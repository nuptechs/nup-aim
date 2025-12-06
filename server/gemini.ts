import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  },
});

export interface AIAnalysisSuggestion {
  impacts: Array<{
    description: string;
    severity: string;
    probability: string;
    category: string;
  }>;
  risks: Array<{
    description: string;
    impact: string;
    probability: string;
    mitigation: string;
  }>;
  mitigations: Array<{
    action: string;
    responsible: string;
    priority: string;
  }>;
  summary: string;
  recommendations: string[];
}

export async function generateAnalysisSuggestions(
  title: string,
  description: string,
  processes: string[]
): Promise<AIAnalysisSuggestion> {
  const prompt = `Você é um especialista em análise de impacto de sistemas e projetos de TI. 
Analise o seguinte contexto e gere sugestões inteligentes para uma análise de impacto:

TÍTULO: ${title}
DESCRIÇÃO: ${description}
PROCESSOS AFETADOS: ${processes.join(', ')}

Por favor, gere uma análise estruturada com:
1. Impactos potenciais (3-5 itens) - categorize como: business, technical, operational, ou financial
2. Riscos identificados (3-5 itens)
3. Ações de mitigação recomendadas (3-5 itens)
4. Um resumo executivo
5. Recomendações gerais (3-5 itens)

Para severidade e probabilidade use: low, medium, high, critical
Para prioridade use: low, medium, high, urgent

Responda APENAS em formato JSON válido seguindo esta estrutura:
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
        responseMimeType: "application/json",
      },
    });

    const text = response.text || '{}';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    throw new Error('Falha ao gerar sugestões com IA');
  }
}

export async function improveText(text: string, context: string): Promise<string> {
  const prompt = `Você é um especialista em redação técnica e análise de impacto.
Melhore o seguinte texto, tornando-o mais claro, profissional e completo.
Mantenha o significado original mas aprimore a qualidade.

CONTEXTO: ${context}
TEXTO ORIGINAL: ${text}

Responda apenas com o texto melhorado, sem explicações adicionais.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || text;
  } catch (error) {
    console.error('Error improving text:', error);
    throw new Error('Falha ao melhorar texto com IA');
  }
}

export async function generateSmartSuggestions(
  field: string,
  currentValue: string,
  analysisContext: {
    title: string;
    description: string;
    project: string;
  }
): Promise<string[]> {
  const prompt = `Você é um assistente especializado em análise de impacto de sistemas.
Sugira 5 opções para o campo "${field}" baseado no contexto:

PROJETO: ${analysisContext.project}
TÍTULO: ${analysisContext.title}
DESCRIÇÃO: ${analysisContext.description}
VALOR ATUAL: ${currentValue || 'vazio'}

Responda APENAS com um JSON array de 5 strings com sugestões relevantes e profissionais:
["sugestão 1", "sugestão 2", "sugestão 3", "sugestão 4", "sugestão 5"]`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || '[]';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return [];
  }
}

export async function chatWithAssistant(
  message: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  analysisContext?: {
    title: string;
    description: string;
    project: string;
  }
): Promise<string> {
  const systemContext = analysisContext
    ? `Você é um assistente especializado em análise de impacto para o sistema NuP-AIM.
Contexto atual:
- Projeto: ${analysisContext.project}
- Título da Análise: ${analysisContext.title}
- Descrição: ${analysisContext.description}

Ajude o usuário com dúvidas sobre análise de impacto, riscos, mitigações e boas práticas.
Seja conciso, profissional e sempre ofereça sugestões práticas.`
    : `Você é um assistente especializado em análise de impacto para o sistema NuP-AIM.
Ajude o usuário com dúvidas sobre análise de impacto, riscos, mitigações e boas práticas.
Seja conciso, profissional e sempre ofereça sugestões práticas.`;

  const messages = [
    { role: 'user' as const, parts: [{ text: systemContext }] },
    ...conversationHistory.map((msg) => ({
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.content }],
    })),
    { role: 'user' as const, parts: [{ text: message }] },
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: messages,
    });

    return response.text || 'Desculpe, não consegui processar sua mensagem.';
  } catch (error) {
    console.error('Error in chat:', error);
    throw new Error('Falha ao processar mensagem');
  }
}
