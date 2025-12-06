import { Express } from 'express';
import express from 'express';
import { db } from './db';
import { users, profiles, projects, analyses, processes, impacts, risks, mitigations, conclusions } from './schema';
import { eq, and, or } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { corsMiddleware } from './middleware/cors.middleware';
import { authenticateToken } from './middleware/auth.middleware';

const JWT_SECRET: string = process.env.JWT_SECRET || '';

if (!JWT_SECRET) {
  console.error('🔴 [FATAL] JWT_SECRET environment variable is required');
  console.error('🔴 [FATAL] NuP-AIM cannot start without a secure JWT_SECRET');
  console.error('💡 Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  throw new Error('JWT_SECRET is required. Set it in Secrets tab.');
}

if (JWT_SECRET.length < 32) {
  console.error('🔴 [FATAL] JWT_SECRET is too short (min 32 chars)');
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

console.log('✅ [Security] JWT_SECRET configured (' + JWT_SECRET.length + ' chars)');

interface RouteOptions {
  ssoEnabled?: boolean;
}

export function registerRoutes(app: Express, options: RouteOptions = {}) {
  const { ssoEnabled = false } = options;
  
  // Apply middleware
  app.use(corsMiddleware);
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ limit: '5mb', extended: true }));

  // ============================================
  // HEALTH CHECK
  // ============================================
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      service: 'NuP-AIM', 
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      authMode: ssoEnabled ? 'sso' : 'local'
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      service: 'NuP-AIM', 
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      authMode: ssoEnabled ? 'sso' : 'local'
    });
  });

  // ============================================
  // AUTH ROUTES (only when SSO is disabled)
  // ============================================
  
  if (ssoEnabled) {
    console.log('ℹ️  [Routes] Local auth routes disabled - using SSO');
  } else {
    console.log('ℹ️  [Routes] Local auth routes enabled');
  }

  // Auth routes - only register when SSO is NOT enabled
  if (!ssoEnabled) {
  app.post('/api/auth/login', async (req, res) => {
    try {
      let { email, password } = req.body;
  
      // Trim spaces from inputs
      email = email?.trim();
      password = password?.trim();
  
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
  
      // Find user by email
      const userResult = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        passwordHash: users.passwordHash,
        profileId: users.profileId,
        isActive: users.isActive,
        isEmailVerified: users.isEmailVerified
      }).from(users).where(eq(users.email, email));
  
      if (userResult.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
  
      const user = userResult[0];
  
      // Check if user is active and email is verified
      if (!user.isActive) {
        return res.status(401).json({ error: 'Account is inactive' });
      }
  
      if (!user.isEmailVerified) {
        return res.status(401).json({ error: 'Email not verified' });
      }
  
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
  
      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          profileId: user.profileId 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
  
      // Update last login
      await db.update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, user.id));
  
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          profileId: user.profileId
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Register new user
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password, profileId } = req.body;
  
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email and password are required' });
      }
  
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
  
      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
  
      // Check if user already exists
      const existingUser = await db.select()
        .from(users)
        .where(or(eq(users.email, email), eq(users.username, username)));
  
      if (existingUser.length > 0) {
        if (existingUser.some(u => u.email === email)) {
          return res.status(400).json({ error: 'Email already registered' });
        }
        if (existingUser.some(u => u.username === username)) {
          return res.status(400).json({ error: 'Username already exists' });
        }
      }
  
      // Get default profile if none provided
      let userProfileId = profileId;
      if (!userProfileId) {
        const defaultProfile = await db.select()
          .from(profiles)
          .where(eq(profiles.name, 'Usuário Padrão'))
          .limit(1);
        
        if (defaultProfile.length > 0) {
          userProfileId = defaultProfile[0].id;
        } else {
          // Create default profile if it doesn't exist
          const [newProfile] = await db.insert(profiles).values({
            name: 'Usuário Padrão',
            description: 'Perfil padrão para usuários regulares',
            permissions: ['ANALYSIS_VIEW', 'ANALYSIS_CREATE', 'ANALYSIS_EDIT', 'PROJECTS_VIEW'],
            isDefault: true
          }).returning();
          userProfileId = newProfile.id;
        }
      }
  
      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
  
      // Generate email verification token
      const verificationToken = jwt.sign(
        { email, type: 'email_verification' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
  
      // Create user
      const [newUser] = await db.insert(users).values({
        username,
        email,
        passwordHash,
        profileId: userProfileId,
        isActive: true,
        isEmailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }).returning();
  
      // Send verification email (placeholder - integrate with your email service)
      console.log(`Verification email would be sent to ${email} with token: ${verificationToken}`);
  
      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for verification.',
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          profileId: newUser.profileId
        }
      });
  
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Verify email
  app.post('/api/auth/verify-email', async (req, res) => {
    try {
      const { token } = req.body;
  
      if (!token) {
        return res.status(400).json({ error: 'Verification token is required' });
      }
  
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      if (decoded.type !== 'email_verification') {
        return res.status(400).json({ error: 'Invalid token type' });
      }
  
      // Find user by email and token
      const userResult = await db.select()
        .from(users)
        .where(and(
          eq(users.email, decoded.email),
          eq(users.emailVerificationToken, token)
        ));
  
      if (userResult.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }
  
      const user = userResult[0];
  
      // Check if token is still valid
      if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
        return res.status(400).json({ error: 'Verification token has expired' });
      }
  
      // Update user as verified
      await db.update(users)
        .set({
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));
  
      res.json({
        success: true,
        message: 'Email verified successfully. You can now log in.'
      });
  
    } catch (error) {
      console.error('Email verification error:', error);
      if (error.name === 'JsonWebTokenError') {
        return res.status(400).json({ error: 'Invalid verification token' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(400).json({ error: 'Verification token has expired' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Resend verification email
  app.post('/api/auth/resend-verification', async (req, res) => {
    try {
      const { email } = req.body;
  
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
  
      // Find user
      const userResult = await db.select()
        .from(users)
        .where(eq(users.email, email));
  
      if (userResult.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      const user = userResult[0];
  
      if (user.isEmailVerified) {
        return res.status(400).json({ error: 'Email is already verified' });
      }
  
      // Generate new verification token
      const verificationToken = jwt.sign(
        { email, type: 'email_verification' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
  
      // Update user with new token
      await db.update(users)
        .set({
          emailVerificationToken: verificationToken,
          emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));
  
      // Send verification email (placeholder - integrate with your email service)
      console.log(`Verification email resent to ${email} with token: ${verificationToken}`);
  
      res.json({
        success: true,
        message: 'Verification email sent successfully. Please check your inbox.'
      });
  
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get user profile
  app.get('/api/auth/profile', authenticateToken, async (req: any, res) => {
    try {
      const userResult = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        profileId: users.profileId,
        isActive: users.isActive,
        isEmailVerified: users.isEmailVerified,
        profile: {
          id: profiles.id,
          name: profiles.name,
          permissions: profiles.permissions
        }
      })
      .from(users)
      .leftJoin(profiles, eq(users.profileId, profiles.id))
      .where(eq(users.id, req.user.userId));
  
      if (userResult.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      res.json(userResult[0]);
    } catch (error) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  } // End of if (!ssoEnabled) block for local auth routes
  
  // Custom Fields Microservice Proxy
  const CUSTOM_FIELDS_SERVICE_URL = 'http://localhost:3002';
  
  // Proxy for API endpoints
  app.use('/api/custom-fields-proxy', async (req, res) => {
    try {
      const targetPath = req.originalUrl.replace('/api/custom-fields-proxy', '/api');
      const targetUrl = `${CUSTOM_FIELDS_SERVICE_URL}${targetPath}`;
      
      const proxyOptions: RequestInit = {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
  
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        proxyOptions.body = JSON.stringify(req.body);
      }
  
      const response = await fetch(targetUrl, proxyOptions);
      const data = await response.json();
  
      res.status(response.status).json(data);
    } catch (error) {
      console.error('Custom Fields API proxy error:', error);
      res.status(500).json({ 
        error: 'Failed to communicate with Custom Fields service',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Proxy for Widget assets (CSS, JS, etc) - Direct /widgets/* path
  app.use('/widgets', async (req, res) => {
    try {
      const targetUrl = `${CUSTOM_FIELDS_SERVICE_URL}${req.originalUrl}`;
      
      const response = await fetch(targetUrl);
      const contentType = response.headers.get('content-type');
      
      // Forward the content with appropriate headers
      if (contentType) {
        res.set('Content-Type', contentType);
      }
      
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        res.status(response.status).json(data);
      } else if (contentType?.includes('text/html') || contentType?.includes('javascript') || contentType?.includes('css')) {
        // Text-based content (HTML/JS/CSS) - microservice handles dynamic config injection
        const text = await response.text();
        res.status(response.status).send(text);
      } else {
        const buffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(buffer));
      }
    } catch (error) {
      console.error('Custom Fields widgets proxy error:', error);
      res.status(500).send('Failed to load Custom Fields widgets');
    }
  });
  
  // Proxy for Widget pages via /custom-fields-admin/* (redirects to /widgets/*)
  app.use('/custom-fields-admin', async (req, res) => {
    try {
      const targetPath = req.originalUrl.replace('/custom-fields-admin', '/widgets');
      const targetUrl = `${CUSTOM_FIELDS_SERVICE_URL}${targetPath}`;
      
      const response = await fetch(targetUrl);
      const contentType = response.headers.get('content-type');
      
      // Forward the content with appropriate headers
      if (contentType) {
        res.set('Content-Type', contentType);
      }
      
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        res.status(response.status).json(data);
      } else if (contentType?.includes('text/html')) {
        const html = await response.text();
        res.status(response.status).send(html);
      } else if (contentType?.includes('javascript')) {
        const js = await response.text();
        res.status(response.status).send(js);
      } else if (contentType?.includes('css')) {
        const css = await response.text();
        res.status(response.status).send(css);
      } else {
        const buffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(buffer));
      }
    } catch (error) {
      console.error('Custom Fields admin proxy error:', error);
      res.status(500).send('Failed to load Custom Fields admin panel');
    }
  });
  
  // Projects routes
  app.get('/api/projects', authenticateToken, async (req, res) => {
    try {
      const projectsResult = await db.select().from(projects);
      res.json(projectsResult);
    } catch (error) {
      console.error('Projects fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Helper function to normalize analysis response to camelCase
  const normalizeAnalysis = (row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    author: row.author,
    version: row.version,
    projectId: row.project_id || row.projectId,
    createdBy: row.created_by || row.createdBy,
    data: row.data,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt
  });
  
  // Analyses routes
  app.get('/api/analyses', authenticateToken, async (req, res) => {
    try {
      const analysesResult = await db.select().from(analyses);
      // Normalize to camelCase for frontend
      const normalizedResults = analysesResult.map(normalizeAnalysis);
      res.json(normalizedResults);
    } catch (error) {
      console.error('Analyses fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.post('/api/analyses', authenticateToken, async (req: any, res) => {
    try {
      const { title, description, author, projectId, data } = req.body;
  
      if (!title || !author) {
        return res.status(400).json({ error: 'Title and author are required' });
      }
  
      const newAnalysis = await db.insert(analyses)
        .values({
          title,
          description,
          author,
          projectId,
          data: data || {},
          createdBy: req.user.userId
        })
        .returning();
  
      // Normalize to camelCase for frontend
      res.status(201).json(normalizeAnalysis(newAnalysis[0]));
    } catch (error) {
      console.error('Analysis creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.put('/api/analyses/:id', authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { title, description, author, projectId, data } = req.body;
  
      const updateData: any = { updatedAt: new Date() };
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (author !== undefined) updateData.author = author;
      if (projectId !== undefined) updateData.projectId = projectId;
      if (data !== undefined) updateData.data = data;
  
      const updatedAnalysis = await db.update(analyses)
        .set(updateData)
        .where(eq(analyses.id, id))
        .returning();
  
      if (updatedAnalysis.length === 0) {
        return res.status(404).json({ error: 'Analysis not found' });
      }
  
      // Normalize to camelCase for frontend
      res.json(normalizeAnalysis(updatedAnalysis[0]));
    } catch (error) {
      console.error('Analysis update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.delete('/api/analyses/:id', authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
  
      const deletedAnalysis = await db.delete(analyses)
        .where(eq(analyses.id, id))
        .returning();
  
      if (deletedAnalysis.length === 0) {
        return res.status(404).json({ error: 'Analysis not found' });
      }
  
      res.json({ success: true, message: 'Analysis deleted successfully', data: normalizeAnalysis(deletedAnalysis[0]) });
    } catch (error) {
      console.error('Analysis delete error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Email sending route (replacing Supabase Edge Function)
  app.post('/api/send-email', async (req, res) => {
    try {
      const { to, subject, html, text } = req.body;
  
      if (!to || !subject || !html) {
        return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
      }
  
      // This is a placeholder - you would integrate with your preferred email service
      console.log('Email would be sent:', { to, subject });
      
      res.json({ 
        success: true, 
        message: 'Email sent successfully',
        provider: 'Server-side'
      });
    } catch (error) {
      console.error('Email sending error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Initialize database with seed data
  app.post('/api/init-db', async (req, res) => {
    try {
      // Check if profiles already exist
      const existingProfiles = await db.select().from(profiles);
      
      if (existingProfiles.length === 0) {
        // Insert default profiles
        await db.insert(profiles).values([
          {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'Administrador',
            description: 'Acesso completo a todas as funcionalidades do sistema',
            permissions: [
              "ANALYSIS_CREATE", "ANALYSIS_EDIT", "ANALYSIS_DELETE", "ANALYSIS_VIEW", "ANALYSIS_EXPORT", "ANALYSIS_IMPORT_AI", "ANALYSIS_COPY",
              "PROJECTS_CREATE", "PROJECTS_EDIT", "PROJECTS_DELETE", "PROJECTS_VIEW", "PROJECTS_MANAGE",
              "USERS_CREATE", "USERS_EDIT", "USERS_DELETE", "USERS_VIEW", "USERS_MANAGE",
              "PROFILES_CREATE", "PROFILES_EDIT", "PROFILES_DELETE", "PROFILES_VIEW", "PROFILES_MANAGE"
            ],
            isDefault: false
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            name: 'Usuário Padrão',
            description: 'Acesso básico para criar e visualizar análises',
            permissions: [
              "ANALYSIS_CREATE", "ANALYSIS_EDIT", "ANALYSIS_VIEW", "ANALYSIS_EXPORT",
              "PROJECTS_VIEW"
            ],
            isDefault: true
          }
        ]);
  
        // Insert default project
        await db.insert(projects).values({
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Sistema de Habilitações',
          acronym: 'SH',
          isDefault: true
        });
  
        // Insert admin user
        const hashedPassword = await bcrypt.hash('Senha@1010', 10);
        await db.insert(users).values({
          id: '550e8400-e29b-41d4-a716-446655440004',
          username: 'admin',
          email: 'nuptechs@nuptechs.com',
          passwordHash: hashedPassword,
          profileId: '550e8400-e29b-41d4-a716-446655440001',
          isActive: true,
          isEmailVerified: true
        });
  
        res.json({ success: true, message: 'Database initialized with seed data' });
      } else {
        res.json({ success: true, message: 'Database already initialized' });
      }
    } catch (error) {
      console.error('Database initialization error:', error);
      res.status(500).json({ error: 'Failed to initialize database' });
    }
  });
  
  // Gemini field extraction endpoint
  app.post('/api/gemini-extract', async (req, res) => {
    try {
      const { imageBase64 } = req.body;
  
      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
      }
  
      // Import dynamically to avoid circular dependencies
      const { extractFieldsWithGemini } = await import('../client/src/utils/geminiFieldExtractor');
      
      console.log('🤖 Processing image with Gemini AI...');
      const fields = await extractFieldsWithGemini(imageBase64);
      
      console.log(`✅ Gemini extracted ${fields.length} fields successfully`);
      
      res.json({
        success: true,
        fields,
        source: 'Gemini AI',
        count: fields.length
      });
    } catch (error: any) {
      console.error('Gemini extraction error:', error);
      res.status(500).json({ 
        error: 'Failed to extract fields with Gemini',
        message: error.message 
      });
    }
  });

  // ============================================
  // AI ASSISTANT ROUTES
  // ============================================

  // Generate AI analysis suggestions
  app.post('/api/ai/generate-suggestions', authenticateToken, async (req, res) => {
    try {
      const { title, description, processes } = req.body;
      
      if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
      }

      const { generateAnalysisSuggestions } = await import('./gemini');
      const suggestions = await generateAnalysisSuggestions(title, description, processes || []);
      
      res.json({ success: true, suggestions });
    } catch (error: any) {
      console.error('AI suggestion error:', error);
      res.status(500).json({ error: 'Failed to generate AI suggestions', message: error.message });
    }
  });

  // Improve text with AI
  app.post('/api/ai/improve-text', authenticateToken, async (req, res) => {
    try {
      const { text, context } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      const { improveText } = await import('./gemini');
      const improvedText = await improveText(text, context || 'analysis');
      
      res.json({ success: true, improvedText });
    } catch (error: any) {
      console.error('AI improve text error:', error);
      res.status(500).json({ error: 'Failed to improve text', message: error.message });
    }
  });

  // Get smart suggestions for a field
  app.post('/api/ai/smart-suggestions', authenticateToken, async (req, res) => {
    try {
      const { field, currentValue, analysisContext } = req.body;
      
      if (!field) {
        return res.status(400).json({ error: 'Field name is required' });
      }

      const { generateSmartSuggestions } = await import('./gemini');
      const suggestions = await generateSmartSuggestions(field, currentValue || '', analysisContext || {});
      
      res.json({ success: true, suggestions });
    } catch (error: any) {
      console.error('AI smart suggestions error:', error);
      res.status(500).json({ error: 'Failed to generate suggestions', message: error.message });
    }
  });

  // Chat with AI assistant
  app.post('/api/ai/chat', authenticateToken, async (req, res) => {
    try {
      const { message, history, analysisContext } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const { chatWithAssistant } = await import('./gemini');
      const response = await chatWithAssistant(message, history || [], analysisContext);
      
      res.json({ success: true, response });
    } catch (error: any) {
      console.error('AI chat error:', error);
      res.status(500).json({ error: 'Failed to process chat message', message: error.message });
    }
  });

  // ============================================
  // DASHBOARD ANALYTICS ROUTES
  // ============================================

  // Get dashboard statistics
  app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
    try {
      const analysesCount = await db.select().from(analyses);
      const projectsCount = await db.select().from(projects);
      const usersCount = await db.select().from(users);
      const impactsCount = await db.select().from(impacts);
      const risksCount = await db.select().from(risks);
      
      const stats = {
        totalAnalyses: analysesCount.length,
        totalProjects: projectsCount.length,
        totalUsers: usersCount.length,
        totalImpacts: impactsCount.length,
        totalRisks: risksCount.length,
        recentAnalyses: analysesCount.slice(-5),
      };
      
      res.json({ success: true, stats });
    } catch (error: any) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Failed to get dashboard stats', message: error.message });
    }
  });
}
