import React, { useState, useCallback } from 'react';
import { FileText, Upload, Loader2, ChevronRight, ChevronDown } from 'lucide-react';

interface DocumentSection {
  level: number;
  title: string;
  content: string;
  children: DocumentSection[];
}

interface DocumentStructure {
  title: string;
  sections: DocumentSection[];
  rawText: string;
  pageCount: number;
  error?: string;
}

interface SimpleDocumentReaderProps {
  onDocumentAnalyzed?: (doc: DocumentStructure) => void;
}

export function SimpleDocumentReader({ onDocumentAnalyzed }: SimpleDocumentReaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentStructure | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (path: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      let text = '';
      let fileBase64: string | undefined;
      const mimeType = file.type;
      const fileName = file.name;

      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        text = await file.text();
      } else {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        fileBase64 = base64.split(',')[1];
      }

      const response = await fetch('/api/document-reader/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, fileBase64, mimeType, fileName }),
      });

      if (!response.ok) {
        throw new Error('Erro ao analisar documento');
      }

      const result: DocumentStructure = await response.json();
      setDocument(result);
      onDocumentAnalyzed?.(result);
      
      const allPaths = new Set<string>();
      result.sections.forEach((s, i) => allPaths.add(String(i)));
      setExpandedSections(allPaths);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }, [onDocumentAnalyzed]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/document-reader/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Erro ao analisar documento');
      }

      const result: DocumentStructure = await response.json();
      setDocument(result);
      onDocumentAnalyzed?.(result);
      
      const allPaths = new Set<string>();
      result.sections.forEach((s, i) => allPaths.add(String(i)));
      setExpandedSections(allPaths);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }, [onDocumentAnalyzed]);

  const renderSection = (section: DocumentSection, path: string) => {
    const isExpanded = expandedSections.has(path);
    const hasChildren = section.children && section.children.length > 0;
    const indent = (section.level - 1) * 16;

    return (
      <div key={path} style={{ marginLeft: indent }}>
        <div 
          className={`flex items-start gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer ${
            section.level === 1 ? 'bg-blue-50 border-l-4 border-blue-500' : 
            section.level === 2 ? 'bg-gray-50 border-l-2 border-gray-300' : ''
          }`}
          onClick={() => toggleSection(path)}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4 mt-1 text-gray-500" /> : <ChevronRight className="w-4 h-4 mt-1 text-gray-500" />
          ) : (
            <div className="w-4" />
          )}
          <div className="flex-1">
            <h4 className={`font-medium ${
              section.level === 1 ? 'text-lg text-blue-800' : 
              section.level === 2 ? 'text-base text-gray-800' : 'text-sm text-gray-700'
            }`}>
              {section.title}
            </h4>
            {section.content && (
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                {section.content}
              </p>
            )}
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="mt-1">
            {section.children.map((child, idx) => renderSection(child, `${path}-${idx}`))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Leitor de Documentos</h3>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          Envie um arquivo ou cole texto para organizar automaticamente
        </p>
      </div>

      <div className="p-4">
        {!document && !isLoading && (
          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
            onPaste={handlePaste}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              Arraste um arquivo aqui, cole texto (Ctrl+V), ou
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
              <Upload className="w-4 h-4" />
              Selecionar Arquivo
              <input 
                type="file" 
                className="hidden" 
                accept=".txt,.md,.doc,.docx,image/*"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Analisando documento com IA...</p>
            <p className="text-sm text-gray-400 mt-1">Identificando títulos e organizando conteúdo</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {document && !isLoading && (
          <div>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
              <div>
                <h4 className="font-semibold text-gray-900">{document.title}</h4>
                {document.error ? (
                  <p className="text-sm text-red-600">{document.error}</p>
                ) : (
                  <p className="text-sm text-gray-500">
                    {document.sections.length} seções encontradas
                  </p>
                )}
              </div>
              <button
                onClick={() => setDocument(null)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Novo documento
              </button>
            </div>

            <div className="space-y-1 max-h-96 overflow-y-auto">
              {document.sections.map((section, idx) => renderSection(section, String(idx)))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
