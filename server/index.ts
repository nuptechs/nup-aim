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

// Track initialization status
let appReady = false;
let ssoInitialized = false;
let ssoEnabled = false;

// Register health check endpoints FIRST - before any async initialization
// This ensures autoscale can verify the server is running immediately
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    ready: appReady,
    ssoReady: ssoInitialized
  });
});

// Root path health check for Autoscale (responds immediately)
app.get('/', (req, res, next) => {
  // If app is ready, let the SPA fallback handle it
  if (appReady) {
    return next();
  }
  // During initialization, return health status
  res.status(200).json({ 
    status: 'starting', 
    message: 'Application is initializing...',
    timestamp: new Date().toISOString()
  });
});

async function initializeApp() {
  try {
    // Setup NuPIdentity SSO (if configured)
    const nup = await setupNuPIdentityAuth(app);
    ssoEnabled = nup.isEnabled;
    ssoInitialized = true;
    
    if (nup.isEnabled) {
      console.log('🔐 [Auth] Modo SSO NuPIdentity ativado');
    } else {
      console.log('🔐 [Auth] Modo autenticação local ativado');
    }

    // Register all routes after SSO setup
    registerRoutes(app, { ssoEnabled: nup.isEnabled });
    
  } catch (error) {
    console.error('⚠️ [NuPIdentity] SSO setup failed, falling back to local auth:', error);
    ssoInitialized = true;
    ssoEnabled = false;
    
    // Register routes with local auth as fallback
    registerRoutes(app, { ssoEnabled: false });
  }
  
  // Serve static files from dist/public (frontend build)
  app.use(express.static(publicPath));

  // SPA fallback - serve index.html for any route that doesn't match API
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
      res.status(404).json({ error: 'Not found' });
    } else {
      res.sendFile(path.join(publicPath, 'index.html'));
    }
  });
  
  // Mark app as ready after all routes are registered
  appReady = true;
  console.log('✅ [NuP-AIM] App is ready to serve requests');
}

// Start the server immediately
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [NuP-AIM] Server listening on port ${PORT}`);
  console.log(`📁 [NuP-AIM] Serving static files from: ${publicPath}`);
});

// Initialize SSO and routes in background
initializeApp()
  .then(() => {
    console.log('✅ [NuP-AIM] Application fully initialized');
  })
  .catch(err => {
    console.error('❌ [NuP-AIM] Failed to initialize app:', err);
    // Don't exit - keep server running with health check available
  });

// Export for dev server
export default app;
