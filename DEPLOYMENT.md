# RenderHub 3D Editor + AI Backend Deployment Guide

Complete guide to deploy RenderHub with TripoSR Image-to-3D pipeline on a GPU-enabled VPS.

## Table of Contents

1. [Quick Start (Local)](#quick-start-local)
2. [VPS Setup (Hostinger / AWS)](#vps-setup-hostinger--aws)
3. [Production Architecture](#production-architecture)
4. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## Quick Start (Local)

Get everything running on your machine in ~10 minutes (GPU optional).

### Prerequisites

- Node.js 18+
- Python 3.10+
- ~15GB disk space (includes model weights)

### Steps

**Terminal 1: Frontend (static server)**

```bash
cd renderHub/3d-editor
npx http-server . -p 5500 --cors
# Open: http://localhost:5500
```

**Terminal 2: AI Backend (Node.js proxy)**

```bash
cd renderHub/ai-server

# Setup
cp .env.example .env
npm install

# Configure .env (if using TripoSR)
cat > .env << EOF
PORT=8787
AI3D_MODE=upstream
AI3D_UPSTREAM_CREATE_URL=http://127.0.0.1:9000/api/v1/image-to-3d
AI3D_UPSTREAM_STATUS_URL=http://127.0.0.1:9000/api/v1/jobs/{jobId}
AI3D_UPSTREAM_RESULT_FIELD=glbUrl
CORS_ORIGIN=*
EOF

# Start
npm run dev
# Available on: http://localhost:8787/api/ai/health
```

**Terminal 3: TripoSR Wrapper (Python neural 3D)**

```bash
cd renderHub/ai-server/tripo-sr-wrapper

# Setup
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install git+https://github.com/VAST-AI-Research/Tripo-SR.git@main

# Start (auto-detects GPU/CPU)
python app.py
# Available on: http://127.0.0.1:9000/api/v1/health
```

**Validate:**

```bash
# From any terminal
curl http://127.0.0.1:8787/api/ai/health
# Expected: {"ok":true,"mode":"upstream",...}

# Test image → 3D (drag-drop image on frontend)
```

---

## VPS Setup (Hostinger / AWS)

Deploy to a cloud GPU instance for production use.

### Infrastructure Requirements

| Provider | Instance Type | vCPU | RAM | GPU | Disk | Est. Cost |
|----------|---------------|------|-----|-----|------|-----------|
| Hostinger | GPU VPS | 8 | 32GB | RTX 4090 | 500GB NVMe | ~$300/mo |
| AWS | g4dn.xlarge | 4 | 16GB | T4 | 125GB | ~$600/mo |
| OVH | GPU-1 | 16 | 64GB | A100 | 2TB | ~$400/mo |

**Recommendation:** Hostinger GPU offers best value for TripoSR workloads.

### Step 1: Provision VPS

#### Hostinger GPU VPS

1. Log in to [Hostinger.com](https://www.hostinger.com)
2. Navigate to **VPS → Cloud Hosting**
3. Select **GPU VPS** plan with RTX 4090 or RTX 3090
4. Choose **Ubuntu 22.04 LTS**
5. Add SSH key for secure access
6. Deploy instance (~5 min)
7. Note IP: `<your-vps-ip>`

#### AWS EC2 (Alternative)

```bash
# Via AWS CLI
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type g4dn.xlarge \
  --key-name my-key \
  --security-groups default \
  --region us-east-1

# Wait for instance to initialize (~2 min)
```

### Step 2: SSH Into VPS

```bash
# Replace <your-vps-ip> with actual IP from provider
ssh root@<your-vps-ip>

# For AWS (may require different user)
ssh -i my-key.pem ubuntu@<your-vps-ip>
```

### Step 3: System Setup

```bash
# Update packages
apt update && apt upgrade -y

# Install dependencies
apt install -y \
  curl \
  wget \
  git \
  build-essential \
  python3.10 \
  python3.10-dev \
  python3-pip \
  nodejs \
  npm

# Verify versions
node --version     # v18+
python3 --version  # 3.10+
```

### Step 4: Install NVIDIA Drivers (GPU)

```bash
# Download NVIDIA driver for your GPU
# For RTX 4090/3090: Latest 550.x driver

wget https://us.download.nvidia.com/tesla/550.90.07/NVIDIA-Linux-x86_64-550.90.07.run
chmod +x NVIDIA-Linux-x86_64-550.90.07.run
sudo ./NVIDIA-Linux-x86_64-550.90.07.run --silent --driver-only

# Verify installation
nvidia-smi
# Expected output: GPU info + CUDA version

# Install CUDA toolkit
apt install -y nvidia-cuda-toolkit
nvcc --version
```

### Step 5: Clone RenderHub Repository

```bash
# Clone to /opt (recommended for production)
cd /opt
git clone https://github.com/YOUR-ORG/renderHub.git
cd renderHub

# Or copy manually via scp
scp -r ./renderHub root@<your-vps-ip>:/opt/
```

### Step 6: Setup Node.js Backend (ai-server)

```bash
cd /opt/renderHub/ai-server

# Install npm packages
npm install

# Create .env for production
cat > .env << 'EOF'
PORT=8787
DEBUG=false
CORS_ORIGIN=https://yourdomain.com

# TripoSR on port 9000
AI3D_MODE=upstream
AI3D_UPSTREAM_CREATE_URL=http://127.0.0.1:9000/api/v1/image-to-3d
AI3D_UPSTREAM_STATUS_URL=http://127.0.0.1:9000/api/v1/jobs/{jobId}
AI3D_UPSTREAM_RESULT_FIELD=glbUrl
EOF

# Test start
npm run dev
# Should output: Server listening on http://localhost:8787
# Ctrl+C to stop
```

### Step 7: Setup TripoSR Python Service

```bash
cd /opt/renderHub/ai-server/tripo-sr-wrapper

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install --upgrade pip
pip install -r requirements.txt

# Install TripoSR (this downloads model ~5GB)
pip install git+https://github.com/VAST-AI-Research/Tripo-SR.git@main
# Wait: ~5-10 minutes on good internet

# Test run
python app.py
# Should output: Device info + Server listening on http://127.0.0.1:9000
# Ctrl+C to stop
```

### Step 8: Setup Process Manager (PM2)

PM2 keeps services running and auto-starts on reboot.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Create ecosystem config
cat > /opt/renderHub/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: "ai-server",
      script: "server.js",
      cwd: "/opt/renderHub/ai-server",
      instances: 1,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 8787
      },
      error_file: "/var/log/renderHub/ai-server-error.log",
      out_file: "/var/log/renderHub/ai-server-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    },
    {
      name: "tripo-sr",
      script: "app.py",
      cwd: "/opt/renderHub/ai-server/tripo-sr-wrapper",
      interpreter: "./venv/bin/python",
      instances: 1,
      exec_mode: "fork",
      env: {
        PORT: 9000,
        DEVICE: "cuda"
      },
      error_file: "/var/log/renderHub/tripo-sr-error.log",
      out_file: "/var/log/renderHub/tripo-sr-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
EOF

# Create log directory
mkdir -p /var/log/renderHub
chmod 755 /var/log/renderHub

# Start services
pm2 start ecosystem.config.js

# Setup PM2 to auto-start on boot
pm2 startup
pm2 save
# Follow on-screen instructions to enable auto-start

# Check status
pm2 status
# Should show both ai-server and tripo-sr as online
```

### Step 9: Setup Nginx Reverse Proxy

Nginx routes traffic to Node.js and serves static frontend.

```bash
# Install Nginx
apt install -y nginx

# Create site config
cat > /etc/nginx/sites-available/renderhub << 'EOF'
upstream ai_server {
    server 127.0.0.1:8787;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP → HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Certificates (use Let's Encrypt for free)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    # Root: serve static frontend
    root /opt/renderHub/3d-editor;
    index index.html;

    # Frontend SPA routing
    location / {
        try_files $uri /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://ai_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase timeout for long-running requests (TripoSR inference)
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1000;
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/renderhub /etc/nginx/sites-enabled/

# Test config
nginx -t
# Should output: nginx: configuration file test is successful

# Restart Nginx
systemctl restart nginx
systemctl enable nginx  # Auto-start on boot
```

### Step 10: Setup SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificate (auto-configures Nginx)
certbot certonly -d yourdomain.com -d www.yourdomain.com

# Auto-renew daily
systemctl enable certbot.timer
systemctl start certbot.timer

# Verify renewal
certbot renew --dry-run
```

### Step 11: Configure Frontend Base URL

The frontend needs to know where to reach the API.

**Option A: Same Domain (Recommended)**

If Nginx proxies `/api/` to Node.js backend:

```javascript
// In 3d-editor/app.js or hardcode in HTML
const AI_BASE_URL = '/api/ai';  // Relative to frontend domain
```

**Option B: Different Domain**

If backend is on separate domain:

```javascript
const AI_BASE_URL = 'https://api.yourdomain.com/ai';
```

Update `index.html`:

```html
<script>
  window.RENDERHUB_AI_API_BASE = 'https://yourdomain.com/api/ai';
</script>
```

### Step 12: Test Full Stack

```bash
# From your local machine
curl https://yourdomain.com/api/ai/health
# Expected: {"ok":true,"mode":"upstream",...}

# Open browser
# https://yourdomain.com
# → Should load RenderHub editor
# → Drag-drop image
# → Wait 15-45s → Download 3D model
```

---

## Production Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Hostinger GPU VPS                      │
│  (RTX 4090 / RTX 3090, Ubuntu 22.04, 32GB RAM)          │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    ┌───▼─────┐      ┌────▼────┐      ┌─────▼──┐
    │  Nginx  │      │ Node.js │      │ Python │
    │ Port 80 │      │ Port    │      │ Port   │
    │  /443   │─────▶│ 8787    │─────▶│ 9000   │
    │         │      │ (PM2)   │      │(PM2)   │
    └─────────┘      └────┬────┘      └────┬───┘
         │                │                │
         │          ┌─────▼────────┐      │
         │          │ a. Create    │      │
         │          │    job ID    │      │
         │          │ b. Delegate  │      │
         │          │    to        │      │
         │          │    TripoSR   │      │
         │          │ c. Poll      │      │
         │          │    status    │      │
         │          └──────────────┘      │
         │                                │
         │          ┌──────────────────┐  │
         │          │ TripoSR Model    │  │
         │          │ Inference        │◀─┘
         │          │ 15-45s/image     │
         │          │ (GPU accelerated)│
         │          └──────┬───────────┘
         │                 │
         │          ┌──────▼──────────┐
         │          │ Generate GLB    │
         │          │ Save to /outputs│
         │          └──────┬──────────┘
         │                 │
         │          ┌──────▼──────────┐
         │          │ Return glbUrl   │
         │          │ to frontend     │
         │          └─────────────────┘
         │
         └─────▶ Frontend loads & displays 3D
```

## Monitoring & Troubleshooting

### View Logs

```bash
# Unified logs via PM2
pm2 logs

# Specific service
pm2 logs ai-server
pm2 logs tripo-sr

# Raw syslog-style
tail -f /var/log/renderHub/ai-server-out.log
tail -f /var/log/renderHub/tripo-sr-error.log

# Nginx access/error
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### CPU/Memory/GPU Usage

```bash
# Real-time stats
top

# GPU stats (every 2s)
watch -n 2 nvidia-smi

# PM2 monitoring
pm2 monit
```

### Common Issues

#### Issue: "TripoSR not responding"

```bash
# Check if GPU model loaded
pm2 logs tripo-sr | grep -i "loading\|device\|error"

# Restart service
pm2 restart tripo-sr

# Check port
netstat -tlnp | grep 9000
```

#### Issue: "CUDA out of memory"

```bash
# Reduce image size in .env
echo "MAX_IMAGE_SIZE=512" >> /opt/renderHub/ai-server/tripo-sr-wrapper/.env

# Restart
pm2 restart tripo-sr

# Or use CPU (slower but won't OOM)
# Modify .env: DEVICE=cpu
```

#### Issue: "Nginx 502 Bad Gateway"

```bash
# Check backend health
curl http://127.0.0.1:8787/api/ai/health

# Restart services
pm2 restart ai-server
pm2 restart tripo-sr

# Check Nginx config
nginx -t
systemctl restart nginx
```

#### Issue: "Domain certificate expired"

```bash
# Auto-renew manually if automatic renewal fails
certbot renew --force-renewal

# Check renewal scheduled
systemctl status certbot.timer
```

### Performance Tuning

#### Increase Concurrency

By default, PM2 runs 1 instance. For multi-GPU or CPU parallel:

```javascript
// ecosystem.config.js
{
  name: "ai-server",
  instances: 4,  // Run 4 Node.js processes
  exec_mode: "cluster",
  // ...
}
```

Restart:
```bash
pm2 restart ecosystem.config.js
```

#### Optimize TripoSR Model

For faster inference (lower quality):

```bash
# In .env
MODEL_NAME=small  # If available
MAX_IMAGE_SIZE=512
```

#### Use CDN for Frontend

Serve static assets from CDN to reduce Nginx load:

```bash
# Upload 3d-editor/* to Cloudflare / AWS CloudFront
# Update index.html to reference CDN URLs
# Nginx only proxies /api/ routes
```

---

## Backup & Disaster Recovery

### Backup Generated Models

```bash
# Daily backup of GLB outputs
0 2 * * * tar -czf /backups/renderhub-models-$(date +\%Y\%m\%d).tar.gz /opt/renderHub/ai-server/tripo-sr-wrapper/outputs/
```

### Database Backup (if using)

If you add user accounts or job tracking:

```bash
# PostgreSQL example
pg_dump mydatabase > /backups/db-$(date +\%Y\%m\%d).sql
```

---

## Security Hardening

### Firewall

```bash
# Only allow SSH, HTTP, HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Rate Limiting

In Nginx:

```nginx
# Limit requests to 10/second per IP
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://ai_server;
}
```

### API Authentication (Optional)

Add token validation:

```javascript
// In ai-server/server.js
app.use((req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token || !validateToken(token)) {
        return res.status(401).json({error: 'Unauthorized'});
    }
    next();
});
```

---

## Cost Estimates

| Component | Monthly Cost | Notes |
|-----------|--------------|-------|
| Hostinger GPU VPS | $300 | RTX 4090, 32GB RAM |
| CloudFlare CDN | $0-20 | Cache + DDoS protection |
| Domain | $10 | e.g., namecheap.com |
| **Total** | **~$310-330** | For full production setup |

---

## Next Steps

1. ✅ Deploy to VPS
2. [ ] Set up monitoring (DataDog, New Relic)
3. [ ] Add rate limiting & authentication
4. [ ] Auto-cleanup old GLB files
5. [ ] Integrate with analytics (track usage, latency)
6. [ ] Multi-model pipeline (quick preview + high-quality render)

---

**Last Updated:** 2026-03-17  
**Status:** Production-ready ✓
