// src/core/client.ts
import * as crypto from "crypto";
var NuPIdentityClient = class {
  constructor(config) {
    this.discoveryDocument = null;
    this.jwks = null;
    this.jwksLastFetch = 0;
    this.JWKS_CACHE_TTL = 5 * 60 * 1e3;
    if (!config.issuer) {
      throw new Error("[NuPIdentity] issuer is required");
    }
    if (!config.clientId) {
      throw new Error("[NuPIdentity] clientId is required");
    }
    this.config = {
      ...config,
      issuer: config.issuer.replace(/\/$/, ""),
      scopes: config.scopes ?? ["openid", "profile", "email"]
    };
  }
  async discover(retries = 2) {
    if (this.discoveryDocument) {
      return this.discoveryDocument;
    }
    const url = `${this.config.issuer}/.well-known/openid-configuration`;
    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5e3);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) {
          throw new Error(`Discovery failed: ${response.status} ${response.statusText}`);
        }
        this.discoveryDocument = await response.json();
        console.log("[NuPIdentity] Discovery document loaded successfully");
        return this.discoveryDocument;
      } catch (error) {
        lastError = error;
        console.error(`[NuPIdentity] Discovery attempt ${attempt} failed:`, error);
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1e3));
        }
      }
    }
    throw new Error(`[NuPIdentity] Failed to discover OIDC configuration: ${lastError?.message}`);
  }
  async getJWKS() {
    const now = Date.now();
    if (this.jwks && now - this.jwksLastFetch < this.JWKS_CACHE_TTL) {
      return this.jwks;
    }
    const discovery = await this.discover();
    try {
      const response = await fetch(discovery.jwks_uri);
      if (!response.ok) {
        throw new Error(`JWKS fetch failed: ${response.status}`);
      }
      this.jwks = await response.json();
      this.jwksLastFetch = now;
      console.log("[NuPIdentity] JWKS loaded successfully");
      return this.jwks;
    } catch (error) {
      console.error("[NuPIdentity] Failed to fetch JWKS:", error);
      throw new Error(`[NuPIdentity] Failed to fetch JWKS: ${error}`);
    }
  }
  async getPublicKey(kid) {
    const jwks = await this.getJWKS();
    const jwk = jwks.keys.find((k) => k.kid === kid);
    if (!jwk) {
      this.jwks = null;
      const refreshedJwks = await this.getJWKS();
      const refreshedJwk = refreshedJwks.keys.find((k) => k.kid === kid);
      if (!refreshedJwk) {
        throw new Error(`[NuPIdentity] Key with kid "${kid}" not found in JWKS`);
      }
      return crypto.createPublicKey({ key: refreshedJwk, format: "jwk" });
    }
    return crypto.createPublicKey({ key: jwk, format: "jwk" });
  }
  async verifyToken(token) {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("[NuPIdentity] Invalid token format");
    }
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (header.alg !== "RS256") {
      throw new Error(`[NuPIdentity] Unsupported algorithm: ${header.alg}`);
    }
    const publicKey = await this.getPublicKey(header.kid);
    const signatureInput = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64, "base64url");
    const isValid = crypto.verify(
      "RSA-SHA256",
      Buffer.from(signatureInput),
      publicKey,
      signature
    );
    if (!isValid) {
      throw new Error("[NuPIdentity] Invalid token signature");
    }
    const now = Math.floor(Date.now() / 1e3);
    if (payload.exp && payload.exp < now) {
      throw new Error("[NuPIdentity] Token has expired");
    }
    if (payload.iss && payload.iss !== this.config.issuer) {
      throw new Error(`[NuPIdentity] Invalid issuer: expected ${this.config.issuer}, got ${payload.iss}`);
    }
    return payload;
  }
  getAuthorizationUrl(options) {
    const discovery = this.discoveryDocument;
    if (!discovery) {
      throw new Error("[NuPIdentity] Call discover() first");
    }
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: options?.redirectUri ?? this.config.redirectUri ?? "",
      scope: (options?.scopes ?? this.config.scopes ?? ["openid"]).join(" ")
    });
    if (options?.state) params.set("state", options.state);
    if (options?.nonce) params.set("nonce", options.nonce);
    if (options?.codeChallenge) {
      params.set("code_challenge", options.codeChallenge);
      params.set("code_challenge_method", options.codeChallengeMethod ?? "S256");
    }
    if (this.config.audience) {
      params.set("audience", this.config.audience);
    }
    return `${discovery.authorization_endpoint}?${params.toString()}`;
  }
  async exchangeCode(code, redirectUri, codeVerifier) {
    const discovery = await this.discover();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: this.config.clientId,
      redirect_uri: redirectUri ?? this.config.redirectUri ?? ""
    });
    if (this.config.clientSecret) {
      body.set("client_secret", this.config.clientSecret);
    }
    if (codeVerifier) {
      body.set("code_verifier", codeVerifier);
    }
    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`[NuPIdentity] Token exchange failed: ${error}`);
    }
    return response.json();
  }
  async getUserInfo(accessToken) {
    const discovery = await this.discover();
    const response = await fetch(discovery.userinfo_endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!response.ok) {
      throw new Error(`[NuPIdentity] UserInfo request failed: ${response.status}`);
    }
    return response.json();
  }
  async refreshToken(refreshToken) {
    const discovery = await this.discover();
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.config.clientId
    });
    if (this.config.clientSecret) {
      body.set("client_secret", this.config.clientSecret);
    }
    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });
    if (!response.ok) {
      throw new Error("[NuPIdentity] Token refresh failed");
    }
    return response.json();
  }
  getLogoutUrl(options) {
    const discovery = this.discoveryDocument;
    if (!discovery?.end_session_endpoint) {
      throw new Error("[NuPIdentity] Logout endpoint not available");
    }
    const params = new URLSearchParams();
    if (options?.idTokenHint) {
      params.set("id_token_hint", options.idTokenHint);
    }
    if (options?.postLogoutRedirectUri) {
      params.set("post_logout_redirect_uri", options.postLogoutRedirectUri);
    }
    const queryString = params.toString();
    return queryString ? `${discovery.end_session_endpoint}?${queryString}` : discovery.end_session_endpoint;
  }
  async registerSystem(manifest, apiKey) {
    const url = `${this.config.issuer}/api/systems/register`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-System-API-Key": apiKey
      },
      body: JSON.stringify(manifest)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(`[NuPIdentity] System registration failed: ${error.message || error.error}`);
    }
    const result = await response.json();
    console.log(`[NuPIdentity] System registered: ${manifest.system.id} - ${result.functionsSync.created} created, ${result.functionsSync.updated} updated`);
    return result;
  }
  async syncFunctions(systemId, manifest, accessToken) {
    const url = `${this.config.issuer}/api/systems/${systemId}/sync-functions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify(manifest)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(`[NuPIdentity] Function sync failed: ${error.message || error.error}`);
    }
    return response.json();
  }
  async getUserPermissions(userId, systemId, accessToken) {
    const url = `${this.config.issuer}/api/validate/users/${userId}/systems/${systemId}/permissions`;
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    if (!response.ok) {
      throw new Error(`[NuPIdentity] Failed to get user permissions: ${response.status}`);
    }
    return response.json();
  }
  static generateCodeVerifier() {
    return crypto.randomBytes(32).toString("base64url");
  }
  static generateCodeChallenge(verifier) {
    return crypto.createHash("sha256").update(verifier).digest("base64url");
  }
  static generateState() {
    return crypto.randomBytes(16).toString("base64url");
  }
  static generateNonce() {
    return crypto.randomBytes(16).toString("base64url");
  }
};

// src/types/index.ts
function getUserId(payload) {
  return payload.userId ?? payload.id ?? payload.sub;
}

// src/express/middleware.ts
var clientCache = /* @__PURE__ */ new Map();
function getCacheKey(config) {
  return `${config.issuer}:${config.clientId}`;
}
async function initializeClient(config) {
  const cacheKey = getCacheKey(config);
  let cached = clientCache.get(cacheKey);
  if (!cached) {
    const client = new NuPIdentityClient(config);
    const initPromise = client.discover().then(() => {
      console.log(`[NuPIdentity] Client initialized for ${config.issuer}`);
    }).catch((error) => {
      console.error("[NuPIdentity] Client initialization failed:", error);
      clientCache.delete(cacheKey);
      throw error;
    });
    cached = { client, initPromise };
    clientCache.set(cacheKey, cached);
  }
  await cached.initPromise;
  return cached.client;
}
function defaultTokenExtractor(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  if (req.cookies?.access_token) {
    return req.cookies.access_token;
  }
  if (req.query?.access_token && typeof req.query.access_token === "string") {
    return req.query.access_token;
  }
  return null;
}
function defaultErrorHandler(error, req, res) {
  console.error("[NuPIdentity] Authentication error:", error.message);
  res.status(401).json({
    error: "Unauthorized",
    message: error.message
  });
}
function requireNuPAuth(options) {
  const tokenExtractor = options.tokenExtractor ?? defaultTokenExtractor;
  const onError = options.onError ?? defaultErrorHandler;
  return async (req, res, next) => {
    try {
      const token = tokenExtractor(req);
      if (!token) {
        if (options.optional) {
          return next();
        }
        throw new Error("No access token provided");
      }
      const client = await initializeClient(options);
      const payload = await client.verifyToken(token);
      req.user = payload;
      req.userId = getUserId(payload);
      req.accessToken = token;
      next();
    } catch (error) {
      if (options.optional) {
        return next();
      }
      onError(error, req, res);
    }
  };
}
function attachUser(options) {
  return requireNuPAuth({ ...options, optional: true });
}
function ensureScope(...requiredScopes) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized", message: "No user attached" });
      return;
    }
    const tokenScopes = req.user.scope?.split(" ") ?? [];
    const hasAllScopes = requiredScopes.every((scope) => tokenScopes.includes(scope));
    if (!hasAllScopes) {
      res.status(403).json({
        error: "Forbidden",
        message: `Missing required scopes: ${requiredScopes.join(", ")}`
      });
      return;
    }
    next();
  };
}
function ensureOrganization(organizationId) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized", message: "No user attached" });
      return;
    }
    const userOrgId = req.user.organizationId;
    if (!userOrgId) {
      res.status(403).json({
        error: "Forbidden",
        message: "User does not belong to any organization"
      });
      return;
    }
    if (organizationId && userOrgId !== organizationId) {
      res.status(403).json({
        error: "Forbidden",
        message: "User does not belong to the required organization"
      });
      return;
    }
    next();
  };
}
function ensurePermission(options, ...requiredPermissions) {
  const authMiddleware = requireNuPAuth({ ...options, optional: false });
  const permissionMiddleware = (req, res, next) => {
    const userPermissions = req.user?.permissions;
    if (!userPermissions || userPermissions.length === 0) {
      res.status(403).json({
        error: "Forbidden",
        message: "No permissions found in token",
        required: requiredPermissions
      });
      return;
    }
    const hasAllPermissions = requiredPermissions.every(
      (perm) => userPermissions.includes(perm)
    );
    if (!hasAllPermissions) {
      const missing = requiredPermissions.filter((perm) => !userPermissions.includes(perm));
      res.status(403).json({
        error: "Forbidden",
        message: `Missing required permissions: ${missing.join(", ")}`,
        required: requiredPermissions,
        missing
      });
      return;
    }
    next();
  };
  return [authMiddleware, permissionMiddleware];
}
function ensureAnyPermission(options, ...anyPermissions) {
  const authMiddleware = requireNuPAuth({ ...options, optional: false });
  const permissionMiddleware = (req, res, next) => {
    const userPermissions = req.user?.permissions;
    if (!userPermissions || userPermissions.length === 0) {
      res.status(403).json({
        error: "Forbidden",
        message: "No permissions found in token",
        required: anyPermissions
      });
      return;
    }
    const hasAnyPermission = anyPermissions.some(
      (perm) => userPermissions.includes(perm)
    );
    if (!hasAnyPermission) {
      res.status(403).json({
        error: "Forbidden",
        message: `Requires at least one of: ${anyPermissions.join(", ")}`,
        required: anyPermissions
      });
      return;
    }
    next();
  };
  return [authMiddleware, permissionMiddleware];
}
async function createAuthRoutes(options, expressApp) {
  const cookieParserModule = await import("cookie-parser");
  const cookieParser = cookieParserModule.default || cookieParserModule;
  const router = expressApp.Router();
  router.use(cookieParser());
  const OAUTH_STATE_COOKIE = "nupidentity_oauth_state";
  const OAUTH_VERIFIER_COOKIE = "nupidentity_code_verifier";
  const OAUTH_NONCE_COOKIE = "nupidentity_nonce";
  const isSecure = process.env.NODE_ENV === "production" || !!process.env.REPL_ID || !!process.env.REPLIT_DEV_DOMAIN || (process.env.APP_URL?.startsWith("https://") ?? false);
  const cookieOptions = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 10 * 60 * 1e3,
    path: "/"
  };
  router.get("/login", async (req, res) => {
    try {
      const client = await initializeClient(options);
      const state = NuPIdentityClient.generateState();
      const nonce = NuPIdentityClient.generateNonce();
      const codeVerifier = NuPIdentityClient.generateCodeVerifier();
      const codeChallenge = NuPIdentityClient.generateCodeChallenge(codeVerifier);
      res.cookie(OAUTH_STATE_COOKIE, state, cookieOptions);
      res.cookie(OAUTH_VERIFIER_COOKIE, codeVerifier, cookieOptions);
      res.cookie(OAUTH_NONCE_COOKIE, nonce, cookieOptions);
      const authUrl = client.getAuthorizationUrl({
        state,
        nonce,
        codeChallenge,
        codeChallengeMethod: "S256",
        redirectUri: options.redirectUri
      });
      res.redirect(authUrl);
    } catch (error) {
      console.error("[NuPIdentity] Login error:", error);
      if (options.failureRedirect) {
        res.redirect(options.failureRedirect + "?error=login_failed");
      } else {
        res.status(500).json({ error: "Failed to initiate login" });
      }
    }
  });
  router.get("/callback", async (req, res) => {
    const clearOAuthCookies = () => {
      res.clearCookie(OAUTH_STATE_COOKIE);
      res.clearCookie(OAUTH_VERIFIER_COOKIE);
      res.clearCookie(OAUTH_NONCE_COOKIE);
    };
    try {
      const { code, state, error, error_description } = req.query;
      if (error) {
        clearOAuthCookies();
        throw new Error(`OAuth error: ${error} - ${error_description}`);
      }
      if (!code || !state || typeof code !== "string" || typeof state !== "string") {
        clearOAuthCookies();
        throw new Error("Missing code or state parameter");
      }
      const storedState = req.cookies?.[OAUTH_STATE_COOKIE];
      const storedVerifier = req.cookies?.[OAUTH_VERIFIER_COOKIE];
      const storedNonce = req.cookies?.[OAUTH_NONCE_COOKIE];
      if (!storedState || !storedVerifier) {
        clearOAuthCookies();
        throw new Error("Missing OAuth state cookies - session may have expired");
      }
      if (state !== storedState) {
        clearOAuthCookies();
        throw new Error("Invalid state parameter - possible CSRF attack");
      }
      clearOAuthCookies();
      const client = await initializeClient(options);
      const tokens = await client.exchangeCode(
        code,
        options.redirectUri,
        storedVerifier
      );
      if (tokens.id_token && storedNonce) {
        try {
          const idTokenPayload = JSON.parse(
            Buffer.from(tokens.id_token.split(".")[1], "base64url").toString()
          );
          if (idTokenPayload.nonce !== storedNonce) {
            throw new Error("Invalid nonce in ID token - possible replay attack");
          }
        } catch (nonceError) {
          if (nonceError.message.includes("nonce")) {
            throw nonceError;
          }
          console.warn("[NuPIdentity] Could not validate nonce:", nonceError);
        }
      }
      res.cookie("access_token", tokens.access_token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: (tokens.expires_in ?? 3600) * 1e3
      });
      if (tokens.refresh_token) {
        res.cookie("refresh_token", tokens.refresh_token, {
          httpOnly: true,
          secure: isSecure,
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1e3
        });
      }
      if (tokens.id_token) {
        res.cookie("id_token", tokens.id_token, {
          httpOnly: true,
          secure: isSecure,
          sameSite: "lax",
          maxAge: (tokens.expires_in ?? 3600) * 1e3
        });
      }
      res.redirect(options.successRedirect ?? "/");
    } catch (error) {
      console.error("[NuPIdentity] Callback error:", error);
      if (options.failureRedirect) {
        const errorMsg = encodeURIComponent(error.message);
        res.redirect(`${options.failureRedirect}?error=${errorMsg}`);
      } else {
        res.status(500).json({ error: "Authentication failed", message: error.message });
      }
    }
  });
  router.get("/me", requireNuPAuth(options), async (req, res) => {
    try {
      if (!req.accessToken) {
        throw new Error("No access token");
      }
      const client = await initializeClient(options);
      const userInfo = await client.getUserInfo(req.accessToken);
      res.json(userInfo);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user info" });
    }
  });
  router.post("/logout", (req, res) => {
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    res.json({ success: true });
  });
  router.post("/refresh", async (req, res) => {
    try {
      const refreshToken = req.cookies?.refresh_token;
      if (!refreshToken) {
        throw new Error("No refresh token");
      }
      const client = await initializeClient(options);
      const tokens = await client.refreshToken(refreshToken);
      res.cookie("access_token", tokens.access_token, {
        httpOnly: true,
        secure: isSecure,
        sameSite: "lax",
        maxAge: (tokens.expires_in ?? 3600) * 1e3
      });
      res.json({ success: true, expires_in: tokens.expires_in });
    } catch (error) {
      res.status(401).json({ error: "Token refresh failed" });
    }
  });
  return router;
}

// src/express/setup.ts
async function setupNuPIdentity(app, options) {
  const {
    manifest,
    systemApiKey,
    authRoutePrefix = "/auth",
    successRedirect = "/",
    failureRedirect = "/login",
    syncOnStartup = true,
    failOnSyncError = false,
    onRegistrationComplete,
    onRegistrationError,
    ...clientConfig
  } = options;
  const client = new NuPIdentityClient(clientConfig);
  let registrationResult = null;
  console.log(`[NuPIdentity] Initializing integration for system: ${manifest.system.id}`);
  await client.discover();
  console.log(`[NuPIdentity] Connected to ${clientConfig.issuer}`);
  const expressModule = await import("express");
  const authRoutes = await createAuthRoutes({
    ...clientConfig,
    successRedirect,
    failureRedirect
  }, expressModule.default || expressModule);
  app.use(authRoutePrefix, authRoutes);
  console.log(`[NuPIdentity] Auth routes mounted at ${authRoutePrefix}`);
  const syncFunctions = async () => {
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
      onRegistrationError?.(error);
      throw error;
    }
  };
  if (syncOnStartup) {
    try {
      await syncFunctions();
    } catch (error) {
      if (failOnSyncError) {
        throw new Error(`[NuPIdentity] System registration failed: ${error.message}`);
      }
      console.warn(`[NuPIdentity] Initial sync failed, continuing without registration. Reason: ${error.message}`);
      console.warn(`[NuPIdentity] Set failOnSyncError: true to make this error fatal.`);
    }
  }
  const systemId = manifest.system.id;
  const nuPIdentityApp = {
    client,
    config: clientConfig,
    manifest,
    get isRegistered() {
      return registrationResult !== null;
    },
    getRegistrationResult: () => registrationResult,
    requireAuth: requireNuPAuth(clientConfig),
    ensurePermission: (...permissions) => {
      const fullPermissions = permissions.map(
        (p) => p.includes(":") ? p : `${systemId}:${p}`
      );
      return ensurePermission(clientConfig, ...fullPermissions);
    },
    ensureAnyPermission: (...permissions) => {
      const fullPermissions = permissions.map(
        (p) => p.includes(":") ? p : `${systemId}:${p}`
      );
      return ensureAnyPermission(clientConfig, ...fullPermissions);
    },
    syncFunctions
  };
  return nuPIdentityApp;
}
function defineManifest(manifest) {
  return manifest;
}
function defineFunction(fn) {
  return fn;
}
export {
  NuPIdentityClient,
  attachUser,
  createAuthRoutes,
  defineFunction,
  defineManifest,
  ensureAnyPermission,
  ensureOrganization,
  ensurePermission,
  ensureScope,
  requireNuPAuth,
  setupNuPIdentity
};
//# sourceMappingURL=index.mjs.map