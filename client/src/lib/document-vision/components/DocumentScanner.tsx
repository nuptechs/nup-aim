import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useDocumentVision } from '../hooks/useDocumentVision';
import type { DocumentStructure, DetectedRegion, VisionConfig } from '../types';

interface DocumentScannerProps {
  onDocumentScanned?: (document: DocumentStructure) => void;
  onError?: (error: string) => void;
  config?: Partial<VisionConfig>;
  showOverlay?: boolean;
  autoCapture?: boolean;
  autoCaptureDelay?: number;
  className?: string;
  labels?: {
    startCamera?: string;
    stopCamera?: string;
    capture?: string;
    switchCamera?: string;
    processing?: string;
    uploadFile?: string;
    dragDrop?: string;
  };
}

const defaultLabels = {
  startCamera: 'Iniciar Câmera',
  stopCamera: 'Parar Câmera',
  capture: 'Capturar',
  switchCamera: 'Trocar Câmera',
  processing: 'Processando...',
  uploadFile: 'Enviar Arquivo',
  dragDrop: 'Arraste um documento aqui ou clique para selecionar'
};

export const DocumentScanner: React.FC<DocumentScannerProps> = ({
  onDocumentScanned,
  onError,
  config,
  showOverlay = true,
  autoCapture = false,
  autoCaptureDelay = 2000,
  className = '',
  labels: customLabels
}) => {
  const labels = { ...defaultLabels, ...customLabels };
  const [mode, setMode] = useState<'camera' | 'file'>('file');
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoCaptureTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    videoRef, 
    canvasRef, 
    isStreaming, 
    error: cameraError,
    startCamera, 
    stopCamera, 
    captureFrame,
    switchCamera 
  } = useCamera();
  
  const { 
    isProcessing, 
    document, 
    error: visionError,
    processImage, 
    processVideo,
    reset 
  } = useDocumentVision(config);
  
  useEffect(() => {
    if (document && onDocumentScanned) {
      onDocumentScanned(document);
    }
  }, [document, onDocumentScanned]);
  
  useEffect(() => {
    const error = cameraError || visionError;
    if (error && onError) {
      onError(error);
    }
  }, [cameraError, visionError, onError]);
  
  useEffect(() => {
    if (autoCapture && isStreaming && !isProcessing) {
      autoCaptureTimerRef.current = setTimeout(async () => {
        if (videoRef.current) {
          await processVideo(videoRef.current);
        }
      }, autoCaptureDelay);
    }
    
    return () => {
      if (autoCaptureTimerRef.current) {
        clearTimeout(autoCaptureTimerRef.current);
      }
    };
  }, [autoCapture, isStreaming, isProcessing, autoCaptureDelay, processVideo, videoRef]);
  
  const handleCapture = useCallback(async () => {
    if (videoRef.current) {
      const frame = captureFrame();
      if (frame) {
        setPreviewUrl(frame);
        await processImage(frame);
      }
    }
  }, [captureFrame, processImage, videoRef]);
  
  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      onError?.('Tipo de arquivo não suportado. Use imagens ou PDF.');
      return;
    }
    
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    await processImage(file);
  }, [processImage, onError]);
  
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const handleReset = useCallback(() => {
    reset();
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [reset]);
  
  const renderRegionOverlay = (regions: DetectedRegion[]) => {
    if (!showOverlay || !previewUrl) return null;
    
    return (
      <svg 
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 10 }}
      >
        {regions.map((region) => {
          const colors: Record<string, string> = {
            title: '#22c55e',
            subtitle: '#84cc16',
            paragraph: '#3b82f6',
            table: '#f59e0b',
            form_field: '#8b5cf6',
            signature: '#ec4899',
            image: '#06b6d4',
            header: '#6366f1',
            footer: '#64748b',
            unknown: '#94a3b8'
          };
          
          const color = colors[region.type] || colors.unknown;
          const { x, y, width, height } = region.boundingBox;
          
          return (
            <g key={region.id}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={color}
                fillOpacity={0.2}
                stroke={color}
                strokeWidth={2}
              />
              <text
                x={x + 4}
                y={y + 16}
                fill={color}
                fontSize={12}
                fontWeight="bold"
              >
                {region.type} ({Math.round(region.confidence * 100)}%)
              </text>
            </g>
          );
        })}
      </svg>
    );
  };
  
  return (
    <div className={`document-scanner ${className}`}>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setMode('file'); stopCamera(); }}
          className={`px-4 py-2 rounded-lg transition-colors ${
            mode === 'file' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📁 Arquivo
        </button>
        <button
          onClick={() => setMode('camera')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            mode === 'camera' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📷 Câmera
        </button>
      </div>
      
      {mode === 'file' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragging 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileInputChange}
            className="hidden"
          />
          
          {previewUrl ? (
            <div className="relative">
              <img 
                src={previewUrl} 
                alt="Preview" 
                className="max-h-96 mx-auto rounded-lg"
              />
              {document && renderRegionOverlay(document.regions)}
            </div>
          ) : (
            <div className="py-12">
              <div className="text-5xl mb-4">📄</div>
              <p className="text-gray-600">{labels.dragDrop}</p>
              <p className="text-sm text-gray-400 mt-2">
                Suporta: JPG, PNG, PDF
              </p>
            </div>
          )}
        </div>
      )}
      
      {mode === 'camera' && (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full rounded-xl ${isStreaming ? '' : 'hidden'}`}
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {!isStreaming && (
            <div className="bg-gray-900 rounded-xl p-12 text-center">
              <div className="text-5xl mb-4">📷</div>
              <p className="text-gray-400">Câmera não iniciada</p>
            </div>
          )}
          
          {isStreaming && document && renderRegionOverlay(document.regions)}
          
          <div className="flex gap-2 mt-4">
            {!isStreaming ? (
              <button
                onClick={startCamera}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {labels.startCamera}
              </button>
            ) : (
              <>
                <button
                  onClick={stopCamera}
                  className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  {labels.stopCamera}
                </button>
                <button
                  onClick={handleCapture}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? labels.processing : labels.capture}
                </button>
                <button
                  onClick={switchCamera}
                  className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  🔄
                </button>
              </>
            )}
          </div>
        </div>
      )}
      
      {isProcessing && (
        <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span>{labels.processing}</span>
        </div>
      )}
      
      {(cameraError || visionError) && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {cameraError || visionError}
        </div>
      )}
      
      {document && (
        <div className="mt-4">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            ← Limpar e recomeçar
          </button>
        </div>
      )}
    </div>
  );
};
