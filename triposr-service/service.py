import asyncio
import base64
import json
import os
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

import trimesh
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

PORT = int(os.getenv('TRIPOSR_SERVICE_PORT', '9000'))
ROOT = Path(__file__).resolve().parent
OUTPUT_ROOT = Path(os.getenv('TRIPOSR_OUTPUT_DIR', ROOT / 'outputs')).resolve()
TRIPOSR_REPO = Path(os.getenv('TRIPOSR_REPO_PATH', ROOT / 'TripoSR')).resolve()
TRIPOSR_PYTHON = os.getenv('TRIPOSR_PYTHON_BIN', sys.executable)
TRIPOSR_BAKE_TEXTURE = os.getenv('TRIPOSR_BAKE_TEXTURE', '1') == '1'
TRIPOSR_MC_RESOLUTION = os.getenv('TRIPOSR_MC_RESOLUTION', '256')
TRIPOSR_DEVICE = os.getenv('TRIPOSR_DEVICE', 'cuda')

OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

app = FastAPI(title='RenderHub TripoSR Service')
app.mount('/outputs', StaticFiles(directory=str(OUTPUT_ROOT)), name='outputs')

jobs: dict[str, dict] = {}


class ImageTo3DRequest(BaseModel):
    imageBase64: str
    fileName: str = 'image.png'
    prompt: str = ''


@app.get('/api/v1/health')
def health():
    return {
        'ok': True,
        'service': 'renderhub-triposr-service',
        'port': PORT,
        'triposrRepo': str(TRIPOSR_REPO),
        'python': TRIPOSR_PYTHON,
        'device': TRIPOSR_DEVICE,
        'repoExists': TRIPOSR_REPO.exists(),
    }


@app.post('/api/v1/image-to-3d', status_code=202)
async def create_job(payload: ImageTo3DRequest):
    if not payload.imageBase64:
        raise HTTPException(status_code=400, detail='imageBase64 is required')

    job_id = str(uuid.uuid4())
    job_dir = OUTPUT_ROOT / job_id
    input_dir = job_dir / 'input'
    input_dir.mkdir(parents=True, exist_ok=True)

    input_name = sanitize_filename(payload.fileName)
    input_path = input_dir / input_name
    input_path.write_bytes(base64.b64decode(payload.imageBase64))

    jobs[job_id] = {
        'jobId': job_id,
        'status': 'queued',
        'prompt': payload.prompt,
        'fileName': payload.fileName,
        'inputPath': str(input_path),
        'outputDir': str(job_dir),
        'createdAt': iso_now(),
        'updatedAt': iso_now(),
        'glbUrl': None,
        'error': None,
    }

    asyncio.create_task(run_job(job_id, input_path, job_dir))
    return {'jobId': job_id, 'status': 'queued'}


@app.get('/api/v1/jobs/{job_id}')
def get_job(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    return {
        'jobId': job['jobId'],
        'status': job['status'],
        'glbUrl': job['glbUrl'],
        'error': job['error'],
        'createdAt': job['createdAt'],
        'updatedAt': job['updatedAt'],
    }


async def run_job(job_id: str, input_path: Path, job_dir: Path):
    job = jobs[job_id]
    job['status'] = 'running'
    job['updatedAt'] = iso_now()

    if not TRIPOSR_REPO.exists():
        job['status'] = 'failed'
        job['error'] = f'TRIPOSR_REPO_PATH does not exist: {TRIPOSR_REPO}'
        job['updatedAt'] = iso_now()
        return

    try:
        output_dir = job_dir / 'triposr-output'
        output_dir.mkdir(parents=True, exist_ok=True)

        cmd = [
            TRIPOSR_PYTHON,
            'run.py',
            str(input_path),
            '--output-dir',
            str(output_dir),
            '--mc-resolution',
            str(TRIPOSR_MC_RESOLUTION),
        ]
        if TRIPOSR_BAKE_TEXTURE:
            cmd.append('--bake-texture')

        env = os.environ.copy()
        env['PYTHONUNBUFFERED'] = '1'
        env['CUDA_VISIBLE_DEVICES'] = env.get('CUDA_VISIBLE_DEVICES', '0' if TRIPOSR_DEVICE == 'cuda' else '')

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(TRIPOSR_REPO),
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        print(f"[{job_id}] Running: {' '.join(cmd)}")
        stdout_task = asyncio.create_task(stream_subprocess_output(proc.stdout, job_id, 'stdout'))
        stderr_task = asyncio.create_task(stream_subprocess_output(proc.stderr, job_id, 'stderr'))
        returncode = await proc.wait()
        stdout = await stdout_task
        stderr = await stderr_task

        log_payload = {
            'cmd': cmd,
            'stdout': stdout.decode('utf-8', errors='ignore'),
            'stderr': stderr.decode('utf-8', errors='ignore'),
            'returncode': returncode,
        }
        (job_dir / 'run-log.json').write_text(json.dumps(log_payload, indent=2), encoding='utf-8')

        if returncode != 0:
            raise RuntimeError(f'TripoSR failed with code {returncode}')

        mesh_path = find_mesh_file(output_dir)
        if not mesh_path:
            raise RuntimeError('No mesh output found in TripoSR output dir')

        glb_path = job_dir / 'model.glb'
        convert_to_glb(mesh_path, glb_path)

        job['status'] = 'succeeded'
        job['glbUrl'] = f'http://127.0.0.1:{PORT}/outputs/{job_id}/model.glb'
        job['updatedAt'] = iso_now()
    except Exception as exc:
        job['status'] = 'failed'
        job['error'] = str(exc)
        job['updatedAt'] = iso_now()


def find_mesh_file(output_dir: Path) -> Path | None:
    candidates = []
    for ext in ('*.glb', '*.gltf', '*.obj', '*.ply', '*.stl'):
        candidates.extend(output_dir.rglob(ext))
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]


def convert_to_glb(source_path: Path, glb_path: Path):
    if source_path.suffix.lower() == '.glb':
        shutil.copyfile(source_path, glb_path)
        return

    scene = trimesh.load(str(source_path), force='scene')
    glb_bytes = scene.export(file_type='glb')
    glb_path.write_bytes(glb_bytes)


def sanitize_filename(name: str) -> str:
    clean = ''.join(ch for ch in name if ch.isalnum() or ch in ('-', '_', '.')).strip('.')
    return clean or 'image.png'


async def stream_subprocess_output(stream, job_id: str, stream_name: str) -> str:
    """Stream child process output to terminal while collecting it for logs."""
    if stream is None:
        return ''

    chunks: list[str] = []
    while True:
        line = await stream.readline()
        if not line:
            break
        text = line.decode('utf-8', errors='ignore').rstrip()
        chunks.append(text + '\n')
        print(f'[{job_id}] [{stream_name}] {text}')

    return ''.join(chunks)


def iso_now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=PORT)
