import express from 'express';
import dotenv from 'dotenv';
import { registerRoutes } from './routes';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const isDev = process.env.NODE_ENV === 'development';

async function startServer() {
  // Register all routes first
  await registerRoutes(app);

  if (isDev) {
    // Development: use Vite middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { 
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
      root: path.join(__dirname, '../client'),
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files from dist/public
    const publicPath = path.join(__dirname, '../dist/public');
    app.use(express.static(publicPath));

    // SPA fallback - serve index.html for any route that doesn't match API
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
        res.status(404).json({ error: 'Not found' });
      } else {
        res.sendFile(path.join(publicPath, 'index.html'));
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [NuP-AIM] Server running on port ${PORT}`);
  });
}

startServer();
