import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const mode = process.env.AI3D_MODE || 'mock';

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '25mb' }));

/** @type {Map<string, any>} */
const jobs = new Map();

app.get('/api/ai/health', (_req, res) => {
  res.json({
    ok: true,
    mode,
    service: 'renderhub-ai-server',
    now: new Date().toISOString(),
  });
});

app.post('/api/ai/image-to-3d', async (req, res) => {
  try {
    const { imageBase64, fileName, prompt } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    const jobId = crypto.randomUUID();
    const job = {
      id: jobId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      fileName: fileName || 'image.png',
      prompt: prompt || '',
      result: null,
      error: null,
    };
    jobs.set(jobId, job);

    // Process asynchronously so frontend can poll.
    processImageTo3D(jobId, { imageBase64, fileName, prompt }).catch(err => {
      const failed = jobs.get(jobId);
      if (!failed) return;
      failed.status = 'failed';
      failed.error = err.message || String(err);
      failed.updatedAt = new Date().toISOString();
      jobs.set(jobId, failed);
    });

    return res.status(202).json({ jobId, status: 'queued' });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
});

app.get('/api/ai/image-to-3d/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  return res.json({
    jobId: job.id,
    status: job.status,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt || job.createdAt,
  });
});

async function processImageTo3D(jobId, payload) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'running';
  job.updatedAt = new Date().toISOString();
  jobs.set(jobId, job);

  if (mode === 'upstream') {
    const upstreamCreate = process.env.AI3D_UPSTREAM_CREATE_URL;
    const upstreamStatus = process.env.AI3D_UPSTREAM_STATUS_URL;
    if (!upstreamCreate || !upstreamStatus) {
      throw new Error('Upstream mode requires AI3D_UPSTREAM_CREATE_URL and AI3D_UPSTREAM_STATUS_URL');
    }

    const created = await fetch(upstreamCreate, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.AI3D_API_KEY ? { Authorization: `Bearer ${process.env.AI3D_API_KEY}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!created.ok) {
      const details = await created.text();
      throw new Error(`Upstream create failed (${created.status}): ${details}`);
    }

    const createdData = await created.json();
    const upstreamJobId = createdData.jobId || createdData.id;
    if (!upstreamJobId) throw new Error('Upstream create did not return job id');

    let statusData = null;
    for (let i = 0; i < 120; i++) {
      await sleep(2500);
      const statusUrl = upstreamStatus.replace('{jobId}', encodeURIComponent(upstreamJobId));
      const statusResp = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          ...(process.env.AI3D_API_KEY ? { Authorization: `Bearer ${process.env.AI3D_API_KEY}` } : {}),
        },
      });
      if (!statusResp.ok) continue;
      statusData = await statusResp.json();
      const st = String(statusData.status || '').toLowerCase();
      if (st === 'succeeded' || st === 'completed' || st === 'failed' || st === 'error') break;
    }

    if (!statusData) throw new Error('Upstream status timeout');

    const st = String(statusData.status || '').toLowerCase();
    if (st === 'failed' || st === 'error') {
      throw new Error(statusData.error || 'Upstream generation failed');
    }

    const resultField = process.env.AI3D_UPSTREAM_RESULT_FIELD || 'glbUrl';
    const nestedGlbUrl = statusData?.result?.glbUrl;
    const glbUrl = statusData[resultField] || statusData.glbUrl || statusData.url || nestedGlbUrl;

    if (!glbUrl) {
      throw new Error('Upstream completed without GLB URL');
    }

    const done = jobs.get(jobId);
    if (!done) return;
    done.status = 'succeeded';
    done.updatedAt = new Date().toISOString();
    done.result = {
      glbUrl,
      meta: {
        mode: 'upstream',
        upstreamJobId,
      },
    };
    jobs.set(jobId, done);
    return;
  }

  // Default mock mode: return a local fallback signal so frontend uses its own generator.
  await sleep(1200);
  const done = jobs.get(jobId);
  if (!done) return;
  done.status = 'succeeded';
  done.updatedAt = new Date().toISOString();
  done.result = {
    message: 'Mock mode: no remote GLB generated. Frontend should use local Image→3D fallback.',
    meta: {
      mode: 'mock',
      note: 'Set AI3D_MODE=upstream and upstream URLs to enable real external Image-to-3D provider.',
    },
  };
  jobs.set(jobId, done);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.listen(port, () => {
  console.log(`[renderhub-ai-server] listening on http://localhost:${port}`);
  console.log(`[renderhub-ai-server] mode=${mode}`);
});
