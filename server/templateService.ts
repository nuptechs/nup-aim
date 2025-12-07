import PizZip from 'pizzip';
import createReport from 'docx-templates';
import { db } from './db';
import { documentTemplates, analyses, projects, users, profiles, impacts, risks, mitigations, conclusions, processes, customFieldValues } from './schema';
import { eq } from 'drizzle-orm';

export interface ParsedMarker {
  marker: string;
  fieldName: string;
  context: string;
  position: number;
}

export interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  table: string;
  tableLabel: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'json' | 'list';
  description?: string;
}

export interface FieldCategory {
  id: string;
  label: string;
  icon: string;
  fields: FieldDefinition[];
}

const FIELD_LABELS: Record<string, Record<string, string>> = {
  analyses: {
    id: 'ID da Análise',
    title: 'Título',
    description: 'Descrição',
    author: 'Autor',
    version: 'Versão',
    createdAt: 'Data de Criação',
    updatedAt: 'Data de Atualização'
  },
  projects: {
    id: 'ID do Projeto',
    name: 'Nome do Projeto',
    acronym: 'Sigla',
    createdAt: 'Data de Criação'
  },
  users: {
    id: 'ID do Usuário',
    username: 'Nome de Usuário',
    email: 'E-mail'
  },
  impacts: {
    id: 'ID do Impacto',
    description: 'Descrição do Impacto',
    severity: 'Severidade',
    probability: 'Probabilidade',
    category: 'Categoria'
  },
  risks: {
    id: 'ID do Risco',
    description: 'Descrição do Risco',
    impact: 'Impacto',
    probability: 'Probabilidade',
    mitigation: 'Mitigação'
  },
  mitigations: {
    id: 'ID da Mitigação',
    action: 'Ação',
    responsible: 'Responsável',
    deadline: 'Prazo',
    priority: 'Prioridade'
  },
  conclusions: {
    id: 'ID da Conclusão',
    summary: 'Resumo Executivo',
    recommendations: 'Recomendações',
    nextSteps: 'Próximos Passos'
  },
  processes: {
    id: 'ID do Processo',
    name: 'Nome da Funcionalidade',
    status: 'Status',
    workDetails: 'Detalhes do Trabalho',
    websisCreated: 'WEBSIS Criado'
  }
};

const TABLE_LABELS: Record<string, { label: string; icon: string }> = {
  analyses: { label: 'Análise', icon: 'FileText' },
  projects: { label: 'Projeto', icon: 'Folder' },
  users: { label: 'Usuário', icon: 'User' },
  impacts: { label: 'Impactos', icon: 'AlertTriangle' },
  risks: { label: 'Riscos', icon: 'Shield' },
  mitigations: { label: 'Mitigações', icon: 'CheckCircle' },
  conclusions: { label: 'Conclusões', icon: 'FileCheck' },
  processes: { label: 'Funcionalidades', icon: 'Layers' }
};

export function getAvailableFields(): FieldCategory[] {
  const categories: FieldCategory[] = [];

  categories.push({
    id: 'analyses',
    label: 'Análise de Impacto',
    icon: 'FileText',
    fields: [
      { id: 'analyses.title', name: 'title', label: 'Título da Análise', table: 'analyses', tableLabel: 'Análise', type: 'text' },
      { id: 'analyses.description', name: 'description', label: 'Descrição', table: 'analyses', tableLabel: 'Análise', type: 'text' },
      { id: 'analyses.author', name: 'author', label: 'Autor', table: 'analyses', tableLabel: 'Análise', type: 'text' },
      { id: 'analyses.version', name: 'version', label: 'Versão', table: 'analyses', tableLabel: 'Análise', type: 'text' },
      { id: 'analyses.createdAt', name: 'createdAt', label: 'Data de Criação', table: 'analyses', tableLabel: 'Análise', type: 'date' },
      { id: 'analyses.updatedAt', name: 'updatedAt', label: 'Data de Atualização', table: 'analyses', tableLabel: 'Análise', type: 'date' },
    ]
  });

  categories.push({
    id: 'projects',
    label: 'Projeto',
    icon: 'Folder',
    fields: [
      { id: 'projects.name', name: 'name', label: 'Nome do Projeto', table: 'projects', tableLabel: 'Projeto', type: 'text' },
      { id: 'projects.acronym', name: 'acronym', label: 'Sigla do Projeto', table: 'projects', tableLabel: 'Projeto', type: 'text' },
    ]
  });

  categories.push({
    id: 'impacts',
    label: 'Impactos (Lista)',
    icon: 'AlertTriangle',
    fields: [
      { id: 'impacts', name: 'impacts', label: 'Lista de Impactos', table: 'impacts', tableLabel: 'Impactos', type: 'list', description: 'Todos os impactos da análise' },
      { id: 'impacts.description', name: 'description', label: 'Descrição do Impacto', table: 'impacts', tableLabel: 'Impactos', type: 'text' },
      { id: 'impacts.severity', name: 'severity', label: 'Severidade', table: 'impacts', tableLabel: 'Impactos', type: 'text' },
      { id: 'impacts.probability', name: 'probability', label: 'Probabilidade', table: 'impacts', tableLabel: 'Impactos', type: 'text' },
      { id: 'impacts.category', name: 'category', label: 'Categoria', table: 'impacts', tableLabel: 'Impactos', type: 'text' },
    ]
  });

  categories.push({
    id: 'risks',
    label: 'Riscos (Lista)',
    icon: 'Shield',
    fields: [
      { id: 'risks', name: 'risks', label: 'Lista de Riscos', table: 'risks', tableLabel: 'Riscos', type: 'list', description: 'Todos os riscos da análise' },
      { id: 'risks.description', name: 'description', label: 'Descrição do Risco', table: 'risks', tableLabel: 'Riscos', type: 'text' },
      { id: 'risks.impact', name: 'impact', label: 'Impacto', table: 'risks', tableLabel: 'Riscos', type: 'text' },
      { id: 'risks.probability', name: 'probability', label: 'Probabilidade', table: 'risks', tableLabel: 'Riscos', type: 'text' },
      { id: 'risks.mitigation', name: 'mitigation', label: 'Mitigação', table: 'risks', tableLabel: 'Riscos', type: 'text' },
    ]
  });

  categories.push({
    id: 'mitigations',
    label: 'Mitigações (Lista)',
    icon: 'CheckCircle',
    fields: [
      { id: 'mitigations', name: 'mitigations', label: 'Lista de Mitigações', table: 'mitigations', tableLabel: 'Mitigações', type: 'list', description: 'Todas as ações de mitigação' },
      { id: 'mitigations.action', name: 'action', label: 'Ação', table: 'mitigations', tableLabel: 'Mitigações', type: 'text' },
      { id: 'mitigations.responsible', name: 'responsible', label: 'Responsável', table: 'mitigations', tableLabel: 'Mitigações', type: 'text' },
      { id: 'mitigations.deadline', name: 'deadline', label: 'Prazo', table: 'mitigations', tableLabel: 'Mitigações', type: 'date' },
      { id: 'mitigations.priority', name: 'priority', label: 'Prioridade', table: 'mitigations', tableLabel: 'Mitigações', type: 'text' },
    ]
  });

  categories.push({
    id: 'conclusions',
    label: 'Conclusões',
    icon: 'FileCheck',
    fields: [
      { id: 'conclusions.summary', name: 'summary', label: 'Resumo Executivo', table: 'conclusions', tableLabel: 'Conclusões', type: 'text' },
      { id: 'conclusions.recommendations', name: 'recommendations', label: 'Recomendações', table: 'conclusions', tableLabel: 'Conclusões', type: 'json' },
      { id: 'conclusions.nextSteps', name: 'nextSteps', label: 'Próximos Passos', table: 'conclusions', tableLabel: 'Conclusões', type: 'json' },
    ]
  });

  categories.push({
    id: 'processes',
    label: 'Funcionalidades (Lista)',
    icon: 'Layers',
    fields: [
      { id: 'processes', name: 'processes', label: 'Lista de Funcionalidades', table: 'processes', tableLabel: 'Funcionalidades', type: 'list', description: 'Todas as funcionalidades impactadas' },
      { id: 'processes.name', name: 'name', label: 'Nome da Funcionalidade', table: 'processes', tableLabel: 'Funcionalidades', type: 'text' },
      { id: 'processes.status', name: 'status', label: 'Status', table: 'processes', tableLabel: 'Funcionalidades', type: 'text' },
      { id: 'processes.workDetails', name: 'workDetails', label: 'Detalhes do Trabalho', table: 'processes', tableLabel: 'Funcionalidades', type: 'text' },
    ]
  });

  categories.push({
    id: 'metadata',
    label: 'Metadados',
    icon: 'Info',
    fields: [
      { id: 'meta.currentDate', name: 'currentDate', label: 'Data Atual', table: 'meta', tableLabel: 'Metadados', type: 'date' },
      { id: 'meta.currentTime', name: 'currentTime', label: 'Hora Atual', table: 'meta', tableLabel: 'Metadados', type: 'text' },
      { id: 'meta.totalImpacts', name: 'totalImpacts', label: 'Total de Impactos', table: 'meta', tableLabel: 'Metadados', type: 'number' },
      { id: 'meta.totalRisks', name: 'totalRisks', label: 'Total de Riscos', table: 'meta', tableLabel: 'Metadados', type: 'number' },
      { id: 'meta.totalMitigations', name: 'totalMitigations', label: 'Total de Mitigações', table: 'meta', tableLabel: 'Metadados', type: 'number' },
    ]
  });

  return categories;
}

export function parseMarkersFromDocx(fileContent: Buffer): ParsedMarker[] {
  const markers: ParsedMarker[] = [];
  
  try {
    const zip = new PizZip(fileContent);
    const documentXml = zip.file('word/document.xml')?.asText() || '';
    
    const textContent = documentXml
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const markerRegex = /#\$([^#$]+)#\$/g;
    let match;
    
    while ((match = markerRegex.exec(textContent)) !== null) {
      const fullMarker = match[0];
      const fieldName = match[1].trim();
      const position = match.index;
      
      const contextStart = Math.max(0, position - 30);
      const contextEnd = Math.min(textContent.length, position + fullMarker.length + 30);
      let context = textContent.substring(contextStart, contextEnd);
      
      if (contextStart > 0) context = '...' + context;
      if (contextEnd < textContent.length) context = context + '...';
      
      const existingMarker = markers.find(m => m.fieldName === fieldName);
      if (!existingMarker) {
        markers.push({
          marker: fullMarker,
          fieldName,
          context,
          position
        });
      }
    }
    
    return markers;
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    throw new Error('Erro ao analisar o documento. Verifique se é um arquivo DOCX válido.');
  }
}

export async function getAnalysisData(analysisId: string): Promise<Record<string, any>> {
  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId));
  
  if (!analysis) {
    throw new Error('Análise não encontrada');
  }

  const [project] = analysis.projectId 
    ? await db.select().from(projects).where(eq(projects.id, analysis.projectId))
    : [null];

  const impactsList = await db.select().from(impacts).where(eq(impacts.analysisId, analysisId));
  const risksList = await db.select().from(risks).where(eq(risks.analysisId, analysisId));
  const mitigationsList = await db.select().from(mitigations).where(eq(mitigations.analysisId, analysisId));
  const [conclusion] = await db.select().from(conclusions).where(eq(conclusions.analysisId, analysisId));
  const processesList = await db.select().from(processes).where(eq(processes.analysisId, analysisId));

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatSeverity = (severity: string) => {
    const map: Record<string, string> = {
      'baixo': 'Baixo',
      'medio': 'Médio',
      'alto': 'Alto',
      'critico': 'Crítico'
    };
    return map[severity] || severity;
  };

  const formatCategory = (category: string) => {
    const map: Record<string, string> = {
      'business': 'Negócio',
      'technical': 'Técnico',
      'operational': 'Operacional',
      'financial': 'Financeiro'
    };
    return map[category] || category;
  };

  const formatStatus = (status: string) => {
    const map: Record<string, string> = {
      'nova': 'Nova',
      'alterada': 'Alterada',
      'excluida': 'Excluída'
    };
    return map[status] || status;
  };

  return {
    'analyses.title': analysis.title,
    'analyses.description': analysis.description || '',
    'analyses.author': analysis.author,
    'analyses.version': analysis.version || '1.0',
    'analyses.createdAt': formatDate(analysis.createdAt),
    'analyses.updatedAt': formatDate(analysis.updatedAt),

    'projects.name': project?.name || '',
    'projects.acronym': project?.acronym || '',

    'impacts': impactsList.map(i => ({
      description: i.description,
      severity: formatSeverity(i.severity),
      probability: formatSeverity(i.probability),
      category: formatCategory(i.category)
    })),

    'risks': risksList.map(r => ({
      description: r.description,
      impact: formatSeverity(r.impact),
      probability: formatSeverity(r.probability),
      mitigation: r.mitigation || ''
    })),

    'mitigations': mitigationsList.map(m => ({
      action: m.action,
      responsible: m.responsible,
      deadline: formatDate(m.deadline ? new Date(m.deadline) : null),
      priority: formatSeverity(m.priority)
    })),

    'conclusions.summary': conclusion?.summary || '',
    'conclusions.recommendations': Array.isArray(conclusion?.recommendations) 
      ? (conclusion.recommendations as string[]).join('\n') 
      : '',
    'conclusions.nextSteps': Array.isArray(conclusion?.nextSteps) 
      ? (conclusion.nextSteps as string[]).join('\n') 
      : '',

    'processes': processesList.map(p => ({
      name: p.name,
      status: formatStatus(p.status),
      workDetails: p.workDetails || ''
    })),

    'meta.currentDate': new Date().toLocaleDateString('pt-BR'),
    'meta.currentTime': new Date().toLocaleTimeString('pt-BR'),
    'meta.totalImpacts': impactsList.length,
    'meta.totalRisks': risksList.length,
    'meta.totalMitigations': mitigationsList.length,
    'meta.totalProcesses': processesList.length
  };
}

export async function generateDocumentFromTemplate(
  templateId: string,
  analysisId: string
): Promise<Buffer> {
  const [template] = await db.select().from(documentTemplates).where(eq(documentTemplates.id, templateId));
  
  if (!template) {
    throw new Error('Template não encontrado');
  }

  const analysisData = await getAnalysisData(analysisId);
  const fieldMappings = template.fieldMappings as Record<string, string>;
  
  const templateBuffer = Buffer.from(template.fileContent, 'base64');
  
  let processedContent = templateBuffer;
  
  try {
    const zip = new PizZip(templateBuffer);
    let documentXml = zip.file('word/document.xml')?.asText() || '';
    
    for (const [marker, fieldId] of Object.entries(fieldMappings)) {
      const value = analysisData[fieldId];
      const markerPattern = `#\\$${marker}#\\$`;
      const regex = new RegExp(markerPattern, 'g');
      
      if (Array.isArray(value)) {
        const listContent = value.map((item, index) => {
          if (typeof item === 'object') {
            return Object.entries(item)
              .map(([key, val]) => `${key}: ${val}`)
              .join(', ');
          }
          return String(item);
        }).join('\n');
        
        documentXml = documentXml.replace(regex, listContent);
      } else {
        documentXml = documentXml.replace(regex, String(value || ''));
      }
    }
    
    zip.file('word/document.xml', documentXml);
    processedContent = zip.generate({ type: 'nodebuffer' });
    
    await db.update(documentTemplates)
      .set({ 
        usageCount: String(parseInt(template.usageCount || '0') + 1),
        updatedAt: new Date()
      })
      .where(eq(documentTemplates.id, templateId));
    
    return processedContent;
  } catch (error) {
    console.error('Error generating document:', error);
    throw new Error('Erro ao gerar documento a partir do template');
  }
}

export async function validateFieldMappings(
  parsedMarkers: ParsedMarker[],
  fieldMappings: Record<string, string>
): Promise<{ valid: boolean; unmappedMarkers: string[]; invalidMappings: string[] }> {
  const availableFieldIds = getAvailableFields()
    .flatMap(cat => cat.fields)
    .map(f => f.id);
  
  const unmappedMarkers = parsedMarkers
    .filter(m => !fieldMappings[m.fieldName])
    .map(m => m.fieldName);
  
  const invalidMappings = Object.entries(fieldMappings)
    .filter(([_, fieldId]) => !availableFieldIds.includes(fieldId))
    .map(([marker, _]) => marker);
  
  return {
    valid: unmappedMarkers.length === 0 && invalidMappings.length === 0,
    unmappedMarkers,
    invalidMappings
  };
}
