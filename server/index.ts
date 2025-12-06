import express from 'express';
import dotenv from 'dotenv';
import { registerRoutes } from './routes';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Register all routes
registerRoutes(app);

// Serve static files from dist/public (frontend build)
const publicPath = path.join(__dirname, '../dist/public');
app.use(express.static(publicPath));

// SPA fallback - serve index.html for any route that doesn't match API
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    res.status(404).json({ error: 'Not found' });
  } else {
    res.sendFile(path.join(publicPath, 'index.html'));
  }
});

// Export for dev server
export default app;

// Start server only if not in composed dev mode
if (!process.env.COMPOSED_DEV) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [NuP-AIM] Server running on port ${PORT}`);
  });
}
