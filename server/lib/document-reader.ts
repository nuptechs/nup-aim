import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export interface DocumentSection {
  level: number;
  title: string;
  content: string;
  children: DocumentSection[];
}

export interface DocumentStructure {
  title: string;
  sections: DocumentSection[];
  rawText: string;
  pageCount: number;
}

function extractJSON(text: string): string {
  let cleaned = text.trim();
  
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").replace(/```/g, "");
  
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, (char) => {
    if (char === "\n" || char === "\r" || char === "\t") return char;
    return "";
  });
  
  return cleaned.trim();
}

function parseDocumentText(text: string): DocumentSection[] {
  const lines = text.split("\n").filter((line) => line.trim());
  const sections: DocumentSection[] = [];
  let currentSection: DocumentSection | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    const isTitle =
      trimmed === trimmed.toUpperCase() && 
      trimmed.length > 3 && 
      trimmed.length < 100 &&
      !trimmed.match(/^[\d.,\-–•]+$/) &&
      trimmed.match(/[A-ZÀ-Ú]/);

    const isNumberedSection = /^(\d+\.?\d*\.?\d*)\s+[A-ZÀ-Ú]/.test(trimmed);

    if (isTitle || isNumberedSection) {
      if (currentSection) {
        currentSection.content = currentContent.join("\n").trim();
        sections.push(currentSection);
      }

      let level = 1;
      if (isNumberedSection) {
        const dots = (trimmed.match(/\./g) || []).length;
        level = Math.min(dots + 1, 3);
      }

      currentSection = {
        level,
        title: trimmed,
        content: "",
        children: [],
      };
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(trimmed);
    } else {
      currentContent.push(trimmed);
    }
  }

  if (currentSection) {
    currentSection.content = currentContent.join("\n").trim();
    sections.push(currentSection);
  } else if (currentContent.length > 0) {
    sections.push({
      level: 1,
      title: "Conteúdo do Documento",
      content: currentContent.join("\n").trim(),
      children: [],
    });
  }

  return sections;
}

export async function analyzeDocumentWithAI(text: string): Promise<DocumentSection[]> {
  const truncatedText = text.length > 30000 ? text.substring(0, 30000) + "\n[...]" : text;

  const prompt = `Analise este documento e extraia sua estrutura hierárquica.

INSTRUÇÕES:
1. Identifique títulos principais (level 1), subtítulos (level 2), sub-subtítulos (level 3)
2. Coloque o conteúdo de cada seção no campo "content"
3. Retorne APENAS JSON válido, sem explicações

Documento:
${truncatedText}

Responda com este formato JSON (sem markdown):
{"sections":[{"level":1,"title":"Título","content":"texto...","children":[]}]}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      console.log("[DocumentReader] Sem resposta de texto, usando parser local");
      return parseDocumentText(text);
    }

    const jsonText = extractJSON(textContent.text);
    
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
        return parsed.sections;
      }
    } catch (parseError) {
      console.log("[DocumentReader] JSON inválido, usando parser local");
    }

    return parseDocumentText(text);
  } catch (error) {
    console.error("[DocumentReader] Erro na API, usando parser local:", error);
    return parseDocumentText(text);
  }
}

export async function readDocumentFromText(text: string): Promise<DocumentStructure> {
  const sections = await analyzeDocumentWithAI(text);

  const documentTitle =
    sections.length > 0 && sections[0].level === 1
      ? sections[0].title
      : "Documento Analisado";

  return {
    title: documentTitle,
    sections: nestSections(sections),
    rawText: text,
    pageCount: 1,
  };
}

function nestSections(flatSections: DocumentSection[]): DocumentSection[] {
  const result: DocumentSection[] = [];
  const stack: DocumentSection[] = [];

  for (const section of flatSections) {
    const newSection = { ...section, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      result.push(newSection);
    } else {
      stack[stack.length - 1].children.push(newSection);
    }

    stack.push(newSection);
  }

  return result;
}
