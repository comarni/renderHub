# TripoSR Service

Servicio FastAPI para exponer un motor Image-to-3D real basado en TripoSR.

## Qué hace

- Recibe una imagen en base64.
- Ejecuta TripoSR localmente.
- Busca la malla generada.
- Convierte la salida a GLB.
- Expone una API compatible con RenderHub:
  - `POST /api/v1/image-to-3d`
  - `GET /api/v1/jobs/{jobId}`

## Requisitos reales

- Python 3.10+
- GPU NVIDIA recomendada
- CUDA compatible con tu build de PyTorch
- Repo TripoSR clonado localmente

Repositorio del motor:
- https://github.com/VAST-AI-Research/TripoSR

## Instalación recomendada

1. Clona TripoSR dentro de esta carpeta o en otra ruta:

```bash
git clone https://github.com/VAST-AI-Research/TripoSR.git
```

2. Crea entorno virtual e instala dependencias del servicio:

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
```

3. Instala dependencias de TripoSR según su README.

4. Configura variables de entorno:

```bash
set TRIPOSR_REPO_PATH=C:\ruta\a\TripoSR
set TRIPOSR_PYTHON_BIN=C:\ruta\a\python.exe
set TRIPOSR_SERVICE_PORT=9000
set TRIPOSR_BAKE_TEXTURE=1
set TRIPOSR_MC_RESOLUTION=256
```

5. Arranca el servicio:

```bash
python service.py
```

6. Health:

```bash
curl http://127.0.0.1:9000/api/v1/health
```

## Integración con RenderHub

En [ai-server/.env.example](../ai-server/.env.example) o tu `.env`:

```env
AI3D_MODE=upstream
AI3D_UPSTREAM_CREATE_URL=http://127.0.0.1:9000/api/v1/image-to-3d
AI3D_UPSTREAM_STATUS_URL=http://127.0.0.1:9000/api/v1/jobs/{jobId}
AI3D_UPSTREAM_RESULT_FIELD=glbUrl
```

## Notas prácticas

- Sin GPU, TripoSR puede ser demasiado lento para uso interactivo.
- El servicio demo actual en `ai-server/upstream-demo-server.js` sirve solo para validar flujo remoto, no para reconstrucción real.
- Si quieres producción, monta este servicio detrás de PM2/systemd + reverse proxy.
