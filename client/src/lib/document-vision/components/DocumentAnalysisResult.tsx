import React from 'react';
import type { DocumentStructure, DetectedRegion, HierarchyNode } from '../types';

interface DocumentAnalysisResultProps {
  document: DocumentStructure;
  showDetails?: boolean;
  className?: string;
}

const typeLabels: Record<string, string> = {
  requirements: 'Documento de Requisitos',
  contract: 'Contrato',
  meeting_notes: 'Ata de Reunião',
  technical_spec: 'Especificação Técnica',
  user_story: 'User Story',
  form: 'Formulário',
  report: 'Relatório',
  unknown: 'Documento'
};

const regionLabels: Record<string, string> = {
  title: 'Título',
  subtitle: 'Subtítulo',
  paragraph: 'Parágrafo',
  table: 'Tabela',
  table_cell: 'Célula',
  list: 'Lista',
  list_item: 'Item de Lista',
  image: 'Imagem',
  diagram: 'Diagrama',
  signature: 'Assinatura',
  header: 'Cabeçalho',
  footer: 'Rodapé',
  form_field: 'Campo de Formulário',
  checkbox: 'Checkbox',
  unknown: 'Desconhecido'
};

const regionColors: Record<string, string> = {
  title: 'bg-green-100 text-green-800',
  subtitle: 'bg-lime-100 text-lime-800',
  paragraph: 'bg-blue-100 text-blue-800',
  table: 'bg-amber-100 text-amber-800',
  form_field: 'bg-violet-100 text-violet-800',
  signature: 'bg-pink-100 text-pink-800',
  image: 'bg-cyan-100 text-cyan-800',
  header: 'bg-indigo-100 text-indigo-800',
  footer: 'bg-slate-100 text-slate-800',
  unknown: 'bg-gray-100 text-gray-800'
};

export const DocumentAnalysisResult: React.FC<DocumentAnalysisResultProps> = ({
  document,
  showDetails = true,
  className = ''
}) => {
  const regionCounts = document.regions.reduce((acc, region) => {
    acc[region.type] = (acc[region.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const renderHierarchyNode = (node: HierarchyNode, depth = 0) => {
    const indent = depth * 20;
    
    return (
      <div key={node.id} style={{ marginLeft: indent }}>
        <div className="flex items-center gap-2 py-1">
          <span className={`px-2 py-0.5 rounded text-xs ${regionColors[node.type] || regionColors.unknown}`}>
            {regionLabels[node.type] || node.type}
          </span>
          {node.title && (
            <span className="text-sm font-medium">{node.title}</span>
          )}
          {node.content && (
            <span className="text-sm text-gray-600 truncate max-w-xs">{node.content}</span>
          )}
        </div>
        {node.children.map(child => renderHierarchyNode(child, depth + 1))}
      </div>
    );
  };
  
  return (
    <div className={`document-analysis-result ${className}`}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {typeLabels[document.type] || 'Documento Analisado'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Confiança: {Math.round(document.confidence * 100)}%
              </p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <div>Processado em {Math.round(document.metadata.processingTime)}ms</div>
              <div>Qualidade: {document.metadata.quality}</div>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-b border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Regiões Detectadas</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(regionCounts).map(([type, count]) => (
              <span 
                key={type}
                className={`px-3 py-1 rounded-full text-sm font-medium ${regionColors[type] || regionColors.unknown}`}
              >
                {regionLabels[type] || type}: {count}
              </span>
            ))}
          </div>
        </div>
        
        {showDetails && document.hierarchy.length > 0 && (
          <div className="p-6 border-b border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Estrutura do Documento</h4>
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
              {document.hierarchy.map(node => renderHierarchyNode(node))}
            </div>
          </div>
        )}
        
        {showDetails && (
          <div className="p-6 bg-gray-50">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Metadados</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Páginas:</span>
                <span className="ml-2 font-medium">{document.metadata.pageCount}</span>
              </div>
              <div>
                <span className="text-gray-500">Idioma:</span>
                <span className="ml-2 font-medium">{document.metadata.language}</span>
              </div>
              <div>
                <span className="text-gray-500">Orientação:</span>
                <span className="ml-2 font-medium">
                  {document.metadata.orientation === 'portrait' ? 'Retrato' : 'Paisagem'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Regiões:</span>
                <span className="ml-2 font-medium">{document.regions.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
