import { parseDocumentStructure, DocumentSection } from '../server/lib/document-structure-parser';
import { extractText, getDocumentProxy } from 'unpdf';
import * as mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';

interface TestCase {
  name: string;
  filePath: string;
  expectedSections: string[];
  falsePositives: string[];
}

interface TestResult {
  name: string;
  totalFound: number;
  matched: string[];
  missing: string[];
  falsePositives: string[];
  accuracy: number;
}

async function extractTextFromFile(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text: pdfPages } = await extractText(pdf, { mergePages: false });
    return Array.isArray(pdfPages) ? pdfPages.join('\n\n') : String(pdfPages);
  } else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    return buffer.toString('utf-8');
  }
}

function normalizeTitle(title: string): string {
  return title
    .toUpperCase()
    .replace(/[^\w\sÀ-ÿ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sectionsMatch(found: string, expected: string): boolean {
  const normFound = normalizeTitle(found);
  const normExpected = normalizeTitle(expected);
  return normFound.includes(normExpected) || normExpected.includes(normFound);
}

export async function runTest(testCase: TestCase): Promise<TestResult> {
  const text = await extractTextFromFile(testCase.filePath);
  const result = parseDocumentStructure(text, 3);
  
  const foundTitles = result.sections.map(s => s.title);
  
  const matched: string[] = [];
  const missing: string[] = [];
  
  for (const expected of testCase.expectedSections) {
    const found = foundTitles.some(f => sectionsMatch(f, expected));
    if (found) {
      matched.push(expected);
    } else {
      missing.push(expected);
    }
  }
  
  const falsePositives: string[] = [];
  for (const fp of testCase.falsePositives) {
    const found = foundTitles.some(f => sectionsMatch(f, fp));
    if (found) {
      falsePositives.push(fp);
    }
  }
  
  const accuracy = testCase.expectedSections.length > 0 
    ? (matched.length / testCase.expectedSections.length) * 100 
    : 100;
  
  return {
    name: testCase.name,
    totalFound: result.sections.length,
    matched,
    missing,
    falsePositives,
    accuracy
  };
}

export async function analyzeDocument(filePath: string): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Analisando: ${path.basename(filePath)}`);
  console.log('='.repeat(60));
  
  const text = await extractTextFromFile(filePath);
  const result = parseDocumentStructure(text, 3);
  
  console.log(`\nTotal de seções encontradas: ${result.totalSections}`);
  console.log(`Seções exibidas (level <= 3): ${result.sections.length}`);
  console.log(`Páginas estimadas: ${result.pageCount}`);
  
  console.log('\n--- SEÇÕES ENCONTRADAS (primeiras 50) ---');
  result.sections.slice(0, 50).forEach((s, i) => {
    console.log(`${i + 1}. [L${s.level}] [${s.type}] ${s.title}`);
  });
  
  console.log('\n--- ANÁLISE DE PROBLEMAS ---');
  
  const potentialFalsePositives = result.sections.filter(s => {
    const title = s.title.toUpperCase();
    if (title.match(/^\d{5}\s*-\s*\d+/)) return true;
    if (title.length < 5 && s.type === 'all_caps_title') return true;
    if (title.match(/^(MENOR|MAIOR)\s+(PREÇO|VALOR)/)) return true;
    if (title.match(/^R\$\s*[\d.,]+/)) return true;
    return false;
  });
  
  if (potentialFalsePositives.length > 0) {
    console.log('\nPossíveis falsos positivos:');
    potentialFalsePositives.forEach(s => {
      console.log(`  - [${s.type}] ${s.title}`);
    });
  }
  
  const duplicates = new Map<string, number>();
  result.sections.forEach(s => {
    const key = normalizeTitle(s.title);
    duplicates.set(key, (duplicates.get(key) || 0) + 1);
  });
  
  const dups = [...duplicates.entries()].filter(([, count]) => count > 1);
  if (dups.length > 0) {
    console.log('\nSeções duplicadas:');
    dups.forEach(([title, count]) => {
      console.log(`  - "${title}" aparece ${count}x`);
    });
  }
  
  fs.writeFileSync(
    `tests/documents/${path.basename(filePath, path.extname(filePath))}_result.json`,
    JSON.stringify({
      file: filePath,
      totalSections: result.totalSections,
      displayedSections: result.sections.length,
      pageCount: result.pageCount,
      sections: result.sections
    }, null, 2)
  );
  
  console.log(`\nResultado salvo em: tests/documents/${path.basename(filePath, path.extname(filePath))}_result.json`);
}

const filePath = process.argv[2];
if (filePath) {
  analyzeDocument(filePath).catch(console.error);
} else {
  console.log('Uso: npx tsx tests/test-parser.ts <caminho-do-arquivo>');
}
