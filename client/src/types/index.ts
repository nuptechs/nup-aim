export interface ImpactAnalysis {
  id: string;
  title: string;
  description: string;
  author: string;
  date: string;
  version: string;
  project: string;
  
  // Escopo
  scope: {
    processes: ProcessItem[];
  };
  
  // Análise de Impacto
  impacts: {
    business: ImpactItem[];
    technical: ImpactItem[];
    operational: ImpactItem[];
    financial: ImpactItem[];
  };
  
  // Riscos
  risks: RiskItem[];
  
  // Plano de Mitigação
  mitigations: MitigationItem[];
  
  // Conclusões
  conclusions: {
    summary: string;
    recommendations: string[];
    nextSteps: string[];
  };
  
  // Custom Fields Values
  customFieldsValues?: Record<string, Record<string, any>>;
}

export interface ProcessItem {
  id: string;
  name: string;
  status: 'nova' | 'alterada' | 'excluida';
  workDetails?: string;
  screenshots?: string;
  websisCreated?: boolean;
  functionType?: 'ALI' | 'AIE' | 'EE' | 'SE' | 'CE';
  complexity?: 'baixa' | 'media' | 'alta';
  aiGenerated?: boolean;
  aiConfidence?: number;
  aiRationale?: string;
  citationVerified?: boolean; // True if citation was found in source document
  citationText?: string; // Extracted citation text
  evidences?: Evidence[];
}

export interface Evidence {
  id: string;
  type: 'image' | 'text' | 'document';
  content: string;
  description?: string;
}

export interface WorkspaceInput {
  id: string;
  type: 'text' | 'image' | 'document';
  content: string;
  fileName?: string;
  mimeType?: string;
  timestamp: string;
}

export interface ImpactItem {
  id: string;
  description: string;
  severity: 'baixo' | 'medio' | 'alto' | 'critico';
  probability: 'baixo' | 'medio' | 'alto';
  category: string;
}

export interface RiskItem {
  id: string;
  description: string;
  impact: 'baixo' | 'medio' | 'alto' | 'critico';
  probability: 'baixo' | 'medio' | 'alto';
  mitigation: string;
}

export interface MitigationItem {
  id: string;
  action: string;
  responsible: string;
  deadline: string;
  priority: 'baixo' | 'medio' | 'alto';
}

export interface Project {
  id: string;
  name: string;
  acronym: string;
  isDefault: boolean;
  createdAt: string;
}