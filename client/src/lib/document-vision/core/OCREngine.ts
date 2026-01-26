import Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  blocks: OCRBlock[];
  processingTime: number;
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  blockType: 'paragraph' | 'line' | 'word';
}

export class OCREngine {
  private worker: Tesseract.Worker | null = null;
  private initialized = false;
  private language: string;
  
  constructor(language = 'por') {
    this.language = language;
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.worker = await Tesseract.createWorker(this.language, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      this.initialized = true;
      console.log('[OCR] Tesseract initialized');
    } catch (error) {
      console.error('[OCR] Failed to initialize:', error);
      throw error;
    }
  }
  
  async recognize(image: string | File | Blob | HTMLCanvasElement): Promise<OCRResult> {
    const startTime = performance.now();
    
    await this.initialize();
    
    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }
    
    try {
      const result = await this.worker.recognize(image);
      const processingTime = performance.now() - startTime;
      
      const blocks: OCRBlock[] = [];
      
      const paragraphs = (result.data as any).paragraphs;
      if (paragraphs && Array.isArray(paragraphs)) {
        for (const paragraph of paragraphs) {
          blocks.push({
            text: paragraph.text,
            confidence: paragraph.confidence,
            bbox: paragraph.bbox,
            blockType: 'paragraph'
          });
        }
      }
      
      return {
        text: result.data.text,
        confidence: result.data.confidence,
        blocks,
        processingTime
      };
    } catch (error) {
      console.error('[OCR] Recognition failed:', error);
      throw error;
    }
  }
  
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initialized = false;
    }
  }
}

export const createOCREngine = (language?: string) => new OCREngine(language);
