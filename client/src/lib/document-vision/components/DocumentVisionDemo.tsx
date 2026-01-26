import React, { useState } from 'react';
import { DocumentScanner } from './DocumentScanner';
import { DocumentAnalysisResult } from './DocumentAnalysisResult';
import type { DocumentStructure } from '../types';

interface DocumentVisionDemoProps {
  onExtractedData?: (data: ExtractedDocumentData) => void;
  className?: string;
}

export interface ExtractedDocumentData {
  documentType: string;
  confidence: number;
  regions: {
    type: string;
    count: number;
  }[];
  structure: {
    level: number;
    type: string;
    title?: string;
  }[];
  metadata: {
    quality: string;
    orientation: string;
    processingTime: number;
  };
}

export const DocumentVisionDemo: React.FC<DocumentVisionDemoProps> = ({
  onExtractedData,
  className = ''
}) => {
  const [document, setDocument] = useState<DocumentStructure | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleDocumentScanned = (doc: DocumentStructure) => {
    setDocument(doc);
    setError(null);
    
    if (onExtractedData) {
      const regionCounts = doc.regions.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const extractedData: ExtractedDocumentData = {
        documentType: doc.type,
        confidence: doc.confidence,
        regions: Object.entries(regionCounts).map(([type, count]) => ({ type, count })),
        structure: doc.hierarchy.map(h => ({
          level: h.level,
          type: h.type,
          title: h.title
        })),
        metadata: {
          quality: doc.metadata.quality,
          orientation: doc.metadata.orientation,
          processingTime: doc.metadata.processingTime
        }
      };
      
      onExtractedData(extractedData);
    }
  };
  
  const handleError = (err: string) => {
    setError(err);
  };
  
  return (
    <div className={`document-vision-demo ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Análise Inteligente de Documentos
        </h2>
        <p className="text-gray-600">
          Use a câmera ou faça upload de um documento para análise automática de estrutura.
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Entrada</h3>
          <DocumentScanner
            onDocumentScanned={handleDocumentScanned}
            onError={handleError}
            showOverlay={true}
            config={{
              confidenceThreshold: 0.4,
              detectTables: true,
              detectForms: true,
              detectSignatures: true
            }}
          />
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Resultado</h3>
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}
          {document ? (
            <DocumentAnalysisResult document={document} showDetails={true} />
          ) : (
            <div className="p-12 bg-gray-50 rounded-xl text-center text-gray-500">
              <div className="text-4xl mb-3">👁️</div>
              <p>Aguardando documento para análise...</p>
              <p className="text-sm mt-2">
                O sistema irá "olhar" o documento como um humano faria
              </p>
            </div>
          )}
        </div>
      </div>
      
      {document && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Resumo da Análise</h4>
          <div className="text-sm text-blue-800">
            <p>
              Documento identificado como <strong>{document.type}</strong> com{' '}
              <strong>{Math.round(document.confidence * 100)}%</strong> de confiança.
            </p>
            <p className="mt-1">
              Foram detectadas <strong>{document.regions.length}</strong> regiões em{' '}
              <strong>{Math.round(document.metadata.processingTime)}ms</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
