# Multi-stage Dockerfile for TripoSR wrapper
# Stage 1: Base image with Python and CUDA (if GPU available)
# Stage 2: Install dependencies and TripoSR
# Usage: docker build -t tripo-sr-wrapper .
#        docker run -p 9000:9000 --gpus all tripo-sr-wrapper  (with GPU)
#        docker run -p 9000:9000 tripo-sr-wrapper             (CPU only)

ARG CUDA_VERSION=12.1.0
ARG CUDNN_VERSION=8
ARG UBUNTU_VERSION=22.04

# Build argument to switch between GPU and CPU
ARG BUILD_MODE=gpu

# ============================================================
# GPU Base Image (CUDA 12.1 + cuDNN)
# ============================================================
FROM nvidia/cuda:${CUDA_VERSION}-cudnn${CUDNN_VERSION}-runtime-ubuntu${UBUNTU_VERSION} AS base-gpu

ENV DEBIAN_FRONTEND=noninteractive \
    CUDA_HOME=/usr/local/cuda \
    PATH=/usr/local/cuda/bin:${PATH} \
    LD_LIBRARY_PATH=/usr/local/cuda/lib64:${LD_LIBRARY_PATH}

RUN apt-get update && apt-get install -y \
    python3.10 \
    python3.10-dev \
    python3-pip \
    git \
    wget \
    build-essential \
    libopenblas-dev \
    && rm -rf /var/lib/apt/lists/* \
    && update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1

# ============================================================
# CPU Base Image (Ubuntu without CUDA)
# ============================================================
FROM ubuntu:${UBUNTU_VERSION} AS base-cpu

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    python3.10 \
    python3.10-dev \
    python3-pip \
    git \
    wget \
    build-essential \
    libopenblas-dev \
    && rm -rf /var/lib/apt/lists/* \
    && update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1

# ============================================================
# Builder stage (unified)
# ============================================================
FROM base-${BUILD_MODE} AS builder

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Upgrade pip
RUN python -m pip install --upgrade pip setuptools wheel

# Install PyTorch with appropriate backend
RUN if [ "${BUILD_MODE}" = "gpu" ]; then \
      pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121; \
    else \
      pip install torch torchvision; \
    fi

# Install remaining requirements
RUN pip install -r requirements.txt

# Install TripoSR from GitHub
RUN pip install git+https://github.com/VAST-AI-Research/Tripo-SR.git@main

# ============================================================
# Final Runtime Image
# ============================================================
FROM base-${BUILD_MODE} AS runtime

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.10/dist-packages /usr/local/lib/python3.10/dist-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY app.py .

# Create output directory
RUN mkdir -p outputs

# Expose port
EXPOSE 9000

# Environment defaults
ENV FLASK_APP=app.py \
    FLASK_ENV=production \
    PORT=9000 \
    DEVICE=auto \
    MODEL_NAME=default \
    OUTPUT_FORMAT=glb \
    MAX_IMAGE_SIZE=1024 \
    JOB_TIMEOUT=300

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -m pip install requests > /dev/null 2>&1 && \
        python -c "import requests; requests.get('http://localhost:9000/health', timeout=5)" || exit 1

# Run application
CMD ["python", "app.py"]
