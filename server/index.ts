import express from 'express';
import dotenv from 'dotenv';
import { registerRoutes } from './routes';
import { setupNuPIdentityAuth } from './nupidentity';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const isProduction = process.env.NODE_ENV === 'production';
const publicPath = isProduction 
  ? path.join(__dirname, 'public') 
  : path.join(__dirname, '../dist/public');

async function initializeApp() {
  // Setup NuPIdentity SSO first (if configured)
  const nup = await setupNuPIdentityAuth(app);
  
  if (nup.isEnabled) {
    console.log('🔐 [Auth] Modo SSO NuPIdentity ativado');
  } else {
    console.log('🔐 [Auth] Modo autenticação local ativado');
  }

  // Register all routes after SSO setup
  // Pass SSO status to disable local auth routes when SSO is enabled
  registerRoutes(app, { ssoEnabled: nup.isEnabled });
  
  // Serve static files from dist/public (frontend build)
  app.use(express.static(publicPath));

  // SPA fallback - serve index.html for any route that doesn't match API
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/auth')) {
      res.status(404).json({ error: 'Not found' });
    } else {
      res.sendFile(path.join(publicPath, 'index.html'));
    }
  });
  
  // Start server only if not in composed dev mode
  if (!process.env.COMPOSED_DEV) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 [NuP-AIM] Server running on port ${PORT}`);
    });
  }
}

// Initialize the app
initializeApp().catch(err => {
  console.error('❌ [NuP-AIM] Failed to initialize app:', err);
  process.exit(1);
});

// Export for dev server
export default app;
