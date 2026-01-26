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

  const truncatedText = text.length > 100000 ? text.substring(0, 100000) : text;

  const prompt = `Você é um especialista em análise de documentos técnicos brasileiros (editais, termos de referência, contratos).

TAREFA: Extrair a estrutura hierárquica EXATA do documento abaixo.

REGRAS DE HIERARQUIA:
- level 1: Seções principais numeradas como "1.", "2.", "3." ou títulos em MAIÚSCULAS
- level 2: Subseções numeradas como "1.1", "2.1", "3.1"  
- level 3: Sub-subseções numeradas como "1.1.1", "2.1.1"
- level 4: Níveis mais profundos como "1.1.1.1"

IMPORTANTE:
- Identifique TODAS as seções numeradas do documento
- Mantenha a numeração no título (ex: "1. DO OBJETO", "1.1. Descrição")
- O campo "content" deve ter um resumo breve (máx 80 caracteres)
- NÃO duplique seções (se "1. DO OBJETO" existe, não crie outra "OBJETO" separada)
- Ignore cabeçalhos repetidos de página, rodapés e informações administrativas

DOCUMENTO:
${truncatedText}

RESPONDA APENAS COM JSON VÁLIDO (sem markdown, sem explicação):
{"sections":[{"level":1,"title":"1. DO OBJETO","content":"Descrição breve","children":[]}]}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
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
    jsonText = jsonText.replace(/^```\w*\s*/i, "").replace(/\s*```$/i, "");
    
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
    } catch {
      // Tenta reparar JSON incompleto
      let repaired = jsonText;
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/]/g) || []).length;
      
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]}";
      for (let i = 0; i < openBraces - closeBraces - (openBrackets - closeBrackets); i++) repaired += "}";
      
      try {
        parsed = JSON.parse(repaired);
      } catch {
        return {
          title: "Erro",
          sections: [],
          rawText: text,
          pageCount: 1,
          error: "Resposta da IA foi cortada. Tente com documento menor.",
        };
      }
    }

    if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      return {
        title: "Documento Vazio",
        sections: [],
        rawText: text,
        pageCount: 1,
        error: "Nenhuma seção identificada.",
      };
    }

    const cleanSections = parsed.sections.map(s => ({
      level: s.level || 1,
      title: s.title || "Sem título",
      content: s.content || "",
      children: []
    }));

    // Título do documento é a primeira seção level 1 ou o primeiro título
    const docTitle = cleanSections.find(s => s.level === 1)?.title || cleanSections[0]?.title || "Documento";

    return {
      title: docTitle,
      sections: cleanSections,
      rawText: text,
      pageCount: 1,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[DocumentReader] Erro:", msg);
    
    return {
      title: "Erro",
      sections: [],
      rawText: text,
      pageCount: 1,
      error: msg.includes("too long") ? "Documento muito grande." : 
             msg.includes("429") ? "Limite de requisições. Aguarde." : 
             "Erro: " + msg.substring(0, 100),
    };
  }
}
