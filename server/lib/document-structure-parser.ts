export interface DocumentSection {
  level: number;
  title: string;
  content: string;
  children: DocumentSection[];
  marker?: string;
  type?: string;
}

export interface DocumentStructure {
  title: string;
  sections: DocumentSection[];
  rawText: string;
  pageCount: number;
  totalSections: number;
  error?: string;
}

interface PatternMatch {
  type: string;
  marker: string;
  title: string;
  level: number;
  lineIndex: number;
}

function isValidRoman(str: string): boolean {
  const romanRegex = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
  return romanRegex.test(str) && str.length > 0;
}

function isProperName(text: string): boolean {
  const words = text.trim().split(/\s+/);
  const significantWords = words.filter(w => !['DE', 'DA', 'DO', 'DOS', 'DAS', 'E'].includes(w));
  if (significantWords.length < 2 || significantWords.length > 5) return false;
  
  return significantWords.every(w => {
    if (w.length < 2 || w.length > 15) return false;
    if (!/^[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-ZÀÁÂÃÉÊÍÓÔÕÚÇ]*$/.test(w)) return false;
    const vowels = (w.match(/[AEIOUÀÁÂÃÉÊÍÓÔÕÚ]/gi) || []).length;
    const consonants = w.length - vowels;
    if (vowels === 0 || consonants === 0) return false;
    return true;
  });
}

function isIncompletePhrase(text: string): boolean {
  const trimmed = text.trim();
  const prepositions = /\s(DE|DO|DA|DOS|DAS|EM|NO|NA|NOS|NAS|AO|AOS|À|ÀS|PARA|POR|COM|SEM|SOB|E|OU|QUE|SE|A|O)$/i;
  return prepositions.test(trimmed);
}

function isInstitutionalHeader(text: string): boolean {
  const lower = text.toLowerCase();
  const patterns = [
    /^(governo|república|estado|município|prefeitura|câmara|senado|tribunal|ministério|secretaria|departamento|autarquia|fundação|empresa|agência|instituto|conselho|comissão|diretoria|gerência|coordenação|superintendência)/,
    /\b(federal|estadual|municipal|distrital)\b/,
    /(cnpj|cpf|inscri[çc][ãa]o|endere[çc]o|telefone|fax|e-?mail|site|www\.)/
  ];
  return patterns.some(p => p.test(lower));
}

function isListItem(marker: string, text: string): boolean {
  if (!marker.match(/^\d+$/) || marker.includes('.')) return false;
  
  const isAllCaps = /^[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ\s\/\-\(\)]+$/.test(text.trim());
  if (isAllCaps) return false;
  
  const firstWord = text.split(/\s+/)[0] || '';
  
  if (/^[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][a-zàáâãéêíóôõúç]+r$/.test(firstWord)) return true;
  if (/^[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][a-zàáâãéêíóôõúç]+ndo$/.test(firstWord)) return true;
  if (/^[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][a-zàáâãéêíóôõúç]+ção$/.test(firstWord)) return true;
  
  if (/^[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][a-zàáâãéêíóôõúç]/.test(text)) {
    if (!/[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ]{2,}/.test(text)) return true;
  }
  
  return false;
}

function isTableLabel(text: string): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return true;
  
  if (/X{3,}/i.test(text)) return true;
  
  const tableKeywords = ['QTD', 'QDE', 'QTDE', 'VLR', 'VALOR', 'TOTAL', 'ITEM', 'CÓDIGO', 'COD', 'REF', 'DESC', 'OBS', 'DATA', 'PRAZO', 'UND', 'UNID', 'HST', 'PERFIL', 'NOME'];
  const matches = words.filter(w => tableKeywords.includes(w.toUpperCase()));
  if (matches.length >= 2) return true;
  
  if (words.length <= 3 && words.every(w => w.length <= 4)) return true;
  
  return false;
}

function isTableRow(text: string): boolean {
  const lower = text.toLowerCase();
  
  if (/^(ilha|lote|item|grupo)\s+(de\s+)?(serviço|serviços)/i.test(text)) return true;
  
  if (/^\d+\s*[-–]\s*(ilha|lote|item)/i.test(text)) return true;
  
  return false;
}

const PATTERNS = [
  {
    name: 'decimal_titled',
    regex: /^(\d+(?:\.\d+)*)\s*[.-]?\s*([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-ZÀÁÂÃÉÊÍÓÔÕÚÇ\s]{2,})$/,
    getLevel: (m: string) => m.split('.').length,
    getTitle: (m: RegExpMatchArray) => `${m[1]}. ${m[2].trim()}`,
    validate: (_marker: string, match: RegExpMatchArray) => {
      const text = match[2]?.trim() || '';
      if (isProperName(text)) return false;
      if (isTableLabel(text)) return false;
      return true;
    }
  },
  {
    name: 'decimal_dash',
    regex: /^(\d+(?:\.\d+)*)\s*[-–]\s*([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-Za-zÀ-ÿ\s]{2,})$/,
    getLevel: (m: string) => m.split('.').length,
    getTitle: (m: RegExpMatchArray) => `${m[1]} - ${m[2].trim()}`,
    validate: (marker: string, match: RegExpMatchArray) => {
      if (/^\d{5,}$/.test(marker)) return false;
      if (match[2] && /^\d+[-\/]/.test(match[2])) return false;
      const text = match[2]?.trim() || '';
      if (isTableRow(text)) return false;
      return true;
    }
  },
  {
    name: 'decimal_mixed',
    regex: /^(\d+(?:\.\d+)*)\.\s+(.{3,})$/,
    getLevel: (m: string) => m.split('.').length,
    getTitle: (m: RegExpMatchArray) => `${m[1]}. ${m[2].trim()}`,
    validate: (marker: string, match: RegExpMatchArray) => {
      const text = match[2]?.trim() || '';
      if (isListItem(marker, text)) return false;
      return true;
    }
  },
  {
    name: 'decimal_paren',
    regex: /^(\d+(?:\.\d+)*)\)\s+(.{3,})$/,
    getLevel: (m: string) => m.split('.').length + 1,
    getTitle: (m: RegExpMatchArray) => `${m[1]}) ${m[2].trim()}`
  },
  {
    name: 'decimal_simple',
    regex: /^(\d+)\s+([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-ZÀÁÂÃÉÊÍÓÔÕÚÇ\s]{2,})$/,
    getLevel: () => 1,
    getTitle: (m: RegExpMatchArray) => `${m[1]}. ${m[2].trim()}`,
    validate: (_marker: string, match: RegExpMatchArray) => {
      const text = match[2]?.trim() || '';
      if (isProperName(text)) return false;
      if (isTableLabel(text)) return false;
      return true;
    }
  },
  {
    name: 'artigo',
    regex: /^(Art\.?\s*\d+[°º]?)\s*[-–.]?\s*(.*)$/i,
    getLevel: () => 2,
    getTitle: (m: RegExpMatchArray) => m[2] ? `${m[1]} - ${m[2].trim()}` : m[1]
  },
  {
    name: 'paragrafo',
    regex: /^(§\s*\d+[°º]?|Parágrafo\s+\w+)\s*[-–.]?\s*(.*)$/i,
    getLevel: () => 3,
    getTitle: (m: RegExpMatchArray) => m[2] ? `${m[1]} - ${m[2].trim()}` : m[1]
  },
  {
    name: 'roman_upper',
    regex: /^([IVXLCDM]+)\s*[-–.)\s]\s*([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-ZÀÁÂÃÉÊÍÓÔÕÚÇ\s]{2,})$/,
    getLevel: () => 1,
    getTitle: (m: RegExpMatchArray) => `${m[1]} - ${m[2].trim()}`,
    validate: (marker: string, match: RegExpMatchArray) => {
      if (!isValidRoman(marker)) return false;
      const text = match[2]?.trim() || '';
      if (isProperName(text)) return false;
      return true;
    }
  },
  {
    name: 'roman_lower',
    regex: /^([ivxlcdm]+)\s*[-–.)\s]\s*(.{3,})$/,
    getLevel: () => 3,
    getTitle: (m: RegExpMatchArray) => `${m[1]}) ${m[2].trim()}`,
    validate: (marker: string, _match: RegExpMatchArray) => isValidRoman(marker.toUpperCase())
  },
  {
    name: 'letter_lower_paren',
    regex: /^([a-z])\)\s+(.{3,})$/,
    getLevel: () => 3,
    getTitle: (m: RegExpMatchArray) => `${m[1]}) ${m[2].trim()}`
  },
  {
    name: 'letter_upper_paren',
    regex: /^([A-Z])\)\s+(.{3,})$/,
    getLevel: () => 2,
    getTitle: (m: RegExpMatchArray) => `${m[1]}) ${m[2].trim()}`
  },
  {
    name: 'letter_dot',
    regex: /^([a-zA-Z])\.\s+(.{3,})$/,
    getLevel: () => 3,
    getTitle: (m: RegExpMatchArray) => `${m[1]}. ${m[2].trim()}`
  },
  {
    name: 'anexo',
    regex: /^(ANEXO\s+[IVXLCDM\d]+)\s*[-–:]?\s*(.*)$/i,
    getLevel: () => 1,
    getTitle: (m: RegExpMatchArray) => m[2] ? `${m[1].toUpperCase()} - ${m[2].trim()}` : m[1].toUpperCase()
  },
  {
    name: 'capitulo',
    regex: /^(CAP[ÍI]TULO\s+[IVXLCDM\d]+)\s*[-–:]?\s*(.*)$/i,
    getLevel: () => 1,
    getTitle: (m: RegExpMatchArray) => m[2] ? `${m[1].toUpperCase()} - ${m[2].trim()}` : m[1].toUpperCase()
  },
  {
    name: 'secao',
    regex: /^(SE[ÇC][ÃA]O\s+[IVXLCDM\d]+)\s*[-–:]?\s*(.*)$/i,
    getLevel: () => 1,
    getTitle: (m: RegExpMatchArray) => m[2] ? `${m[1].toUpperCase()} - ${m[2].trim()}` : m[1].toUpperCase()
  },
  {
    name: 'titulo',
    regex: /^(T[ÍI]TULO\s+[IVXLCDM\d]+)\s*[-–:]?\s*(.*)$/i,
    getLevel: () => 1,
    getTitle: (m: RegExpMatchArray) => m[2] ? `${m[1].toUpperCase()} - ${m[2].trim()}` : m[1].toUpperCase()
  },
  {
    name: 'subsecao',
    regex: /^(SUBSE[ÇC][ÃA]O\s+[IVXLCDM\d]+)\s*[-–:]?\s*(.*)$/i,
    getLevel: () => 2,
    getTitle: (m: RegExpMatchArray) => m[2] ? `${m[1].toUpperCase()} - ${m[2].trim()}` : m[1].toUpperCase()
  },
  {
    name: 'keyword_br',
    regex: /^(D[OAE]S?\s+[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-ZÀÁÂÃÉÊÍÓÔÕÚÇ\s]{2,})$/,
    getLevel: () => 1,
    getTitle: (m: RegExpMatchArray) => m[1].trim(),
    validate: (_marker: string, match: RegExpMatchArray) => {
      const text = match[1]?.trim() || '';
      if (isIncompletePhrase(text)) return false;
      if (text.length > 50) return false;
      return true;
    }
  },
  {
    name: 'all_caps_title',
    regex: /^([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-ZÀÁÂÃÉÊÍÓÔÕÚÇ\s]{5,})$/,
    getLevel: () => 1,
    getTitle: (m: RegExpMatchArray) => m[1].trim(),
    validate: (_marker: string, match: RegExpMatchArray) => {
      const text = match[1]?.trim() || '';
      
      if (text.length < 10 || text.length > 60) return false;
      
      if (isIncompletePhrase(text)) return false;
      
      if (isInstitutionalHeader(text)) return false;
      
      if (isProperName(text)) return false;
      
      if (isTableLabel(text)) return false;
      
      const words = text.split(/\s+/).filter(w => w.length > 0);
      if (words.length < 2) return false;
      
      return true;
    }
  }
];

function parseLine(line: string, lineIndex: number): PatternMatch | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return null;
  
  for (const pattern of PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      const marker = match[1];
      
      if (pattern.validate && !pattern.validate(marker, match)) {
        continue;
      }
      
      return {
        type: pattern.name,
        marker,
        title: pattern.getTitle(match),
        level: pattern.getLevel(marker),
        lineIndex
      };
    }
  }
  
  return null;
}

function buildHierarchy(matches: PatternMatch[], lines: string[], maxLevel: number): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const stack: { section: DocumentSection; level: number }[] = [];
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const nextMatch = matches[i + 1];
    
    const contentLines: string[] = [];
    const startLine = match.lineIndex + 1;
    const endLine = nextMatch ? nextMatch.lineIndex : lines.length;
    
    for (let j = startLine; j < endLine && j < startLine + 5; j++) {
      const line = lines[j]?.trim();
      if (line && line.length > 10) {
        contentLines.push(line);
      }
    }
    
    const section: DocumentSection = {
      level: match.level,
      title: match.title,
      content: contentLines.join(' ').substring(0, 500),
      children: [],
      marker: match.marker,
      type: match.type
    };
    
    while (stack.length > 0 && stack[stack.length - 1].level >= match.level) {
      stack.pop();
    }
    
    if (stack.length > 0) {
      stack[stack.length - 1].section.children.push(section);
    } else {
      sections.push(section);
    }
    
    stack.push({ section, level: match.level });
  }
  
  return sections;
}

function flattenSections(sections: DocumentSection[], maxLevel: number): DocumentSection[] {
  const result: DocumentSection[] = [];
  
  function traverse(items: DocumentSection[]) {
    for (const section of items) {
      if (section.level <= maxLevel) {
        result.push(section);
      }
      if (section.children.length > 0) {
        traverse(section.children);
      }
    }
  }
  
  traverse(sections);
  return result;
}

export function parseDocumentStructure(text: string, maxLevel: number = 3): DocumentStructure {
  const lines = text.split(/\r?\n/);
  const matches: PatternMatch[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const match = parseLine(lines[i], i);
    if (match) {
      matches.push(match);
    }
  }
  
  const hierarchy = buildHierarchy(matches, lines, maxLevel);
  const flatSections = flattenSections(hierarchy, maxLevel);
  
  const pageCount = Math.ceil(lines.length / 30);
  
  console.log(`[RegexParser] ${matches.length} seções totais, ${flatSections.length} exibidas (level <= ${maxLevel}) de ${lines.length} linhas (~${pageCount} páginas)`);
  
  return {
    title: flatSections[0]?.title || 'Documento',
    sections: flatSections,
    rawText: text,
    pageCount,
    totalSections: matches.length
  };
}
