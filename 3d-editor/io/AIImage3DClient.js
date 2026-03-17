/* ═══════════════════════════════════════════════════════════════
   AIImage3DClient — Frontend client for Image→3D backend jobs
   ═══════════════════════════════════════════════════════════════ */

export class AIImage3DClient {
  constructor({
    baseUrl = '/api',
    pollIntervalMs = 2500,
    maxPollMs = 180000,
  } = {}) {
    this.baseUrl = String(baseUrl || '/api').replace(/\/$/, '');
    this.pollIntervalMs = pollIntervalMs;
    this.maxPollMs = maxPollMs;
  }

  async health() {
    const resp = await fetch(`${this.baseUrl}/ai/health`, { method: 'GET' });
    if (!resp.ok) throw new Error(`AI health failed (${resp.status})`);
    return resp.json();
  }

  async generateFromImage(file, options = {}) {
    const payload = {
      fileName: file?.name || 'image.png',
      prompt: options.prompt || '',
      provider: options.provider || 'deepseek-local',
      imageBase64: await this._fileToBase64(file),
    };

    const createResp = await fetch(`${this.baseUrl}/ai/image-to-3d`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!createResp.ok) {
      const txt = await createResp.text();
      throw new Error(`AI create failed (${createResp.status}): ${txt || 'no details'}`);
    }

    const createData = await createResp.json();
    if (!createData?.jobId) throw new Error('AI create failed: missing jobId');

    const final = await this._pollJob(createData.jobId);

    if (final.status !== 'succeeded') {
      throw new Error(final.error || 'AI generation failed');
    }

    const result = final.result || {};

    if (result.glbBase64) {
      return {
        source: 'glb-base64',
        arrayBuffer: this._base64ToArrayBuffer(result.glbBase64),
        meta: result.meta || {},
      };
    }

    if (result.glbUrl) {
      const glbResp = await fetch(result.glbUrl);
      if (!glbResp.ok) throw new Error(`GLB download failed (${glbResp.status})`);
      return {
        source: 'glb-url',
        arrayBuffer: await glbResp.arrayBuffer(),
        meta: result.meta || {},
      };
    }

    return {
      source: 'fallback-local',
      arrayBuffer: null,
      meta: result.meta || {},
      fallbackLocal: true,
      message: result.message || 'Backend requested local fallback',
    };
  }

  async _pollJob(jobId) {
    const start = Date.now();
    while (Date.now() - start < this.maxPollMs) {
      const resp = await fetch(`${this.baseUrl}/ai/image-to-3d/${encodeURIComponent(jobId)}`, {
        method: 'GET',
      });
      if (!resp.ok) throw new Error(`AI status failed (${resp.status})`);
      const data = await resp.json();
      if (data.status === 'succeeded' || data.status === 'failed') return data;
      await this._sleep(this.pollIntervalMs);
    }
    throw new Error('AI timeout while waiting for Image→3D result');
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  _base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
}
