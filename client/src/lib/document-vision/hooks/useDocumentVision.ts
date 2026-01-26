import { useState, useCallback, useRef } from 'react';
import { VisionEngine } from '../core/VisionEngine';
import type { VisionConfig, ProcessingResult, DocumentStructure } from '../types';

interface UseDocumentVisionReturn {
  isProcessing: boolean;
  result: ProcessingResult | null;
  document: DocumentStructure | null;
  error: string | null;
  processImage: (source: string | File | Blob) => Promise<ProcessingResult>;
  processVideo: (video: HTMLVideoElement) => Promise<ProcessingResult>;
  reset: () => void;
}

export function useDocumentVision(config?: Partial<VisionConfig>): UseDocumentVisionReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const engineRef = useRef<VisionEngine | null>(null);
  
  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new VisionEngine(config);
    }
    return engineRef.current;
  }, [config]);
  
  const processImage = useCallback(async (source: string | File | Blob): Promise<ProcessingResult> => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const engine = getEngine();
      const processingResult = await engine.processImage(source);
      
      setResult(processingResult);
      
      if (!processingResult.success) {
        setError(processingResult.error || 'Processing failed');
      }
      
      return processingResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      const errorResult: ProcessingResult = { success: false, error: message };
      setResult(errorResult);
      return errorResult;
    } finally {
      setIsProcessing(false);
    }
  }, [getEngine]);
  
  const processVideo = useCallback(async (video: HTMLVideoElement): Promise<ProcessingResult> => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const engine = getEngine();
      const processingResult = await engine.processVideo(video);
      
      setResult(processingResult);
      
      if (!processingResult.success) {
        setError(processingResult.error || 'Processing failed');
      }
      
      return processingResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      const errorResult: ProcessingResult = { success: false, error: message };
      setResult(errorResult);
      return errorResult;
    } finally {
      setIsProcessing(false);
    }
  }, [getEngine]);
  
  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsProcessing(false);
  }, []);
  
  return {
    isProcessing,
    result,
    document: result?.document || null,
    error,
    processImage,
    processVideo,
    reset
  };
}
