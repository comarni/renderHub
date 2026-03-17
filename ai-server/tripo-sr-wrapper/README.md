# TripoSR Image-to-3D Wrapper

Convert images to 3D models using **TripoSR**, Stability AI's neural 3D reconstruction model.

## Features

- 🧠 **Neural 3D Generation**: Uses TripoSR to create variable-geometry 3D meshes from images
- 🚀 **GPU Acceleration**: CUDA support for fast inference (3-60s per image on RTX3090)
- 💻 **CPU Fallback**: Works on CPU (slower, but functional for testing)
- 🔄 **Async Jobs**: Background processing with polling via job ID
- 📦 **Docker Support**: Ready-to-deploy Docker image with GPU support
- ✅ **API Compatible**: Same endpoints as ai-server upstream interface

## Quick Start

### 1. Local Setup (Python)

**Requirements:**
- Python 3.10+
- CUDA-capable GPU (optional, CPU fallback available)
- ~5GB disk for model weights

**Install:**

```bash
cd tripo-sr-wrapper

# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install TripoSR from GitHub
pip install git+https://github.com/VAST-AI-Research/Tripo-SR.git@main

# Run server
python app.py
```

**Server starts on:** `http://127.0.0.1:9000`

**Detect Device:**
```bash
# GPU (CUDA)
$ python app.py
🖥️  Device:     CUDA GPU (NVIDIA RTX 3090)

# CPU (fallback)
$ python app.py
🖥️  Device:     CPU (inference will be slow)
```

### 2. Docker Setup (Recommended for Production)

**with GPU support (requires nvidia-docker):**

```bash
# Build image
docker build -t tripo-sr-wrapper \
  --build-arg BUILD_MODE=gpu \
  --build-arg CUDA_VERSION=12.1.0 .

# Run container
docker run -d \
  --name tripo-sr \
  -p 9000:9000 \
  --gpus all \
  -v $(pwd)/outputs:/app/outputs \
  tripo-sr-wrapper
```

**CPU only:**

```bash
# Build image
docker build -t tripo-sr-wrapper \
  --build-arg BUILD_MODE=cpu .

# Run container
docker run -d \
  --name tripo-sr \
  -p 9000:9000 \
  -v $(pwd)/outputs:/app/outputs \
  tripo-sr-wrapper
```

## API Reference

### Health Check

```http
GET /api/v1/health
```

**Response:**
```json
{
  "ok": true,
  "service": "tripo-sr-wrapper",
  "port": 9000,
  "device": "CUDA GPU (NVIDIA RTX 3090)"
}
```

### Create Job

```http
POST /api/v1/image-to-3d
Content-Type: application/json

{
  "image": "<base64 encoded PNG/JPG>",
  "prompt": "(optional) car, shoe, etc."
}
```

**Response:**
```json
{
  "jobId": "a1b2c3d4-e5f6-...",
  "status": "queued"
}
```

**Time to first inference:** 1-10 seconds (model load only on first request)

### Get Job Status

```http
GET /api/v1/jobs/{jobId}
```

**Queued/Processing:**
```json
{
  "jobId": "a1b2c3d4-...",
  "status": "processing",
  "result": null,
  "error": null
}
```

**Succeeded:**
```json
{
  "jobId": "a1b2c3d4-...",
  "status": "succeeded",
  "result": {
    "glbUrl": "http://127.0.0.1:9000/outputs/a1b2c3d4-....glb",
    "meta": {
      "service": "tripo-sr",
      "device": "cuda",
      "vertices": 45000,
      "faces": 90000,
      "inference_time_s": 23.4
    }
  },
  "error": null
}
```

**Failed:**
```json
{
  "jobId": "a1b2c3d4-...",
  "status": "failed",
  "result": null,
  "error": "RuntimeError: CUDA out of memory..."
}
```

### Download Mesh

```http
GET /outputs/{filename}
```

Downloads the generated `.glb` or `.obj` file.

## Configuration

Environment variables in `.env`:

```bash
# API Server
PORT=9000                          # Default: 9000
DEBUG=false                        # Flask debug mode

# Model & Device
DEVICE=cuda                        # 'cuda' or 'cpu'
MODEL_NAME=default                 # TripoSR version
OUTPUT_FORMAT=glb                  # 'glb' or 'obj'

# Processing
MAX_IMAGE_SIZE=1024                # Max input resolution (pixels)
JOB_TIMEOUT=300                    # Max job duration (seconds)
```

## Integration with ai-server

Update `ai-server/.env`:

```bash
AI3D_MODE=upstream
AI3D_UPSTREAM_CREATE_URL=http://127.0.0.1:9000/api/v1/image-to-3d
AI3D_UPSTREAM_STATUS_URL=http://127.0.0.1:9000/api/v1/jobs
```

Then drag-drop images in RenderHub 3D Editor to generate real 3D models!

## Performance Notes

### GPU (RTX 3090 / A100)
- Model load: 3-8 seconds (once)
- Inference: 15-45 seconds per image
- Memory: ~6GB VRAM

### GPU (RTX 2060 / MX450)
- Memory may be insufficient; requires smaller batch size
- Inference: 60-120 seconds per image

### CPU (Intel i7 / Ryzen 7)
- Inference: 5-15 minutes per image
- Not recommended for production; use for testing only

## TripoSR Model Details

- **Author:** Stability AI Research
- **Training:** High-quality 3D models from diverse datasets
- **Input:** Single RGB image (256×256 to 2048×2048)
- **Output:** High-poly mesh (50k-200k vertices)
- **License:** Open weights for research/non-commercial

**References:**
- [Tripo-SR GitHub](https://github.com/VAST-AI-Research/Tripo-SR)
- [Paper](https://arxiv.org/abs/2403.02151)

## Troubleshooting

**"ModuleNotFoundError: No module named 'tsr'"**

```bash
# Ensure TripoSR is installed
pip install git+https://github.com/VAST-AI-Research/Tripo-SR.git@main
```

**"CUDA out of memory"**

```bash
# Reduce max image size in .env
MAX_IMAGE_SIZE=512
```

Or use CPU (slower but won't OOM):
```bash
DEVICE=cpu
```

**"Port 9000 already in use"**

```bash
# Change port
PORT=9001 python app.py

# Or kill existing process (Linux/Mac)
lsof -i :9000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

## Next Steps

1. **Deploy to VPS with GPU:** See [Hostinger GPU VPS Setup](../DEPLOYMENT.md)
2. **Monitor inference performance:** Check logs for latency/memory usage
3. **Add request validation:** Image size constraints, format checks
4. **Batch processing:** Multiple images in one request
5. **Model fine-tuning:** Custom datasets for specific object categories

---

**Last Updated:** 2026-03-17  
**Status:** Production-ready ✓
