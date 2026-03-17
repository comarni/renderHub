"""
TripoSR Image-to-3D Wrapper
Converts images to 3D models using TripoSR neural network.
GPU acceleration recommended; CPU fallback available (slow).
"""

import os
import sys
import json
import uuid
import base64
import traceback
import threading
import time
from io import BytesIO
from pathlib import Path
from datetime import datetime

import torch
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

# Import TripoSR (will be installed via pip)
try:
    from tsr.models import TripoSRModel
    TRIPO_AVAILABLE = True
except ImportError:
    TRIPO_AVAILABLE = False
    print("⚠️  TripoSR not installed. Install with: pip install tripo")

# Configuration
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
PORT = int(os.getenv('PORT', 9000))
DEVICE = os.getenv('DEVICE', 'cuda' if torch.cuda.is_available() else 'cpu')
MODEL_NAME = os.getenv('MODEL_NAME', 'default')  # 'default' or specific TripoSR version
OUTPUT_FORMAT = os.getenv('OUTPUT_FORMAT', 'glb')  # 'glb' or 'obj'
MAX_IMAGE_SIZE = int(os.getenv('MAX_IMAGE_SIZE', 1024))  # pixels
JOB_TIMEOUT = int(os.getenv('JOB_TIMEOUT', 300))  # seconds

# State
app = Flask(__name__)
CORS(app)

model = None  # Global TripoSR model (lazy load)
jobs = {}  # {jobId: {status, image_path, result, error, timestamp}}
jobs_lock = threading.Lock()

# Ensure output directory exists
OUTPUT_DIR = Path(__file__).parent / 'outputs'
OUTPUT_DIR.mkdir(exist_ok=True)


def get_device():
    """Detect and report device."""
    if torch.cuda.is_available():
        return 'cuda', f"CUDA GPU ({torch.cuda.get_device_name(0)})"
    return 'cpu', "CPU (inference will be slow)"


def load_model():
    """Lazy-load TripoSR model on first use."""
    global model
    if model is not None:
        return model
    
    if not TRIPO_AVAILABLE:
        raise RuntimeError("TripoSR not available. See README for installation.")
    
    print(f"📦 Loading TripoSR model on {DEVICE}...")
    try:
        # Initialize model
        model = TripoSRModel(device=DEVICE)
        print(f"✓ TripoSR model loaded successfully")
        return model
    except Exception as e:
        print(f"❌ Failed to load TripoSR: {e}")
        raise


def preprocess_image(image_file_or_base64, max_size=MAX_IMAGE_SIZE):
    """
    Load and preprocess image.
    Accepts: PIL Image, file path, or base64 string.
    Returns: PIL Image in RGB mode.
    """
    try:
        if isinstance(image_file_or_base64, str) and image_file_or_base64.startswith('data:'):
            # Base64 data URL
            _, data = image_file_or_base64.split(',', 1)
            img = Image.open(BytesIO(base64.b64decode(data)))
        elif isinstance(image_file_or_base64, str):
            # Base64 raw or file path
            try:
                img = Image.open(image_file_or_base64)
            except:
                img = Image.open(BytesIO(base64.b64decode(image_file_or_base64)))
        else:
            img = image_file_or_base64
        
        # Convert to RGB
        if img.mode != 'RGB':
            if img.mode == 'RGBA':
                bg = Image.new('RGB', img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[3] if len(img.split()) > 3 else None)
                img = bg
            else:
                img = img.convert('RGB')
        
        # Resize if necessary
        if max(img.size) > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        return img
    except Exception as e:
        raise ValueError(f"Image preprocessing failed: {e}")


def TripoSR_inference(image, job_id):
    """
    Run TripoSR inference on image.
    Updates job state with result or error.
    """
    try:
        with jobs_lock:
            jobs[job_id]['status'] = 'processing'
        
        print(f"[{job_id}] Starting inference...")
        
        # Load model if not already loaded
        tripo_model = load_model()
        
        # Preprocess
        img_pil = preprocess_image(image)
        print(f"[{job_id}] Image loaded: {img_pil.size}")
        
        # Convert PIL to tensor
        img_array = np.array(img_pil, dtype=np.float32) / 255.0
        img_tensor = torch.from_numpy(img_array).permute(2, 0, 1).unsqueeze(0).to(DEVICE)
        
        # Inference
        print(f"[{job_id}] Running TripoSR inference on {DEVICE}...")
        with torch.no_grad():
            vertices, faces, features = tripo_model.inference(img_tensor)
        
        print(f"[{job_id}] Inference complete: {len(vertices)} vertices, {len(faces)} faces")
        
        # Export to GLB
        output_path = OUTPUT_DIR / f"{job_id}.{OUTPUT_FORMAT}"
        print(f"[{job_id}] Exporting to {OUTPUT_FORMAT}: {output_path}")
        
        if OUTPUT_FORMAT == 'glb':
            # Simple PLY → GLB export (requires trimesh)
            try:
                import trimesh
                mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
                mesh.export(str(output_path))
            except ImportError:
                # Fallback: Save as OBJ then mention missing trimesh
                print(f"⚠️  trimesh not installed; mesh may have limited format support")
                output_path = OUTPUT_DIR / f"{job_id}.obj"
                # Basic OBJ export
                with open(output_path, 'w') as f:
                    for v in vertices:
                        f.write(f"v {v[0]} {v[1]} {v[2]}\n")
                    for face in faces:
                        f.write(f"f {face[0]+1} {face[1]+1} {face[2]+1}\n")
        else:
            # OBJ export
            with open(output_path, 'w') as f:
                for v in vertices:
                    f.write(f"v {v[0]} {v[1]} {v[2]}\n")
                for face in faces:
                    f.write(f"f {face[0]+1} {face[1]+1} {face[2]+1}\n")
        
        # Store result
        with jobs_lock:
            jobs[job_id].update({
                'status': 'succeeded',
                'result': {
                    'glbUrl': f'http://127.0.0.1:{PORT}/outputs/{job_id}.{OUTPUT_FORMAT}',
                    'meta': {
                        'service': 'tripo-sr',
                        'device': DEVICE,
                        'vertices': int(len(vertices)),
                        'faces': int(len(faces)),
                        'inference_time_s': time.time() - jobs[job_id]['started_at']
                    }
                },
                'error': None
            })
        
        print(f"[{job_id}] ✓ Success")
        
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"[{job_id}] ❌ Error: {error_msg}")
        print(traceback.format_exc())
        
        with jobs_lock:
            jobs[job_id].update({
                'status': 'failed',
                'result': None,
                'error': error_msg
            })


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    device, device_str = get_device()
    return jsonify({
        'ok': TRIPO_AVAILABLE,
        'service': 'tripo-sr-wrapper',
        'port': PORT,
        'device': device_str,
        'model': MODEL_NAME,
        'timestamp': datetime.utcnow().isoformat()
    }), 200 if TRIPO_AVAILABLE else 503


@app.route('/api/v1/health', methods=['GET'])
def api_health():
    """Compatibility endpoint for ai-server."""
    device, device_str = get_device()
    return jsonify({
        'ok': TRIPO_AVAILABLE,
        'service': 'tripo-sr-wrapper',
        'port': PORT,
        'device': device_str
    }), 200 if TRIPO_AVAILABLE else 503


@app.route('/api/v1/image-to-3d', methods=['POST'])
def create_job():
    """
    Create a new Image→3D job.
    
    Body: {
        "image": "<base64 or file>",
        "imageBase64": "<base64 string>",
        "prompt": "<optional description>",
        "fileName": "<optional original name>"
    }
    
    Returns: {
        "jobId": "<uuid>",
        "status": "queued"
    }
    """
    if not TRIPO_AVAILABLE:
        return jsonify({'error': 'TripoSR not available'}), 503
    
    try:
        # Get image from request
        if 'image' in request.files:
            image = request.files['image']
        elif request.is_json and isinstance(request.json, dict) and 'image' in request.json:
            image = request.json['image']
        elif request.is_json and isinstance(request.json, dict) and 'imageBase64' in request.json:
            image = request.json['imageBase64']
        else:
            return jsonify({'error': 'Missing image/imageBase64 field'}), 400
        
        # Create job
        job_id = str(uuid.uuid4())
        with jobs_lock:
            jobs[job_id] = {
                'status': 'queued',
                'result': None,
                'error': None,
                'started_at': time.time(),
                'meta': {
                    'prompt': request.json.get('prompt', '') if request.is_json else ''
                }
            }
        
        print(f"[{job_id}] Job created")
        
        # Start inference in background thread
        thread = threading.Thread(
            target=TripoSR_inference,
            args=(image, job_id),
            daemon=True
        )
        thread.start()
        
        return jsonify({
            'jobId': job_id,
            'status': 'queued'
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/v1/jobs/<job_id>', methods=['GET'])
def get_job_status(job_id):
    """
    Get job status and result.
    
    Returns: {
        "jobId": "<uuid>",
        "status": "queued|processing|succeeded|failed",
        "result": { "glbUrl": "...", "meta": {...} },
        "error": "<error message if failed>"
    }
    """
    with jobs_lock:
        if job_id not in jobs:
            return jsonify({'error': 'Job not found'}), 404
        
        job = jobs[job_id].copy()
    
    glb_url = None
    if isinstance(job.get('result'), dict):
        glb_url = job['result'].get('glbUrl')

    response = {
        'jobId': job_id,
        'status': job['status'],
        'glbUrl': glb_url,
        'result': job['result'],
        'error': job['error']
    }
    
    return jsonify(response), 200


@app.route('/outputs/<filename>', methods=['GET'])
def serve_output(filename):
    """Serve generated GLB/OBJ files."""
    file_path = OUTPUT_DIR / filename
    if not file_path.exists():
        return jsonify({'error': 'File not found'}), 404
    
    from flask import send_file
    return send_file(file_path, as_attachment=True)


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': f'Server error: {str(e)}'}), 500


if __name__ == '__main__':
    # Report startup info
    device, device_str = get_device()
    print(f"""
╔════════════════════════════════════════════════════════════╗
║           TripoSR Image-to-3D Wrapper Server              ║
╚════════════════════════════════════════════════════════════╝

🖥️  Device:     {device_str}
🎯 Model:      {MODEL_NAME}
📁 Output:     {OUTPUT_DIR}
🌐 Server:     http://127.0.0.1:{PORT}

Endpoints:
  POST   /api/v1/image-to-3d      → create job
  GET    /api/v1/jobs/<jobId>     → status
  GET    /health                  → health check
  GET    /outputs/<file>          → download mesh

Starting server...
""")
    
    app.run(host='127.0.0.1', port=PORT, debug=DEBUG, threaded=True)
