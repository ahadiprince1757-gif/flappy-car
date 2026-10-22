import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import scoresRouter from './routes/scores.js';
import garageRouter from './routes/garage.js';
import progressRouter from './routes/progress.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIR = path.join(__dirname, '../client');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

// Enable CORS and JSON parsing
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(s => s.trim()) }));
app.use(express.json());

// Set explicit MIME types for 3D model files before static handler
express.static.mime.define({
  'application/octet-stream': ['fbx'],
  'text/plain': ['obj', 'mtl']
});

// REST API routes
app.use('/api/scores', scoresRouter);
app.use('/api/garage', garageRouter);
app.use('/api/progress', progressRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    game: 'Flappy Car 3D'
  });
});

// Serve static frontend assets from client/ directory
app.use(express.static(CLIENT_DIR));

// Fallback to client/index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`=========================================`);
    console.log(`🏎️  FLAPPY CAR 3D BACKEND & FRONTEND READY`);
    console.log(`🌐 Server running at: http://localhost:${port}`);
    console.log(`📂 Client root: ${CLIENT_DIR}`);
    console.log(`🚀 API Health: http://localhost:${port}/api/health`);
    console.log(`=========================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

export default app;

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  startServer(PORT);
}
