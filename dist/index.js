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
    const ai2 = new GoogleGenAI({ apiKey });
    const base64Image = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    console.log(`\u{1F4E4} Enviando imagem para Gemini 2.5 Flash (tamanho: ${Math.round(base64Image.length / 1024)} KB)`);
    const startTime = performance.now();
    const response = await ai2.models.generateContent({
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

// server/gemini.ts
var gemini_exports = {};
__export(gemini_exports, {
  chatWithAssistant: () => chatWithAssistant,
  generateAnalysisSuggestions: () => generateAnalysisSuggestions,
  generateSmartSuggestions: () => generateSmartSuggestions,
  improveText: () => improveText
});
import { GoogleGenAI as GoogleGenAI2 } from "@google/genai";
async function generateAnalysisSuggestions(title, description, processes3) {
  const prompt = `Voc\xEA \xE9 um especialista em an\xE1lise de impacto de sistemas e projetos de TI. 
Analise o seguinte contexto e gere sugest\xF5es inteligentes para uma an\xE1lise de impacto:

T\xCDTULO: ${title}
DESCRI\xC7\xC3O: ${description}
PROCESSOS AFETADOS: ${processes3.join(", ")}

Por favor, gere uma an\xE1lise estruturada com:
1. Impactos potenciais (3-5 itens) - categorize como: business, technical, operational, ou financial
2. Riscos identificados (3-5 itens)
3. A\xE7\xF5es de mitiga\xE7\xE3o recomendadas (3-5 itens)
4. Um resumo executivo
5. Recomenda\xE7\xF5es gerais (3-5 itens)

Para severidade e probabilidade use: low, medium, high, critical
Para prioridade use: low, medium, high, urgent

Responda APENAS em formato JSON v\xE1lido seguindo esta estrutura:
{
  "impacts": [{"description": "", "severity": "", "probability": "", "category": ""}],
  "risks": [{"description": "", "impact": "", "probability": "", "mitigation": ""}],
  "mitigations": [{"action": "", "responsible": "", "priority": ""}],
  "summary": "",
  "recommendations": []
}`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const text2 = response.text || "{}";
    const cleaned = text2.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Error generating AI suggestions:", error);
    throw new Error("Falha ao gerar sugest\xF5es com IA");
  }
}
async function improveText(text2, context) {
  const prompt = `Voc\xEA \xE9 um especialista em reda\xE7\xE3o t\xE9cnica e an\xE1lise de impacto.
Melhore o seguinte texto, tornando-o mais claro, profissional e completo.
Mantenha o significado original mas aprimore a qualidade.

CONTEXTO: ${context}
TEXTO ORIGINAL: ${text2}

Responda apenas com o texto melhorado, sem explica\xE7\xF5es adicionais.`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    return response.text || text2;
  } catch (error) {
    console.error("Error improving text:", error);
    throw new Error("Falha ao melhorar texto com IA");
  }
}
async function generateSmartSuggestions(field, currentValue, analysisContext) {
  const prompt = `Voc\xEA \xE9 um assistente especializado em an\xE1lise de impacto de sistemas.
Sugira 5 op\xE7\xF5es para o campo "${field}" baseado no contexto:

PROJETO: ${analysisContext.project}
T\xCDTULO: ${analysisContext.title}
DESCRI\xC7\xC3O: ${analysisContext.description}
VALOR ATUAL: ${currentValue || "vazio"}

Responda APENAS com um JSON array de 5 strings com sugest\xF5es relevantes e profissionais:
["sugest\xE3o 1", "sugest\xE3o 2", "sugest\xE3o 3", "sugest\xE3o 4", "sugest\xE3o 5"]`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    const text2 = response.text || "[]";
    const cleaned = text2.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return [];
  }
}
async function chatWithAssistant(message, conversationHistory, analysisContext) {
  const systemContext = analysisContext ? `Voc\xEA \xE9 um assistente especializado em an\xE1lise de impacto para o sistema NuP-AIM.
Contexto atual:
- Projeto: ${analysisContext.project}
- T\xEDtulo da An\xE1lise: ${analysisContext.title}
- Descri\xE7\xE3o: ${analysisContext.description}

Ajude o usu\xE1rio com d\xFAvidas sobre an\xE1lise de impacto, riscos, mitiga\xE7\xF5es e boas pr\xE1ticas.
Seja conciso, profissional e sempre ofere\xE7a sugest\xF5es pr\xE1ticas.` : `Voc\xEA \xE9 um assistente especializado em an\xE1lise de impacto para o sistema NuP-AIM.
Ajude o usu\xE1rio com d\xFAvidas sobre an\xE1lise de impacto, riscos, mitiga\xE7\xF5es e boas pr\xE1ticas.
Seja conciso, profissional e sempre ofere\xE7a sugest\xF5es pr\xE1ticas.`;
  const messages = [
    { role: "user", parts: [{ text: systemContext }] },
    ...conversationHistory.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }]
    })),
    { role: "user", parts: [{ text: message }] }
  ];
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: messages
    });
    return response.text || "Desculpe, n\xE3o consegui processar sua mensagem.";
  } catch (error) {
    console.error("Error in chat:", error);
    throw new Error("Falha ao processar mensagem");
  }
}
var ai;
var init_gemini = __esm({
  "server/gemini.ts"() {
    ai = new GoogleGenAI2({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "",
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || ""
      }
    });
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
  documentTemplates: () => documentTemplates,
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
  data: jsonb("data").default(sql`'{}'::jsonb`),
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
var documentTemplates = aimSchema.table("document_templates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  originalFileName: text("original_file_name").notNull(),
  fileContent: text("file_content").notNull(),
  parsedMarkers: jsonb("parsed_markers").default(sql`'[]'::jsonb`),
  fieldMappings: jsonb("field_mappings").default(sql`'{}'::jsonb`),
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  usageCount: text("usage_count").default("0"),
  createdBy: uuid("created_by").references(() => users.id),
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
import { eq as eq2, and, or, desc } from "drizzle-orm";
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

// server/templateService.ts
import PizZip from "pizzip";
import { eq } from "drizzle-orm";
function getAvailableFields() {
  const categories = [];
  categories.push({
    id: "analyses",
    label: "An\xE1lise de Impacto",
    icon: "FileText",
    fields: [
      { id: "analyses.title", name: "title", label: "T\xEDtulo da An\xE1lise", table: "analyses", tableLabel: "An\xE1lise", type: "text" },
      { id: "analyses.description", name: "description", label: "Descri\xE7\xE3o", table: "analyses", tableLabel: "An\xE1lise", type: "text" },
      { id: "analyses.author", name: "author", label: "Autor", table: "analyses", tableLabel: "An\xE1lise", type: "text" },
      { id: "analyses.version", name: "version", label: "Vers\xE3o", table: "analyses", tableLabel: "An\xE1lise", type: "text" },
      { id: "analyses.createdAt", name: "createdAt", label: "Data de Cria\xE7\xE3o", table: "analyses", tableLabel: "An\xE1lise", type: "date" },
      { id: "analyses.updatedAt", name: "updatedAt", label: "Data de Atualiza\xE7\xE3o", table: "analyses", tableLabel: "An\xE1lise", type: "date" }
    ]
  });
  categories.push({
    id: "projects",
    label: "Projeto",
    icon: "Folder",
    fields: [
      { id: "projects.name", name: "name", label: "Nome do Projeto", table: "projects", tableLabel: "Projeto", type: "text" },
      { id: "projects.acronym", name: "acronym", label: "Sigla do Projeto", table: "projects", tableLabel: "Projeto", type: "text" }
    ]
  });
  categories.push({
    id: "impacts",
    label: "Impactos (Lista)",
    icon: "AlertTriangle",
    fields: [
      { id: "impacts", name: "impacts", label: "Lista de Impactos", table: "impacts", tableLabel: "Impactos", type: "list", description: "Todos os impactos da an\xE1lise" },
      { id: "impacts.description", name: "description", label: "Descri\xE7\xE3o do Impacto", table: "impacts", tableLabel: "Impactos", type: "text" },
      { id: "impacts.severity", name: "severity", label: "Severidade", table: "impacts", tableLabel: "Impactos", type: "text" },
      { id: "impacts.probability", name: "probability", label: "Probabilidade", table: "impacts", tableLabel: "Impactos", type: "text" },
      { id: "impacts.category", name: "category", label: "Categoria", table: "impacts", tableLabel: "Impactos", type: "text" }
    ]
  });
  categories.push({
    id: "risks",
    label: "Riscos (Lista)",
    icon: "Shield",
    fields: [
      { id: "risks", name: "risks", label: "Lista de Riscos", table: "risks", tableLabel: "Riscos", type: "list", description: "Todos os riscos da an\xE1lise" },
      { id: "risks.description", name: "description", label: "Descri\xE7\xE3o do Risco", table: "risks", tableLabel: "Riscos", type: "text" },
      { id: "risks.impact", name: "impact", label: "Impacto", table: "risks", tableLabel: "Riscos", type: "text" },
      { id: "risks.probability", name: "probability", label: "Probabilidade", table: "risks", tableLabel: "Riscos", type: "text" },
      { id: "risks.mitigation", name: "mitigation", label: "Mitiga\xE7\xE3o", table: "risks", tableLabel: "Riscos", type: "text" }
    ]
  });
  categories.push({
    id: "mitigations",
    label: "Mitiga\xE7\xF5es (Lista)",
    icon: "CheckCircle",
    fields: [
      { id: "mitigations", name: "mitigations", label: "Lista de Mitiga\xE7\xF5es", table: "mitigations", tableLabel: "Mitiga\xE7\xF5es", type: "list", description: "Todas as a\xE7\xF5es de mitiga\xE7\xE3o" },
      { id: "mitigations.action", name: "action", label: "A\xE7\xE3o", table: "mitigations", tableLabel: "Mitiga\xE7\xF5es", type: "text" },
      { id: "mitigations.responsible", name: "responsible", label: "Respons\xE1vel", table: "mitigations", tableLabel: "Mitiga\xE7\xF5es", type: "text" },
      { id: "mitigations.deadline", name: "deadline", label: "Prazo", table: "mitigations", tableLabel: "Mitiga\xE7\xF5es", type: "date" },
      { id: "mitigations.priority", name: "priority", label: "Prioridade", table: "mitigations", tableLabel: "Mitiga\xE7\xF5es", type: "text" }
    ]
  });
  categories.push({
    id: "conclusions",
    label: "Conclus\xF5es",
    icon: "FileCheck",
    fields: [
      { id: "conclusions.summary", name: "summary", label: "Resumo Executivo", table: "conclusions", tableLabel: "Conclus\xF5es", type: "text" },
      { id: "conclusions.recommendations", name: "recommendations", label: "Recomenda\xE7\xF5es", table: "conclusions", tableLabel: "Conclus\xF5es", type: "json" },
      { id: "conclusions.nextSteps", name: "nextSteps", label: "Pr\xF3ximos Passos", table: "conclusions", tableLabel: "Conclus\xF5es", type: "json" }
    ]
  });
  categories.push({
    id: "processes",
    label: "Funcionalidades (Lista)",
    icon: "Layers",
    fields: [
      { id: "processes", name: "processes", label: "Lista de Funcionalidades", table: "processes", tableLabel: "Funcionalidades", type: "list", description: "Todas as funcionalidades impactadas" },
      { id: "processes.name", name: "name", label: "Nome da Funcionalidade", table: "processes", tableLabel: "Funcionalidades", type: "text" },
      { id: "processes.status", name: "status", label: "Status", table: "processes", tableLabel: "Funcionalidades", type: "text" },
      { id: "processes.workDetails", name: "workDetails", label: "Detalhes do Trabalho", table: "processes", tableLabel: "Funcionalidades", type: "text" }
    ]
  });
  categories.push({
    id: "metadata",
    label: "Metadados",
    icon: "Info",
    fields: [
      { id: "meta.currentDate", name: "currentDate", label: "Data Atual", table: "meta", tableLabel: "Metadados", type: "date" },
      { id: "meta.currentTime", name: "currentTime", label: "Hora Atual", table: "meta", tableLabel: "Metadados", type: "text" },
      { id: "meta.totalImpacts", name: "totalImpacts", label: "Total de Impactos", table: "meta", tableLabel: "Metadados", type: "number" },
      { id: "meta.totalRisks", name: "totalRisks", label: "Total de Riscos", table: "meta", tableLabel: "Metadados", type: "number" },
      { id: "meta.totalMitigations", name: "totalMitigations", label: "Total de Mitiga\xE7\xF5es", table: "meta", tableLabel: "Metadados", type: "number" }
    ]
  });
  return categories;
}
function parseMarkersFromDocx(fileContent) {
  const markers = [];
  try {
    const zip = new PizZip(fileContent);
    const documentXml = zip.file("word/document.xml")?.asText() || "";
    const textContent = documentXml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const markerRegex = /#\$([^#$]+)#\$/g;
    let match;
    while ((match = markerRegex.exec(textContent)) !== null) {
      const fullMarker = match[0];
      const fieldName = match[1].trim();
      const position = match.index;
      const contextStart = Math.max(0, position - 30);
      const contextEnd = Math.min(textContent.length, position + fullMarker.length + 30);
      let context = textContent.substring(contextStart, contextEnd);
      if (contextStart > 0) context = "..." + context;
      if (contextEnd < textContent.length) context = context + "...";
      const existingMarker = markers.find((m) => m.fieldName === fieldName);
      if (!existingMarker) {
        markers.push({
          marker: fullMarker,
          fieldName,
          context,
          position
        });
      }
    }
    return markers;
  } catch (error) {
    console.error("Error parsing DOCX:", error);
    throw new Error("Erro ao analisar o documento. Verifique se \xE9 um arquivo DOCX v\xE1lido.");
  }
}
async function getAnalysisData(analysisId) {
  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId));
  if (!analysis) {
    throw new Error("An\xE1lise n\xE3o encontrada");
  }
  const [project] = analysis.projectId ? await db.select().from(projects).where(eq(projects.id, analysis.projectId)) : [null];
  const impactsList = await db.select().from(impacts).where(eq(impacts.analysisId, analysisId));
  const risksList = await db.select().from(risks).where(eq(risks.analysisId, analysisId));
  const mitigationsList = await db.select().from(mitigations).where(eq(mitigations.analysisId, analysisId));
  const [conclusion] = await db.select().from(conclusions).where(eq(conclusions.analysisId, analysisId));
  const processesList = await db.select().from(processes).where(eq(processes.analysisId, analysisId));
  const formatDate = (date2) => {
    if (!date2) return "";
    return new Date(date2).toLocaleDateString("pt-BR");
  };
  const formatSeverity = (severity) => {
    const map = {
      "baixo": "Baixo",
      "medio": "M\xE9dio",
      "alto": "Alto",
      "critico": "Cr\xEDtico"
    };
    return map[severity] || severity;
  };
  const formatCategory = (category) => {
    const map = {
      "business": "Neg\xF3cio",
      "technical": "T\xE9cnico",
      "operational": "Operacional",
      "financial": "Financeiro"
    };
    return map[category] || category;
  };
  const formatStatus = (status) => {
    const map = {
      "nova": "Nova",
      "alterada": "Alterada",
      "excluida": "Exclu\xEDda"
    };
    return map[status] || status;
  };
  return {
    "analyses.title": analysis.title,
    "analyses.description": analysis.description || "",
    "analyses.author": analysis.author,
    "analyses.version": analysis.version || "1.0",
    "analyses.createdAt": formatDate(analysis.createdAt),
    "analyses.updatedAt": formatDate(analysis.updatedAt),
    "projects.name": project?.name || "",
    "projects.acronym": project?.acronym || "",
    "impacts": impactsList.map((i) => ({
      description: i.description,
      severity: formatSeverity(i.severity),
      probability: formatSeverity(i.probability),
      category: formatCategory(i.category)
    })),
    "risks": risksList.map((r) => ({
      description: r.description,
      impact: formatSeverity(r.impact),
      probability: formatSeverity(r.probability),
      mitigation: r.mitigation || ""
    })),
    "mitigations": mitigationsList.map((m) => ({
      action: m.action,
      responsible: m.responsible,
      deadline: formatDate(m.deadline ? new Date(m.deadline) : null),
      priority: formatSeverity(m.priority)
    })),
    "conclusions.summary": conclusion?.summary || "",
    "conclusions.recommendations": Array.isArray(conclusion?.recommendations) ? conclusion.recommendations.join("\n") : "",
    "conclusions.nextSteps": Array.isArray(conclusion?.nextSteps) ? conclusion.nextSteps.join("\n") : "",
    "processes": processesList.map((p) => ({
      name: p.name,
      status: formatStatus(p.status),
      workDetails: p.workDetails || ""
    })),
    "meta.currentDate": (/* @__PURE__ */ new Date()).toLocaleDateString("pt-BR"),
    "meta.currentTime": (/* @__PURE__ */ new Date()).toLocaleTimeString("pt-BR"),
    "meta.totalImpacts": impactsList.length,
    "meta.totalRisks": risksList.length,
    "meta.totalMitigations": mitigationsList.length,
    "meta.totalProcesses": processesList.length
  };
}
async function generateDocumentFromTemplate(templateId, analysisId) {
  const [template] = await db.select().from(documentTemplates).where(eq(documentTemplates.id, templateId));
  if (!template) {
    throw new Error("Template n\xE3o encontrado");
  }
  const analysisData = await getAnalysisData(analysisId);
  const fieldMappings = template.fieldMappings;
  const templateBuffer = Buffer.from(template.fileContent, "base64");
  let processedContent = templateBuffer;
  try {
    const zip = new PizZip(templateBuffer);
    let documentXml = zip.file("word/document.xml")?.asText() || "";
    for (const [marker, fieldId] of Object.entries(fieldMappings)) {
      const value = analysisData[fieldId];
      const markerPattern = `#\\$${marker}#\\$`;
      const regex = new RegExp(markerPattern, "g");
      if (Array.isArray(value)) {
        const listContent = value.map((item, index) => {
          if (typeof item === "object") {
            return Object.entries(item).map(([key, val]) => `${key}: ${val}`).join(", ");
          }
          return String(item);
        }).join("\n");
        documentXml = documentXml.replace(regex, listContent);
      } else {
        documentXml = documentXml.replace(regex, String(value || ""));
      }
    }
    zip.file("word/document.xml", documentXml);
    processedContent = zip.generate({ type: "nodebuffer" });
    await db.update(documentTemplates).set({
      usageCount: String(parseInt(template.usageCount || "0") + 1),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(documentTemplates.id, templateId));
    return processedContent;
  } catch (error) {
    console.error("Error generating document:", error);
    throw new Error("Erro ao gerar documento a partir do template");
  }
}
async function validateFieldMappings(parsedMarkers, fieldMappings) {
  const availableFieldIds = getAvailableFields().flatMap((cat) => cat.fields).map((f) => f.id);
  const unmappedMarkers = parsedMarkers.filter((m) => !fieldMappings[m.fieldName]).map((m) => m.fieldName);
  const invalidMappings = Object.entries(fieldMappings).filter(([_, fieldId]) => !availableFieldIds.includes(fieldId)).map(([marker, _]) => marker);
  return {
    valid: unmappedMarkers.length === 0 && invalidMappings.length === 0,
    unmappedMarkers,
    invalidMappings
  };
}

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
function registerRoutes(app2, options = {}) {
  const { ssoEnabled = false } = options;
  app2.use(corsMiddleware);
  app2.use(express.json({ limit: "5mb" }));
  app2.use(express.urlencoded({ limit: "5mb", extended: true }));
  app2.get("/health", (req, res) => {
    res.json({
      status: "healthy",
      service: "NuP-AIM",
      version: "1.0.0",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      authMode: ssoEnabled ? "sso" : "local"
    });
  });
  app2.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      service: "NuP-AIM",
      version: "1.0.0",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      authMode: ssoEnabled ? "sso" : "local"
    });
  });
  app2.get("/api/auth/mode", (req, res) => {
    res.json({
      mode: ssoEnabled ? "sso" : "local",
      ssoLoginUrl: ssoEnabled ? "/auth/sso/login" : null,
      ssoLogoutUrl: ssoEnabled ? "/auth/sso/logout" : null
    });
  });
  if (ssoEnabled) {
    console.log("\u2139\uFE0F  [Routes] Local auth routes disabled - using SSO");
  } else {
    console.log("\u2139\uFE0F  [Routes] Local auth routes enabled");
  }
  if (!ssoEnabled) {
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
        }).from(users).where(eq2(users.email, email));
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
        await db.update(users).set({ lastLogin: /* @__PURE__ */ new Date() }).where(eq2(users.id, user.id));
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
        const existingUser = await db.select().from(users).where(or(eq2(users.email, email), eq2(users.username, username)));
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
          const defaultProfile = await db.select().from(profiles).where(eq2(profiles.name, "Usu\xE1rio Padr\xE3o")).limit(1);
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
          eq2(users.email, decoded.email),
          eq2(users.emailVerificationToken, token)
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
        }).where(eq2(users.id, user.id));
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
        const userResult = await db.select().from(users).where(eq2(users.email, email));
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
        }).where(eq2(users.id, user.id));
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
        }).from(users).leftJoin(profiles, eq2(users.profileId, profiles.id)).where(eq2(users.id, req.user.userId));
        if (userResult.length === 0) {
          return res.status(404).json({ error: "User not found" });
        }
        res.json(userResult[0]);
      } catch (error) {
        console.error("Profile fetch error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }
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
  const normalizeAnalysis = (row) => ({
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
  app2.get("/api/analyses", authenticateToken, async (req, res) => {
    try {
      const analysesResult = await db.select().from(analyses);
      const normalizedResults = analysesResult.map(normalizeAnalysis);
      res.json(normalizedResults);
    } catch (error) {
      console.error("Analyses fetch error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.post("/api/analyses", authenticateToken, async (req, res) => {
    try {
      const { title, description, author, projectId, data } = req.body;
      if (!title || !author) {
        return res.status(400).json({ error: "Title and author are required" });
      }
      const newAnalysis = await db.insert(analyses).values({
        title,
        description,
        author,
        projectId,
        data: data || {},
        createdBy: req.user.userId
      }).returning();
      res.status(201).json(normalizeAnalysis(newAnalysis[0]));
    } catch (error) {
      console.error("Analysis creation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.put("/api/analyses/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, author, projectId, data } = req.body;
      const updateData = { updatedAt: /* @__PURE__ */ new Date() };
      if (title !== void 0) updateData.title = title;
      if (description !== void 0) updateData.description = description;
      if (author !== void 0) updateData.author = author;
      if (projectId !== void 0) updateData.projectId = projectId;
      if (data !== void 0) updateData.data = data;
      const updatedAnalysis = await db.update(analyses).set(updateData).where(eq2(analyses.id, id)).returning();
      if (updatedAnalysis.length === 0) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      res.json(normalizeAnalysis(updatedAnalysis[0]));
    } catch (error) {
      console.error("Analysis update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.delete("/api/analyses/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const deletedAnalysis = await db.delete(analyses).where(eq2(analyses.id, id)).returning();
      if (deletedAnalysis.length === 0) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      res.json({ success: true, message: "Analysis deleted successfully", data: normalizeAnalysis(deletedAnalysis[0]) });
    } catch (error) {
      console.error("Analysis delete error:", error);
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
  app2.post("/api/ai/generate-suggestions", authenticateToken, async (req, res) => {
    try {
      const { title, description, processes: processes3 } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: "Title and description are required" });
      }
      const { generateAnalysisSuggestions: generateAnalysisSuggestions2 } = await Promise.resolve().then(() => (init_gemini(), gemini_exports));
      const suggestions = await generateAnalysisSuggestions2(title, description, processes3 || []);
      res.json({ success: true, suggestions });
    } catch (error) {
      console.error("AI suggestion error:", error);
      res.status(500).json({ error: "Failed to generate AI suggestions", message: error.message });
    }
  });
  app2.post("/api/ai/improve-text", authenticateToken, async (req, res) => {
    try {
      const { text: text2, context } = req.body;
      if (!text2) {
        return res.status(400).json({ error: "Text is required" });
      }
      const { improveText: improveText2 } = await Promise.resolve().then(() => (init_gemini(), gemini_exports));
      const improvedText = await improveText2(text2, context || "analysis");
      res.json({ success: true, improvedText });
    } catch (error) {
      console.error("AI improve text error:", error);
      res.status(500).json({ error: "Failed to improve text", message: error.message });
    }
  });
  app2.post("/api/ai/smart-suggestions", authenticateToken, async (req, res) => {
    try {
      const { field, currentValue, analysisContext } = req.body;
      if (!field) {
        return res.status(400).json({ error: "Field name is required" });
      }
      const { generateSmartSuggestions: generateSmartSuggestions2 } = await Promise.resolve().then(() => (init_gemini(), gemini_exports));
      const suggestions = await generateSmartSuggestions2(field, currentValue || "", analysisContext || {});
      res.json({ success: true, suggestions });
    } catch (error) {
      console.error("AI smart suggestions error:", error);
      res.status(500).json({ error: "Failed to generate suggestions", message: error.message });
    }
  });
  app2.post("/api/ai/chat", authenticateToken, async (req, res) => {
    try {
      const { message, history, analysisContext } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      const { chatWithAssistant: chatWithAssistant2 } = await Promise.resolve().then(() => (init_gemini(), gemini_exports));
      const response = await chatWithAssistant2(message, history || [], analysisContext);
      res.json({ success: true, response });
    } catch (error) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: "Failed to process chat message", message: error.message });
    }
  });
  app2.get("/api/dashboard/stats", authenticateToken, async (req, res) => {
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
        recentAnalyses: analysesCount.slice(-5)
      };
      res.json({ success: true, stats });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Failed to get dashboard stats", message: error.message });
    }
  });
  app2.get("/api/templates/available-fields", authenticateToken, async (req, res) => {
    try {
      const fields = getAvailableFields();
      res.json({ fields });
    } catch (error) {
      console.error("Get available fields error:", error);
      res.status(500).json({ error: "Falha ao obter campos dispon\xEDveis", message: error.message });
    }
  });
  app2.get("/api/templates", authenticateToken, async (req, res) => {
    try {
      const templates = await db.select({
        id: documentTemplates.id,
        name: documentTemplates.name,
        description: documentTemplates.description,
        originalFileName: documentTemplates.originalFileName,
        parsedMarkers: documentTemplates.parsedMarkers,
        fieldMappings: documentTemplates.fieldMappings,
        isActive: documentTemplates.isActive,
        isDefault: documentTemplates.isDefault,
        usageCount: documentTemplates.usageCount,
        createdAt: documentTemplates.createdAt,
        updatedAt: documentTemplates.updatedAt
      }).from(documentTemplates).orderBy(desc(documentTemplates.createdAt));
      res.json({ templates });
    } catch (error) {
      console.error("List templates error:", error);
      res.status(500).json({ error: "Falha ao listar templates", message: error.message });
    }
  });
  app2.get("/api/templates/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const [template] = await db.select().from(documentTemplates).where(eq2(documentTemplates.id, id));
      if (!template) {
        return res.status(404).json({ error: "Template n\xE3o encontrado" });
      }
      res.json({ template });
    } catch (error) {
      console.error("Get template error:", error);
      res.status(500).json({ error: "Falha ao obter template", message: error.message });
    }
  });
  app2.post("/api/templates", authenticateToken, async (req, res) => {
    try {
      const { name, description, fileName, fileContent } = req.body;
      if (!name || !fileName || !fileContent) {
        return res.status(400).json({
          error: "Nome, arquivo e conte\xFAdo s\xE3o obrigat\xF3rios"
        });
      }
      const fileBuffer = Buffer.from(fileContent, "base64");
      const parsedMarkers = parseMarkersFromDocx(fileBuffer);
      const [newTemplate] = await db.insert(documentTemplates).values({
        name,
        description: description || "",
        originalFileName: fileName,
        fileContent,
        parsedMarkers,
        fieldMappings: {},
        isActive: true,
        isDefault: false,
        usageCount: "0",
        createdBy: req.user?.userId || null,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).returning();
      res.status(201).json({
        template: newTemplate,
        markersFound: parsedMarkers.length,
        message: `Template criado com sucesso. ${parsedMarkers.length} marcadores encontrados.`
      });
    } catch (error) {
      console.error("Upload template error:", error);
      res.status(500).json({ error: "Falha ao fazer upload do template", message: error.message });
    }
  });
  app2.put("/api/templates/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, fieldMappings, isActive, isDefault } = req.body;
      const updateData = { updatedAt: /* @__PURE__ */ new Date() };
      if (name !== void 0) updateData.name = name;
      if (description !== void 0) updateData.description = description;
      if (fieldMappings !== void 0) updateData.fieldMappings = fieldMappings;
      if (isActive !== void 0) updateData.isActive = isActive;
      if (isDefault !== void 0) {
        if (isDefault) {
          await db.update(documentTemplates).set({ isDefault: false }).where(eq2(documentTemplates.isDefault, true));
        }
        updateData.isDefault = isDefault;
      }
      const [updatedTemplate] = await db.update(documentTemplates).set(updateData).where(eq2(documentTemplates.id, id)).returning();
      if (!updatedTemplate) {
        return res.status(404).json({ error: "Template n\xE3o encontrado" });
      }
      res.json({ template: updatedTemplate });
    } catch (error) {
      console.error("Update template error:", error);
      res.status(500).json({ error: "Falha ao atualizar template", message: error.message });
    }
  });
  app2.delete("/api/templates/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const [deletedTemplate] = await db.delete(documentTemplates).where(eq2(documentTemplates.id, id)).returning();
      if (!deletedTemplate) {
        return res.status(404).json({ error: "Template n\xE3o encontrado" });
      }
      res.json({ message: "Template exclu\xEDdo com sucesso" });
    } catch (error) {
      console.error("Delete template error:", error);
      res.status(500).json({ error: "Falha ao excluir template", message: error.message });
    }
  });
  app2.post("/api/templates/:id/reparse", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { fileContent, fileName } = req.body;
      if (!fileContent) {
        return res.status(400).json({ error: "Conte\xFAdo do arquivo \xE9 obrigat\xF3rio" });
      }
      const fileBuffer = Buffer.from(fileContent, "base64");
      const parsedMarkers = parseMarkersFromDocx(fileBuffer);
      const updateData = {
        fileContent,
        parsedMarkers,
        updatedAt: /* @__PURE__ */ new Date()
      };
      if (fileName) {
        updateData.originalFileName = fileName;
      }
      const [updatedTemplate] = await db.update(documentTemplates).set(updateData).where(eq2(documentTemplates.id, id)).returning();
      if (!updatedTemplate) {
        return res.status(404).json({ error: "Template n\xE3o encontrado" });
      }
      res.json({
        template: updatedTemplate,
        markersFound: parsedMarkers.length,
        message: `Documento reanalisado. ${parsedMarkers.length} marcadores encontrados.`
      });
    } catch (error) {
      console.error("Reparse template error:", error);
      res.status(500).json({ error: "Falha ao reanalisar template", message: error.message });
    }
  });
  app2.post("/api/templates/:id/validate", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const [template] = await db.select().from(documentTemplates).where(eq2(documentTemplates.id, id));
      if (!template) {
        return res.status(404).json({ error: "Template n\xE3o encontrado" });
      }
      const parsedMarkers = template.parsedMarkers;
      const fieldMappings = template.fieldMappings;
      const validation = await validateFieldMappings(parsedMarkers, fieldMappings);
      res.json({
        validation,
        message: validation.valid ? "Todos os marcadores est\xE3o mapeados corretamente" : `${validation.unmappedMarkers.length} marcadores n\xE3o mapeados`
      });
    } catch (error) {
      console.error("Validate template error:", error);
      res.status(500).json({ error: "Falha ao validar template", message: error.message });
    }
  });
  app2.post("/api/templates/:id/generate", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { analysisId } = req.body;
      if (!analysisId) {
        return res.status(400).json({ error: "ID da an\xE1lise \xE9 obrigat\xF3rio" });
      }
      const documentBuffer = await generateDocumentFromTemplate(id, analysisId);
      const [template] = await db.select({ name: documentTemplates.name }).from(documentTemplates).where(eq2(documentTemplates.id, id));
      const [analysis] = await db.select({ title: analyses.title }).from(analyses).where(eq2(analyses.id, analysisId));
      const filename = `${analysis?.title || "documento"}_${template?.name || "template"}.docx`.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(documentBuffer);
    } catch (error) {
      console.error("Generate document error:", error);
      res.status(500).json({ error: "Falha ao gerar documento", message: error.message });
    }
  });
  app2.get("/api/templates/preview-data/:analysisId", authenticateToken, async (req, res) => {
    try {
      const { analysisId } = req.params;
      const data = await getAnalysisData(analysisId);
      res.json({ data });
    } catch (error) {
      console.error("Preview data error:", error);
      res.status(500).json({ error: "Falha ao obter dados da an\xE1lise", message: error.message });
    }
  });
  app2.post("/api/templates/:id/duplicate", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const [original] = await db.select().from(documentTemplates).where(eq2(documentTemplates.id, id));
      if (!original) {
        return res.status(404).json({ error: "Template n\xE3o encontrado" });
      }
      const [duplicated] = await db.insert(documentTemplates).values({
        name: name || `${original.name} (C\xF3pia)`,
        description: original.description,
        originalFileName: original.originalFileName,
        fileContent: original.fileContent,
        parsedMarkers: original.parsedMarkers,
        fieldMappings: original.fieldMappings,
        isActive: true,
        isDefault: false,
        usageCount: "0",
        createdBy: req.user?.userId || null,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).returning();
      res.status(201).json({
        template: duplicated,
        message: "Template duplicado com sucesso"
      });
    } catch (error) {
      console.error("Duplicate template error:", error);
      res.status(500).json({ error: "Falha ao duplicar template", message: error.message });
    }
  });
}

// server/nupidentity.ts
import cookieParser from "cookie-parser";

// server/nupidentity.manifest.ts
var manifest = {
  system: {
    id: "nup-aim",
    name: "NuP-AIM",
    description: "Sistema de An\xE1lise de Impacto de Mudan\xE7as",
    version: "1.0.0"
  },
  functions: [
    { key: "dashboard.view", name: "Ver Dashboard", category: "Dashboard" },
    { key: "analysis.view", name: "Ver An\xE1lises", category: "An\xE1lises" },
    { key: "analysis.create", name: "Criar An\xE1lises", category: "An\xE1lises" },
    { key: "analysis.edit", name: "Editar An\xE1lises", category: "An\xE1lises" },
    { key: "analysis.delete", name: "Excluir An\xE1lises", category: "An\xE1lises" },
    { key: "analysis.export", name: "Exportar An\xE1lises", category: "An\xE1lises" },
    { key: "projects.view", name: "Ver Projetos", category: "Projetos" },
    { key: "projects.create", name: "Criar Projetos", category: "Projetos" },
    { key: "projects.edit", name: "Editar Projetos", category: "Projetos" },
    { key: "projects.delete", name: "Excluir Projetos", category: "Projetos" },
    { key: "users.view", name: "Ver Usu\xE1rios", category: "Usu\xE1rios" },
    { key: "users.create", name: "Criar Usu\xE1rios", category: "Usu\xE1rios" },
    { key: "users.edit", name: "Editar Usu\xE1rios", category: "Usu\xE1rios" },
    { key: "users.delete", name: "Excluir Usu\xE1rios", category: "Usu\xE1rios" },
    { key: "profiles.view", name: "Ver Perfis", category: "Perfis" },
    { key: "profiles.create", name: "Criar Perfis", category: "Perfis" },
    { key: "profiles.edit", name: "Editar Perfis", category: "Perfis" },
    { key: "profiles.delete", name: "Excluir Perfis", category: "Perfis" },
    { key: "custom-fields.view", name: "Ver Campos Personalizados", category: "Campos Personalizados" },
    { key: "custom-fields.manage", name: "Gerenciar Campos Personalizados", category: "Campos Personalizados" },
    { key: "settings.manage", name: "Gerenciar Configura\xE7\xF5es", category: "Admin" }
  ]
};

// server/nupidentity.ts
var NUPIDENTITY_ENABLED = !!(process.env.NUPIDENTITY_ISSUER && process.env.NUPIDENTITY_CLIENT_ID);
async function setupNuPIdentityAuth(app2) {
  if (!NUPIDENTITY_ENABLED) {
    console.log("\u2139\uFE0F  [NuPIdentity] SSO desabilitado - usando autentica\xE7\xE3o local");
    return {
      isEnabled: false,
      isRegistered: false
    };
  }
  console.log("\u{1F510} [NuPIdentity] Configurando SSO...");
  app2.use(cookieParser());
  const config = {
    issuer: process.env.NUPIDENTITY_ISSUER,
    clientId: process.env.NUPIDENTITY_CLIENT_ID,
    clientSecret: process.env.NUPIDENTITY_CLIENT_SECRET,
    redirectUri: (process.env.APP_URL || `http://localhost:${process.env.PORT || 5e3}`) + "/auth/sso/callback",
    systemApiKey: process.env.NUPIDENTITY_API_KEY,
    successRedirect: "/dashboard",
    failureRedirect: "/login"
  };
  try {
    const sdk = await import("@nupidentity/sdk/express");
    const { setupNuPIdentity } = sdk;
    const nup = await setupNuPIdentity(app2, {
      ...config,
      manifest,
      authRoutePrefix: "/auth/sso",
      failOnSyncError: false
    });
    if (nup.isRegistered) {
      console.log("\u2705 [NuPIdentity] Sistema registrado com sucesso");
    } else {
      console.warn("\u26A0\uFE0F  [NuPIdentity] Sistema n\xE3o registrado - permiss\xF5es podem n\xE3o funcionar");
    }
    console.log("\u2705 [NuPIdentity] SSO configurado com sucesso");
    console.log("   Rotas criadas:");
    console.log("   - GET  /auth/sso/login    (inicia login SSO)");
    console.log("   - GET  /auth/sso/callback (callback OAuth)");
    console.log("   - GET  /auth/sso/me       (dados do usu\xE1rio)");
    console.log("   - POST /auth/sso/logout   (logout)");
    console.log("   - POST /auth/sso/refresh  (renovar token)");
    return {
      isEnabled: true,
      isRegistered: nup.isRegistered
    };
  } catch (error) {
    console.error("\u274C [NuPIdentity] Erro ao configurar SSO:", error);
    return {
      isEnabled: false,
      isRegistered: false
    };
  }
}

// server/index.ts
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var app = express2();
var PORT = parseInt(process.env.PORT || "5000", 10);
var isProduction = process.env.NODE_ENV === "production";
var publicPath = isProduction ? path.join(__dirname, "public") : path.join(__dirname, "../dist/public");
async function initializeApp() {
  const nup = await setupNuPIdentityAuth(app);
  if (nup.isEnabled) {
    console.log("\u{1F510} [Auth] Modo SSO NuPIdentity ativado");
  } else {
    console.log("\u{1F510} [Auth] Modo autentica\xE7\xE3o local ativado");
  }
  registerRoutes(app, { ssoEnabled: nup.isEnabled });
  app.use(express2.static(publicPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/health") || req.path.startsWith("/auth")) {
      res.status(404).json({ error: "Not found" });
    } else {
      res.sendFile(path.join(publicPath, "index.html"));
    }
  });
  if (!process.env.COMPOSED_DEV) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`\u{1F680} [NuP-AIM] Server running on port ${PORT}`);
    });
  }
}
initializeApp().catch((err) => {
  console.error("\u274C [NuP-AIM] Failed to initialize app:", err);
  process.exit(1);
});
var index_default = app;
export {
  index_default as default
};
