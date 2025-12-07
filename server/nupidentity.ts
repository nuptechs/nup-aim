import { Express } from 'express';
import cookieParser from 'cookie-parser';
import { manifest } from './nupidentity.manifest';

const NUPIDENTITY_ENABLED = !!(
  process.env.NUPIDENTITY_ISSUER &&
  process.env.NUPIDENTITY_CLIENT_ID
);

interface NuPIdentitySetupResult {
  isEnabled: boolean;
  isRegistered: boolean;
}

export async function setupNuPIdentityAuth(app: Express): Promise<NuPIdentitySetupResult> {
  if (!NUPIDENTITY_ENABLED) {
    console.log('ℹ️  [NuPIdentity] SSO desabilitado - usando autenticação local');
    return {
      isEnabled: false,
      isRegistered: false,
    };
  }

  console.log('🔐 [NuPIdentity] Configurando SSO...');
  
  app.use(cookieParser());

  const config = {
    issuer: process.env.NUPIDENTITY_ISSUER!,
    clientId: process.env.NUPIDENTITY_CLIENT_ID!,
    clientSecret: process.env.NUPIDENTITY_CLIENT_SECRET,
    redirectUri: (process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`) + '/auth/sso/callback',
    systemApiKey: process.env.NUPIDENTITY_API_KEY,
    successRedirect: '/dashboard',
    failureRedirect: '/login',
  };

  try {
    // @ts-ignore - Module resolution works at runtime with tsx
    const sdk = await import('@nupidentity/sdk/express');
    const { setupNuPIdentity } = sdk;
    
    // Add timeout to prevent blocking deployment
    const setupPromise = setupNuPIdentity(app, {
      ...config,
      manifest,
      authRoutePrefix: '/auth/sso',
      failOnSyncError: false,
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('SSO setup timeout after 10s')), 10000)
    );
    
    const nup = await Promise.race([setupPromise, timeoutPromise]) as any;

    if (nup.isRegistered) {
      console.log('✅ [NuPIdentity] Sistema registrado com sucesso');
    } else {
      console.warn('⚠️  [NuPIdentity] Sistema não registrado - permissões podem não funcionar');
    }

    console.log('✅ [NuPIdentity] SSO configurado com sucesso');
    console.log('   Rotas criadas:');
    console.log('   - GET  /auth/sso/login    (inicia login SSO)');
    console.log('   - GET  /auth/sso/callback (callback OAuth)');
    console.log('   - GET  /auth/sso/me       (dados do usuário)');
    console.log('   - POST /auth/sso/logout   (logout)');
    console.log('   - POST /auth/sso/refresh  (renovar token)');

    return {
      isEnabled: true,
      isRegistered: nup.isRegistered,
    };
  } catch (error) {
    console.error('❌ [NuPIdentity] Erro ao configurar SSO:', error);
    return {
      isEnabled: false,
      isRegistered: false,
    };
  }
}

export function isNuPIdentityEnabled(): boolean {
  return NUPIDENTITY_ENABLED;
}

export { manifest };
