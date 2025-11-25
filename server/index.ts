import express from 'express';
import dotenv from 'dotenv';
import { registerRoutes } from './routes';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '5001', 10);

// Register all routes
registerRoutes(app);

// Serve frontend from Vite dist
app.use(express.static(path.join(__dirname, '../dist/public')));

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/public/index.html'));
});

// Export for dev server
export default app;

// Start server only if not in composed dev mode
if (!process.env.COMPOSED_DEV) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [NuP-AIM] Server running on port ${PORT}`);
  });
}
