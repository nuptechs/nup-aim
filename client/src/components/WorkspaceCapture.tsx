import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Image, Loader2, X } from 'lucide-react';
import { WorkspaceInput } from '../types';

interface WorkspaceCaptureProps {
  onAnalyze: (inputs: WorkspaceInput[]) => Promise<void>;
  isAnalyzing: boolean;
}

export const WorkspaceCapture: React.FC<WorkspaceCaptureProps> = ({ onAnalyze, isAnalyzing }) => {
  const [inputs, setInputs] = useState<WorkspaceInput[]>([]);
  const [textInput, setTextInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const newInput: WorkspaceInput = {
              id: Date.now().toString(),
              type: 'image',
              content: event.target?.result as string,
              mimeType: file.type,
              fileName: `imagem_${Date.now()}.png`,
              timestamp: new Date().toISOString()
            };
            setInputs(prev => [...prev, newInput]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const isImage = file.type.startsWith('image/');
        
        const newInput: WorkspaceInput = {
          id: Date.now().toString() + Math.random(),
          type: isImage ? 'image' : 'document',
          content: event.target?.result as string,
          fileName: file.name,
          mimeType: file.type,
          timestamp: new Date().toISOString()
        };
        
        setInputs(prev => [...prev, newInput]);
      };
      
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const isImage = file.type.startsWith('image/');
        
        const newInput: WorkspaceInput = {
          id: Date.now().toString() + Math.random(),
          type: isImage ? 'image' : 'document',
          content: event.target?.result as string,
          fileName: file.name,
          mimeType: file.type,
          timestamp: new Date().toISOString()
        };
        
        setInputs(prev => [...prev, newInput]);
      };
      
      reader.readAsDataURL(file);
    });
  }, []);

  const removeInput = (id: string) => {
    setInputs(prev => prev.filter(input => input.id !== id));
  };

  const handleAnalyze = async () => {
    if (inputs.length === 0 && !textInput.trim()) return;
    
    let allInputs = [...inputs];
    if (textInput.trim()) {
      allInputs.push({
        id: Date.now().toString(),
        type: 'text',
        content: textInput,
        timestamp: new Date().toISOString()
      });
    }
    
    await onAnalyze(allInputs);
    setInputs([]);
    setTextInput('');
  };

  const getInputIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4 text-blue-500" />;
      case 'document': return <FileText className="w-4 h-4 text-orange-500" />;
      default: return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const hasContent = inputs.length > 0 || textInput.trim();

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Descreva o trabalho realizado
          </label>
          <textarea
            ref={textAreaRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onPaste={handlePaste}
            rows={8}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
            placeholder="Cole aqui requisitos, especificações, prints de tela ou documentos...

Exemplo: 
- Criamos uma tela de cadastro de clientes com campos nome, CPF, email e telefone
- Alteramos o relatório de vendas para incluir filtro por período"
          />
        </div>

        <div className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-400 dark:hover:border-purple-500 transition-colors bg-gray-50 dark:bg-gray-700/50">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Image className="w-5 h-5 text-gray-400" />
              <FileText className="w-5 h-5 text-gray-400" />
              <Upload className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Arraste arquivos aqui ou
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.docx,.doc,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Carregar Arquivos
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Imagens (PNG, JPG), PDF, Word (DOCX), TXT
            </p>
          </div>
        </div>

        {inputs.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Conteúdo capturado ({inputs.length} item{inputs.length !== 1 ? 's' : ''})
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {inputs.map(input => (
                <div 
                  key={input.id} 
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  {getInputIcon(input.type)}
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                    {input.type === 'image' 
                      ? (input.fileName || 'Imagem colada')
                      : input.type === 'document'
                      ? input.fileName
                      : input.content.substring(0, 50) + (input.content.length > 50 ? '...' : '')}
                  </span>
                  <button
                    onClick={() => removeInput(input.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleAnalyze}
          disabled={!hasContent || isAnalyzing}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Extraindo funcionalidades...
            </>
          ) : (
            'Extrair Funcionalidades'
          )}
        </button>
      </div>
    </div>
  );
};
