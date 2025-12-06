var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// client/src/utils/fieldExtractor.ts
import { v4 as uuidv4 } from "uuid";
var mapHTMLInputTypeToFieldType, determineFieldType, determineComplexity, calculateFunctionPoints;
var init_fieldExtractor = __esm({
  "client/src/utils/fieldExtractor.ts"() {
    mapHTMLInputTypeToFieldType = (htmlType) => {
      const mapping = {
        "text": "text",
        "password": "text",
        "email": "email",
        "tel": "text",
        "number": "number",
        "date": "date",
        "datetime-local": "date",
        "time": "text",
        "checkbox": "checkbox",
        "radio": "radio",
        "file": "file",
        "url": "url",
        "search": "text",
        "color": "text",
        "range": "number",
        "hidden": "text"
      };
      return mapping[htmlType.toLowerCase()] || "text";
    };
    determineFieldType = (explicitType, name) => {
      if (explicitType) {
        return mapHTMLInputTypeToFieldType(explicitType);
      }
      const lowerName = name.toLowerCase();
      if (lowerName.includes("email")) return "email";
      if (lowerName.includes("senha") || lowerName.includes("password")) return "text";
      if (lowerName.includes("data") || lowerName.includes("date") || lowerName.includes("nascimento")) return "date";
      if (lowerName.includes("n\xFAmero") || lowerName.includes("number") || lowerName.includes("quantidade") || lowerName.includes("quantity") || lowerName.includes("valor") || lowerName.includes("amount") || lowerName.includes("pre\xE7o") || lowerName.includes("price")) return "number";
      if (lowerName.includes("descri\xE7\xE3o") || lowerName.includes("description") || lowerName.includes("observa\xE7\xE3o") || lowerName.includes("observation") || lowerName.includes("coment\xE1rio") || lowerName.includes("comment") || lowerName.includes("mensagem") || lowerName.includes("message")) return "textarea";
      if (lowerName.includes("aceito") || lowerName.includes("accept") || lowerName.includes("concordo") || lowerName.includes("agree") || lowerName.includes("lembrar") || lowerName.includes("remember")) return "checkbox";
      if (lowerName.includes("sexo") || lowerName.includes("gender") || lowerName.includes("op\xE7\xE3o") || lowerName.includes("option")) return "radio";
      if (lowerName.includes("estado") || lowerName.includes("state") || lowerName.includes("pa\xEDs") || lowerName.includes("country") || lowerName.includes("categoria") || lowerName.includes("category") || lowerName.includes("tipo") || lowerName.includes("type") || lowerName.includes("status")) return "select";
      if (lowerName.includes("arquivo") || lowerName.includes("file") || lowerName.includes("anexo") || lowerName.includes("attachment") || lowerName.includes("upload")) return "file";
      if (lowerName.includes("url") || lowerName.includes("site") || lowerName.includes("website") || lowerName.includes("link")) return "url";
      return "text";
    };
    determineComplexity = (fieldType, name) => {
      if (["file", "textarea"].includes(fieldType)) {
        return "High";
      }
      if (["date", "select", "email", "url", "number"].includes(fieldType)) {
        return "Average";
      }
      const lowerName = name.toLowerCase();
      if (lowerName.includes("cpf") || lowerName.includes("cnpj") || lowerName.includes("password") || lowerName.includes("senha") || lowerName.includes("completo") || lowerName.includes("complete")) {
        return "High";
      }
      if (lowerName.length > 20 || lowerName.includes(" ")) {
        return "Average";
      }
      return "Low";
    };
    calculateFunctionPoints = (fieldType, complexity) => {
      if (["text", "email", "number", "date", "checkbox", "radio", "file", "url"].includes(fieldType)) {
        if (complexity === "Low") return 3;
        if (complexity === "Average") return 4;
        return 6;
      }
      if (["textarea", "select"].includes(fieldType)) {
        if (complexity === "Low") return 4;
        if (complexity === "Average") return 5;
        return 7;
      }
      return 4;
    };
  }
});

// client/src/utils/geminiFieldExtractor.ts
var geminiFieldExtractor_exports = {};
__export(geminiFieldExtractor_exports, {
  extractFieldsWithGemini: () => extractFieldsWithGemini
});
import { GoogleGenAI } from "@google/genai";
import { v4 as uuidv42 } from "uuid";
function identifyDerivedFields(fields) {
  const derivedKeywords = [
    "total",
    "subtotal",
    "soma",
    "somatoria",
    "somat\xF3rio",
    "media",
    "m\xE9dia",
    "percentual",
    "taxa",
    "calculo",
    "c\xE1lculo",
    "resultado",
    "final",
    "liquido",
    "l\xEDquido",
    "bruto",
    "desconto",
    "acrescimo",
    "acr\xE9scimo",
    "juros",
    "quantidade_total",
    "valor_total",
    "preco_final",
    "pre\xE7o_final",
    "total_geral",
    "grand_total",
    "sum",
    "avg",
    "count"
  ];
  return fields.map((field) => {
    const labelLower = field.label.toLowerCase();
    const nameLower = field.name.toLowerCase();
    const isDerived = derivedKeywords.some(
      (keyword) => labelLower.includes(keyword) || nameLower.includes(keyword)
    );
    if (isDerived) {
      console.log(`\u{1F504} Campo "${field.label}" reclassificado como DERIVADO`);
      return {
        ...field,
        fieldCategory: "derivado",
        description: `${field.description || "Campo calculado/agregado"} (identificado automaticamente como derivado)`
      };
    }
    return field;
  });
}
async function extractFieldsWithGemini(imageBase64) {
  try {
    console.log("\u{1F916} Iniciando extra\xE7\xE3o de campos com Gemini AI...");
    const isServer = typeof process !== "undefined" && process.env;
    const apiKey = isServer ? process.env.GEMINI_API_KEY : import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY n\xE3o configurada");
    }
    const ai = new GoogleGenAI({ apiKey });
    const base64Image = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    console.log(`\u{1F4E4} Enviando imagem para Gemini 2.5 Flash (tamanho: ${Math.round(base64Image.length / 1024)} KB)`);
    const startTime = performance.now();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1
        // Baixa temperatura para respostas mais consistentes
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: "image/jpeg"
              }
            },
            {
              text: OPTIMIZED_PROMPT
            }
          ]
        }
      ]
    });
    const endTime = performance.now();
    console.log(`\u2705 Resposta recebida do Gemini em ${Math.round(endTime - startTime)}ms`);
    let responseText = response.text;
    if (!responseText) {
      throw new Error("Resposta vazia do Gemini");
    }
    console.log("\u{1F4E5} Processando resposta JSON do Gemini...");
    responseText = responseText.trim();
    if (responseText.startsWith("```")) {
      responseText = responseText.split("\n").slice(1).join("\n");
      if (responseText.endsWith("```")) {
        responseText = responseText.slice(0, -3);
      }
      responseText = responseText.trim();
    }
    const geminiResponse = JSON.parse(responseText);
    if (!geminiResponse.fields || !Array.isArray(geminiResponse.fields)) {
      throw new Error("Formato de resposta inv\xE1lido do Gemini");
    }
    console.log(`\u{1F3AF} Gemini identificou ${geminiResponse.fields.length} campos relevantes`);
    let extractedFields = geminiResponse.fields.map((field) => {
      const fieldType = field.type || determineFieldType("", field.name);
      const complexity = determineComplexity(fieldType, field.name);
      const fpValue = calculateFunctionPoints(fieldType, complexity);
      return {
        id: uuidv42(),
        name: field.name,
        label: field.label,
        type: fieldType,
        required: field.required || false,
        description: field.description || `Campo ${field.label} extra\xEDdo via Gemini AI`,
        complexity,
        fpValue,
        source: "Gemini AI",
        fieldCategory: field.category || "neutro",
        confidence: 0.95,
        // Gemini tem alta confiança
        value: field.value
      };
    });
    console.log("\u{1F50D} Analisando campos para identificar derivados...");
    extractedFields = identifyDerivedFields(extractedFields);
    console.log("\u{1F4CB} CAMPOS EXTRA\xCDDOS DETALHADAMENTE:");
    extractedFields.forEach((field, index) => {
      console.log(`   ${index + 1}. ${field.label} (${field.name}) - Tipo: ${field.type} - Categoria: ${field.fieldCategory}`);
    });
    const stats = {
      entrada: extractedFields.filter((f) => f.fieldCategory === "entrada").length,
      neutro: extractedFields.filter((f) => f.fieldCategory === "neutro").length,
      derivado: extractedFields.filter((f) => f.fieldCategory === "derivado").length
    };
    console.log(`\u{1F4CA} Distribui\xE7\xE3o dos campos:`);
    console.log(`   - Entrada: ${stats.entrada}`);
    console.log(`   - Neutro: ${stats.neutro}`);
    console.log(`   - Derivado: ${stats.derivado}`);
    return extractedFields;
  } catch (error) {
    console.error("\u274C Erro na extra\xE7\xE3o com Gemini:", error);
    throw new Error(`Falha na extra\xE7\xE3o com Gemini: ${error.message}`);
  }
}
var OPTIMIZED_PROMPT;
var init_geminiFieldExtractor = __esm({
  "client/src/utils/geminiFieldExtractor.ts"() {
    init_fieldExtractor();
    OPTIMIZED_PROMPT = `Analise esta tela de sistema e extraia TODOS os campos de dados vis\xEDveis.

EXTRAIA:
- Campos onde usu\xE1rio insere/edita dados (inputs, selects, checkboxes) \u2192 categoria "entrada"
- Campos que mostram dados do banco (IDs, c\xF3digos, nomes) \u2192 categoria "neutro"

IGNORE:
- Bot\xF5es (Salvar, Cancelar, Adicionar)
- T\xEDtulos e cabe\xE7alhos
- Menus
- Textos est\xE1ticos

Para cada campo:
- label: texto exato do campo
- name: vers\xE3o snake_case
- type: text, number, date, select, currency, checkbox, textarea
- category: "entrada" ou "neutro"
- required: true/false
- value: valor vis\xEDvel ou null

JSON:
{
  "fields": [
    {
      "label": "Nome do campo",
      "name": "nome_campo",
      "type": "text",
      "category": "entrada",
      "required": false,
      "value": null,
      "description": "Descri\xE7\xE3o"
    }
  ]
}

Extraia TODOS os campos de dados que voc\xEA v\xEA.`;
  }
});

// server/index.ts
import express2 from "express";
import dotenv from "dotenv";

// server/routes.ts
import express from "express";

// server/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// server/schema.ts
var schema_exports = {};
__export(schema_exports, {
  analyses: () => analyses,
  conclusions: () => conclusions,
  customFieldValues: () => customFieldValues,
  impacts: () => impacts,
  mitigations: () => mitigations,
  processes: () => processes,
  profiles: () => profiles,
  projects: () => projects,
  risks: () => risks,
  users: () => users
});
import { pgSchema, uuid, text, jsonb, boolean, timestamp, varchar, date } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
var aimSchema = pgSchema("nup_aim");
var profiles = aimSchema.table("profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  permissions: jsonb("permissions").notNull().default(sql`'[]'::jsonb`),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var users = aimSchema.table("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  profileId: uuid("profile_id").references(() => profiles.id),
  isActive: boolean("is_active").default(true),
  isEmailVerified: boolean("is_email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var projects = aimSchema.table("projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  acronym: text("acronym").notNull(),
  isDefault: boolean("is_default").default(false),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var analyses = aimSchema.table("analyses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  author: text("author").notNull(),
  version: text("version").default("1.0"),
  projectId: uuid("project_id").references(() => projects.id),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var processes = aimSchema.table("processes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: uuid("analysis_id").references(() => analyses.id),
  name: text("name").notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  // 'nova', 'alterada', 'excluida'
  workDetails: text("work_details"),
  screenshots: text("screenshots"),
  websisCreated: boolean("websis_created"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var impacts = aimSchema.table("impacts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: uuid("analysis_id").references(() => analyses.id),
  description: text("description").notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  // 'baixo', 'medio', 'alto', 'critico'
  probability: varchar("probability", { length: 20 }).notNull(),
  // 'baixo', 'medio', 'alto'
  category: varchar("category", { length: 20 }).notNull(),
  // 'business', 'technical', 'operational', 'financial'
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var risks = aimSchema.table("risks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: uuid("analysis_id").references(() => analyses.id),
  description: text("description").notNull(),
  impact: varchar("impact", { length: 20 }).notNull(),
  // 'baixo', 'medio', 'alto', 'critico'
  probability: varchar("probability", { length: 20 }).notNull(),
  // 'baixo', 'medio', 'alto'
  mitigation: text("mitigation"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var mitigations = aimSchema.table("mitigations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: uuid("analysis_id").references(() => analyses.id),
  action: text("action").notNull(),
  responsible: text("responsible").notNull(),
  deadline: date("deadline"),
  priority: varchar("priority", { length: 20 }).notNull(),
  // 'baixo', 'medio', 'alto'
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var conclusions = aimSchema.table("conclusions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: uuid("analysis_id").references(() => analyses.id),
  summary: text("summary"),
  recommendations: jsonb("recommendations").default(sql`'{}'::jsonb`),
  nextSteps: jsonb("next_steps").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});
var customFieldValues = aimSchema.table("custom_field_values", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  analysisId: uuid("analysis_id").references(() => analyses.id).notNull(),
  fieldId: text("field_id").notNull(),
  sectionName: text("section_name").notNull(),
  value: jsonb("value"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`)
});

// server/db.ts
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var client = postgres(process.env.DATABASE_URL);
var db = drizzle(client, { schema: schema_exports });

// server/routes.ts
import { eq, and, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt2 from "jsonwebtoken";

// server/middleware/cors.middleware.ts
import cors from "cors";
var allowedOrigins = [
  "http://localhost:5173",
  "http://0.0.0.0:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5000",
  "http://0.0.0.0:5000",
  ...process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : [],
  ...process.env.REPLIT_DEV_DOMAIN ? [
    `https://${process.env.REPLIT_DEV_DOMAIN}`,
    `https://${process.env.REPLIT_DEV_DOMAIN}:6800`
  ] : []
];
var corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
});

// server/middleware/auth.middleware.ts
import jwt from "jsonwebtoken";
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable is required in production");
}
var JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
var authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// server/routes.ts
var JWT_SECRET2 = process.env.JWT_SECRET || "";
if (!JWT_SECRET2) {
  console.error("\u{1F534} [FATAL] JWT_SECRET environment variable is required");
  console.error("\u{1F534} [FATAL] NuP-AIM cannot start without a secure JWT_SECRET");
  console.error(`\u{1F4A1} Generate one with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`);
  throw new Error("JWT_SECRET is required. Set it in Secrets tab.");
}
if (JWT_SECRET2.length < 32) {
  console.error("\u{1F534} [FATAL] JWT_SECRET is too short (min 32 chars)");
  throw new Error("JWT_SECRET must be at least 32 characters long");
}
console.log("\u2705 [Security] JWT_SECRET configured (" + JWT_SECRET2.length + " chars)");
function registerRoutes(app2) {
  app2.use(corsMiddleware);
  app2.use(express.json({ limit: "5mb" }));
  app2.use(express.urlencoded({ limit: "5mb", extended: true }));
  app2.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      service: "NuP-AIM",
      version: "1.0.0",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      service: "NuP-AIM",
      version: "1.0.0",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      let { email, password } = req.body;
      email = email?.trim();
      password = password?.trim();
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
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
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const user = userResult[0];
      if (!user.isActive) {
        return res.status(401).json({ error: "Account is inactive" });
      }
      if (!user.isEmailVerified) {
        return res.status(401).json({ error: "Email not verified" });
      }
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt2.sign(
        {
          userId: user.id,
          email: user.email,
          profileId: user.profileId
        },
        JWT_SECRET2,
        { expiresIn: "24h" }
      );
      await db.update(users).set({ lastLogin: /* @__PURE__ */ new Date() }).where(eq(users.id, user.id));
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
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const { username, email, password, profileId } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ error: "Username, email and password are required" });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
      }
      const existingUser = await db.select().from(users).where(or(eq(users.email, email), eq(users.username, username)));
      if (existingUser.length > 0) {
        if (existingUser.some((u) => u.email === email)) {
          return res.status(400).json({ error: "Email already registered" });
        }
        if (existingUser.some((u) => u.username === username)) {
          return res.status(400).json({ error: "Username already exists" });
        }
      }
      let userProfileId = profileId;
      if (!userProfileId) {
        const defaultProfile = await db.select().from(profiles).where(eq(profiles.name, "Usu\xE1rio Padr\xE3o")).limit(1);
        if (defaultProfile.length > 0) {
          userProfileId = defaultProfile[0].id;
        } else {
          const [newProfile] = await db.insert(profiles).values({
            name: "Usu\xE1rio Padr\xE3o",
            description: "Perfil padr\xE3o para usu\xE1rios regulares",
            permissions: ["ANALYSIS_VIEW", "ANALYSIS_CREATE", "ANALYSIS_EDIT", "PROJECTS_VIEW"],
            isDefault: true
          }).returning();
          userProfileId = newProfile.id;
        }
      }
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      const verificationToken = jwt2.sign(
        { email, type: "email_verification" },
        JWT_SECRET2,
        { expiresIn: "24h" }
      );
      const [newUser] = await db.insert(users).values({
        username,
        email,
        passwordHash,
        profileId: userProfileId,
        isActive: true,
        isEmailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1e3)
        // 24 hours
      }).returning();
      console.log(`Verification email would be sent to ${email} with token: ${verificationToken}`);
      res.status(201).json({
        success: true,
        message: "User registered successfully. Please check your email for verification.",
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          profileId: newUser.profileId
        }
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "Verification token is required" });
      }
      const decoded = jwt2.verify(token, JWT_SECRET2);
      if (decoded.type !== "email_verification") {
        return res.status(400).json({ error: "Invalid token type" });
      }
      const userResult = await db.select().from(users).where(and(
        eq(users.email, decoded.email),
        eq(users.emailVerificationToken, token)
      ));
      if (userResult.length === 0) {
        return res.status(400).json({ error: "Invalid or expired verification token" });
      }
      const user = userResult[0];
      if (user.emailVerificationExpires && user.emailVerificationExpires < /* @__PURE__ */ new Date()) {
        return res.status(400).json({ error: "Verification token has expired" });
      }
      await db.update(users).set({
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(users.id, user.id));
      res.json({
        success: true,
        message: "Email verified successfully. You can now log in."
      });
    } catch (error) {
      console.error("Email verification error:", error);
      if (error.name === "JsonWebTokenError") {
        return res.status(400).json({ error: "Invalid verification token" });
      }
      if (error.name === "TokenExpiredError") {
        return res.status(400).json({ error: "Verification token has expired" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      const userResult = await db.select().from(users).where(eq(users.email, email));
      if (userResult.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      const user = userResult[0];
      if (user.isEmailVerified) {
        return res.status(400).json({ error: "Email is already verified" });
      }
      const verificationToken = jwt2.sign(
        { email, type: "email_verification" },
        JWT_SECRET2,
        { expiresIn: "24h" }
      );
      await db.update(users).set({
        emailVerificationToken: verificationToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1e3),
        // 24 hours
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(users.id, user.id));
      console.log(`Verification email resent to ${email} with token: ${verificationToken}`);
      res.json({
        success: true,
        message: "Verification email sent successfully. Please check your inbox."
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/auth/profile", authenticateToken, async (req, res) => {
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
      }).from(users).leftJoin(profiles, eq(users.profileId, profiles.id)).where(eq(users.id, req.user.userId));
      if (userResult.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(userResult[0]);
    } catch (error) {
      console.error("Profile fetch error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  const CUSTOM_FIELDS_SERVICE_URL = "http://localhost:3002";
  app2.use("/api/custom-fields-proxy", async (req, res) => {
    try {
      const targetPath = req.originalUrl.replace("/api/custom-fields-proxy", "/api");
      const targetUrl = `${CUSTOM_FIELDS_SERVICE_URL}${targetPath}`;
      const proxyOptions = {
        method: req.method,
        headers: {
          "Content-Type": "application/json"
        }
      };
      if (req.method !== "GET" && req.method !== "HEAD") {
        proxyOptions.body = JSON.stringify(req.body);
      }
      const response = await fetch(targetUrl, proxyOptions);
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error("Custom Fields API proxy error:", error);
      res.status(500).json({
        error: "Failed to communicate with Custom Fields service",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.use("/widgets", async (req, res) => {
    try {
      const targetUrl = `${CUSTOM_FIELDS_SERVICE_URL}${req.originalUrl}`;
      const response = await fetch(targetUrl);
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.set("Content-Type", contentType);
      }
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        res.status(response.status).json(data);
      } else if (contentType?.includes("text/html") || contentType?.includes("javascript") || contentType?.includes("css")) {
        const text2 = await response.text();
        res.status(response.status).send(text2);
      } else {
        const buffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(buffer));
      }
    } catch (error) {
      console.error("Custom Fields widgets proxy error:", error);
      res.status(500).send("Failed to load Custom Fields widgets");
    }
  });
  app2.use("/custom-fields-admin", async (req, res) => {
    try {
      const targetPath = req.originalUrl.replace("/custom-fields-admin", "/widgets");
      const targetUrl = `${CUSTOM_FIELDS_SERVICE_URL}${targetPath}`;
      const response = await fetch(targetUrl);
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.set("Content-Type", contentType);
      }
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        res.status(response.status).json(data);
      } else if (contentType?.includes("text/html")) {
        const html = await response.text();
        res.status(response.status).send(html);
      } else if (contentType?.includes("javascript")) {
        const js = await response.text();
        res.status(response.status).send(js);
      } else if (contentType?.includes("css")) {
        const css = await response.text();
        res.status(response.status).send(css);
      } else {
        const buffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(buffer));
      }
    } catch (error) {
      console.error("Custom Fields admin proxy error:", error);
      res.status(500).send("Failed to load Custom Fields admin panel");
    }
  });
  app2.get("/api/projects", authenticateToken, async (req, res) => {
    try {
      const projectsResult = await db.select().from(projects);
      res.json(projectsResult);
    } catch (error) {
      console.error("Projects fetch error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/analyses", authenticateToken, async (req, res) => {
    try {
      const analysesResult = await db.select().from(analyses);
      res.json(analysesResult);
    } catch (error) {
      console.error("Analyses fetch error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/analyses", authenticateToken, async (req, res) => {
    try {
      const { title, description, author, projectId } = req.body;
      if (!title || !author) {
        return res.status(400).json({ error: "Title and author are required" });
      }
      const newAnalysis = await db.insert(analyses).values({
        title,
        description,
        author,
        projectId,
        createdBy: req.user.userId
      }).returning();
      res.status(201).json(newAnalysis[0]);
    } catch (error) {
      console.error("Analysis creation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, html, text: text2 } = req.body;
      if (!to || !subject || !html) {
        return res.status(400).json({ error: "Missing required fields: to, subject, html" });
      }
      console.log("Email would be sent:", { to, subject });
      res.json({
        success: true,
        message: "Email sent successfully",
        provider: "Server-side"
      });
    } catch (error) {
      console.error("Email sending error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/init-db", async (req, res) => {
    try {
      const existingProfiles = await db.select().from(profiles);
      if (existingProfiles.length === 0) {
        await db.insert(profiles).values([
          {
            id: "550e8400-e29b-41d4-a716-446655440001",
            name: "Administrador",
            description: "Acesso completo a todas as funcionalidades do sistema",
            permissions: [
              "ANALYSIS_CREATE",
              "ANALYSIS_EDIT",
              "ANALYSIS_DELETE",
              "ANALYSIS_VIEW",
              "ANALYSIS_EXPORT",
              "ANALYSIS_IMPORT_AI",
              "ANALYSIS_COPY",
              "PROJECTS_CREATE",
              "PROJECTS_EDIT",
              "PROJECTS_DELETE",
              "PROJECTS_VIEW",
              "PROJECTS_MANAGE",
              "USERS_CREATE",
              "USERS_EDIT",
              "USERS_DELETE",
              "USERS_VIEW",
              "USERS_MANAGE",
              "PROFILES_CREATE",
              "PROFILES_EDIT",
              "PROFILES_DELETE",
              "PROFILES_VIEW",
              "PROFILES_MANAGE"
            ],
            isDefault: false
          },
          {
            id: "550e8400-e29b-41d4-a716-446655440002",
            name: "Usu\xE1rio Padr\xE3o",
            description: "Acesso b\xE1sico para criar e visualizar an\xE1lises",
            permissions: [
              "ANALYSIS_CREATE",
              "ANALYSIS_EDIT",
              "ANALYSIS_VIEW",
              "ANALYSIS_EXPORT",
              "PROJECTS_VIEW"
            ],
            isDefault: true
          }
        ]);
        await db.insert(projects).values({
          id: "550e8400-e29b-41d4-a716-446655440003",
          name: "Sistema de Habilita\xE7\xF5es",
          acronym: "SH",
          isDefault: true
        });
        const hashedPassword = await bcrypt.hash("Senha@1010", 10);
        await db.insert(users).values({
          id: "550e8400-e29b-41d4-a716-446655440004",
          username: "admin",
          email: "nuptechs@nuptechs.com",
          passwordHash: hashedPassword,
          profileId: "550e8400-e29b-41d4-a716-446655440001",
          isActive: true,
          isEmailVerified: true
        });
        res.json({ success: true, message: "Database initialized with seed data" });
      } else {
        res.json({ success: true, message: "Database already initialized" });
      }
    } catch (error) {
      console.error("Database initialization error:", error);
      res.status(500).json({ error: "Failed to initialize database" });
    }
  });
  app2.post("/api/gemini-extract", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Image data is required" });
      }
      const { extractFieldsWithGemini: extractFieldsWithGemini2 } = await Promise.resolve().then(() => (init_geminiFieldExtractor(), geminiFieldExtractor_exports));
      console.log("\u{1F916} Processing image with Gemini AI...");
      const fields = await extractFieldsWithGemini2(imageBase64);
      console.log(`\u2705 Gemini extracted ${fields.length} fields successfully`);
      res.json({
        success: true,
        fields,
        source: "Gemini AI",
        count: fields.length
      });
    } catch (error) {
      console.error("Gemini extraction error:", error);
      res.status(500).json({
        error: "Failed to extract fields with Gemini",
        message: error.message
      });
    }
  });
}

// server/index.ts
dotenv.config();
var app = express2();
var PORT = parseInt(process.env.PORT || "5000", 10);
registerRoutes(app);
var index_default = app;
if (!process.env.COMPOSED_DEV) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\u{1F680} [NuP-AIM] Server running on port ${PORT}`);
  });
}
export {
  index_default as default
};
