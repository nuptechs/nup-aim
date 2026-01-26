import { useState, useRef, useCallback, useEffect } from 'react';
import type { CameraConfig } from '../types';

const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  width: 1280,
  height: 720,
  facingMode: 'environment',
  frameRate: 30
};

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureFrame: () => string | null;
  switchCamera: () => Promise<void>;
}

export function useCamera(config: Partial<CameraConfig> = {}): UseCameraReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
    config.facingMode || DEFAULT_CAMERA_CONFIG.facingMode
  );
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const mergedConfig = { ...DEFAULT_CAMERA_CONFIG, ...config, facingMode };
  
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);
  
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      stopCamera();
      
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: mergedConfig.width },
          height: { ideal: mergedConfig.height },
          facingMode: mergedConfig.facingMode,
          frameRate: { ideal: mergedConfig.frameRate }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access camera';
      setError(message);
      console.error('[DocumentVision] Camera error:', err);
    }
  }, [mergedConfig, stopCamera]);
  
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) {
      return null;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.92);
  }, [isStreaming]);
  
  const switchCamera = useCallback(async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    if (isStreaming) {
      stopCamera();
      setTimeout(() => startCamera(), 100);
    }
  }, [facingMode, isStreaming, stopCamera, startCamera]);
  
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);
  
  return {
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
    isStreaming,
    error,
    startCamera,
    stopCamera,
    captureFrame,
    switchCamera
  };
}
