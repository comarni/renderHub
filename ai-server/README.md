# RenderHub AI Server

Backend proxy para el pipeline **Image-to-3D** de RenderHub.

Convierte imágenes a modelos 3D delegando el procesamiento a un motor real (TripoSR, Replicate, etc.) y manejando la cola de trabajos con polling.

## Modos de Operación

| Modo | Propósito | Setup |
|------|---------|-------|
| `mock` | Demo; retorna modelos pre-hechos | Sin dependencias |
| `upstream` | Proxy real (TripoSR/Replicate/HF) | Configurable vía `.env` |

## Quick Start

### 1. Setup Local Node.js

```bash
# Instala dependencias
npm install

# Copia y configura .env
cp .env.example .env
# Edita .env si es necesario (default: mock)

# Arranca servidor
npm run dev
# Server listening on http://localhost:8787
```

### 2. Arranca TripoSR (en otra terminal)

**Opción A: Python Local (GPU recomendado)**

```bash
cd tripo-sr-wrapper

# Crea venv (opcional)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instala dependencias
pip install -r requirements.txt
pip install git+https://github.com/VAST-AI-Research/Tripo-SR.git@main

# Arranca servidor
python app.py
# Server listening on http://127.0.0.1:9000
```

**Opción B: Docker (GPU via nvidia-docker)**

```bash
cd tripo-sr-wrapper

# Build image
docker build -t tripo-sr-wrapper --build-arg BUILD_MODE=gpu .

# Run with GPU
docker run -d --name tripo-sr -p 9000:9000 --gpus all tripo-sr-wrapper

# Check logs
docker logs -f tripo-sr
```

### 3. Configura Backend para TripoSR

Edita `ai-server/.env`:

```bash
AI3D_MODE=upstream
AI3D_UPSTREAM_CREATE_URL=http://127.0.0.1:9000/api/v1/image-to-3d
AI3D_UPSTREAM_STATUS_URL=http://127.0.0.1:9000/api/v1/jobs/{jobId}
AI3D_UPSTREAM_RESULT_FIELD=glbUrl
```

Reinicia el backend:

```bash
npm run dev
```

### 4. Valida Integración

Health check:

```bash
curl http://localhost:8787/api/ai/health
# Response: {"ok":true,"mode":"upstream","service":"ai-server",...}
```

Test image → 3D:

```bash
curl -X POST http://localhost:8787/api/ai/image-to-3d \
  -H "Content-Type: application/json" \
  -d '{"image":"<base64PNG>"}'
# Response: {"jobId":"...","status":"queued"}
```

Poll job:

```bash
curl http://localhost:8787/api/ai/image-to-3d/{jobId}
# Response: {"jobId":"...","status":"succeeded","result":{"glbUrl":"..."},...}
```

### 5. Usa en RenderHub Editor

- Abre `http://127.0.0.1:5500` (frontend)
- Haz drag-drop de imagen en canvas
- Backend procesa vía TripoSR → devuelve modelo 3D real

## Configuración Detallada

### Variables de Entorno (.env)

```bash
# Server
PORT=8787
DEBUG=false
CORS_ORIGIN=*

# Modo
AI3D_MODE=upstream  # 'mock' o 'upstream'

# Upstream (real 3D engine)
AI3D_UPSTREAM_CREATE_URL=http://127.0.0.1:9000/api/v1/image-to-3d
AI3D_UPSTREAM_STATUS_URL=http://127.0.0.1:9000/api/v1/jobs/{jobId}
AI3D_UPSTREAM_RESULT_FIELD=glbUrl

# API Key (si usa Replicate/HF)
AI3D_API_KEY=<token>

# Polling
AI3D_JOB_POLL_INTERVAL_MS=2500
AI3D_JOB_MAX_POLLS=120  # 120 × 2.5s = 300s timeout
AI3D_JOB_TIMEOUT_S=300
```

## Motores Soportados

### TripoSR (Recomendado)

**Ventajas:** Open-source, sin costo, GPU accelerado, variable-geometry meshes  
**Desventajas:** Requiere GPU (~6GB VRAM), setup local

**Setup:** Ver [tripo-sr-wrapper/README.md](tripo-sr-wrapper/README.md)

**Performance:**
- GPU (RTX 3090): 15-45s por imagen
- GPU (RTX 2060): 60-120s por imagen
- CPU: 5-15 min por imagen (no recomendado)

### Replicate (Cloud)

**Ventajas:** Sin instalación, escalable, soporte técnico  
**Desventajas:** Pagado (~$0.0005/img), depende de API

**Setup:**

```bash
# 1. Crea cuenta en https://replicate.com
# 2. Obtén API token
# 3. Instala cliente
pip install replicate

# 4. Edita .env
AI3D_MODE=upstream
AI3D_API_KEY=r8_<token>
AI3D_UPSTREAM_CREATE_URL=https://api.replicate.com/v1/predictions
# (detalles en Replicate API docs para imagen→3D)
```

### Hugging Face Inference

**Ventajas:** Gratis con límite, muchos modelos  
**Desventajas:** Límites de rate, cola en picos

**Setup:**

```bash
# 1. Crea cuenta https://huggingface.co
# 2. Obtén token en Settings → Access Tokens
# 3. Edita .env
AI3D_API_KEY=hf_<token>
```

### Demo (Desarrollo)

Para testing sin GPU real:

```bash
npm run demo-upstream
# Arranca servidor en puerto 9000 (retorna GLBs Khronos como demostración)
```

## API Reference

### Health

```http
GET /api/ai/health
```

**Response:**
```json
{
  "ok": true,
  "mode": "upstream",
  "service": "ai-server",
  "upstream": "http://127.0.0.1:9000/api/v1",
  "timestamp": "2024-03-17T12:00:00Z"
}
```

### Create Job

```http
POST /api/ai/image-to-3d
Content-Type: application/json

{
  "image": "<base64PNG/JPG>",
  "prompt": "car"
}
```

**Response:**
```json
{
  "jobId": "a1b2c3d4-...",
  "status": "queued"
}
```

### Get Status

```http
GET /api/ai/image-to-3d/{jobId}
```

**Processing:**
```json
{
  "jobId": "...",
  "status": "processing",
  "result": null,
  "error": null
}
```

**Success:**
```json
{
  "jobId": "...",
  "status": "succeeded",
  "result": {
    "glbUrl": "http://127.0.0.1:9000/outputs/a1b2c3d4-....glb",
    "meta": {"service":"tripo-sr","device":"cuda",...}
  },
  "error": null
}
```

**Failure:**
```json
{
  "jobId": "...",
  "status": "failed",
  "result": null,
  "error": "RuntimeError: CUDA out of memory"
}
```

## Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| `"fetch failed"` en frontend | Upstream no responde | Valida que TripoSR está corriendo: `curl http://127.0.0.1:9000/api/v1/health` |
| Backend retorna 503 | Mode=mock (default) | Escribe `.env` con `AI3D_MODE=upstream` y reinicia |
| "CUDA out of memory" | Imagen muy grande o GPU insuficiente | Reduce `MAX_IMAGE_SIZE` en TripoSR o usa CPU |
| Port 8787 in use | Otro proceso en puerto | `pm2 stop ai-server` o `kill -9 <pid>` |

## Deployment

### VPS (Recomendado: GPU A100/RTX3090)

Ver [../DEPLOYMENT.md](../DEPLOYMENT.md) para:
- Hostinger GPU VPS setup
- PM2 process manager
- Nginx reverse proxy
- Certificados SSL

### Docker Compose (Local Development)

```yaml
version: '3'
services:
  ai-server:
    build: .
    ports:
      - "8787:8787"
    environment:
      AI3D_MODE: upstream
      AI3D_UPSTREAM_CREATE_URL: http://tripo-sr:9000/api/v1/image-to-3d
      AI3D_UPSTREAM_STATUS_URL: http://tripo-sr:9000/api/v1/jobs/{jobId}

  tripo-sr:
    build: ./tripo-sr-wrapper
    ports:
      - "9000:9000"
    environment:
      DEVICE: cuda
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

Run:
```bash
docker-compose up -d
```

## Archivos

```
ai-server/
├── .env                          # Variables de entorno (NO commitear)
├── .env.example                  # Plantilla (SI commitear)
├── package.json                  # Dependencies Node.js
├── server.js                     # Express backend
├── upstream-demo-server.js       # Demo upstream (puerto 9000)
├── README.md                     # Este archivo
│
└── tripo-sr-wrapper/
    ├── app.py                    # Flask + TripoSR
    ├── Dockerfile                # Multi-stage GPU/CPU
    ├── requirements.txt          # Python dependencies
    ├── README.md                 # TripoSR setup detallado
    └── outputs/                  # Generated GLBs
```

## Próximos Pasos

- [ ] Agregar Rate Limiting (evitar abuso)
- [ ] Webhook callbacks (notificar al cliente cuando esté listo)
- [ ] Metrics & monitoring (Prometheus)
- [ ] WebSocket support (polling en tiempo real)
- [ ] Multi-GPU load balancing

## Referencias

- [TripoSR GitHub](https://github.com/VAST-AI-Research/Tripo-SR)
- [Replicate API](https://replicate.com/docs)
- [Hugging Face Inference](https://huggingface.co/docs/hub/models-inference)

---

**Last Updated:** 2026-03-17  
**Status:** Production-ready with GPU support ✓
