import { N as NuPIdentityClient, r as requireNuPAuth, e as ensurePermission, a as ensureAnyPermission } from '../index-D3bRGfi0.js';
export { A as AuthRoutesOptions, g as NuPIdentityMiddlewareOptions, b as attachUser, f as createAuthRoutes, d as ensureOrganization, c as ensureScope } from '../index-D3bRGfi0.js';
import { Express } from 'express';
import { N as NuPIdentityConfig, S as SystemManifest, a as SystemRegistrationResult } from '../index-B_NFA8jC.js';

interface NuPIdentitySetupOptions extends NuPIdentityConfig {
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
interface NuPIdentityApp {
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
declare function setupNuPIdentity(app: Express, options: NuPIdentitySetupOptions): Promise<NuPIdentityApp>;
declare function defineManifest(manifest: SystemManifest): SystemManifest;
declare function defineFunction(fn: {
    key: string;
    name: string;
    category?: string;
    description?: string;
}): {
    key: string;
    name: string;
    category?: string;
    description?: string;
};

export { type NuPIdentityApp, NuPIdentityClient, type NuPIdentitySetupOptions, defineFunction, defineManifest, ensureAnyPermission, ensurePermission, requireNuPAuth, setupNuPIdentity };
