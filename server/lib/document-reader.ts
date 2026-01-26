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
  error?: string;
}

function extractJSON(text: string): string {
  let cleaned = text.trim();
  
  // Remove markdown code blocks with any language tag
  cleaned = cleaned.replace(/^```\w*\s*/i, "");
  cleaned = cleaned.replace(/\s*```\s*$/i, "");
  cleaned = cleaned.replace(/```/g, "");
  
  // Find the outermost JSON object
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }
  
  // Replace problematic escape sequences
  cleaned = cleaned.replace(/\\n/g, " ");
  cleaned = cleaned.replace(/\\t/g, " ");
  
  return cleaned.trim();
}

export async function readDocumentFromText(text: string): Promise<DocumentStructure> {
  if (!text || text.trim().length === 0) {
    return {
      title: "Erro",
      sections: [],
      rawText: "",
      pageCount: 0,
      error: "Nenhum texto foi fornecido para análise.",
    };
  }

  const truncatedText = text.length > 30000 ? text.substring(0, 30000) + "\n[TEXTO TRUNCADO - muito longo]" : text;

  const prompt = `Você é um analisador de documentos. Analise o documento abaixo e extraia sua estrutura hierárquica completa.

INSTRUÇÕES IMPORTANTES:
1. Identifique TODOS os títulos e subtítulos do documento
2. level 1 = títulos principais (geralmente em MAIÚSCULAS ou numerados como "1.", "2.")
3. level 2 = subtítulos (numerados como "1.1", "2.1" ou destacados)
4. level 3 = sub-subtítulos (numerados como "1.1.1")
5. O campo "content" deve conter o texto que está abaixo de cada título
6. O campo "children" deve estar sempre como array vazio []

DOCUMENTO PARA ANÁLISE:
${truncatedText}

RESPONDA EXATAMENTE NESTE FORMATO JSON (sem texto adicional, sem markdown, sem explicações):
{"sections":[{"level":1,"title":"TITULO AQUI","content":"conteudo aqui","children":[]}]}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return {
        title: "Erro na Análise",
        sections: [],
        rawText: text,
        pageCount: 1,
        error: "A IA não retornou uma resposta de texto válida.",
      };
    }

    const jsonText = extractJSON(textContent.text);
    
    let parsed: { sections: DocumentSection[] };
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("[DocumentReader] JSON inválido:", jsonText.substring(0, 500));
      return {
        title: "Erro no Formato",
        sections: [],
        rawText: text,
        pageCount: 1,
        error: `A IA retornou um formato inválido. Resposta recebida: "${textContent.text.substring(0, 200)}..."`,
      };
    }

    if (!parsed.sections || !Array.isArray(parsed.sections)) {
      return {
        title: "Erro na Estrutura",
        sections: [],
        rawText: text,
        pageCount: 1,
        error: "A IA não identificou nenhuma seção no documento.",
      };
    }

    if (parsed.sections.length === 0) {
      return {
        title: "Documento Vazio",
        sections: [],
        rawText: text,
        pageCount: 1,
        error: "A IA não encontrou títulos ou seções neste documento.",
      };
    }

    const documentTitle = parsed.sections[0]?.title || "Documento Analisado";

    return {
      title: documentTitle,
      sections: parsed.sections,
      rawText: text,
      pageCount: 1,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[DocumentReader] Erro na API:", errorMessage);
    
    let userMessage = "Erro desconhecido ao processar o documento.";
    
    if (errorMessage.includes("413") || errorMessage.includes("too long")) {
      userMessage = "O documento é muito grande. Tente enviar um arquivo menor ou apenas parte do texto.";
    } else if (errorMessage.includes("429") || errorMessage.includes("rate")) {
      userMessage = "Muitas requisições. Aguarde alguns segundos e tente novamente.";
    } else if (errorMessage.includes("401") || errorMessage.includes("auth")) {
      userMessage = "Erro de autenticação com a API de IA. Contate o administrador.";
    } else if (errorMessage.includes("network") || errorMessage.includes("ECONNREFUSED")) {
      userMessage = "Erro de conexão com a API de IA. Verifique sua internet.";
    }
    
    return {
      title: "Erro",
      sections: [],
      rawText: text,
      pageCount: 1,
      error: userMessage,
    };
  }
}
