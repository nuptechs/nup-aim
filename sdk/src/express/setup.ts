import type { Express } from 'express';
import { NuPIdentityClient } from '../core/client';
import type { SystemManifest, SystemRegistrationResult, NuPIdentityConfig } from '../types';
import { createAuthRoutes, requireNuPAuth, ensurePermission, ensureAnyPermission, type AuthRoutesOptions } from './middleware';

export interface NuPIdentitySetupOptions extends NuPIdentityConfig {
  systemApiKey: string;
  manifest: SystemManifest;
  authRoutePrefix?: string;
  successRedirect?: string;
  failureRedirect?: string;
  syncOnStartup?: boolean;
  failOnSyncError?: boolean;
  onRegistrationComplete?: (result: SystemRegistrationResult) => void;
  onRegistrationError?: (error: Error) => void;
}

export interface NuPIdentityApp {
  client: NuPIdentityClient;
  config: NuPIdentityConfig;
  manifest: SystemManifest;
  isRegistered: boolean;
  getRegistrationResult: () => SystemRegistrationResult | null;
  requireAuth: ReturnType<typeof requireNuPAuth>;
  ensurePermission: (...permissions: string[]) => ReturnType<typeof ensurePermission>;
  ensureAnyPermission: (...permissions: string[]) => ReturnType<typeof ensureAnyPermission>;
  syncFunctions: () => Promise<SystemRegistrationResult>;
}

export async function setupNuPIdentity(
  app: Express,
  options: NuPIdentitySetupOptions
): Promise<NuPIdentityApp> {
  const {
    manifest,
    systemApiKey,
    authRoutePrefix = '/auth',
    successRedirect = '/',
    failureRedirect = '/login',
    syncOnStartup = true,
    failOnSyncError = false,
    onRegistrationComplete,
    onRegistrationError,
    ...clientConfig
  } = options;

  const client = new NuPIdentityClient(clientConfig);
  let registrationResult: SystemRegistrationResult | null = null;

  console.log(`[NuPIdentity] Initializing integration for system: ${manifest.system.id}`);

  await client.discover();
  console.log(`[NuPIdentity] Connected to ${clientConfig.issuer}`);

  const expressModule = await import('express');
  const authRoutes = await createAuthRoutes({
    ...clientConfig,
    successRedirect,
    failureRedirect,
  } as AuthRoutesOptions, expressModule.default || expressModule);
  
  app.use(authRoutePrefix, authRoutes);
  console.log(`[NuPIdentity] Auth routes mounted at ${authRoutePrefix}`);

  const syncFunctions = async (): Promise<SystemRegistrationResult> => {
    try {
      console.log(`[NuPIdentity] Syncing ${manifest.functions.length} functions for ${manifest.system.id}...`);
      
      const result = await client.registerSystem(manifest, systemApiKey);
      registrationResult = result;
      
      console.log(`[NuPIdentity] Sync complete:`);
      console.log(`  - System: ${result.system.name} (${result.system.id})`);
      console.log(`  - Functions: ${result.functionsSync.created} created, ${result.functionsSync.updated} updated, ${result.functionsSync.removed} removed`);
      
      if (result.integration?.nextSteps?.length) {
        console.log(`[NuPIdentity] Next steps:`);
        result.integration.nextSteps.forEach((step, i) => {
          console.log(`  ${i + 1}. ${step}`);
        });
      }
      
      onRegistrationComplete?.(result);
      return result;
    } catch (error) {
      console.error(`[NuPIdentity] Sync failed:`, error);
      onRegistrationError?.(error as Error);
      throw error;
    }
  };

  if (syncOnStartup) {
    try {
      await syncFunctions();
    } catch (error) {
      if (failOnSyncError) {
        throw new Error(`[NuPIdentity] System registration failed: ${(error as Error).message}`);
      }
      console.warn(`[NuPIdentity] Initial sync failed, continuing without registration. Reason: ${(error as Error).message}`);
      console.warn(`[NuPIdentity] Set failOnSyncError: true to make this error fatal.`);
    }
  }

  const systemId = manifest.system.id;
  
  const nuPIdentityApp: NuPIdentityApp = {
    client,
    config: clientConfig,
    manifest,
    
    get isRegistered() {
      return registrationResult !== null;
    },
    
    getRegistrationResult: () => registrationResult,
    
    requireAuth: requireNuPAuth(clientConfig),
    
    ensurePermission: (...permissions: string[]) => {
      const fullPermissions = permissions.map(p => 
        p.includes(':') ? p : `${systemId}:${p}`
      );
      return ensurePermission(clientConfig, ...fullPermissions);
    },
    
    ensureAnyPermission: (...permissions: string[]) => {
      const fullPermissions = permissions.map(p => 
        p.includes(':') ? p : `${systemId}:${p}`
      );
      return ensureAnyPermission(clientConfig, ...fullPermissions);
    },
    
    syncFunctions,
  };

  return nuPIdentityApp;
}

export function defineManifest(manifest: SystemManifest): SystemManifest {
  return manifest;
}

export function defineFunction(fn: {
  key: string;
  name: string;
  category?: string;
  description?: string;
}): { key: string; name: string; category?: string; description?: string } {
  return fn;
}
