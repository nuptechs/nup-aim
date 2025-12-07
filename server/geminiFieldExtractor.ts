import { GoogleGenAI } from "@google/genai";
import { v4 as uuidv4 } from "uuid";

export interface GeminiExtractedField {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
  complexity: 'Low' | 'Average' | 'High';
  fpValue: number;
  source: string;
  fieldCategory: 'entrada' | 'saida' | 'neutro' | 'derivado';
  confidence: number;
  value?: string;
}

interface GeminiFieldResponse {
  fields: Array<{
    label: string;
    name: string;
    type: string;
    category: 'entrada' | 'saida' | 'neutro' | 'derivado';
    required: boolean;
    value?: string;
    description?: string;
  }>;
}

const OPTIMIZED_PROMPT = `Analise esta tela de sistema e extraia TODOS os campos de dados visíveis.

EXTRAIA:
- Campos onde usuário insere/edita dados (inputs, selects, checkboxes) → categoria "entrada"
- Campos que mostram dados do banco (IDs, códigos, nomes) → categoria "neutro"

IGNORE:
- Botões (Salvar, Cancelar, Adicionar)
- Títulos e cabeçalhos
- Menus
- Textos estáticos

Para cada campo:
- label: texto exato do campo
- name: versão snake_case
- type: text, number, date, select, currency, checkbox, textarea
- category: "entrada" ou "neutro"
- required: true/false
- value: valor visível ou null

JSON:
{
  "fields": [
    {
      "label": "Nome do campo",
      "name": "nome_campo",
      "type": "text",
      "category": "entrada",
      "required": false,
      "value": null,
      "description": "Descrição"
    }
  ]
}

Extraia TODOS os campos de dados que você vê.`;

function mapHTMLInputTypeToFieldType(htmlType: string): string {
  const mapping: Record<string, string> = {
    "text": "text",
    "password": "text",
    "email": "email",
    "tel": "text",
    "number": "number",
    "date": "date",
    "datetime-local": "date",
    "time": "text",
    "checkbox": "checkbox",
    "radio": "radio",
    "file": "file",
    "url": "url",
    "search": "text",
    "color": "text",
    "range": "number",
    "hidden": "text"
  };
  return mapping[htmlType.toLowerCase()] || "text";
}

function determineFieldType(explicitType: string, name: string): string {
  if (explicitType) {
    return mapHTMLInputTypeToFieldType(explicitType);
  }
  const lowerName = name.toLowerCase();
  if (lowerName.includes("email")) return "email";
  if (lowerName.includes("senha") || lowerName.includes("password")) return "text";
  if (lowerName.includes("data") || lowerName.includes("date") || lowerName.includes("nascimento")) return "date";
  if (lowerName.includes("número") || lowerName.includes("number") || lowerName.includes("quantidade") || lowerName.includes("quantity") || lowerName.includes("valor") || lowerName.includes("amount") || lowerName.includes("preço") || lowerName.includes("price")) return "number";
  if (lowerName.includes("descrição") || lowerName.includes("description") || lowerName.includes("observação") || lowerName.includes("observation") || lowerName.includes("comentário") || lowerName.includes("comment") || lowerName.includes("mensagem") || lowerName.includes("message")) return "textarea";
  if (lowerName.includes("aceito") || lowerName.includes("accept") || lowerName.includes("concordo") || lowerName.includes("agree") || lowerName.includes("lembrar") || lowerName.includes("remember")) return "checkbox";
  if (lowerName.includes("sexo") || lowerName.includes("gender") || lowerName.includes("opção") || lowerName.includes("option")) return "radio";
  if (lowerName.includes("estado") || lowerName.includes("state") || lowerName.includes("país") || lowerName.includes("country") || lowerName.includes("categoria") || lowerName.includes("category") || lowerName.includes("tipo") || lowerName.includes("type") || lowerName.includes("status")) return "select";
  if (lowerName.includes("arquivo") || lowerName.includes("file") || lowerName.includes("anexo") || lowerName.includes("attachment") || lowerName.includes("upload")) return "file";
  return "text";
}

function determineComplexity(fieldType: string, fieldName: string): 'Low' | 'Average' | 'High' {
  const complexTypes = ['file', 'select', 'radio'];
  const simpleTypes = ['checkbox', 'hidden'];
  
  if (complexTypes.includes(fieldType)) return 'High';
  if (simpleTypes.includes(fieldType)) return 'Low';
  
  const complexKeywords = ['valor', 'price', 'amount', 'total', 'quantidade'];
  const lowerName = fieldName.toLowerCase();
  if (complexKeywords.some(k => lowerName.includes(k))) return 'High';
  
  return 'Average';
}

function calculateFunctionPoints(fieldType: string, complexity: 'Low' | 'Average' | 'High'): number {
  const fpMatrix: Record<string, Record<string, number>> = {
    'text': { 'Low': 3, 'Average': 4, 'High': 6 },
    'number': { 'Low': 3, 'Average': 4, 'High': 6 },
    'date': { 'Low': 4, 'Average': 5, 'High': 7 },
    'select': { 'Low': 4, 'Average': 5, 'High': 7 },
    'file': { 'Low': 5, 'Average': 7, 'High': 10 },
    'textarea': { 'Low': 3, 'Average': 4, 'High': 6 },
    'checkbox': { 'Low': 2, 'Average': 3, 'High': 4 },
    'radio': { 'Low': 3, 'Average': 4, 'High': 6 },
    'email': { 'Low': 3, 'Average': 4, 'High': 6 },
    'url': { 'Low': 3, 'Average': 4, 'High': 6 },
  };
  
  return fpMatrix[fieldType]?.[complexity] || fpMatrix['text'][complexity];
}

function identifyDerivedFields(fields: GeminiExtractedField[]): GeminiExtractedField[] {
  const derivedKeywords = [
    'total', 'subtotal', 'soma', 'somatoria', 'somatório',
    'media', 'média', 'percentual', 'taxa', 'calculo', 'cálculo',
    'resultado', 'final', 'liquido', 'líquido', 'bruto',
    'desconto', 'acrescimo', 'acréscimo', 'juros',
    'quantidade_total', 'valor_total', 'preco_final', 'preço_final',
    'total_geral', 'grand_total', 'sum', 'avg', 'count'
  ];

  return fields.map(field => {
    const labelLower = field.label.toLowerCase();
    const nameLower = field.name.toLowerCase();
    
    const isDerived = derivedKeywords.some(keyword => 
      labelLower.includes(keyword) || nameLower.includes(keyword)
    );

    if (isDerived) {
      console.log(`🔄 Campo "${field.label}" reclassificado como DERIVADO`);
      return {
        ...field,
        fieldCategory: 'derivado' as const,
        description: `${field.description || 'Campo calculado/agregado'} (identificado automaticamente como derivado)`
      };
    }

    return field;
  });
}

export async function extractFieldsWithGemini(imageBase64: string): Promise<GeminiExtractedField[]> {
  try {
    console.log('🤖 Iniciando extração de campos com Gemini AI...');
    
    const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const ai = new GoogleGenAI({ apiKey });

    const base64Image = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    console.log(`📤 Enviando imagem para Gemini 2.5 Flash (tamanho: ${Math.round(base64Image.length / 1024)} KB)`);

    const startTime = Date.now();
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: "image/jpeg",
              },
            },
            {
              text: OPTIMIZED_PROMPT
            }
          ]
        }
      ],
    });

    const endTime = Date.now();
    console.log(`✅ Resposta recebida do Gemini em ${endTime - startTime}ms`);

    let responseText = response.text;
    
    if (!responseText) {
      throw new Error('Resposta vazia do Gemini');
    }

    console.log('📥 Processando resposta JSON do Gemini...');
    
    responseText = responseText.trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.split('\n').slice(1).join('\n');
      if (responseText.endsWith('```')) {
        responseText = responseText.slice(0, -3);
      }
      responseText = responseText.trim();
    }
    
    const geminiResponse: GeminiFieldResponse = JSON.parse(responseText);
    
    if (!geminiResponse.fields || !Array.isArray(geminiResponse.fields)) {
      throw new Error('Formato de resposta inválido do Gemini');
    }

    console.log(`🎯 Gemini identificou ${geminiResponse.fields.length} campos relevantes`);

    let extractedFields: GeminiExtractedField[] = geminiResponse.fields.map(field => {
      const fieldType = field.type || determineFieldType('', field.name);
      const complexity = determineComplexity(fieldType, field.name);
      const fpValue = calculateFunctionPoints(fieldType, complexity);

      return {
        id: uuidv4(),
        name: field.name,
        label: field.label,
        type: fieldType,
        required: field.required || false,
        description: field.description || `Campo ${field.label} extraído via Gemini AI`,
        complexity,
        fpValue,
        source: 'Gemini AI',
        fieldCategory: field.category || 'neutro',
        confidence: 0.95,
        value: field.value
      };
    });

    console.log('🔍 Analisando campos para identificar derivados...');
    extractedFields = identifyDerivedFields(extractedFields);

    console.log('📋 CAMPOS EXTRAÍDOS DETALHADAMENTE:');
    extractedFields.forEach((field, index) => {
      console.log(`   ${index + 1}. ${field.label} (${field.name}) - Tipo: ${field.type} - Categoria: ${field.fieldCategory}`);
    });

    const stats = {
      entrada: extractedFields.filter(f => f.fieldCategory === 'entrada').length,
      neutro: extractedFields.filter(f => f.fieldCategory === 'neutro').length,
      derivado: extractedFields.filter(f => f.fieldCategory === 'derivado').length,
    };

    console.log(`📊 Distribuição dos campos:`);
    console.log(`   - Entrada: ${stats.entrada}`);
    console.log(`   - Neutro: ${stats.neutro}`);
    console.log(`   - Derivado: ${stats.derivado}`);

    return extractedFields;
  } catch (error: any) {
    console.error('❌ Erro na extração com Gemini:', error);
    throw new Error(`Falha na extração com Gemini: ${error.message}`);
  }
}
