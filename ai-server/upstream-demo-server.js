import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
const port = 9000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '25mb' }));

const jobs = new Map();

const MODEL_LIBRARY = [
  {
    name: 'vehicle',
    keywords: ['car', 'coche', 'vehicle', 'truck', 'camion', 'van'],
    glbUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb',
  },
  {
    name: 'animal',
    keywords: ['animal', 'fox', 'perro', 'dog', 'cat', 'gato'],
    glbUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Fox/glTF-Binary/Fox.glb',
  },
  {
    name: 'product',
    keywords: ['shoe', 'zapatilla', 'helmet', 'product', 'producto'],
    glbUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
  },
  {
    name: 'generic',
    keywords: [],
    glbUrl: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/Duck/glTF-Binary/Duck.glb',
  },
];

app.get('/api/v1/health', (_req, res) => {
  res.json({ ok: true, service: 'renderhub-upstream-demo', port });
});

app.post('/api/v1/image-to-3d', (req, res) => {
  const { fileName = '', prompt = '' } = req.body || {};
  const jobId = crypto.randomUUID();
  const model = chooseModel(`${fileName} ${prompt}`);

  jobs.set(jobId, {
    id: jobId,
    status: 'queued',
    glbUrl: model.glbUrl,
    model: model.name,
    createdAt: new Date().toISOString(),
  });

  setTimeout(() => {
    const job = jobs.get(jobId);
    if (!job) return;
    job.status = 'running';
    jobs.set(jobId, job);
  }, 400);

  setTimeout(() => {
    const job = jobs.get(jobId);
    if (!job) return;
    job.status = 'succeeded';
    jobs.set(jobId, job);
  }, 1800);

  res.status(202).json({ jobId, status: 'queued' });
});

app.get('/api/v1/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ status: 'failed', error: 'Job not found' });
  }

  res.json({
    jobId: job.id,
    status: job.status,
    glbUrl: job.status === 'succeeded' ? job.glbUrl : null,
    model: job.model,
    createdAt: job.createdAt,
  });
});

function chooseModel(text) {
  const lower = String(text || '').toLowerCase();
  for (const model of MODEL_LIBRARY) {
    if (model.keywords.some(keyword => lower.includes(keyword))) {
      return model;
    }
  }
  return MODEL_LIBRARY[MODEL_LIBRARY.length - 1];
}

app.listen(port, () => {
  console.log(`[renderhub-upstream-demo] listening on http://127.0.0.1:${port}`);
});
