# ⚡ QUICK START: RenderHub Image-to-3D

Get up and running in **~10 minutes** with three simple terminals.

## Prerequisites

- Node.js 18+ (`node --version`)
- Python 3.10+ (`python --version`)
- ~15GB disk for TripoSR model

## 🚀 Start In 3 Steps

### Terminal 1: Frontend (Port 5500)

```bash
cd renderHub/3d-editor
npx http-server . -p 5500 --cors
```

**Expected output:**
```
Starting up http-server, serving .
...
Hit CTRL-C to stop the server
http://127.0.0.1:5500
```

### Terminal 2: Backend (Port 8787)

```bash
cd renderHub/ai-server

# First time: install & configure
npm install
cp .env.example .env  # Or keep default

# Start server
npm run dev
```

**Expected output:**
```
Server listening on http://localhost:8787
Mode: upstream
```

### Terminal 3: TripoSR Engine (Port 9000)

```bash
cd renderHub/ai-server/tripo-sr-wrapper

# First time: setup Python environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install TripoSR (downloads ~5GB model, takes ~5-10 min)
pip install -r requirements.txt
pip install git+https://github.com/VAST-AI-Research/Tripo-SR.git@main

# Start service
python app.py
```

**Expected output:**
```
🖥️  Device:     CUDA GPU (NVIDIA RTX 3090)
🎯 Model:      default
🌐 Server:     http://127.0.0.1:9000

Starting server...
```

Or on CPU:
```
🖥️  Device:     CPU (inference will be slow)
```

## 🎨 Use RenderHub

1. **Open browser:** `http://localhost:5500`
2. **See the 3D editor** with canvas, scene hierarchy, properties panel
3. **Click "Image→3D AI"** button or drag an image onto canvas
4. **Select a `.jpg` or `.png`**
5. **Wait:** 15-45 seconds (GPU) or 5-15 minutes (CPU) for inference
6. **See 3D model** imported into editor!

## ✅ Validate Setup

```bash
# One-command check (Bash on macOS/Linux)
bash validate-setup.sh

# Or PowerShell (Windows)
powershell -ExecutionPolicy Bypass .\validate-setup.ps1
```

Should show:
```
[5/5] Network Connectivity
─────────────────────────────────────
Testing Backend → TripoSR routing... ✓

✓ All systems operational!
```

## 🔧 Configuration

### Frontend Finds Backend Automatically

Default: `http://127.0.0.1:8787/api`

Override via **browser DevTools Console**:
```javascript
localStorage.setItem('renderhub.aiBaseUrl', 'http://192.168.1.100:8787/api');
window.location.reload();
```

### Backend Configuration (`.env`)

Already configured with TripoSR defaults:
```bash
AI3D_MODE=upstream
AI3D_UPSTREAM_CREATE_URL=http://127.0.0.1:9000/api/v1/image-to-3d
AI3D_UPSTREAM_STATUS_URL=http://127.0.0.1:9000/api/v1/jobs/{jobId}
```

## 📊 What's Happening?

```
You drag image
        │
        ▼
   Frontend converts to base64
        │
        ▼
   Sends to Node.js backend (8787)
        │
        ▼
   Backend creates job ID, delegates to TripoSR (9000)
        │
        ▼
   TripoSR runs GPU inference
   ├─ Preprocess image
   ├─ Neural network (15-45s)
   ├─ Generate mesh
   └─ Export to GLB
        │
        ▼
   Frontend polls backend for status
        │
        ▼
   Backend returns glbUrl
        │
        ▼
   Frontend loads GLB into Three.js scene
        │
        ▼
   You see 3D model! 🎉
```

## ⏱️ Performance

| Device | Time | Notes |
|--------|------|-------|
| **GPU RTX 4090** | 15-30s | ⚡ Recommended |
| **GPU RTX 3090** | 20-45s | Fast |
| **GPU RTX 2060** | 60-120s | Slower |
| **CPU (i7)** | 5-15 min | ⚠️ Testing only |

## 🛠️ Troubleshooting

**Q: "fetch failed" in browser console**

A: Check TripoSR is running:
```bash
curl http://127.0.0.1:9000/api/v1/health
```

**Q: "Port 8787 in use"**

A: Kill old process:
```bash
# macOS/Linux
lsof -i :8787 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Windows (PowerShell)
Get-Process | Where-Object {$_.Handles -eq (netstat -ano | grep :8787).split()[4]} | Stop-Process
```

**Q: "CUDA out of memory"**

A: For testing on smaller GPU:
```bash
# Reduce image size in env
export MAX_IMAGE_SIZE=512
python app.py
```

Or use CPU (slow but works):
```bash
export DEVICE=cpu
python app.py
```

**Q: Python "ModuleNotFoundError: No module named 'tsr'"**

A: Install TripoSR:
```bash
pip install git+https://github.com/VAST-AI-Research/Tripo-SR.git@main
```

## 📚 Full Documentation

- **Deep dive:** [README.md](./README.md)
- **Backend setup:** [ai-server/README.md](./ai-server/README.md)
- **TripoSR details:** [ai-server/tripo-sr-wrapper/README.md](./ai-server/tripo-sr-wrapper/README.md)
- **Production deploy:** [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🌍 Deploy to VPS

Want to put this on a real server for production?

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step Hostinger GPU VPS setup.

Estimated cost: **~$300/month** for RTX 4090 + 32GB RAM

## 🎯 Next

Once you've tested locally:

1. **Try different images** (cars, animals, products, furniture)
2. **Fine-tune settings** (quality, size, etc.)
3. **Deploy to VPS** if you want public access
4. **Add authentication** if building for users
5. **Monitor performance** (latency, GPU usage)

---

**Status:** ✅ Ready to use  
**Date:** 2026-03-17  
**Support:** See [README.md](./README.md) or [ai-server/README.md](./ai-server/README.md)
