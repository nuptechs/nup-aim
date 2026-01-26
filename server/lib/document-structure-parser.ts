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

const PATTERNS = [
  {
    name: 'decimal_titled',
    regex: /^(\d+(?:\.\d+)*)\s*[.-]?\s*([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-ZÀÁÂÃÉÊÍÓÔÕÚÇ\s]{2,})$/,
    getLevel: (m: string) => m.split('.').length,
    getTitle: (m: RegExpMatchArray) => `${m[1]}. ${m[2].trim()}`
  },
  {
    name: 'decimal_dash',
    regex: /^(\d+(?:\.\d+)*)\s*[-–]\s*([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-Za-zÀ-ÿ\s]{2,})$/,
    getLevel: (m: string) => m.split('.').length,
    getTitle: (m: RegExpMatchArray) => `${m[1]} - ${m[2].trim()}`,
    validate: (marker: string, match: RegExpMatchArray) => {
      if (marker.match(/^\d{5}$/)) return false;
      if (match[2] && match[2].match(/^\d+[-\/]/)) return false;
      const text = match[2]?.toLowerCase() || '';
      if (text.includes('ilha de serviço') || text.includes('ilha de serviços')) return false;
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
      const lower = text.toLowerCase();
      
      if (marker.match(/^\d+$/) && !marker.includes('.')) {
        const firstWord = text.split(/\s+/)[0];
        if (firstWord && /^[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][a-zàáâãéêíóôõúç]+[aeiou]r$/i.test(firstWord)) return false;
        
        if (/^Sobre\s/i.test(text)) return false;
        
        if (/^DECLARAÇÃO\s+PARA/i.test(text)) return false;
        
        if (/^[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][a-zàáâãéêíóôõúç]/.test(text) && !/^(D[OAE]S?|PARA|SOBRE|COM)\s/i.test(text)) {
          if (!/[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ]{3,}/.test(text)) return false;
        }
      }
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
    getTitle: (m: RegExpMatchArray) => `${m[1]}. ${m[2].trim()}`
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
    validate: (marker: string, _match: RegExpMatchArray) => isValidRoman(marker)
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
    name: 'keyword_br',
    regex: /^(D[OAE]S?\s+[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-ZÀÁÂÃÉÊÍÓÔÕÚÇ\s]{2,})$/,
    getLevel: () => 1,
    getTitle: (m: RegExpMatchArray) => m[1].trim()
  },
  {
    name: 'all_caps_title',
    regex: /^([A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-ZÀÁÂÃÉÊÍÓÔÕÚÇ\s]{5,})$/,
    getLevel: () => 1,
    getTitle: (m: RegExpMatchArray) => m[1].trim(),
    validate: (marker: string, _match: RegExpMatchArray) => {
      const text = marker.trim();
      const lower = text.toLowerCase();
      
      const stopwords = ['governo', 'departamento', 'ministério', 'secretaria', 'página', 'folha', 'diário', 'oficial', 'pregão', 'processo', 'estimativa'];
      if (stopwords.some(w => lower.includes(w))) return false;
      
      if (text.length > 60) return false;
      if (text.length < 10) return false;
      
      if (/\s(DE|DO|DA|DOS|DAS|EM|NO|NA|NOS|NAS|AO|AOS|À|ÀS|PARA|POR|COM|SEM|SOB|E|OU)$/i.test(text)) return false;
      
      const coverLabels = ['sessão pública', 'início da sessão', 'abertura do certame', 'endereço eletrônico', 'critério de julgamento', 'modo de disputa', 'tipo/regime'];
      if (coverLabels.some(l => lower.includes(l))) return false;
      
      const tableLabels = ['ilha de serviço', 'dados do contrato', 'produtos a serem', 'perfis profissionais', 'nome perfil', 'modelo de', 'modelo proposta', 'xxxxxxx', 'formação do preço', 'planilha de preço', 'minutas dos contratos', 'relatórios do programa'];
      if (tableLabels.some(l => lower.includes(l))) return false;
      
      const formLabels = ['modalidade de licitação', 'numero da licitação', 'número da licitação', 'avaliação de programa'];
      if (formLabels.some(l => lower.includes(l))) return false;
      
      const words = text.split(/\s+/).filter(w => w.length > 0);
      if (words.length < 3) return false;
      
      const isProperName = words.length >= 2 && words.length <= 4 && 
        words.filter(w => w !== 'DE' && w !== 'DA' && w !== 'DO' && w !== 'DOS' && w !== 'DAS')
             .every(w => /^[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-ZÀÁÂÃÉÊÍÓÔÕÚÇ]+$/.test(w) && w.length >= 3 && w.length <= 12);
      if (isProperName) return false;
      
      return true;
    }
  }
];

function isValidRoman(str: string): boolean {
  const romanRegex = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
  return romanRegex.test(str) && str.length > 0;
}

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

function getContentAfterSection(lines: string[], startIndex: number, endIndex: number): string {
  const contentLines = lines.slice(startIndex + 1, Math.min(endIndex, startIndex + 5));
  const content = contentLines
    .map(l => l.trim())
    .filter(l => l.length > 0 && !parseLine(l, 0))
    .slice(0, 2)
    .join(' ')
    .substring(0, 120);
  
  return content || '';
}

function buildHierarchy(matches: PatternMatch[], lines: string[]): DocumentSection[] {
  if (matches.length === 0) return [];

  const root: DocumentSection[] = [];
  const stack: { section: DocumentSection; level: number }[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const nextMatchIndex = i < matches.length - 1 ? matches[i + 1].lineIndex : lines.length;
    const content = getContentAfterSection(lines, match.lineIndex, nextMatchIndex);

    const section: DocumentSection = {
      level: match.level,
      title: match.title,
      content: content.length > 100 ? content.substring(0, 100) + '...' : content,
      children: [],
      marker: match.marker,
      type: match.type
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= match.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(section);
    } else {
      stack[stack.length - 1].section.children.push(section);
    }

    stack.push({ section, level: match.level });
  }

  return root;
}

function flattenForDisplay(sections: DocumentSection[], maxLevel: number = 2): DocumentSection[] {
  const result: DocumentSection[] = [];
  
  function traverse(items: DocumentSection[]) {
    for (const item of items) {
      if (item.level <= maxLevel) {
        result.push({
          ...item,
          children: []
        });
      }
      if (item.children.length > 0) {
        traverse(item.children);
      }
    }
  }
  
  traverse(sections);
  return result;
}

export function parseDocumentStructure(text: string, maxLevel: number = 2): DocumentStructure {
  if (!text || text.trim().length === 0) {
    return {
      title: "Erro",
      sections: [],
      rawText: "",
      pageCount: 0,
      totalSections: 0,
      error: "Nenhum texto foi fornecido para análise."
    };
  }

  const lines = text.split('\n');
  const matches: PatternMatch[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const match = parseLine(lines[i], i);
    if (match) {
      matches.push(match);
    }
  }

  if (matches.length === 0) {
    return {
      title: "Documento",
      sections: [],
      rawText: text,
      pageCount: Math.ceil(text.length / 3000),
      totalSections: 0,
      error: "Nenhuma seção estruturada foi encontrada no documento."
    };
  }

  const hierarchicalSections = buildHierarchy(matches, lines);
  const displaySections = flattenForDisplay(hierarchicalSections, maxLevel);
  
  const documentTitle = displaySections.find(s => s.level === 1)?.title || displaySections[0]?.title || "Documento";
  const pageCount = Math.ceil(text.length / 3000);

  console.log(`[RegexParser] ${matches.length} seções totais, ${displaySections.length} exibidas (level <= ${maxLevel}) de ${lines.length} linhas (~${pageCount} páginas)`);

  return {
    title: documentTitle,
    sections: displaySections,
    rawText: text,
    pageCount,
    totalSections: matches.length
  };
}
