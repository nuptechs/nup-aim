import crypto from 'crypto';
import { GoogleGenAI } from "@google/genai";
import mammoth from 'mammoth';
import { db } from '../db';
import { fpaGuidelines } from '../schema';
import { eq } from 'drizzle-orm';

// Dynamic import for pdf-parse (CommonJS module)
let pdfParse: any = null;
import('pdf-parse').then(m => { pdfParse = m.default || m; }).catch(() => {});

// Parse base64 data URL to buffer
function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!match) return null;
  
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  };
}

// Extract text from PDF with page-by-page chunking
async function extractTextFromPdfChunked(buffer: Buffer): Promise<TextChunk[]> {
  try {
    if (!pdfParse) {
      const module = await import('pdf-parse');
      pdfParse = module.default || module;
    }
    const data = await pdfParse(buffer);
    const fullText = data.text || '';
    
    // Try to split by page markers (common PDF patterns)
    const pageMarkers = fullText.split(/\f|\n{4,}|(?=Página\s+\d+)|(?=Page\s+\d+)/i);
    
    if (pageMarkers.length > 1) {
      let charOffset = 0;
      return pageMarkers.filter(p => p.trim()).map((text, idx) => {
        const chunk = { page: idx + 1, text: text.trim(), charOffset };
        charOffset += text.length;
        return chunk;
      });
    }
    
    // Fallback: split by ~2000 chars for large docs
    return splitTextIntoChunks(fullText, 2000);
  } catch (error: any) {
    console.error('[FPA] Erro ao extrair texto do PDF:', error.message);
    return [];
  }
}

// Extract text from DOCX with paragraph-based chunking
async function extractTextFromDocxChunked(buffer: Buffer): Promise<TextChunk[]> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const fullText = result.value || '';
    
    // Split by double newlines (paragraphs/sections)
    return splitTextIntoChunks(fullText, 2000);
  } catch (error: any) {
    console.error('[FPA] Erro ao extrair texto do DOCX:', error.message);
    return [];
  }
}

// Split text into manageable chunks (~2000 chars each) with hard limit enforcement
function splitTextIntoChunks(text: string, maxChars: number = 2000): TextChunk[] {
  const chunks: TextChunk[] = [];
  
  // First, try to split by paragraphs/double newlines
  const paragraphs = text.split(/\n{2,}/);
  
  let currentChunk = '';
  let currentPage = 1;
  let charOffset = 0;
  
  for (const para of paragraphs) {
    // If the paragraph itself exceeds maxChars, split it by sentences or hard limit
    if (para.length > maxChars) {
      // First flush current chunk if it has content
      if (currentChunk.trim()) {
        chunks.push({ page: currentPage, text: currentChunk.trim(), charOffset });
        charOffset += currentChunk.length;
        currentChunk = '';
        currentPage++;
      }
      
      // Split long paragraph by sentences first
      const sentences = para.split(/(?<=[.!?;:])\s+/);
      let sentenceChunk = '';
      
      for (const sentence of sentences) {
        if (sentence.length > maxChars) {
          // Hard split: sentence is too long, break by maxChars at word boundaries
          if (sentenceChunk.trim()) {
            chunks.push({ page: currentPage, text: sentenceChunk.trim(), charOffset });
            charOffset += sentenceChunk.length;
            sentenceChunk = '';
            currentPage++;
          }
          
          // Split by words to stay under limit
          const words = sentence.split(/\s+/);
          let wordChunk = '';
          
          for (const word of words) {
            if (wordChunk.length + word.length + 1 > maxChars && wordChunk.length > 0) {
              chunks.push({ page: currentPage, text: wordChunk.trim(), charOffset });
              charOffset += wordChunk.length;
              wordChunk = '';
              currentPage++;
            }
            wordChunk += (wordChunk ? ' ' : '') + word;
          }
          
          if (wordChunk.trim()) {
            sentenceChunk = wordChunk;
          }
        } else if (sentenceChunk.length + sentence.length + 1 > maxChars) {
          chunks.push({ page: currentPage, text: sentenceChunk.trim(), charOffset });
          charOffset += sentenceChunk.length;
          sentenceChunk = sentence;
          currentPage++;
        } else {
          sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
        }
      }
      
      if (sentenceChunk.trim()) {
        currentChunk = sentenceChunk;
      }
    } else if (currentChunk.length + para.length + 2 > maxChars && currentChunk.length > 0) {
      chunks.push({ page: currentPage, text: currentChunk.trim(), charOffset });
      charOffset += currentChunk.length;
      currentChunk = para;
      currentPage++;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }
  
  // Flush final chunk
  if (currentChunk.trim()) {
    chunks.push({ page: currentPage, text: currentChunk.trim(), charOffset });
  }
  
  // Validate: ensure no chunk exceeds maxChars (final safety check)
  const validatedChunks: TextChunk[] = [];
  for (const chunk of chunks) {
    if (chunk.text.length <= maxChars) {
      validatedChunks.push(chunk);
    } else {
      // Emergency hard split
      let remaining = chunk.text;
      let pageNum = chunk.page;
      let offset = chunk.charOffset;
      
      while (remaining.length > 0) {
        const slice = remaining.substring(0, maxChars);
        validatedChunks.push({ page: pageNum, text: slice.trim(), charOffset: offset });
        offset += slice.length;
        remaining = remaining.substring(maxChars);
        pageNum++;
      }
    }
  }
  
  return validatedChunks.length > 0 ? validatedChunks : [{ page: 1, text: text.trim().substring(0, maxChars), charOffset: 0 }];
}

// Legacy single-text extractors for backward compatibility
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const chunks = await extractTextFromPdfChunked(buffer);
  return chunks.map(c => c.text).join('\n\n');
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const chunks = await extractTextFromDocxChunked(buffer);
  return chunks.map(c => c.text).join('\n\n');
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Calculate similarity ratio (0-1)
function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

// Normalize functionality name for comparison
function normalizeFunctionalityName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if two functionalities are the same
function areSameFunctionality(a: ExtractedFunctionality, b: ExtractedFunctionality): boolean {
  const nameA = normalizeFunctionalityName(a.name);
  const nameB = normalizeFunctionalityName(b.name);
  
  // Same type and status, plus similar name
  if (a.functionType === b.functionType && a.status === b.status) {
    if (stringSimilarity(nameA, nameB) > 0.85) {
      return true;
    }
  }
  
  // Very similar names regardless of type (might be same func with different classification)
  if (stringSimilarity(nameA, nameB) > 0.92) {
    return true;
  }
  
  return false;
}

// Deduplicate and merge functionalities from multiple chunks
function deduplicateAndMerge(candidates: RawFunctionalityCandidate[]): MergedFunctionality[] {
  const merged: MergedFunctionality[] = [];
  
  for (const candidate of candidates) {
    let foundMatch = false;
    
    for (const existing of merged) {
      if (areSameFunctionality(candidate, existing)) {
        // Merge: add source chunk and rationale
        existing.sourceChunks.push(candidate.sourceChunk);
        existing.mergedRationales.push(candidate.rationale);
        // Keep highest confidence
        existing.confidence = Math.max(existing.confidence, candidate.confidence);
        foundMatch = true;
        break;
      }
    }
    
    if (!foundMatch) {
      merged.push({
        ...candidate,
        sourceChunks: [candidate.sourceChunk],
        mergedRationales: [candidate.rationale]
      });
    }
  }
  
  // Sort by page order and finalize rationales
  return merged.map(m => ({
    ...m,
    sourceChunks: [...new Set(m.sourceChunks)].sort((a, b) => a - b),
    rationale: m.mergedRationales
      .filter((r, i, arr) => arr.indexOf(r) === i) // Remove duplicates
      .join(' | '),
    mergedRationales: m.mergedRationales
  })).sort((a, b) => a.sourceChunks[0] - b.sourceChunks[0]);
}

interface WorkspaceInput {
  id: string;
  type: 'text' | 'image' | 'document';
  content: string;
  fileName?: string;
  mimeType?: string;
  timestamp: string;
}

interface ExtractedFunctionality {
  name: string;
  functionType: 'ALI' | 'AIE' | 'EE' | 'SE' | 'CE';
  status: 'nova' | 'alterada' | 'excluida';
  complexity: 'baixa' | 'media' | 'alta';
  workDetails: string;
  confidence: number;
  rationale: string;
  citationVerified?: boolean; // True if citation found in source document
  citationText?: string; // Extracted citation from rationale
}

// Extract citation from rationale (looks for "Trecho: '...'" pattern)
function extractCitationFromRationale(rationale: string): string | null {
  const patterns = [
    /Trecho:\s*['"]([^'"]+)['"]/i,
    /Trecho:\s*\[([^\]]+)\]/i,
    /Citação:\s*['"]([^'"]+)['"]/i,
    /evidence:\s*['"]([^'"]+)['"]/i
  ];
  
  for (const pattern of patterns) {
    const match = rationale.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

// Verify if citation exists in the source document (fuzzy matching)
function verifyCitationInDocument(citation: string, documentText: string): boolean {
  if (!citation || citation.length < 10) return false;
  
  const normalizedCitation = citation.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedDoc = documentText.toLowerCase().replace(/\s+/g, ' ');
  
  // Exact substring match
  if (normalizedDoc.includes(normalizedCitation)) {
    return true;
  }
  
  // Try with first 50 chars (in case citation was summarized)
  const shortCitation = normalizedCitation.substring(0, 50);
  if (shortCitation.length >= 20 && normalizedDoc.includes(shortCitation)) {
    return true;
  }
  
  // Fuzzy match: check if 60% of words are present in document
  const citationWords = normalizedCitation.split(' ').filter(w => w.length > 3);
  if (citationWords.length > 0) {
    const matchedWords = citationWords.filter(word => normalizedDoc.includes(word));
    const matchRatio = matchedWords.length / citationWords.length;
    return matchRatio >= 0.6;
  }
  
  return false;
}

// Validate and enrich functionalities with citation verification
function validateCitations(
  functionalities: ExtractedFunctionality[],
  documentText: string
): ExtractedFunctionality[] {
  let verifiedCount = 0;
  let unverifiedCount = 0;
  
  const validated = functionalities.map(f => {
    const citation = extractCitationFromRationale(f.rationale);
    const isVerified = citation ? verifyCitationInDocument(citation, documentText) : false;
    
    if (isVerified) {
      verifiedCount++;
    } else {
      unverifiedCount++;
    }
    
    // Lower confidence if citation not verified
    const adjustedConfidence = isVerified ? f.confidence : Math.max(0.5, f.confidence - 0.15);
    
    return {
      ...f,
      confidence: adjustedConfidence,
      citationVerified: isVerified,
      citationText: citation || undefined
    };
  });
  
  console.log('[FPA] Validação de citações:', verifiedCount, 'verificadas,', unverifiedCount, 'não verificadas');
  
  return validated;
}

interface AnalysisResult {
  functionalities: ExtractedFunctionality[];
  summary: string;
  totalPoints?: number;
  cacheHit?: boolean;
}

interface CacheEntry {
  result: AnalysisResult;
  timestamp: number;
  promptVersion: string;
}

const PROMPT_VERSION = '3.2.0'; // Added Discovery Agent for implicit functionality detection
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const analysisCache = new Map<string, CacheEntry>();

// Types for chunked processing
interface TextChunk {
  page: number;
  text: string;
  charOffset: number;
}

interface RawFunctionalityCandidate extends ExtractedFunctionality {
  sourceChunk: number;
  sourceExcerpt: string;
}

interface MergedFunctionality extends ExtractedFunctionality {
  sourceChunks: number[];
  mergedRationales: string[];
}

interface FpaGuideline {
  id: string;
  title: string;
  triggerPhrases: string[];
  businessDomains: string[];
  instruction: string;
  examples: { input: string; output: string }[];
  negativeExamples: { input: string; wrongOutput: string; correctOutput: string }[];
  priority: string;
}

async function fetchActiveGuidelines(): Promise<FpaGuideline[]> {
  try {
    const guidelines = await db.select().from(fpaGuidelines).where(eq(fpaGuidelines.isActive, true));
    return guidelines.map(g => ({
      id: g.id,
      title: g.title,
      triggerPhrases: (g.triggerPhrases as string[]) || [],
      businessDomains: (g.businessDomains as string[]) || [],
      instruction: g.instruction,
      examples: (g.examples as any[]) || [],
      negativeExamples: (g.negativeExamples as any[]) || [],
      priority: g.priority || 'normal'
    }));
  } catch (error: any) {
    console.warn('[FPA] Erro ao buscar diretrizes:', error.message);
    return [];
  }
}

function findMatchingGuidelines(text: string, guidelines: FpaGuideline[]): FpaGuideline[] {
  const textLower = text.toLowerCase();
  
  return guidelines.filter(g => {
    const triggerMatch = g.triggerPhrases.some(phrase => 
      textLower.includes(phrase.toLowerCase())
    );
    const domainMatch = g.businessDomains.some(domain =>
      textLower.includes(domain.toLowerCase())
    );
    return triggerMatch || domainMatch;
  }).sort((a, b) => {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    return (priorityOrder[a.priority as keyof typeof priorityOrder] || 1) - 
           (priorityOrder[b.priority as keyof typeof priorityOrder] || 1);
  });
}

function formatGuidelinesForPrompt(guidelines: FpaGuideline[]): string {
  if (guidelines.length === 0) return '';
  
  let guidelinesSection = `\n\n=== DIRETRIZES APF OBRIGATÓRIAS ===
APLIQUE as seguintes diretrizes de Análise de Pontos de Função:

`;
  
  guidelines.forEach((g, idx) => {
    guidelinesSection += `[DIRETRIZ ${idx + 1}] ${g.title}
${g.instruction}
`;
    
    if (g.examples.length > 0) {
      guidelinesSection += `Exemplos corretos:\n`;
      g.examples.forEach(ex => {
        guidelinesSection += `  - Texto: "${ex.input}" → ${ex.output}\n`;
      });
    }
    
    if (g.negativeExamples.length > 0) {
      guidelinesSection += `Exemplos INCORRETOS (não fazer):\n`;
      g.negativeExamples.forEach(ex => {
        guidelinesSection += `  - Texto: "${ex.input}" → ERRADO: ${ex.wrongOutput} → CORRETO: ${ex.correctOutput}\n`;
      });
    }
    
    guidelinesSection += '\n';
  });
  
  guidelinesSection += `=================================\n`;
  
  return guidelinesSection;
}

function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

function generateContentHash(inputs: WorkspaceInput[], guidelineIds: string[] = []): string {
  const contentParts = inputs.map(input => {
    if (input.type === 'text') {
      return normalizeText(input.content);
    }
    const base64Match = input.content.match(/base64,(.+)/);
    return base64Match ? base64Match[1] : input.content;
  });
  
  const sortedContents = contentParts.sort();
  const guidelineSignature = guidelineIds.sort().join(',');
  const combinedContent = sortedContents.join('|||') + '###' + guidelineSignature;
  
  return crypto.createHash('sha256').update(combinedContent).digest('hex');
}

function getCachedResult(hash: string): AnalysisResult | null {
  const entry = analysisCache.get(hash);
  if (!entry) return null;
  
  if (entry.promptVersion !== PROMPT_VERSION) {
    analysisCache.delete(hash);
    return null;
  }
  
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    analysisCache.delete(hash);
    return null;
  }
  
  return { ...entry.result, cacheHit: true };
}

function setCacheResult(hash: string, result: AnalysisResult): void {
  analysisCache.set(hash, {
    result,
    timestamp: Date.now(),
    promptVersion: PROMPT_VERSION
  });
  
  if (analysisCache.size > 100) {
    const oldestKey = analysisCache.keys().next().value;
    if (oldestKey) analysisCache.delete(oldestKey);
  }
}

// ============================================================================
// MULTI-AGENT ARCHITECTURE WITH CHAIN OF THOUGHT
// ============================================================================

// AGENT 1: COMPREHENSIVE SCAN - Finds ALL potential functionalities
const SCAN_AGENT_PROMPT = `Você é um ANALISTA DE SISTEMAS experiente fazendo a PRIMEIRA LEITURA de um documento de requisitos.

=== SUA MISSÃO ===
Leia o documento COMPLETO e identifique TODAS as potenciais funcionalidades de software que:
- Foram CRIADAS (novas)
- Foram ALTERADAS (modificadas)
- Foram EXCLUÍDAS (removidas)

=== RACIOCÍNIO PASSO A PASSO (Chain of Thought) ===
Para cada funcionalidade que você identificar, raciocine assim:

PASSO 1: Qual ação está sendo descrita?
- Verbos: criar, alterar, excluir, incluir, modificar, remover, adicionar, atualizar...
- Substantivos: criação, alteração, exclusão, inclusão, modificação, remoção...
- Contexto implícito: "era X, agora é Y" (alteração), "novo campo" (criação)

PASSO 2: Qual é a ENTIDADE afetada?
- Tela, relatório, cadastro, consulta, arquivo, processo, regra de negócio...
- IMPORTANTE: Se menciona MÚLTIPLAS entidades separadas por "e" ou vírgula, cada uma é uma funcionalidade SEPARADA!
  Exemplo: "Modelo de Contrato Turma SEST e Locação de Espaços" = 2 funcionalidades distintas

PASSO 3: Qual é o STATUS?
- Nova: algo que não existia antes
- Alterada: algo que existia e foi modificado
- Excluída: algo que existia e foi removido

=== REGRA CRÍTICA: SEPARAÇÃO DE FUNCIONALIDADES ===
SEMPRE separe quando:
- Texto menciona "X e Y" onde X e Y são entidades diferentes → 2 funcionalidades
- Texto menciona "X, Y e Z" → 3 funcionalidades
- Entidades podem existir independentemente → separar
- Entidades têm regras de negócio diferentes → separar

=== EXEMPLOS CONCRETOS (FEW-SHOT) ===

EXEMPLO 1 - Texto de entrada:
"Criar tela de cadastro de Clientes com campos Nome, CPF, Telefone e Email. Incluir validação de CPF."

Saída esperada:
{
  "reasoning": "Identifico 2 funcionalidades: (1) tela de cadastro = ALI para dados + EE para inclusão, (2) validação de CPF = regra de negócio na EE",
  "candidates": [
    {"name": "Cadastro de Clientes", "status": "nova", "evidence": "Criar tela de cadastro de Clientes com campos Nome, CPF, Telefone e Email", "reasoning": "Cadastro = manutenção de dados = ALI + EE"},
    {"name": "Validação de CPF no Cadastro de Clientes", "status": "nova", "evidence": "Incluir validação de CPF", "reasoning": "Validação é parte da EE de inclusão"}
  ]
}

EXEMPLO 2 - Texto de entrada:
"Alterar relatório de Vendas para incluir filtro por período e totalização por região."

Saída esperada:
{
  "reasoning": "Relatório alterado com novos filtros e cálculos = SE alterada (tem cálculo de totalização)",
  "candidates": [
    {"name": "Relatório de Vendas com Filtro por Período", "status": "alterada", "evidence": "Alterar relatório de Vendas para incluir filtro por período", "reasoning": "Novo filtro = alteração de consulta existente"},
    {"name": "Totalização por Região no Relatório de Vendas", "status": "alterada", "evidence": "totalização por região", "reasoning": "Novo cálculo no relatório = SE alterada"}
  ]
}

EXEMPLO 3 - Texto de entrada:
"Configurar Modelo Contrato Turma SEST e Locação de Espaços. Gerar automaticamente os contratos."

Saída esperada (SEPARAÇÃO OBRIGATÓRIA):
{
  "reasoning": "Texto menciona 2 entidades diferentes separadas por 'e': Turma SEST e Locação. São contratos diferentes = funcionalidades separadas. Configurar = ALI, Gerar = SE.",
  "candidates": [
    {"name": "Configurar Modelo Contrato Turma SEST", "status": "nova", "evidence": "Configurar Modelo Contrato Turma SEST", "reasoning": "Modelo de contrato = template = ALI"},
    {"name": "Configurar Modelo Contrato Locação de Espaços", "status": "nova", "evidence": "Configurar Modelo Contrato... Locação de Espaços", "reasoning": "Outro modelo distinto = outro ALI"},
    {"name": "Gerar Contrato Turma SEST", "status": "nova", "evidence": "Gerar automaticamente os contratos", "reasoning": "Geração com merge de dados = SE"},
    {"name": "Gerar Contrato Locação de Espaços", "status": "nova", "evidence": "Gerar automaticamente os contratos", "reasoning": "Outro tipo de contrato = outra SE"}
  ]
}

EXEMPLO 4 - Texto de entrada:
"Excluir funcionalidade de importação de dados legados. O sistema não terá mais essa opção."

Saída esperada:
{
  "reasoning": "Funcionalidade sendo removida = status excluida",
  "candidates": [
    {"name": "Importação de Dados Legados", "status": "excluida", "evidence": "Excluir funcionalidade de importação de dados legados", "reasoning": "Remoção explícita de funcionalidade existente"}
  ]
}

EXEMPLO 5 - Texto de entrada:
"Integrar com sistema do SERPRO para consulta de CNPJ e CPF."

Saída esperada:
{
  "reasoning": "Integração externa = AIE (dados de fora) + CE (consultas). CPF e CNPJ são 2 consultas diferentes.",
  "candidates": [
    {"name": "Integração SERPRO - Dados", "status": "nova", "evidence": "Integrar com sistema do SERPRO", "reasoning": "Dados externos = AIE"},
    {"name": "Consulta CNPJ via SERPRO", "status": "nova", "evidence": "consulta de CNPJ", "reasoning": "Consulta externa = CE"},
    {"name": "Consulta CPF via SERPRO", "status": "nova", "evidence": "consulta de... CPF", "reasoning": "Consulta diferente = outra CE"}
  ]
}

=== O QUE PROCURAR ===
1. Telas de cadastro/manutenção de dados
2. Relatórios e consultas
3. Integrações com outros sistemas
4. Regras de negócio que mudam
5. Campos que são adicionados, alterados ou removidos
6. Validações novas ou modificadas
7. Processos automatizados
8. Modelos de documentos (contratos, propostas, etc.)
9. Alterações em banco de dados que impactam funcionalidades

=== FORMATO DE RESPOSTA ===
{
  "reasoning": "seu raciocínio passo a passo explicando o que você identificou",
  "candidates": [
    {
      "name": "Nome descritivo da funcionalidade",
      "status": "nova|alterada|excluida",
      "evidence": "trecho EXATO copiado do documento que justifica (citação literal)",
      "reasoning": "por que você identificou isso como funcionalidade"
    }
  ]
}

SEJA EXAUSTIVO: É melhor identificar demais do que identificar de menos!

DOCUMENTO PARA ANÁLISE:`;

// AGENT 2: EXPANSION & VALIDATION - Reviews and expands the list
const EXPANSION_AGENT_PROMPT = `Você é um REVISOR SÊNIOR de Análise de Pontos de Função. Outro analista fez uma primeira identificação de funcionalidades.

=== SUA MISSÃO ===
1. REVISAR cada funcionalidade identificada
2. SEPARAR funcionalidades que estão combinadas indevidamente
3. IDENTIFICAR funcionalidades que podem ter sido OMITIDAS
4. VALIDAR se cada item é realmente uma funcionalidade de software

=== REGRAS DE REVISÃO ===

SEPARAR quando:
- Nome contém "e" ou "," listando entidades diferentes
- Uma funcionalidade poderia existir sem a outra
- São entidades de negócio distintas
- Teriam regras diferentes no sistema

MANTER JUNTO quando:
- É a mesma entidade com filtros diferentes ("Ativos e Inativos")
- São sempre usadas juntas no mesmo processo
- Uma não faz sentido sem a outra

ADICIONAR funcionalidades omitidas:
- Revise o documento original procurando menções que o primeiro analista pode ter perdido
- Procure por funcionalidades implícitas (se altera X, pode precisar de consulta de X)
- Verifique se há telas de consulta que seriam necessárias para operar cadastros

=== EXEMPLOS CONCRETOS (FEW-SHOT) ===

EXEMPLO 1 - SEPARAÇÃO NECESSÁRIA:
Entrada do analista:
[{"name": "Cadastro de Fornecedores e Clientes", "status": "nova", "evidence": "Criar cadastro de fornecedores e clientes"}]

Saída corrigida:
{
  "reviewNotes": "SEPAREI: 'Fornecedores e Clientes' são entidades distintas com regras diferentes. Cada uma terá seu próprio ALI e EEs.",
  "expandedCandidates": [
    {"name": "Cadastro de Fornecedores", "status": "nova", "evidence": "Criar cadastro de fornecedores", "reasoning": "Fornecedor = entidade independente = ALI + EEs separados"},
    {"name": "Cadastro de Clientes", "status": "nova", "evidence": "Criar cadastro de... clientes", "reasoning": "Cliente = entidade independente = ALI + EEs separados"}
  ],
  "addedFunctionalities": []
}

EXEMPLO 2 - MANTER JUNTO:
Entrada do analista:
[{"name": "Consulta de Produtos Ativos", "status": "nova", "evidence": "Consultar produtos ativos e inativos"}]

Saída corrigida:
{
  "reviewNotes": "MANTIVE JUNTO: 'Ativos e Inativos' são filtros da mesma consulta, não entidades diferentes. Uma CE com filtro de status.",
  "expandedCandidates": [
    {"name": "Consulta de Produtos (Ativos e Inativos)", "status": "nova", "evidence": "Consultar produtos ativos e inativos", "reasoning": "Mesma CE com filtro por status"}
  ],
  "addedFunctionalities": []
}

EXEMPLO 3 - FUNCIONALIDADE OMITIDA (IMPLÍCITA):
Entrada do analista:
[{"name": "Alterar Pedido de Compra", "status": "alterada", "evidence": "Modificar tela de pedido para incluir campo de aprovador"}]

Documento menciona: "O usuário deve poder pesquisar pedidos antes de alterar"

Saída corrigida:
{
  "reviewNotes": "ADICIONEI: O documento menciona pesquisa de pedidos que foi omitida. Também implícita: se altera pedido, precisa visualizar pedido.",
  "expandedCandidates": [
    {"name": "Alterar Pedido de Compra", "status": "alterada", "evidence": "Modificar tela de pedido para incluir campo de aprovador", "reasoning": "EE de alteração"},
    {"name": "Consultar Pedido de Compra", "status": "nova", "evidence": "O usuário deve poder pesquisar pedidos antes de alterar", "reasoning": "CE implícita - necessária para operar alteração"},
    {"name": "Visualizar Detalhes do Pedido", "status": "nova", "evidence": "(implícito - necessário para alterar)", "reasoning": "CE implícita - deve visualizar antes de alterar"}
  ],
  "addedFunctionalities": ["Consultar Pedido de Compra", "Visualizar Detalhes do Pedido"]
}

EXEMPLO 4 - FUNCIONALIDADE NÃO VÁLIDA:
Entrada do analista:
[{"name": "Melhorar performance do sistema", "status": "alterada", "evidence": "Otimizar consultas SQL"}]

Saída corrigida:
{
  "reviewNotes": "REMOVIDO: 'Melhorar performance' não é funcionalidade contável - é requisito não-funcional (SNAP, não FPA).",
  "expandedCandidates": [],
  "addedFunctionalities": []
}

=== FORMATO DE RESPOSTA ===
{
  "reviewNotes": "notas sobre suas decisões de separação/unificação/adição",
  "expandedCandidates": [
    {
      "name": "Nome da funcionalidade (cada uma separada)",
      "status": "nova|alterada|excluida",
      "evidence": "trecho EXATO do documento (citação literal)",
      "reasoning": "justificativa completa"
    }
  ],
  "addedFunctionalities": ["lista de funcionalidades que você adicionou que não estavam na lista original"]
}

FUNCIONALIDADES IDENTIFICADAS PELO PRIMEIRO ANALISTA:
{candidates}

DOCUMENTO ORIGINAL:
{document}`;

// AGENT 3: IFPUG CLASSIFICATION - Applies technical classification
const CLASSIFICATION_AGENT_PROMPT = `Você é um ESPECIALISTA CERTIFICADO em Análise de Pontos de Função (CFPS) aplicando o padrão IFPUG CPM 4.3.1.

=== SUA MISSÃO ===
Classificar cada funcionalidade validada segundo o padrão IFPUG:
- TIPO: ALI, AIE, EE, SE, CE
- COMPLEXIDADE: baixa, media, alta

=== TIPOS IFPUG ===
- ALI (Arquivo Lógico Interno): Grupo de dados mantido DENTRO do sistema analisado
- AIE (Arquivo de Interface Externa): Grupo de dados referenciado de OUTRO sistema (mantido externamente)
- EE (Entrada Externa): Processo que MANTÉM dados (incluir, alterar, excluir) ou altera comportamento do sistema
- SE (Saída Externa): Processo que exibe dados COM cálculos, derivações ou lógica de processamento
- CE (Consulta Externa): Processo que exibe dados SEM cálculos significativos (recuperação direta)

=== DETERMINAÇÃO DE COMPLEXIDADE ===
Para ALI/AIE (contar DERs e RLRs):
- Baixa: ≤19 DERs + 1 RLR, ou ≤50 DERs + 1 RLR
- Media: ≤19 DERs + 2-5 RLRs, ou 20-50 DERs + 2-5 RLRs  
- Alta: 50+ DERs ou 6+ RLRs

Para EE/SE/CE (contar DERs e ALRs):
- Baixa: ≤4 DERs + 0-1 ALRs, ou 5-15 DERs + 0-1 ALR
- Media: ≤4 DERs + 2 ALRs, ou 5-15 DERs + 2 ALRs, ou 16+ DERs + 0-1 ALR
- Alta: 16+ DERs + 2+ ALRs, ou 3+ ALRs

REGRA NESMA: Se não conseguir identificar DERs/ALRs no texto, use "media" e adicione ao rationale essa justificativa.

=== EXEMPLOS CONCRETOS DE CLASSIFICAÇÃO IFPUG (FEW-SHOT) ===

EXEMPLO 1 - ALI (Cadastro de dados):
Entrada: {"name": "Cadastro de Clientes", "status": "nova", "evidence": "Criar tela de cadastro de Clientes com campos Nome, CPF, Telefone, Email"}
Saída:
{
  "name": "ALI - Cadastro de Clientes",
  "functionType": "ALI",
  "status": "nova",
  "complexity": "baixa",
  "workDetails": "Arquivo lógico para armazenar dados de clientes incluindo nome, CPF, telefone e email",
  "confidence": 0.95,
  "rationale": "Trecho: 'Criar tela de cadastro de Clientes com campos Nome, CPF, Telefone, Email'. Classificado como ALI porque é grupo de dados mantido pelo sistema. Complexidade baixa: 4 DERs identificados (Nome, CPF, Telefone, Email) + 1 RLR (Clientes)."
}

EXEMPLO 2 - EE (Entrada de dados):
Entrada: {"name": "Incluir Cliente", "status": "nova", "evidence": "O usuário pode cadastrar novos clientes no sistema"}
Saída:
{
  "name": "EE - Incluir Cliente",
  "functionType": "EE",
  "status": "nova",
  "complexity": "baixa",
  "workDetails": "Transação para incluir novo registro de cliente no sistema",
  "confidence": 0.95,
  "rationale": "Trecho: 'O usuário pode cadastrar novos clientes'. Classificado como EE porque é processo que mantém (inclui) dados no ALI Clientes. Complexidade baixa: poucos campos + 1 ALR (Clientes)."
}

EXEMPLO 3 - SE (Relatório com cálculos):
Entrada: {"name": "Relatório de Vendas por Região", "status": "nova", "evidence": "Gerar relatório com totalização de vendas por região e período"}
Saída:
{
  "name": "SE - Relatório de Vendas por Região",
  "functionType": "SE",
  "status": "nova",
  "complexity": "media",
  "workDetails": "Relatório que calcula totais de vendas agrupados por região e período",
  "confidence": 0.90,
  "rationale": "Trecho: 'totalização de vendas por região'. Classificado como SE porque exibe dados COM cálculo de totalização. Complexidade média: cálculos de agregação + múltiplos ALRs (Vendas, Regiões)."
}

EXEMPLO 4 - CE (Consulta simples):
Entrada: {"name": "Consultar Pedido", "status": "nova", "evidence": "Pesquisar pedidos por número ou cliente"}
Saída:
{
  "name": "CE - Consultar Pedido",
  "functionType": "CE",
  "status": "nova",
  "complexity": "baixa",
  "workDetails": "Consulta para recuperar dados de pedidos por número ou cliente",
  "confidence": 0.92,
  "rationale": "Trecho: 'Pesquisar pedidos por número ou cliente'. Classificado como CE porque é recuperação direta de dados SEM cálculos. Complexidade baixa: filtros simples + 1 ALR (Pedidos)."
}

EXEMPLO 5 - AIE (Dados externos):
Entrada: {"name": "Dados SERPRO", "status": "nova", "evidence": "Consultar CPF no webservice do SERPRO"}
Saída:
{
  "name": "AIE - Dados SERPRO",
  "functionType": "AIE",
  "status": "nova",
  "complexity": "baixa",
  "workDetails": "Arquivo de interface externa para dados de CPF do SERPRO",
  "confidence": 0.88,
  "rationale": "Trecho: 'webservice do SERPRO'. Classificado como AIE porque são dados mantidos por sistema externo (SERPRO) e apenas referenciados pelo nosso sistema. Complexidade baixa: dados de pessoa = estrutura simples."
}

EXEMPLO 6 - EE de Alteração:
Entrada: {"name": "Alterar Contrato", "status": "alterada", "evidence": "Modificar tela de contrato para incluir campo de aprovador"}
Saída:
{
  "name": "EE - Alterar Contrato",
  "functionType": "EE",
  "status": "alterada",
  "complexity": "media",
  "workDetails": "Transação de alteração de contrato com novo campo de aprovador",
  "confidence": 0.90,
  "rationale": "Trecho: 'Modificar tela de contrato para incluir campo de aprovador'. Classificado como EE porque é processo que altera dados existentes. Complexidade média (NESMA): não foi possível extrair todos os campos para contagem precisa de DERs."
}

=== FORMATO DE RESPOSTA ===
{
  "functionalities": [
    {
      "name": "TIPO - Nome Descritivo",
      "functionType": "ALI|AIE|EE|SE|CE",
      "status": "nova|alterada|excluida",
      "complexity": "baixa|media|alta",
      "workDetails": "descrição do que a funcionalidade faz",
      "confidence": 0.0-1.0,
      "rationale": "Trecho: '[citação exata]'. Classificado como TIPO porque [razão técnica IFPUG]. Complexidade [nivel] porque [contagem DER/ALR ou justificativa NESMA]."
    }
  ],
  "summary": "resumo da análise com contagem por tipo",
  "totalPoints": número
}

FUNCIONALIDADES PARA CLASSIFICAR:
{candidates}

DOCUMENTO DE REFERÊNCIA:
{document}`;

// LEGACY: Chunk extraction prompt (kept for fallback/compatibility)
const CHUNK_EXTRACTION_PROMPT = `Você é um especialista em Análise de Pontos de Função (APF) seguindo o padrão IFPUG CPM 4.3.1.

MISSÃO: Extraia TODAS as funcionalidades que foram CRIADAS, ALTERADAS ou EXCLUÍDAS no texto abaixo.

=== REGRA CRÍTICA: SEPARAÇÃO DE FUNCIONALIDADES ===
SEMPRE separe quando o texto menciona múltiplas entidades:
- "X e Y" onde X e Y são entidades diferentes → 2 funcionalidades SEPARADAS
- "Modelo Contrato Turma SEST e Locação de Espaços" → 2 funcionalidades

=== TIPOS IFPUG ===
- ALI: Dados mantidos pelo sistema (cadastros)
- AIE: Dados de sistema externo
- EE: Transação que cria/altera/exclui dados
- SE: Saída com cálculos
- CE: Consulta simples

=== FORMATO DE RESPOSTA ===
{"functionalities":[{"name":"TIPO - Ação Entidade","functionType":"ALI|AIE|EE|SE|CE","status":"nova|alterada|excluida","complexity":"media","workDetails":"descrição","confidence":0.8,"rationale":"trecho e justificativa"}]}

TEXTO A ANALISAR:`;

// CONSOLIDATION PROMPT - Reviews all extracted functionalities holistically
const CONSOLIDATION_PROMPT = `Você é um especialista em Análise de Pontos de Função (APF) realizando uma REVISÃO FINAL.

CONTEXTO: Um documento foi dividido em seções e funcionalidades foram extraídas de cada seção separadamente.
Agora você deve revisar TODAS as funcionalidades extraídas considerando o DOCUMENTO COMPLETO.

=== SUA MISSÃO ===
1. VERIFICAR se funcionalidades que parecem iguais são realmente a mesma ou são distintas
2. SEPARAR funcionalidades que foram erroneamente combinadas (ex: "Func A e Func B" → duas entradas separadas)
3. UNIFICAR funcionalidades que são realmente a mesma mas aparecem com nomes ligeiramente diferentes
4. ENRIQUECER as justificativas com informações de todo o documento

=== REGRAS DE SEPARAÇÃO ===
Se uma funcionalidade contém "e", "," ou lista múltiplos itens, avalie se são:
- MESMA funcionalidade (mantém junto): "Consultar Clientes Ativos e Inativos" → uma CE
- FUNCIONALIDADES DISTINTAS (separar): "Configurar Modelo Contrato A e Modelo Contrato B" → duas EE separadas

Indicadores de que devem ser SEPARADAS:
- Entidades diferentes (Turma SEST vs Locação de Espaços)
- Podem existir independentemente
- Usuários diferentes podem precisar de apenas uma delas
- Regras de negócio diferentes

Indicadores de que devem ser MANTIDAS JUNTAS:
- Mesma entidade, operações similares
- Sempre usadas juntas
- Mesma tela/processo no sistema

=== FORMATO DE RESPOSTA ===
Retorne JSON com a lista FINAL de funcionalidades REVISADAS:
{"functionalities":[{"name":"TIPO - Nome Funcionalidade","functionType":"ALI|AIE|EE|SE|CE","status":"nova|alterada|excluida","complexity":"baixa|media|alta","workDetails":"descrição","confidence":0.0-1.0,"rationale":"justificativa consolidada"}],"summary":"resumo da análise","consolidationNotes":"notas sobre separações/unificações realizadas"}

FUNCIONALIDADES EXTRAÍDAS PARA REVISÃO:`;

// DISCOVERY AGENT PROMPT - Second pass to find implicit/hidden functionalities
const DISCOVERY_AGENT_PROMPT = `Você é um ESPECIALISTA EM DESCOBERTA de funcionalidades IMPLÍCITAS e OCULTAS em documentos de projeto.

=== CONTEXTO ===
Uma análise inicial identificou algumas funcionalidades explícitas no documento. 
Sua missão é uma SEGUNDA VARREDURA profunda para encontrar funcionalidades que NÃO foram detectadas.

=== O QUE PROCURAR (funcionalidades implícitas) ===

1. **Operações CRUD derivadas**:
   - Se há "Cadastro de Clientes", provavelmente existem: Incluir, Alterar, Excluir, Consultar Cliente
   - Cada operação é uma funcionalidade SEPARADA

2. **Integrações mencionadas de passagem**:
   - "dados do SERPRO", "consulta Receita Federal", "integração com banco"
   - Cada sistema externo referenciado pode ser um AIE

3. **Relatórios e consultas mencionados em contexto**:
   - "o gerente precisa acompanhar...", "a diretoria visualiza...", "exportar para Excel"
   - Verbos como: visualizar, acompanhar, monitorar, exportar, imprimir

4. **Validações e regras de negócio como EE**:
   - "validar CPF", "verificar disponibilidade", "aprovar pedido"
   - Processos que alteram estado do sistema

5. **Fluxos alternativos e exceções**:
   - "caso contrário...", "se não houver...", "quando expirar..."
   - Podem indicar funcionalidades de tratamento específico

6. **Funcionalidades de apoio/infraestrutura**:
   - Logs de auditoria, controle de acesso, notificações por email
   - Frequentemente implícitos mas contáveis

=== FUNCIONALIDADES JÁ IDENTIFICADAS (NÃO repetir) ===
{existingFunctionalities}

=== REGRAS CRÍTICAS ===
- NÃO repita funcionalidades já listadas acima (mesmo com nomes diferentes)
- Cada nova funcionalidade DEVE ter citação exata do documento
- Se não encontrar novas funcionalidades, retorne lista vazia (isso é OK)
- Priorize QUALIDADE sobre quantidade - só adicione se for realmente contável por IFPUG

=== EXEMPLOS DE DESCOBERTA ===

EXEMPLO 1 - CRUD implícito:
Documento diz: "Sistema de cadastro de fornecedores"
Funcionalidades implícitas:
- EE - Incluir Fornecedor (derivada de "cadastro")
- EE - Alterar Fornecedor (derivada de "cadastro")
- EE - Excluir Fornecedor (derivada de "cadastro")
- CE - Consultar Fornecedor (derivada de "cadastro")

EXEMPLO 2 - Integração implícita:
Documento diz: "O CPF é validado junto à Receita Federal"
Funcionalidades implícitas:
- AIE - Dados Receita Federal (sistema externo referenciado)
- EE - Validar CPF (processo de validação)

EXEMPLO 3 - Relatório implícito:
Documento diz: "A gerência acompanha a produtividade mensal"
Funcionalidades implícitas:
- SE - Relatório de Produtividade Mensal (derivada de "acompanha")

=== FORMATO DE RESPOSTA ===
IMPORTANTE: Retorne candidatos BRUTOS para classificação posterior. NÃO inclua tipo IFPUG no nome.
{
  "discoveredCandidates": [
    {
      "name": "Nome da Funcionalidade (sem prefixo de tipo)",
      "status": "nova|alterada|excluida",
      "evidence": "trecho EXATO e LITERAL do documento que evidencia esta funcionalidade",
      "reasoning": "Funcionalidade implícita identificada porque [razão]. Derivada de [elemento explícito]."
    }
  ],
  "discoveryNotes": "explicação de como descobriu cada funcionalidade"
}

DOCUMENTO PARA SEGUNDA VARREDURA:
{document}`;

// Consolidate functionalities with full document context
async function consolidateFunctionalities(
  ai: GoogleGenAI,
  candidates: MergedFunctionality[],
  fullDocumentText: string,
  guidelinesSection: string
): Promise<ExtractedFunctionality[]> {
  if (candidates.length === 0) return [];
  if (candidates.length === 1) {
    // Single functionality - no consolidation needed
    return candidates.map(m => ({
      name: m.name,
      functionType: m.functionType,
      status: m.status,
      complexity: m.complexity,
      workDetails: m.workDetails,
      confidence: m.confidence,
      rationale: m.rationale
    }));
  }
  
  try {
    // Prepare candidates summary for review
    const candidatesSummary = candidates.map((c, i) => 
      `${i + 1}. "${c.name}" (${c.functionType}, ${c.status}, ${c.complexity})\n   Justificativa: ${c.rationale.substring(0, 300)}...`
    ).join('\n\n');
    
    // Limit document text to avoid context overflow
    const docSummary = fullDocumentText.length > 8000 
      ? fullDocumentText.substring(0, 8000) + '\n...[documento truncado para revisão]...'
      : fullDocumentText;
    
    const prompt = `${CONSOLIDATION_PROMPT}${guidelinesSection}

${candidatesSummary}

=== TEXTO COMPLETO DO DOCUMENTO (para referência) ===
${docSummary}`;

    console.log('[FPA] Consolidando', candidates.length, 'funcionalidades com visão holística...');
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    let responseText = response.text || '';
    if (!responseText && response.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = response.candidates[0].content.parts[0].text;
    }
    
    if (!responseText) {
      console.warn('[FPA] Consolidação: resposta vazia, usando candidatos originais');
      return candidates.map(m => ({
        name: m.name,
        functionType: m.functionType,
        status: m.status,
        complexity: m.complexity,
        workDetails: m.workDetails,
        confidence: m.confidence,
        rationale: m.rationale
      }));
    }
    
    let jsonStr = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.warn('[FPA] Consolidação: JSON não encontrado, usando candidatos originais');
      return candidates.map(m => ({
        name: m.name,
        functionType: m.functionType,
        status: m.status,
        complexity: m.complexity,
        workDetails: m.workDetails,
        confidence: m.confidence,
        rationale: m.rationale
      }));
    }
    
    const cleanJson = jsonMatch[0].replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
    const parsed = JSON.parse(cleanJson);
    
    const consolidatedFuncs = (parsed.functionalities || []) as ExtractedFunctionality[];
    
    if (parsed.consolidationNotes) {
      console.log('[FPA] Notas de consolidação:', parsed.consolidationNotes);
    }
    
    console.log('[FPA] Consolidação completa:', consolidatedFuncs.length, 'funcionalidades finais (de', candidates.length, 'candidatas)');
    
    return consolidatedFuncs.map(f => ({
      ...f,
      functionType: validateFunctionType(f.functionType),
      status: validateStatus(f.status),
      complexity: validateComplexity(f.complexity),
      confidence: Math.min(1, Math.max(0, f.confidence || 0.8))
    }));
    
  } catch (error: any) {
    console.error('[FPA] Erro na consolidação:', error.message);
    // Fallback to original candidates
    return candidates.map(m => ({
      name: m.name,
      functionType: m.functionType,
      status: m.status,
      complexity: m.complexity,
      workDetails: m.workDetails,
      confidence: m.confidence,
      rationale: m.rationale
    }));
  }
}

// ============================================================================
// MULTI-AGENT EXECUTION FUNCTIONS
// ============================================================================

interface ScanCandidate {
  name: string;
  status: string;
  evidence: string;
  reasoning: string;
}

// AGENT 1: Scan Agent - Comprehensive document scan
// Handles large documents by chunking if necessary
const MAX_SCAN_CHARS = 25000; // Safe limit for Gemini context

async function runScanAgent(
  ai: GoogleGenAI,
  documentText: string,
  guidelinesSection: string
): Promise<{ reasoning: string; candidates: ScanCandidate[] }> {
  console.log('[FPA] 🔍 AGENTE 1 (SCAN): Iniciando análise compreensiva...');
  console.log('[FPA] Tamanho do documento:', documentText.length, 'caracteres');
  
  // For large documents, split into chunks and process each
  if (documentText.length > MAX_SCAN_CHARS) {
    console.log('[FPA] Documento grande detectado, dividindo em partes...');
    return await runScanAgentChunked(ai, documentText, guidelinesSection);
  }
  
  return await runScanAgentSingle(ai, documentText, guidelinesSection);
}

// Scan a single document (or chunk)
async function runScanAgentSingle(
  ai: GoogleGenAI,
  documentText: string,
  guidelinesSection: string
): Promise<{ reasoning: string; candidates: ScanCandidate[] }> {
  try {
    const prompt = `${SCAN_AGENT_PROMPT}${guidelinesSection}\n\n${documentText}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    let responseText = response.text || '';
    if (!responseText && response.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = response.candidates[0].content.parts[0].text;
    }
    
    if (!responseText) {
      console.warn('[FPA] Scan Agent: resposta vazia');
      return { reasoning: '', candidates: [] };
    }
    
    const jsonStr = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.warn('[FPA] Scan Agent: JSON não encontrado');
      return { reasoning: '', candidates: [] };
    }
    
    const cleanJson = jsonMatch[0].replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
    const parsed = JSON.parse(cleanJson);
    
    console.log('[FPA] Scan Agent encontrou:', (parsed.candidates || []).length, 'candidatos');
    
    return {
      reasoning: parsed.reasoning || '',
      candidates: parsed.candidates || []
    };
    
  } catch (error: any) {
    console.error('[FPA] Scan Agent erro:', error.message);
    return { reasoning: '', candidates: [] };
  }
}

// Scan large documents by processing in chunks
async function runScanAgentChunked(
  ai: GoogleGenAI,
  documentText: string,
  guidelinesSection: string
): Promise<{ reasoning: string; candidates: ScanCandidate[] }> {
  const chunks = splitTextIntoChunks(documentText, MAX_SCAN_CHARS - 5000); // Leave room for prompt
  console.log('[FPA] Documento dividido em', chunks.length, 'partes para scan');
  
  const allCandidates: ScanCandidate[] = [];
  const allReasonings: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    console.log('[FPA] Processando parte', i + 1, 'de', chunks.length);
    
    const chunkResult = await runScanAgentSingle(ai, chunks[i].text, guidelinesSection);
    
    if (chunkResult.candidates.length > 0) {
      allCandidates.push(...chunkResult.candidates);
    }
    if (chunkResult.reasoning) {
      allReasonings.push(`Parte ${i + 1}: ${chunkResult.reasoning.substring(0, 200)}`);
    }
    
    // Small delay between chunks
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  console.log('[FPA] Scan chunked completo:', allCandidates.length, 'candidatos de', chunks.length, 'partes');
  
  return {
    reasoning: allReasonings.join('\n'),
    candidates: allCandidates
  };
}

// AGENT 2: Expansion Agent - Review and expand the list
// Now processes document in chunks if too large
async function runExpansionAgent(
  ai: GoogleGenAI,
  candidates: ScanCandidate[],
  documentText: string,
  guidelinesSection: string
): Promise<ScanCandidate[]> {
  console.log('[FPA] 📝 AGENTE 2 (EXPANSÃO): Revisando e expandindo lista...');
  
  if (candidates.length === 0) {
    console.warn('[FPA] Expansion Agent: nenhum candidato para revisar');
    return [];
  }
  
  try {
    const candidatesJson = JSON.stringify(candidates, null, 2);
    
    // Calculate available space for document context
    // Prompt template takes ~4000 chars with few-shot examples
    const candidatesSize = candidatesJson.length;
    const guidelinesSize = guidelinesSection.length;
    const promptOverhead = 4500; // Approximate size of prompt template with examples
    const availableSpace = MAX_SCAN_CHARS - candidatesSize - guidelinesSize - promptOverhead;
    
    // Use calculated available space, but at least 5000 chars to be useful
    // If available space is very low, warn but proceed with minimum
    const minUsableContext = 5000;
    const docContextSize = Math.max(minUsableContext, Math.min(documentText.length, availableSpace));
    
    if (availableSpace < minUsableContext) {
      console.warn('[FPA] Expansion Agent: espaço limitado disponível (', availableSpace, 'chars). Usando mínimo:', minUsableContext);
    }
    
    const documentContext = documentText.length > docContextSize
      ? documentText.substring(0, docContextSize) + '\n\n[... documento truncado para processamento ...]'
      : documentText;
    
    console.log('[FPA] Expansion Agent: usando', documentContext.length, 'de', documentText.length, 'caracteres do documento (espaço calculado:', availableSpace, ')');
    
    const prompt = EXPANSION_AGENT_PROMPT
      .replace('{candidates}', candidatesJson)
      .replace('{document}', documentContext) + guidelinesSection;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    let responseText = response.text || '';
    if (!responseText && response.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = response.candidates[0].content.parts[0].text;
    }
    
    if (!responseText) {
      console.warn('[FPA] Expansion Agent: resposta vazia, usando candidatos originais');
      return candidates;
    }
    
    const jsonStr = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.warn('[FPA] Expansion Agent: JSON não encontrado');
      return candidates;
    }
    
    const cleanJson = jsonMatch[0].replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
    const parsed = JSON.parse(cleanJson);
    
    if (parsed.reviewNotes) {
      console.log('[FPA] Expansion Agent notas:', parsed.reviewNotes);
    }
    if (parsed.addedFunctionalities && parsed.addedFunctionalities.length > 0) {
      console.log('[FPA] Expansion Agent adicionou:', parsed.addedFunctionalities);
    }
    
    const expanded = parsed.expandedCandidates || candidates;
    console.log('[FPA] Expansion Agent resultado:', expanded.length, 'funcionalidades (de', candidates.length, 'originais)');
    
    return expanded;
    
  } catch (error: any) {
    console.error('[FPA] Expansion Agent erro:', error.message);
    return candidates;
  }
}

// AGENT 3: Classification Agent - Apply IFPUG classification
// Now processes document in chunks if too large
async function runClassificationAgent(
  ai: GoogleGenAI,
  candidates: ScanCandidate[],
  documentText: string,
  guidelinesSection: string
): Promise<ExtractedFunctionality[]> {
  console.log('[FPA] 📊 AGENTE 3 (CLASSIFICAÇÃO): Aplicando regras IFPUG...');
  
  if (candidates.length === 0) {
    console.warn('[FPA] Classification Agent: nenhum candidato para classificar');
    return [];
  }
  
  try {
    const candidatesJson = JSON.stringify(candidates, null, 2);
    
    // Calculate available space for document context
    // Classification prompt is larger due to detailed IFPUG examples
    const candidatesSize = candidatesJson.length;
    const guidelinesSize = guidelinesSection.length;
    const promptOverhead = 6000; // Classification prompt is larger with IFPUG examples
    const availableSpace = MAX_SCAN_CHARS - candidatesSize - guidelinesSize - promptOverhead;
    
    // Use calculated available space, but at least 4000 chars to be useful
    const minUsableContext = 4000;
    const docContextSize = Math.max(minUsableContext, Math.min(documentText.length, availableSpace));
    
    if (availableSpace < minUsableContext) {
      console.warn('[FPA] Classification Agent: espaço limitado disponível (', availableSpace, 'chars). Usando mínimo:', minUsableContext);
    }
    
    const documentContext = documentText.length > docContextSize
      ? documentText.substring(0, docContextSize) + '\n\n[... documento truncado para processamento ...]'
      : documentText;
    
    console.log('[FPA] Classification Agent: usando', documentContext.length, 'de', documentText.length, 'caracteres do documento (espaço calculado:', availableSpace, ')');
    
    const prompt = CLASSIFICATION_AGENT_PROMPT
      .replace('{candidates}', candidatesJson)
      .replace('{document}', documentContext) + guidelinesSection;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    let responseText = response.text || '';
    if (!responseText && response.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = response.candidates[0].content.parts[0].text;
    }
    
    if (!responseText) {
      console.warn('[FPA] Classification Agent: resposta vazia');
      return [];
    }
    
    const jsonStr = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.warn('[FPA] Classification Agent: JSON não encontrado');
      return [];
    }
    
    const cleanJson = jsonMatch[0].replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
    const parsed = JSON.parse(cleanJson);
    
    const funcs = (parsed.functionalities || []) as ExtractedFunctionality[];
    
    console.log('[FPA] Classification Agent resultado:', funcs.length, 'funcionalidades classificadas');
    console.log('[FPA] Classification Agent summary:', parsed.summary || '');
    
    return funcs.map(f => ({
      ...f,
      functionType: validateFunctionType(f.functionType),
      status: validateStatus(f.status),
      complexity: validateComplexity(f.complexity),
      confidence: Math.min(1, Math.max(0, f.confidence || 0.85))
    }));
    
  } catch (error: any) {
    console.error('[FPA] Classification Agent erro:', error.message);
    return [];
  }
}

// AGENT 4: Discovery Agent - Second pass to find implicit/hidden functionalities
// Returns raw ScanCandidate[] for proper IFPUG classification downstream
async function runDiscoveryAgent(
  ai: GoogleGenAI,
  existingFunctionalities: ExtractedFunctionality[],
  documentText: string,
  guidelinesSection: string
): Promise<ScanCandidate[]> {
  console.log('[FPA] 🔎 AGENTE 4 (DESCOBERTA): Buscando funcionalidades implícitas...');
  
  if (!documentText || documentText.length < 100) {
    console.log('[FPA] Discovery Agent: documento muito curto, pulando segunda varredura');
    return [];
  }
  
  try {
    // Format existing functionalities for context
    const existingList = existingFunctionalities.map((f, i) => 
      `${i + 1}. ${f.name} (${f.functionType}, ${f.status})`
    ).join('\n');
    
    // Calculate safe document context size
    const existingSize = existingList.length;
    const promptOverhead = 4000; // Discovery prompt size
    const guidelinesSize = guidelinesSection.length;
    const availableSpace = MAX_SCAN_CHARS - existingSize - guidelinesSize - promptOverhead;
    
    const minUsableContext = 5000;
    const docContextSize = Math.max(minUsableContext, Math.min(documentText.length, availableSpace));
    
    const documentContext = documentText.length > docContextSize
      ? documentText.substring(0, docContextSize) + '\n\n[... documento truncado para descoberta ...]'
      : documentText;
    
    console.log('[FPA] Discovery Agent: analisando', documentContext.length, 'caracteres, já identificadas:', existingFunctionalities.length, 'funções');
    
    const prompt = DISCOVERY_AGENT_PROMPT
      .replace('{existingFunctionalities}', existingList)
      .replace('{document}', documentContext) + guidelinesSection;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2, // Slightly higher for creative discovery
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    });

    let responseText = response.text || '';
    if (!responseText && response.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = response.candidates[0].content.parts[0].text;
    }
    
    if (!responseText) {
      console.log('[FPA] Discovery Agent: sem resposta');
      return [];
    }
    
    console.log('[FPA] Discovery Agent resposta bruta (primeiros 500 chars):', responseText.substring(0, 500));
    
    const jsonStr = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    
    let parsed: any;
    
    // Try parsing directly first (for responseMimeType: "application/json")
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Fallback: extract JSON object from text
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('[FPA] Discovery Agent: JSON não encontrado na resposta');
        console.log('[FPA] Discovery Agent resposta completa:', responseText);
        return [];
      }
      const cleanJson = jsonMatch[0].replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
      parsed = JSON.parse(cleanJson);
    }
    
    // Handle case where discoveredCandidates is empty or response indicates no discoveries
    if (!parsed.discoveredCandidates || parsed.discoveredCandidates.length === 0) {
      console.log('[FPA] Discovery Agent resultado: 0 candidatos implícitos');
      if (parsed.discoveryNotes) {
        console.log('[FPA] Discovery Agent notas:', parsed.discoveryNotes);
      }
      return [];
    }
    
    // Parse raw candidates from discoveredCandidates
    const rawCandidates = parsed.discoveredCandidates as Array<{
      name: string;
      status: string;
      evidence: string;
      reasoning: string;
    }>;
    
    console.log('[FPA] Discovery Agent: encontrados', rawCandidates.length, 'candidatos implícitos brutos');
    if (parsed.discoveryNotes) {
      console.log('[FPA] Discovery Agent notas:', parsed.discoveryNotes);
    }
    
    // Convert to ScanCandidate format and filter duplicates by name similarity
    const trulyNewCandidates: ScanCandidate[] = [];
    
    for (const raw of rawCandidates) {
      // Normalize name for comparison
      const normalizedName = normalizeFunctionalityName(raw.name);
      let isDuplicate = false;
      
      // Check against existing classified functionalities
      for (const existing of existingFunctionalities) {
        const existingNorm = normalizeFunctionalityName(existing.name);
        if (stringSimilarity(normalizedName, existingNorm) > 0.75) {
          console.log('[FPA] Discovery Agent: descartando candidato similar a existente -', raw.name);
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        trulyNewCandidates.push({
          name: raw.name,
          status: validateStatus(raw.status),
          evidence: raw.evidence || '',
          reasoning: raw.reasoning || 'Funcionalidade implícita descoberta na segunda varredura'
        });
      }
    }
    
    console.log('[FPA] Discovery Agent resultado:', trulyNewCandidates.length, 'candidatos implícitos para classificação');
    
    return trulyNewCandidates;
    
  } catch (error: any) {
    console.error('[FPA] Discovery Agent erro:', error.message);
    return [];
  }
}

// LEGACY: Extract a single chunk with AI (kept for fallback)
async function extractChunkWithAI(
  ai: GoogleGenAI,
  chunk: TextChunk,
  guidelinesSection: string,
  retryCount: number = 0
): Promise<RawFunctionalityCandidate[]> {
  const maxRetries = 2;
  
  try {
    const prompt = `${CHUNK_EXTRACTION_PROMPT}${guidelinesSection}\n\n[Página/Seção ${chunk.page}]\n${chunk.text}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    });

    let responseText = response.text || '';
    if (!responseText && response.candidates?.[0]?.content?.parts?.[0]?.text) {
      responseText = response.candidates[0].content.parts[0].text;
    }
    
    if (!responseText) {
      console.warn(`[FPA] Chunk ${chunk.page}: resposta vazia`);
      return [];
    }
    
    let jsonStr = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.warn(`[FPA] Chunk ${chunk.page}: JSON não encontrado`);
      return [];
    }
    
    const cleanJson = jsonMatch[0].replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
    const parsed = JSON.parse(cleanJson);
    
    const funcs = (parsed.functionalities || []) as ExtractedFunctionality[];
    
    return funcs.map(f => ({
      ...f,
      functionType: validateFunctionType(f.functionType),
      status: validateStatus(f.status),
      complexity: validateComplexity(f.complexity),
      confidence: Math.min(1, Math.max(0, f.confidence || 0.7)),
      sourceChunk: chunk.page,
      sourceExcerpt: chunk.text.substring(0, 200)
    }));
    
  } catch (error: any) {
    console.error(`[FPA] Chunk ${chunk.page} erro:`, error.message);
    
    if (retryCount < maxRetries) {
      console.log(`[FPA] Chunk ${chunk.page}: retry ${retryCount + 1}/${maxRetries}`);
      await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
      return extractChunkWithAI(ai, chunk, guidelinesSection, retryCount + 1);
    }
    
    return [];
  }
}

// Process chunks in parallel with rate limiting
async function processChunksInParallel(
  ai: GoogleGenAI,
  chunks: TextChunk[],
  guidelinesSection: string,
  maxConcurrent: number = 4
): Promise<RawFunctionalityCandidate[]> {
  const allCandidates: RawFunctionalityCandidate[] = [];
  
  // Process in batches
  for (let i = 0; i < chunks.length; i += maxConcurrent) {
    const batch = chunks.slice(i, i + maxConcurrent);
    console.log(`[FPA] Processando batch ${Math.floor(i/maxConcurrent) + 1}/${Math.ceil(chunks.length/maxConcurrent)} (${batch.length} chunks)`);
    
    const batchResults = await Promise.all(
      batch.map(chunk => extractChunkWithAI(ai, chunk, guidelinesSection))
    );
    
    for (const results of batchResults) {
      allCandidates.push(...results);
    }
    
    // Small delay between batches to avoid rate limiting
    if (i + maxConcurrent < chunks.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  
  return allCandidates;
}

export async function analyzeWithAI(inputs: WorkspaceInput[]): Promise<AnalysisResult> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  
  if (!apiKey || !baseUrl) {
    console.warn('[FPA] API não configurada');
    return {
      functionalities: [],
      summary: 'API do Gemini não configurada.'
    };
  }

  // Fetch guidelines FIRST so we can include them in cache key
  const allGuidelines = await fetchActiveGuidelines();
  const guidelineIds = allGuidelines.map(g => g.id);
  
  const contentHash = generateContentHash(inputs, guidelineIds);
  console.log('[FPA] Hash:', contentHash.substring(0, 12), '(com', guidelineIds.length, 'diretrizes)');
  
  const cachedResult = getCachedResult(contentHash);
  if (cachedResult) {
    console.log('[FPA] Cache hit');
    return cachedResult;
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      apiVersion: "",
      baseUrl: baseUrl,
    },
  });

  // Collect all chunks from all inputs
  const allChunks: TextChunk[] = [];

  for (const input of inputs) {
    if (input.type === 'text') {
      // Text input - create chunks
      const textChunks = splitTextIntoChunks(normalizeText(input.content), 2000);
      allChunks.push(...textChunks);
    } else if (input.type === 'document' && input.content) {
      const content = input.content;
      
      if (content.startsWith('data:')) {
        const parsed = parseDataUrl(content);
        if (!parsed) {
          console.log('[FPA] Falha ao parsear data URL:', input.fileName);
          continue;
        }
        
        const { mimeType, buffer } = parsed;
        console.log('[FPA] Processando arquivo:', input.fileName, 'tipo:', mimeType);
        
        let documentChunks: TextChunk[] = [];
        
        if (mimeType === 'application/pdf') {
          documentChunks = await extractTextFromPdfChunked(buffer);
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                   mimeType === 'application/msword') {
          documentChunks = await extractTextFromDocxChunked(buffer);
        } else if (mimeType === 'text/plain') {
          const text = buffer.toString('utf-8');
          documentChunks = splitTextIntoChunks(normalizeText(text), 2000);
        } else {
          console.log('[FPA] Tipo de arquivo não suportado:', mimeType);
          continue;
        }
        
        if (documentChunks.length > 0) {
          console.log('[FPA] Documento dividido em', documentChunks.length, 'chunks');
          allChunks.push(...documentChunks);
        }
      } else {
        if (!input.mimeType?.startsWith('image/')) {
          const textChunks = splitTextIntoChunks(normalizeText(content), 2000);
          allChunks.push(...textChunks);
        }
      }
    }
  }

  if (allChunks.length === 0) {
    console.log('[FPA] Nenhum texto para analisar');
    return {
      functionalities: [],
      summary: 'Nenhum conteúdo de texto encontrado. Adicione texto ou carregue documentos com conteúdo textual.'
    };
  }
  
  // Get combined text for guideline matching
  const combinedText = allChunks.map(c => c.text).join('\n');
  
  // Apply matching guidelines
  const matchingGuidelines = findMatchingGuidelines(combinedText, allGuidelines);
  const guidelinesSection = formatGuidelinesForPrompt(matchingGuidelines);
  
  if (matchingGuidelines.length > 0) {
    console.log('[FPA] Aplicando', matchingGuidelines.length, 'diretrizes:', matchingGuidelines.map(g => g.title).join(', '));
  }

  const pipelineStart = Date.now();
  console.log('[FPA] ========================================');
  console.log('[FPA] INICIANDO PIPELINE MULTI-AGENTE');
  console.log('[FPA] Documento com', combinedText.length, 'caracteres');
  console.log('[FPA] ========================================');

  try {
    // =========================================================================
    // STAGE 1: SCAN AGENT - Comprehensive document analysis
    // =========================================================================
    const stage1Start = Date.now();
    const scanResult = await runScanAgent(ai, combinedText, guidelinesSection);
    console.log('[FPA] ⏱️  Stage 1 (Scan):', Date.now() - stage1Start, 'ms');
    
    if (scanResult.candidates.length === 0) {
      console.log('[FPA] Scan Agent não encontrou funcionalidades');
      return {
        functionalities: [],
        summary: 'Nenhuma funcionalidade identificada no documento.'
      };
    }
    
    console.log('[FPA] ========================================');
    console.log('[FPA] SCAN COMPLETO:', scanResult.candidates.length, 'candidatos iniciais');
    console.log('[FPA] ========================================');
    
    // =========================================================================
    // STAGE 2: EXPANSION AGENT - Review, separate, and expand
    // =========================================================================
    const stage2Start = Date.now();
    const expandedCandidates = await runExpansionAgent(
      ai,
      scanResult.candidates,
      combinedText,
      guidelinesSection
    );
    console.log('[FPA] ⏱️  Stage 2 (Expansion):', Date.now() - stage2Start, 'ms');
    
    console.log('[FPA] ========================================');
    console.log('[FPA] EXPANSÃO COMPLETA:', expandedCandidates.length, 'candidatos após revisão');
    console.log('[FPA] ========================================');
    
    // =========================================================================
    // STAGE 3: CLASSIFICATION AGENT - Apply IFPUG rules
    // =========================================================================
    const stage3Start = Date.now();
    const classifiedFunctionalities = await runClassificationAgent(
      ai,
      expandedCandidates,
      combinedText,
      guidelinesSection
    );
    console.log('[FPA] ⏱️  Stage 3 (Classification):', Date.now() - stage3Start, 'ms');
    
    console.log('[FPA] ========================================');
    console.log('[FPA] CLASSIFICAÇÃO COMPLETA:', classifiedFunctionalities.length, 'funcionalidades finais');
    console.log('[FPA] ========================================');
    
    if (classifiedFunctionalities.length === 0) {
      return {
        functionalities: [],
        summary: 'Não foi possível classificar as funcionalidades identificadas.'
      };
    }
    
    // =========================================================================
    // STAGE 4 & 5 IN PARALLEL: Citation Validation + Discovery Agent
    // These can run in parallel since Discovery doesn't depend on citation validation
    // =========================================================================
    const stage4Start = Date.now();
    
    // Run Citation Validation and Discovery Agent in parallel
    const [validatedFunctionalities, discoveredCandidates] = await Promise.all([
      // Stage 4: Citation validation (sync but wrapped in promise)
      Promise.resolve(validateCitations(classifiedFunctionalities, combinedText)),
      // Stage 5: Discovery agent (async LLM call)
      runDiscoveryAgent(ai, classifiedFunctionalities, combinedText, guidelinesSection)
    ]);
    
    console.log('[FPA] ⏱️  Stage 4+5 parallel (Validation + Discovery):', Date.now() - stage4Start, 'ms');
    
    // Count low confidence items for summary
    const lowConfidenceCount = validatedFunctionalities.filter(f => f.confidence < 0.8).length;
    const verifiedCount = validatedFunctionalities.filter(f => f.citationVerified).length;
    
    console.log('[FPA] ========================================');
    console.log('[FPA] VALIDAÇÃO COMPLETA:', verifiedCount, 'citações verificadas de', validatedFunctionalities.length);
    if (lowConfidenceCount > 0) {
      console.log('[FPA] ⚠️  ATENÇÃO:', lowConfidenceCount, 'funcionalidades com confiança baixa (<0.8)');
    }
    console.log('[FPA] ========================================');
    
    let validatedDiscovered: ExtractedFunctionality[] = [];
    
    if (discoveredCandidates.length > 0) {
      console.log('[FPA] Candidatos implícitos:', discoveredCandidates.length, '- aplicando pipeline (expansão + classificação)...');
      
      const stage5bStart = Date.now();
      
      // STAGE 5a+5b: Run Expansion and Classification in sequence for discovered candidates
      const expandedDiscovered = await runExpansionAgent(
        ai,
        discoveredCandidates,
        combinedText,
        guidelinesSection
      );
      
      console.log('[FPA] Candidatos pós-expansão:', expandedDiscovered.length);
      
      // STAGE 5b: Run expanded candidates through Classification Agent for IFPUG compliance
      const classifiedDiscovered = await runClassificationAgent(
        ai,
        expandedDiscovered,
        combinedText,
        guidelinesSection
      );
      
      console.log('[FPA] ⏱️  Stage 5b (Discovery pipeline):', Date.now() - stage5bStart, 'ms');
      
      // Validate citations for properly classified discoveries
      if (classifiedDiscovered.length > 0) {
        const validatedClassified = validateCitations(classifiedDiscovered, combinedText);
        
        // Final deduplication against existing functionalities
        for (const disc of validatedClassified) {
          let isDuplicate = false;
          for (const existing of validatedFunctionalities) {
            if (areSameFunctionality(disc, existing)) {
              console.log('[FPA] Discovery post-classification: descartando duplicata -', disc.name);
              isDuplicate = true;
              break;
            }
          }
          if (!isDuplicate) {
            // Mark as implicitly discovered with slightly reduced confidence
            validatedDiscovered.push({
              ...disc,
              confidence: Math.min(1, disc.confidence * 0.95)
            });
          }
        }
      }
    } else {
      console.log('[FPA] Nenhum candidato implícito encontrado, pulando stage 5b');
    }
    
    // Combine all functionalities
    const allFunctionalities = [...validatedFunctionalities, ...validatedDiscovered];
    
    console.log('[FPA] ========================================');
    console.log('[FPA] DESCOBERTA COMPLETA:', validatedDiscovered.length, 'funcionalidades implícitas (classificadas IFPUG) adicionadas');
    console.log('[FPA] TOTAL FINAL:', allFunctionalities.length, 'funcionalidades');
    console.log('[FPA] ========================================');
    
    // Recalculate counts with all functionalities
    const finalLowConfidenceCount = allFunctionalities.filter(f => f.confidence < 0.8).length;
    const finalVerifiedCount = allFunctionalities.filter(f => f.citationVerified).length;
    
    // Calculate total points
    const totalPoints = calculateFunctionPoints(allFunctionalities);
    
    // Build summary with confidence info
    const lowConfNote = finalLowConfidenceCount > 0 
      ? ` (${finalLowConfidenceCount} itens precisam revisão - confiança <80%)`
      : '';
    
    const discoveryNote = validatedDiscovered.length > 0
      ? ` Incluindo ${validatedDiscovered.length} funcionalidades implícitas descobertas na segunda varredura.`
      : '';
    
    const result: AnalysisResult = {
      functionalities: allFunctionalities,
      summary: `Análise Multi-Agente concluída: ${allFunctionalities.length} funcionalidades identificadas. ${finalVerifiedCount} citações verificadas. Total: ${totalPoints} pontos de função.${discoveryNote}${lowConfNote}`,
      totalPoints
    };
    
    setCacheResult(contentHash, result);
    
    console.log('[FPA] ========================================');
    console.log('[FPA] ANÁLISE CONCLUÍDA COM SUCESSO');
    console.log('[FPA] Funcionalidades:', allFunctionalities.length);
    console.log('[FPA] Pontos de Função:', totalPoints);
    console.log('[FPA] ⏱️  TEMPO TOTAL:', Date.now() - pipelineStart, 'ms');
    console.log('[FPA] ========================================');
    
    return result;
    
  } catch (error: any) {
    console.error('[FPA] Erro na análise multi-agente:', error?.message || error);
    return {
      functionalities: [],
      summary: `Erro: ${error?.message || 'desconhecido'}`
    };
  }
}

function extractPartialFunctionalities(jsonStr: string): ExtractedFunctionality[] {
  const funcs: ExtractedFunctionality[] = [];
  
  const funcRegex = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"functionType"\s*:\s*"([^"]+)"\s*,\s*"status"\s*:\s*"([^"]+)"\s*,\s*"complexity"\s*:\s*"([^"]+)"\s*,\s*"workDetails"\s*:\s*"([^"]+)"\s*,\s*"confidence"\s*:\s*([\d.]+)\s*,\s*"rationale"\s*:\s*"([^"]+)"\s*\}/g;
  
  let match;
  while ((match = funcRegex.exec(jsonStr)) !== null) {
    funcs.push({
      name: match[1],
      functionType: validateFunctionType(match[2]),
      status: validateStatus(match[3]),
      complexity: validateComplexity(match[4]),
      workDetails: match[5],
      confidence: parseFloat(match[6]) || 0.7,
      rationale: match[7]
    });
  }
  
  return funcs;
}

function validateFunctionType(type: string): 'ALI' | 'AIE' | 'EE' | 'SE' | 'CE' {
  const validTypes = ['ALI', 'AIE', 'EE', 'SE', 'CE'];
  return validTypes.includes(type) ? type as any : 'EE';
}

function validateStatus(status: string): 'nova' | 'alterada' | 'excluida' {
  const validStatuses = ['nova', 'alterada', 'excluida'];
  return validStatuses.includes(status) ? status as any : 'nova';
}

function validateComplexity(complexity: string): 'baixa' | 'media' | 'alta' {
  const validComplexities = ['baixa', 'media', 'alta'];
  return validComplexities.includes(complexity) ? complexity as any : 'media';
}

export function calculateFunctionPoints(functionalities: ExtractedFunctionality[]): number {
  const pointsTable = {
    ALI: { baixa: 7, media: 10, alta: 15 },
    AIE: { baixa: 5, media: 7, alta: 10 },
    EE: { baixa: 3, media: 4, alta: 6 },
    SE: { baixa: 4, media: 5, alta: 7 },
    CE: { baixa: 3, media: 4, alta: 6 }
  };

  return functionalities.reduce((total, f) => {
    const typePoints = pointsTable[f.functionType];
    return total + (typePoints?.[f.complexity] || 4);
  }, 0);
}

export function clearAnalysisCache(): void {
  analysisCache.clear();
  console.log('[FPA] Cache limpo');
}
