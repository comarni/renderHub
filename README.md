# RenderHub 3D Editor + Image-to-3D AI Pipeline

A full-stack 3D editor with AI-powered image-to-3D model generation using **TripoSR**.

- 🎨 **3D Editor**: WebGL-based editor with cameras, materials, transforms, and object import
- 🧠 **Image-to-3D AI**: Convert images to 3D models via TripoSR + neural network inference
- 💻 **Backend**: Node.js proxy + Python TripoSR wrapper
- 🚀 **Production-Ready**: Docker support, GPU acceleration, deployment guides

## Quick Start (Local Development)

Get everything running in ~10 minutes:

### 1. Frontend (3D Editor)

```bash
cd renderHub/3d-editor
npx http-server . -p 5500 --cors
# Open: http://localhost:5500
```

### 2. AI Backend (Node.js)

```bash
cd renderHub/ai-server

# Setup
rm -f .env  # Clear any old config
cp .env.example .env

# Edit .env for TripoSR (or keep default mock)
nano .env
# Should have:
# AI3D_MODE=upstream
# AI3D_UPSTREAM_CREATE_URL=http://127.0.0.1:9000/api/v1/image-to-3d

# Install & run
npm install
npm run dev
# Available: http://localhost:8787/api/ai/health
```

### 3. TripoSR Python Service (Image-to-3D)

```bash
cd renderHub/ai-server/tripo-sr-wrapper

# Create virtual env
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies (~5 min, downloads 6GB model)
pip install -r requirements.txt
pip install git+https://github.com/VAST-AI-Research/Tripo-SR.git@main

# Start (auto-detects GPU or uses CPU)
python app.py
# Available: http://127.0.0.1:9000/api/v1/health
```

### 4. Test Integration

Open editor @ `http://localhost:5500`:
- Click **"Image→3D AI"** button
- Select an image
- Wait 15-45 seconds (GPU) or 5-15 min (CPU)
- → 3D model loads in editor

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Frontend: 3D Editor (Three.js)                          │
│  - 5500: http-server or live-server                      │
│  - Drag-drop images for AI 3D generation                 │
└────────────┬─────────────────────────────────────────────┘
             │
             │ POST /api/ai/image-to-3d
             │ GET  /api/ai/image-to-3d/{jobId}
             ▼
┌──────────────────────────────────────────────────────────┐
│  Backend: Node.js Express Proxy (ai-server)              │
│  - 8787: Express server                                  │
│  - Handles job queue, polling, upstream delegation       │
└────────────┬─────────────────────────────────────────────┘
             │
             │ POST /api/v1/image-to-3d
             │ GET  /api/v1/jobs/{jobId}
             ▼
┌──────────────────────────────────────────────────────────┐
│  TripoSR Wrapper: Python Flask API                       │
│  - 9000: Flask server                                    │
│  - Neural 3D generation from image                       │
│  - GPU acceleration (CUDA) or CPU fallback               │
└──────────────────────────────────────────────────────────┘
```

## Features

### Three.js Editor (`3d-editor/`)

- **Canvas**: WebGL renderer with perspective/orthographic cameras
- **Gizmos**: Move, rotate, scale objects with transformation handles
- **Import**: Load GLTF, GLB, OBJ, STL models
- **Materials**: Metallic, roughness, normal maps, emissive
- **Lights**: Directional, ambient, point lights with shadows
- **Scene Hierarchy**: Visual tree of objects with quick add buttons

### Image-to-3D Pipeline

**Three import modes:**

1. **Import Model** (`GLTF/GLB/OBJ/STL`): Load pre-made 3D files
2. **Image Plane**: Create a flat plane with image texture
3. **Image→3D AI**: Convert image to 3D model via TripoSR

**Workflow:**
- Drag-drop or click **"Image→3D AI"** button
- Frontend converts image to base64
- `AIImage3DClient.js` sends to backend
- Backend delegates to TripoSR Python service
- TripoSR runs neural inference (15-45s on GPU)
- Returns GLB file URL
- Editor loads and displays 3D model
- **Fallback**: If AI unavailable, uses local relief generation

## File Structure

```
renderHub/
├── 3d-editor/                    # Three.js web editor
│   ├── app.js                    # Bootstrap & event listeners
│   ├── index.html                # UI layout
│   ├── style.css                 # Dark theme styling
│   ├── io/
│   │   ├── ModelImporter.js       # Load models, images, AI 3D
│   │   ├── AIImage3DClient.js     # HTTP client for remote jobs
│   │   └── ImageTo3DGenerator.js  # Local fallback (relief)
│   ├── ui/
│   │   ├── SceneHierarchy.js      # Object list & quick-add
│   │   ├── PropertiesPanel.js     # Material/transform editor
│   │   └── ViewportGizmos.js      # Move/rotate/scale handles
│   ├── lib/
│   │   └── three.min.js           # Three.js library
│   └── assets/                    # Icons, textures
│
├── ai-server/                    # Node.js backend
│   ├── server.js                 # Express app & API endpoints
│   ├── upstream-demo-server.js   # Demo service (Khronos GLBs)
│   ├── .env                      # Configuration (local, .gitignore)
│   ├── .env.example              # Template
│   ├── package.json              # npm dependencies
│   ├── README.md                 # Detailed setup
│   │
│   └── tripo-sr-wrapper/         # Python TripoSR service
│       ├── app.py                # Flask server + inference
│       ├── Dockerfile            # Multi-stage GPU/CPU build
│       ├── requirements.txt      # Python dependencies
│       ├── README.md             # TripoSR-specific docs
│       ├── .env                  # Configuration
│       └── outputs/              # Generated GLB files
│
├── README.md                     # This file
├── DEPLOYMENT.md                 # VPS setup + Hostinger guide
└── ecosystem.config.js           # PM2 process manager config
```

## Configuration

### Frontend Base URL (Backend API)

Frontend auto-detects backend:
1. `window.RENDERHUB_AI_API_BASE` (if set in HTML)
2. `localStorage.renderhub.aiBaseUrl` (if set via console)
3. `http://127.0.0.1:8787/api` (default)

Override via browser console:
```js
localStorage.setItem('renderhub.aiBaseUrl', 'https://api.yourdomain.com')
```

### Backend Configuration (`ai-server/.env`)

See [ai-server/README.md](ai-server/README.md#configuration-detallada) for all options.

Key variables:
```bash
AI3D_MODE=upstream                 # 'mock' or 'upstream'
AI3D_UPSTREAM_CREATE_URL=...       # TripoSR create endpoint
AI3D_UPSTREAM_STATUS_URL=...       # TripoSR status endpoint
CORS_ORIGIN=*                      # CORS allowed origins
```

## Deployment

### Local Development

Run all three services in separate terminals (see Quick Start above).

### Production (VPS/Hostinger)

Complete guide in [DEPLOYMENT.md](DEPLOYMENT.md):

- Provision GPU VPS (Hostinger, AWS, OVH)
- Install NVIDIA drivers & CUDA
- Deploy with PM2 (process manager)
- Configure Nginx reverse proxy
- Setup SSL with Let's Encrypt
- Monitor logs & performance

**Estimated cost:** ~$300-400/month for GPU VPS + domain

## API Endpoints

### Frontend ↔ Backend (Node.js)

```http
GET  /api/ai/health              # Health check
POST /api/ai/image-to-3d         # Create job
GET  /api/ai/image-to-3d/{jobId} # Get job status
```

### Backend ↔ TripoSR (Python)

```http
GET  /api/v1/health               # Health check
POST /api/v1/image-to-3d          # Create job
GET  /api/v1/jobs/{jobId}        # Get job status
GET  /outputs/{filename}          # Download GLB
```

See [ai-server/README.md](ai-server/README.md#api-reference) for full details.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Image drop shows relief, not AI model | TripoSR not responding | Check: `curl http://127.0.0.1:9000/api/v1/health` |
| "fetch failed" in browser console | Backend offline or wrong URL | Verify ai-server running: `curl http://127.0.0.1:8787/api/ai/health` |
| "CUDA out of memory" | GPU insufficient for image size | Reduce `MAX_IMAGE_SIZE` in `.env` |
| Port 8787/9000 in use | Another process on port | `pm2 stop ai-server && pm2 stop tripo-sr` |
| Python "ModuleNotFoundError" | TripoSR not installed | `pip install git+https://github.com/VAST-AI-Research/Tripo-SR.git@main` |

See [ai-server/README.md#troubleshooting](ai-server/README.md#troubleshooting) for more.

## Performance

### GPU (RTX 4090 / RTX 3090)
- Model load: 3-8s (once)
- Inference per image: **15-45 seconds**
- Memory: ~6GB VRAM

### GPU (RTX 2060 / T4)
- Inference per image: 60-120 seconds
- Memory: May run out; requires smaller images

### CPU (Intel i7 / Ryzen 7)
- Inference per image: **5-15 minutes**
- Memory: ~8GB RAM
- ⚠️ Not recommended for production; use for testing only

## TripoSR Neural Network

- **Model**: Stability AI Tripo-SR
- **Input**: Single RGB image (256×2048 pixels)
- **Output**: High-poly mesh (50k-200k vertices)
- **Training**: Diverse 3D dataset (cars, animals, products, furniture)
- **License**: Open weights for research & non-commercial use

**References:**
- [GitHub](https://github.com/VAST-AI-Research/Tripo-SR)
- [Paper](https://arxiv.org/abs/2403.02151)

## Next Steps

1. ✅ Local dev setup
2. [ ] Deploy to Hostinger GPU VPS (see [DEPLOYMENT.md](DEPLOYMENT.md))
3. [ ] Add authentication & rate limiting
4. [ ] Scale to multiple GPU servers
5. [ ] Integrate with user accounts & job history
6. [ ] Add batch processing & scheduled jobs

## Contributing

Fork this repo and submit PRs for:
- Bug fixes
- Performance improvements
- New 3D features (animations, physics)
- Multi-model support (mesh fusion, detail enhancement)
- UI/UX improvements

## License

MIT (see LICENSE file)

## Support

- **Issues**: GitHub Issues
- **Docs**: [ai-server/README.md](ai-server/README.md) | [DEPLOYMENT.md](DEPLOYMENT.md) | [tripo-sr-wrapper/README.md](ai-server/tripo-sr-wrapper/README.md)
- **Community**: GitHub Discussions

---

**Last Updated:** 2026-03-17  
**Status:** Production-ready ✓

## HTML/Three.js Export Workflow

Starter target for generated websites:
- `web-ready/`

One-command export (creates ZIP in `exports/`):

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\export-project.ps1 -SourcePath web-ready -OutName portfolio-cubo
```

## One Click In VS Code

1. Open Command Palette and run: Tasks: Run Task
2. Choose: One Click: Export Portfolio Web
3. The zip is generated in `exports/`

## Public URL

- https://comarni.github.io/renderHub/
