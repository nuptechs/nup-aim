import { Express } from 'express';
import express from 'express';
import { db } from './db';
import { users, profiles, projects, analyses, processes, impacts, risks, mitigations, conclusions, fpaGuidelines } from './schema';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { corsMiddleware } from './middleware/cors.middleware';
import { authenticateToken } from './middleware/auth.middleware';
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'nuptechs@nuptechs.com';

let resend: Resend | null = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
  console.log('✅ [Email] Resend configured');
} else {
  console.log('⚠️  [Email] Resend not configured - emails will be simulated');
}

async function sendVerificationEmail(email: string, verificationToken: string): Promise<boolean> {
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : 'http://localhost:5000';
  
  const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
  
  if (!resend) {
    console.log(`📧 [Email] Simulating email to ${email}`);
    console.log(`   Verification URL: ${verificationUrl}`);
    return true;
  }
  
  try {
    const { data, error } = await resend.emails.send({
      from: `NuP_AIM <${SENDER_EMAIL}>`,
      to: email,
      subject: 'NuP_AIM - Verifique seu email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">NuP_AIM</h1>
            <p style="color: #6b7280; margin: 5px 0;">Sistema de Análise de Impacto</p>
          </div>
          
          <h2 style="color: #111827;">Bem-vindo ao NuP_AIM!</h2>
          
          <p style="color: #374151; line-height: 1.6;">
            Sua conta foi criada com sucesso. Para ativar sua conta e começar a usar o sistema, 
            clique no botão abaixo:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 6px; font-weight: bold;
                      display: inline-block;">
              Verificar Email
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Se o botão não funcionar, copie e cole este link no seu navegador:
            <br>
            <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">
              ${verificationUrl}
            </a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px;">
            Este link expira em 24 horas.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            NuPTechs - Sua fábrica de softwares inteligentes
          </p>
        </div>
      `
    });
    
    if (error) {
      console.error(`❌ [Email] Failed to send to ${email}:`, error.message);
      return false;
    }
    
    console.log(`✅ [Email] Verification email sent to ${email} (id: ${data?.id})`);
    return true;
  } catch (error: any) {
    console.error(`❌ [Email] Failed to send to ${email}:`, error.message);
    return false;
  }
}

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

export function registerRoutes(app: Express) {
  // Apply middleware
  app.use(corsMiddleware);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // ============================================
  // HEALTH CHECK
  // ============================================
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      service: 'NuP-AIM', 
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      service: 'NuP-AIM', 
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // ============================================
  // AUTH ROUTES
  // ============================================

  // Auth mode - indicates if SSO or local authentication is used
  app.get('/api/auth/mode', (req, res) => {
    res.json({ 
      mode: 'local', 
      ssoLoginUrl: null, 
      ssoLogoutUrl: null 
    });
  });

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      let { email, password } = req.body;
  
      // Trim spaces from inputs
      const usernameOrEmail = email?.trim();
      password = password?.trim();
  
      if (!usernameOrEmail || !password) {
        return res.status(400).json({ error: 'Email/username and password are required' });
      }
  
      // Find user by email OR username
      const userResult = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        passwordHash: users.passwordHash,
        profileId: users.profileId,
        isActive: users.isActive,
        isEmailVerified: users.isEmailVerified
      }).from(users).where(or(eq(users.email, usernameOrEmail), eq(users.username, usernameOrEmail)));
  
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
  
      // Send verification email
      const emailSent = await sendVerificationEmail(email, verificationToken);
      if (!emailSent) {
        console.log(`⚠️  [Email] Could not send verification email to ${email}, but user was created`);
      }
  
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
  
      // Send verification email
      const emailSent = await sendVerificationEmail(email, verificationToken);
      
      if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
      }
  
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
  
  // Custom Fields API - Local implementation (no external microservice required)
  // Returns empty data gracefully since custom fields are optional
  
  // Get custom fields for a section
  app.get('/api/custom-fields-proxy/custom-fields', async (req, res) => {
    try {
      const section = req.query.section as string;
      // Return empty fields array - custom fields feature not configured
      res.json({ fields: [], section: section || 'default' });
    } catch (error) {
      console.error('Custom Fields API error:', error);
      res.json({ fields: [], error: 'Custom fields not available' });
    }
  });
  
  // Get form values
  app.get('/api/custom-fields-proxy/forms/:formType/:formId/values', async (req, res) => {
    try {
      res.json({ values: {}, formId: req.params.formId });
    } catch (error) {
      console.error('Custom Fields values error:', error);
      res.json({ values: {} });
    }
  });
  
  // Save form values
  app.post('/api/custom-fields-proxy/forms/:formType/:formId/values', async (req, res) => {
    try {
      res.json({ success: true, message: 'Custom fields not configured' });
    } catch (error) {
      console.error('Custom Fields save error:', error);
      res.json({ success: false });
    }
  });
  
  // Register sections
  app.post('/api/custom-fields-proxy/sections/register', async (req, res) => {
    try {
      res.json({ success: true, message: 'Sections registered (local mode)' });
    } catch (error) {
      console.error('Custom Fields register error:', error);
      res.json({ success: true });
    }
  });
  
  // Catch-all for other custom fields endpoints
  app.use('/api/custom-fields-proxy', async (req, res) => {
    res.json({ success: true, message: 'Custom fields service not configured' });
  });
  
  // Widgets endpoint - returns empty response (no external service required)
  app.use('/widgets', async (req, res) => {
    res.status(200).send('<!-- Custom fields widgets not configured -->');
  });
  
  // Custom fields admin endpoint - returns info message
  app.use('/custom-fields-admin', async (req, res) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Campos Personalizados</title></head>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h2>Campos Personalizados</h2>
          <p>O gerenciador de campos personalizados não está configurado neste ambiente.</p>
          <p>Os campos personalizados podem ser adicionados via configuração do sistema.</p>
        </body>
      </html>
    `);
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

  app.post('/api/projects', authenticateToken, async (req: any, res) => {
    try {
      const { name, acronym, isDefault } = req.body;

      if (!name || !acronym) {
        return res.status(400).json({ error: 'Name and acronym are required' });
      }

      // If setting as default, remove default from others
      if (isDefault) {
        await db.update(projects).set({ isDefault: false });
      }

      const newProject = await db.insert(projects)
        .values({
          name,
          acronym,
          isDefault: isDefault || false,
          createdBy: req.user.userId
        })
        .returning();

      res.status(201).json(newProject[0]);
    } catch (error) {
      console.error('Project creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/projects/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, acronym, isDefault } = req.body;

      // If setting as default, remove default from others first
      if (isDefault) {
        await db.update(projects).set({ isDefault: false });
      }

      const updated = await db.update(projects)
        .set({
          name,
          acronym,
          isDefault,
          updatedAt: new Date()
        })
        .where(eq(projects.id, id))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(updated[0]);
    } catch (error) {
      console.error('Project update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;

      // Check if project is used by any analysis
      const usedByAnalysis = await db.select({ id: analyses.id })
        .from(analyses)
        .where(eq(analyses.projectId, id))
        .limit(1);

      if (usedByAnalysis.length > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete project that is used by analyses' 
        });
      }

      // Check how many projects exist
      const allProjects = await db.select().from(projects);
      if (allProjects.length <= 1) {
        return res.status(400).json({ 
          error: 'Cannot delete the last project' 
        });
      }

      await db.delete(projects).where(eq(projects.id, id));

      res.json({ success: true });
    } catch (error) {
      console.error('Project delete error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Analyses routes
  
  // Get all analyses for current user (with summary info) - MUST be before /:id route
  app.get('/api/analyses/list/all', authenticateToken, async (req: any, res) => {
    try {
      const analysesResult = await db.select({
        id: analyses.id,
        title: analyses.title,
        description: analyses.description,
        author: analyses.author,
        version: analyses.version,
        projectId: analyses.projectId,
        createdAt: analyses.createdAt,
        updatedAt: analyses.updatedAt
      }).from(analyses);
      
      // Get processes for each analysis to include in the response
      const analysisIds = analysesResult.map(a => a.id);
      const allProcesses = analysisIds.length > 0 
        ? await db.select().from(processes).where(inArray(processes.analysisId, analysisIds))
        : [];
      
      // Group processes by analysis ID
      const processesByAnalysis: Record<string, any[]> = {};
      for (const p of allProcesses) {
        if (!processesByAnalysis[p.analysisId!]) {
          processesByAnalysis[p.analysisId!] = [];
        }
        processesByAnalysis[p.analysisId!].push({
          id: p.id,
          name: p.name,
          status: p.status,
          workDetails: p.workDetails || '',
          screenshots: p.screenshots || '',
          websisCreated: p.websisCreated || false
        });
      }
      
      // Transform for frontend with complete structure
      const result = analysesResult.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description || '',
        author: a.author || '',
        date: a.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        version: a.version || '1.0',
        project: a.projectId || '',
        scope: {
          processes: processesByAnalysis[a.id] || []
        },
        impacts: { business: [], technical: [], operational: [], financial: [] },
        risks: [],
        mitigations: [],
        conclusions: { summary: '', recommendations: [], nextSteps: [] }
      }));
      
      res.json(result);
    } catch (error) {
      console.error('Analyses list error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.get('/api/analyses', authenticateToken, async (req, res) => {
    try {
      const analysesResult = await db.select().from(analyses);
      res.json(analysesResult);
    } catch (error) {
      console.error('Analyses fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.post('/api/analyses', authenticateToken, async (req: any, res) => {
    try {
      const { title, description, author, projectId } = req.body;
  
      if (!title || !author) {
        return res.status(400).json({ error: 'Title and author are required' });
      }
  
      const newAnalysis = await db.insert(analyses)
        .values({
          title,
          description,
          author,
          projectId,
          createdBy: req.user.userId
        })
        .returning();
  
      res.status(201).json(newAnalysis[0]);
    } catch (error) {
      console.error('Analysis creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get single analysis with all related data
  app.get('/api/analyses/:id', authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Get analysis
      const [analysis] = await db.select().from(analyses).where(eq(analyses.id, id));
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }
      
      // Get related data in parallel
      const [processesData, impactsData, risksData, mitigationsData, conclusionsData] = await Promise.all([
        db.select().from(processes).where(eq(processes.analysisId, id)),
        db.select().from(impacts).where(eq(impacts.analysisId, id)),
        db.select().from(risks).where(eq(risks.analysisId, id)),
        db.select().from(mitigations).where(eq(mitigations.analysisId, id)),
        db.select().from(conclusions).where(eq(conclusions.analysisId, id))
      ]);
      
      // Transform to frontend format
      const result = {
        id: analysis.id,
        title: analysis.title,
        description: analysis.description || '',
        author: analysis.author,
        date: analysis.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        version: analysis.version || '1.0',
        project: analysis.projectId || '',
        scope: {
          processes: processesData.map(p => ({
            id: p.id,
            name: p.name,
            status: p.status,
            workDetails: p.workDetails || '',
            screenshots: p.screenshots || '',
            websisCreated: p.websisCreated || false
          }))
        },
        impacts: {
          business: impactsData.filter(i => i.category === 'business').map(i => ({
            id: i.id, description: i.description, severity: i.severity, probability: i.probability, category: i.category
          })),
          technical: impactsData.filter(i => i.category === 'technical').map(i => ({
            id: i.id, description: i.description, severity: i.severity, probability: i.probability, category: i.category
          })),
          operational: impactsData.filter(i => i.category === 'operational').map(i => ({
            id: i.id, description: i.description, severity: i.severity, probability: i.probability, category: i.category
          })),
          financial: impactsData.filter(i => i.category === 'financial').map(i => ({
            id: i.id, description: i.description, severity: i.severity, probability: i.probability, category: i.category
          }))
        },
        risks: risksData.map(r => ({
          id: r.id, description: r.description, impact: r.impact, probability: r.probability, mitigation: r.mitigation || ''
        })),
        mitigations: mitigationsData.map(m => ({
          id: m.id, action: m.action, responsible: m.responsible, deadline: m.deadline ? (typeof m.deadline === 'string' ? m.deadline : (m.deadline as Date).toISOString().split('T')[0]) : '', priority: m.priority
        })),
        conclusions: conclusionsData[0] ? {
          summary: conclusionsData[0].summary || '',
          recommendations: (conclusionsData[0].recommendations as string[]) || [],
          nextSteps: (conclusionsData[0].nextSteps as string[]) || []
        } : { summary: '', recommendations: [], nextSteps: [] }
      };
      
      res.json(result);
    } catch (error) {
      console.error('Analysis fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Save complete analysis (create or update)
  app.put('/api/analyses/:id', authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      const analysisData = req.body;
      
      // Check if analysis exists first (needed to preserve projectId if lookup fails)
      const [existing] = await db.select().from(analyses).where(eq(analyses.id, id));
      
      // Resolve projectId - could be UUID, name, or acronym
      // Default to existing projectId to preserve association if lookup fails
      let resolvedProjectId: string | null = existing?.projectId ?? null;
      let projectLookupFailed = false;
      
      if (analysisData.project) {
        const projectValue = analysisData.project;
        // Check if it's already a valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(projectValue)) {
          // Verify project exists
          const [existingProject] = await db.select({ id: projects.id })
            .from(projects)
            .where(eq(projects.id, projectValue))
            .limit(1);
          if (existingProject) {
            resolvedProjectId = projectValue;
          } else {
            projectLookupFailed = true;
          }
        } else {
          // Try to find project by name or acronym
          const [foundProject] = await db.select({ id: projects.id })
            .from(projects)
            .where(or(
              eq(projects.name, projectValue),
              eq(projects.acronym, projectValue)
            ))
            .limit(1);
          if (foundProject) {
            resolvedProjectId = foundProject.id;
          } else {
            projectLookupFailed = true;
          }
        }
        // If project lookup failed, keep existing projectId (already set as default)
      } else if (analysisData.project === null || analysisData.project === '') {
        // Explicitly clear project association only if null/empty was intentionally sent
        resolvedProjectId = null;
      }
      
      let analysisId = id;
      
      if (existing) {
        // Update existing analysis
        await db.update(analyses)
          .set({
            title: analysisData.title,
            description: analysisData.description,
            author: analysisData.author || '',
            version: analysisData.version,
            projectId: resolvedProjectId,
            updatedAt: new Date()
          })
          .where(eq(analyses.id, id));
          
        // Delete existing related data
        await Promise.all([
          db.delete(processes).where(eq(processes.analysisId, id)),
          db.delete(impacts).where(eq(impacts.analysisId, id)),
          db.delete(risks).where(eq(risks.analysisId, id)),
          db.delete(mitigations).where(eq(mitigations.analysisId, id)),
          db.delete(conclusions).where(eq(conclusions.analysisId, id))
        ]);
      } else {
        // Create new analysis
        const [newAnalysis] = await db.insert(analyses)
          .values({
            id,
            title: analysisData.title,
            description: analysisData.description,
            author: analysisData.author || '',
            version: analysisData.version,
            projectId: resolvedProjectId,
            createdBy: req.user.userId
          })
          .returning();
        analysisId = newAnalysis.id;
      }
      
      // Insert processes
      if (analysisData.scope?.processes?.length > 0) {
        await db.insert(processes).values(
          analysisData.scope.processes.map((p: any) => ({
            id: p.id.includes('-') ? p.id : undefined, // Use provided UUID or let DB generate
            analysisId,
            name: p.name,
            status: p.status,
            workDetails: p.workDetails || null,
            screenshots: p.screenshots || null,
            websisCreated: p.websisCreated || false
          }))
        );
      }
      
      // Insert impacts (flatten all categories)
      const allImpacts = [
        ...(analysisData.impacts?.business || []).map((i: any) => ({ ...i, category: 'business' })),
        ...(analysisData.impacts?.technical || []).map((i: any) => ({ ...i, category: 'technical' })),
        ...(analysisData.impacts?.operational || []).map((i: any) => ({ ...i, category: 'operational' })),
        ...(analysisData.impacts?.financial || []).map((i: any) => ({ ...i, category: 'financial' }))
      ];
      
      if (allImpacts.length > 0) {
        await db.insert(impacts).values(
          allImpacts.map((i: any) => ({
            analysisId,
            description: i.description,
            severity: i.severity,
            probability: i.probability,
            category: i.category
          }))
        );
      }
      
      // Insert risks
      if (analysisData.risks?.length > 0) {
        await db.insert(risks).values(
          analysisData.risks.map((r: any) => ({
            analysisId,
            description: r.description,
            impact: r.impact,
            probability: r.probability,
            mitigation: r.mitigation || null
          }))
        );
      }
      
      // Insert mitigations
      if (analysisData.mitigations?.length > 0) {
        await db.insert(mitigations).values(
          analysisData.mitigations.map((m: any) => ({
            analysisId,
            action: m.action,
            responsible: m.responsible,
            deadline: m.deadline ? new Date(m.deadline) : null,
            priority: m.priority
          }))
        );
      }
      
      // Insert conclusions
      if (analysisData.conclusions) {
        await db.insert(conclusions).values({
          analysisId,
          summary: analysisData.conclusions.summary || null,
          recommendations: analysisData.conclusions.recommendations || [],
          nextSteps: analysisData.conclusions.nextSteps || []
        });
      }
      
      res.json({ success: true, id: analysisId });
    } catch (error) {
      console.error('Analysis save error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Delete analysis and all related data
  app.delete('/api/analyses/:id', authenticateToken, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Delete related data first
      await Promise.all([
        db.delete(processes).where(eq(processes.analysisId, id)),
        db.delete(impacts).where(eq(impacts.analysisId, id)),
        db.delete(risks).where(eq(risks.analysisId, id)),
        db.delete(mitigations).where(eq(mitigations.analysisId, id)),
        db.delete(conclusions).where(eq(conclusions.analysisId, id))
      ]);
      
      // Delete analysis
      await db.delete(analyses).where(eq(analyses.id, id));
      
      res.json({ success: true });
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

  // Analyze content and extract function points
  app.post('/api/ai/analyze-function-points', authenticateToken, async (req, res) => {
    try {
      const { inputs } = req.body;
      
      if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
        return res.status(400).json({ error: 'Inputs array is required' });
      }

      const { analyzeWithAI, calculateFunctionPoints } = await import('./services/functionPointAnalyzer');
      const result = await analyzeWithAI(inputs);
      
      if (result.functionalities && result.functionalities.length > 0) {
        result.totalPoints = calculateFunctionPoints(result.functionalities);
      }
      
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Function point analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze function points', message: error.message });
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

  // ============================================
  // FPA GUIDELINES ROUTES (Diretrizes de APF)
  // ============================================

  // Get all FPA guidelines
  app.get('/api/fpa-guidelines', authenticateToken, async (req, res) => {
    try {
      const guidelines = await db.select().from(fpaGuidelines).where(eq(fpaGuidelines.isActive, true));
      res.json({ success: true, guidelines });
    } catch (error: any) {
      console.error('Get FPA guidelines error:', error);
      res.status(500).json({ error: 'Failed to get FPA guidelines', message: error.message });
    }
  });

  // Get single FPA guideline
  app.get('/api/fpa-guidelines/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.select().from(fpaGuidelines).where(eq(fpaGuidelines.id, id));
      if (result.length === 0) {
        return res.status(404).json({ error: 'Guideline not found' });
      }
      res.json({ success: true, guideline: result[0] });
    } catch (error: any) {
      console.error('Get FPA guideline error:', error);
      res.status(500).json({ error: 'Failed to get FPA guideline', message: error.message });
    }
  });

  // Create FPA guideline (admin only)
  app.post('/api/fpa-guidelines', authenticateToken, async (req: any, res) => {
    try {
      const { title, triggerPhrases, businessDomains, instruction, examples, negativeExamples, priority } = req.body;
      
      if (!title || !instruction) {
        return res.status(400).json({ error: 'Title and instruction are required' });
      }

      const newGuideline = await db.insert(fpaGuidelines).values({
        title,
        triggerPhrases: triggerPhrases || [],
        businessDomains: businessDomains || [],
        instruction,
        examples: examples || [],
        negativeExamples: negativeExamples || [],
        priority: priority || 'normal',
        createdBy: req.user?.userId,
      }).returning();

      res.json({ success: true, guideline: newGuideline[0] });
    } catch (error: any) {
      console.error('Create FPA guideline error:', error);
      res.status(500).json({ error: 'Failed to create FPA guideline', message: error.message });
    }
  });

  // Update FPA guideline (admin only)
  app.put('/api/fpa-guidelines/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, triggerPhrases, businessDomains, instruction, examples, negativeExamples, priority, isActive } = req.body;

      const updated = await db.update(fpaGuidelines)
        .set({
          title,
          triggerPhrases,
          businessDomains,
          instruction,
          examples,
          negativeExamples,
          priority,
          isActive,
          updatedAt: new Date()
        })
        .where(eq(fpaGuidelines.id, id))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: 'Guideline not found' });
      }

      res.json({ success: true, guideline: updated[0] });
    } catch (error: any) {
      console.error('Update FPA guideline error:', error);
      res.status(500).json({ error: 'Failed to update FPA guideline', message: error.message });
    }
  });

  // Delete FPA guideline (soft delete)
  app.delete('/api/fpa-guidelines/:id', authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      const deleted = await db.update(fpaGuidelines)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(fpaGuidelines.id, id))
        .returning();

      if (deleted.length === 0) {
        return res.status(404).json({ error: 'Guideline not found' });
      }

      res.json({ success: true, message: 'Guideline deleted' });
    } catch (error: any) {
      console.error('Delete FPA guideline error:', error);
      res.status(500).json({ error: 'Failed to delete FPA guideline', message: error.message });
    }
  });

  // Get all active guidelines for AI analysis (internal use)
  app.get('/api/fpa-guidelines/active/all', authenticateToken, async (req, res) => {
    try {
      const guidelines = await db.select().from(fpaGuidelines).where(eq(fpaGuidelines.isActive, true));
      res.json({ success: true, guidelines });
    } catch (error: any) {
      console.error('Get active FPA guidelines error:', error);
      res.status(500).json({ error: 'Failed to get active FPA guidelines', message: error.message });
    }
  });
}
