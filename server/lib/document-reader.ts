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

export interface PageContent {
  pageNumber: number;
  text: string;
  imageBase64?: string;
  mimeType?: string;
}

export async function analyzeDocumentPage(page: PageContent): Promise<DocumentSection[]> {
  const prompt = `Analise esta página de documento e extraia a estrutura hierárquica.

REGRAS:
1. Identifique TODOS os títulos e subtítulos
2. Associe cada conteúdo ao seu título/subtítulo correspondente
3. Use níveis: 1 para títulos principais, 2 para subtítulos, 3 para sub-subtítulos, etc.
4. Mantenha o texto exatamente como está, sem resumir

TEXTO DA PÁGINA ${page.pageNumber}:
${page.text}

Responda APENAS em JSON válido, sem markdown:
{
  "sections": [
    {
      "level": 1,
      "title": "Título Principal",
      "content": "Texto sob este título...",
      "children": [
        {
          "level": 2,
          "title": "Subtítulo",
          "content": "Texto do subtítulo...",
          "children": []
        }
      ]
    }
  ]
}`;

  const contentBlocks: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

  if (page.imageBase64 && page.mimeType) {
    contentBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: page.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: page.imageBase64,
      },
    });
  }

  contentBlocks.push({
    type: "text",
    text: prompt,
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: contentBlocks,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return [];
    }

    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith("```")) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const parsed = JSON.parse(jsonText);
    return parsed.sections || [];
  } catch (error) {
    console.error("Erro ao analisar página:", error);
    return [];
  }
}

export async function readDocument(pages: PageContent[]): Promise<DocumentStructure> {
  const allSections: DocumentSection[] = [];
  let fullText = "";

  for (const page of pages) {
    fullText += `\n--- Página ${page.pageNumber} ---\n${page.text}`;
    const pageSections = await analyzeDocumentPage(page);
    allSections.push(...pageSections);
  }

  const documentTitle = allSections.length > 0 && allSections[0].level === 1 
    ? allSections[0].title 
    : "Documento sem título";

  const mergedSections = mergeSections(allSections);

  return {
    title: documentTitle,
    sections: mergedSections,
    rawText: fullText.trim(),
    pageCount: pages.length,
  };
}

function mergeSections(sections: DocumentSection[]): DocumentSection[] {
  const result: DocumentSection[] = [];
  let currentParent: DocumentSection | null = null;

  for (const section of sections) {
    if (section.level === 1) {
      currentParent = { ...section, children: [...section.children] };
      result.push(currentParent);
    } else if (currentParent) {
      currentParent.children.push(section);
    } else {
      result.push(section);
    }
  }

  return result;
}

export async function readDocumentFromText(text: string): Promise<DocumentStructure> {
  const pages: PageContent[] = [
    {
      pageNumber: 1,
      text: text,
    },
  ];
  return readDocument(pages);
}

export async function readDocumentFromImage(
  imageBase64: string,
  mimeType: string,
  extractedText?: string
): Promise<DocumentStructure> {
  const pages: PageContent[] = [
    {
      pageNumber: 1,
      text: extractedText || "",
      imageBase64,
      mimeType,
    },
  ];
  return readDocument(pages);
}
