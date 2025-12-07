import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, FileText, X, CheckCircle, AlertCircle, 
  Loader2, ArrowLeft, FileUp, Info
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';

interface TemplateUploadProps {
  onComplete: (template: any) => void;
  onCancel: () => void;
}

export const TemplateUpload: React.FC<TemplateUploadProps> = ({ onComplete, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }, []);

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.docx')) {
      setError('Por favor, selecione um arquivo Word (.docx)');
      return;
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('O arquivo não pode ter mais de 10MB');
      return;
    }
    
    setFile(selectedFile);
    
    if (!name) {
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, '');
      setName(fileName);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !name.trim()) {
      setError('Nome e arquivo são obrigatórios');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      
      reader.onload = async () => {
        const base64Content = reader.result?.toString().split(',')[1];
        
        if (!base64Content) {
          setError('Erro ao processar o arquivo');
          setIsUploading(false);
          return;
        }

        try {
          const response = await apiClient.post('/api/templates', {
            name: name.trim(),
            description: description.trim(),
            fileName: file.name,
            fileContent: base64Content
          });

          if (response.success) {
            onComplete(response.template);
          } else {
            setError(response.error || 'Erro ao fazer upload do template');
          }
        } catch (err: any) {
          setError(err.message || 'Erro ao fazer upload do template');
        } finally {
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        setError('Erro ao ler o arquivo');
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer upload');
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para lista de templates
        </button>

        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl">
                <FileUp className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="text-xl text-white">Novo Modelo de Documento</CardTitle>
                <p className="text-primary-100 mt-1">
                  Faça upload de um documento Word com marcadores #$campo#$
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : file
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileSelect}
                className="hidden"
              />

              {file ? (
                <div className="flex items-center justify-center gap-4">
                  <div className="p-4 bg-green-100 dark:bg-green-900/40 rounded-xl">
                    <FileText className="w-10 h-10 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full w-fit mx-auto mb-4">
                    <Upload className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {isDragging ? 'Solte o arquivo aqui' : 'Arraste e solte seu documento'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ou clique para selecionar um arquivo .docx (máx. 10MB)
                  </p>
                </>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do Template *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Modelo Área Comercial"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição (opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descreva o propósito deste template..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  <p className="font-medium mb-1">Dica: Como criar marcadores</p>
                  <p>No seu documento Word, insira marcadores no formato <code className="bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">#$nome_do_campo#$</code></p>
                  <p className="mt-1">Exemplo: <code className="bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">#$titulo#$</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">#$autor#$</code>, <code className="bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">#$descricao#$</code></p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={onCancel}
                disabled={isUploading}
                className="flex-1 py-3 px-6 border border-gray-200 dark:border-gray-700 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || !name.trim() || isUploading}
                className="flex-1 py-3 px-6 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analisando documento...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Fazer Upload e Analisar
                  </>
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TemplateUpload;
