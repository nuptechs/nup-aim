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

  // Limit text to avoid API issues
  const truncatedText = text.length > 25000 ? text.substring(0, 25000) : text;

  const prompt = `Analise este documento e retorne APENAS um JSON válido com a estrutura hierárquica.

REGRAS:
1. Identifique títulos principais (level 1), subtítulos (level 2), etc.
2. O campo "content" deve ser breve (máximo 100 caracteres)
3. O campo "children" deve ser sempre um array vazio []
4. Retorne NO MÁXIMO 20 seções para evitar respostas muito longas

DOCUMENTO:
${truncatedText}

FORMATO (retorne EXATAMENTE assim, sem markdown, sem explicação):
{"sections":[{"level":1,"title":"Titulo","content":"Resumo breve","children":[]}]}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return {
        title: "Erro",
        sections: [],
        rawText: text,
        pageCount: 1,
        error: "A IA não retornou texto.",
      };
    }

    let jsonText = textContent.text.trim();
    
    // Remove markdown formatting
    jsonText = jsonText.replace(/^```\w*\s*/i, "").replace(/\s*```$/i, "");
    
    // Extract JSON object
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return {
        title: "Erro",
        sections: [],
        rawText: text,
        pageCount: 1,
        error: "A IA não retornou JSON válido.",
      };
    }
    
    jsonText = jsonText.substring(start, end + 1);

    let parsed: { sections: DocumentSection[] };
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      // JSON incompleto - tentar reparar fechando arrays/objetos
      let repaired = jsonText;
      
      // Conta chaves abertas
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/]/g) || []).length;
      
      // Fecha o que está aberto
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        repaired += "]}";
      }
      for (let i = 0; i < openBraces - closeBraces - (openBrackets - closeBrackets); i++) {
        repaired += "}";
      }
      
      try {
        parsed = JSON.parse(repaired);
      } catch {
        console.error("[DocumentReader] JSON não pôde ser reparado");
        return {
          title: "Erro",
          sections: [],
          rawText: text,
          pageCount: 1,
          error: "Resposta da IA foi cortada. Tente com um documento menor.",
        };
      }
    }

    if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      return {
        title: "Documento Vazio",
        sections: [],
        rawText: text,
        pageCount: 1,
        error: "Nenhuma seção identificada no documento.",
      };
    }

    // Garante que cada seção tem children como array
    const cleanSections = parsed.sections.map(s => ({
      level: s.level || 1,
      title: s.title || "Sem título",
      content: s.content || "",
      children: []
    }));

    return {
      title: cleanSections[0]?.title || "Documento",
      sections: cleanSections,
      rawText: text,
      pageCount: 1,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[DocumentReader] Erro API:", msg);
    
    return {
      title: "Erro",
      sections: [],
      rawText: text,
      pageCount: 1,
      error: msg.includes("too long") ? "Documento muito grande." : 
             msg.includes("429") ? "Limite de requisições. Aguarde." : 
             "Erro ao processar: " + msg.substring(0, 100),
    };
  }
}
