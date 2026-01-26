import type { 
  VisionConfig, 
  ProcessingResult, 
  DocumentStructure,
  DetectedRegion,
  RegionType,
  DocumentType,
  HierarchyNode,
  BoundingBox
} from '../types';
import { 
  loadImage, 
  imageToCanvas, 
  getImageData, 
  applyGrayscale,
  detectEdges,
  findContours,
  assessImageQuality,
  generateId
} from '../utils/imageProcessing';
import { OCREngine, type OCRResult } from './OCREngine';
import { PDFProcessor } from './PDFProcessor';

const DEFAULT_CONFIG: VisionConfig = {
  enableGPU: true,
  confidenceThreshold: 0.5,
  maxRegions: 100,
  detectTables: true,
  detectForms: true,
  detectSignatures: true,
  language: 'pt-BR'
};

export class VisionEngine {
  private config: VisionConfig;
  private initialized: boolean = false;
  private ocrEngine: OCREngine;
  private pdfProcessor: PDFProcessor;
  
  constructor(config: Partial<VisionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.ocrEngine = new OCREngine(this.config.language === 'pt-BR' ? 'por' : 'eng');
    this.pdfProcessor = new PDFProcessor(2.0);
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }
  
  async processImage(source: string | File | Blob): Promise<ProcessingResult> {
    const startTime = performance.now();
    
    try {
      await this.initialize();
      
      let canvas: HTMLCanvasElement;
      let isPDF = false;
      
      if (source instanceof File && source.type === 'application/pdf') {
        isPDF = true;
        const pdfPage = await this.pdfProcessor.processFirstPage(source);
        if (!pdfPage) {
          return { success: false, error: 'Failed to process PDF' };
        }
        canvas = pdfPage.canvas;
      } else {
        const image = await loadImage(source);
        canvas = imageToCanvas(image);
      }
      
      const imageData = getImageData(canvas);
      const quality = assessImageQuality(imageData);
      
      const grayData = applyGrayscale(new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      ));
      const edges = detectEdges(grayData);
      const contours = findContours(edges);
      
      const regions = await this.classifyRegions(contours, canvas);
      
      let ocrResult: OCRResult | null = null;
      let rawText = '';
      
      try {
        ocrResult = await this.ocrEngine.recognize(canvas);
        rawText = ocrResult.text;
        
        if (ocrResult.blocks.length > 0) {
          for (const block of ocrResult.blocks) {
            const blockRegion: DetectedRegion = {
              id: generateId(),
              type: 'paragraph',
              boundingBox: {
                x: block.bbox.x0,
                y: block.bbox.y0,
                width: block.bbox.x1 - block.bbox.x0,
                height: block.bbox.y1 - block.bbox.y0
              },
              confidence: block.confidence / 100,
              content: block.text
            };
            
            const existingRegion = regions.find(r => 
              this.regionsOverlap(r.boundingBox, blockRegion.boundingBox)
            );
            
            if (existingRegion) {
              existingRegion.content = block.text;
            } else {
              regions.push(blockRegion);
            }
          }
        }
      } catch (ocrError) {
        console.warn('[VisionEngine] OCR failed, continuing without text extraction:', ocrError);
      }
      
      const documentType = this.detectDocumentType(regions, rawText);
      const hierarchy = this.buildHierarchy(regions);
      
      const processingTime = performance.now() - startTime;
      
      const document: DocumentStructure = {
        id: generateId(),
        type: documentType,
        confidence: this.calculateOverallConfidence(regions),
        regions,
        hierarchy,
        metadata: {
          pageCount: isPDF ? 1 : 1,
          language: this.config.language,
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          quality,
          processingTime
        },
        rawText
      };
      
      return { success: true, document };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
  
  private regionsOverlap(a: BoundingBox, b: BoundingBox): boolean {
    const margin = 20;
    return !(
      a.x + a.width + margin < b.x ||
      b.x + b.width + margin < a.x ||
      a.y + a.height + margin < b.y ||
      b.y + b.height + margin < a.y
    );
  }
  
  async processVideo(video: HTMLVideoElement): Promise<ProcessingResult> {
    const canvas = imageToCanvas(video);
    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    return this.processImage(base64);
  }
  
  private async classifyRegions(
    contours: BoundingBox[], 
    canvas: HTMLCanvasElement
  ): Promise<DetectedRegion[]> {
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;
    const regions: DetectedRegion[] = [];
    
    const sortedContours = [...contours].sort((a, b) => {
      const aY = a.y / height;
      const bY = b.y / height;
      if (Math.abs(aY - bY) < 0.05) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });
    
    for (const box of sortedContours.slice(0, this.config.maxRegions)) {
      const regionType = this.classifyRegionType(box, width, height, ctx);
      const confidence = this.calculateRegionConfidence(box, regionType, width, height);
      
      if (confidence >= this.config.confidenceThreshold) {
        regions.push({
          id: generateId(),
          type: regionType,
          boundingBox: box,
          confidence
        });
      }
    }
    
    return regions;
  }
  
  private classifyRegionType(
    box: BoundingBox, 
    canvasWidth: number, 
    canvasHeight: number,
    ctx: CanvasRenderingContext2D
  ): RegionType {
    const { x, y, width, height } = box;
    const aspectRatio = width / height;
    const relativeWidth = width / canvasWidth;
    const relativeHeight = height / canvasHeight;
    const relativeY = y / canvasHeight;
    const relativeX = x / canvasWidth;
    
    if (relativeY < 0.1 && relativeWidth > 0.5) {
      return 'header';
    }
    
    if (relativeY > 0.9) {
      return 'footer';
    }
    
    if (relativeY < 0.15 && relativeWidth > 0.3 && relativeHeight < 0.08) {
      return 'title';
    }
    
    if (relativeHeight < 0.05 && relativeWidth > 0.2 && relativeWidth < 0.6) {
      return 'subtitle';
    }
    
    if (this.config.detectTables && this.looksLikeTable(box, ctx)) {
      return 'table';
    }
    
    if (aspectRatio > 0.8 && aspectRatio < 1.2 && relativeWidth < 0.3) {
      return 'image';
    }
    
    if (this.config.detectForms && relativeHeight < 0.04 && relativeWidth < 0.4) {
      return 'form_field';
    }
    
    if (this.config.detectSignatures && this.looksLikeSignature(box, canvasWidth, canvasHeight)) {
      return 'signature';
    }
    
    if (relativeHeight < 0.03 && relativeWidth < 0.05) {
      return 'list_item';
    }
    
    if (relativeWidth > 0.6 && relativeHeight > 0.05) {
      return 'paragraph';
    }
    
    return 'unknown';
  }
  
  private looksLikeTable(box: BoundingBox, ctx: CanvasRenderingContext2D): boolean {
    try {
      const imageData = ctx.getImageData(box.x, box.y, box.width, box.height);
      const { data, width, height } = imageData;
      
      let horizontalLines = 0;
      let verticalLines = 0;
      
      for (let y = 0; y < height; y += 5) {
        let consecutivePixels = 0;
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          if (brightness < 100) {
            consecutivePixels++;
          } else {
            if (consecutivePixels > width * 0.5) horizontalLines++;
            consecutivePixels = 0;
          }
        }
      }
      
      for (let x = 0; x < width; x += 5) {
        let consecutivePixels = 0;
        for (let y = 0; y < height; y++) {
          const idx = (y * width + x) * 4;
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          if (brightness < 100) {
            consecutivePixels++;
          } else {
            if (consecutivePixels > height * 0.3) verticalLines++;
            consecutivePixels = 0;
          }
        }
      }
      
      return horizontalLines >= 2 && verticalLines >= 2;
    } catch {
      return false;
    }
  }
  
  private looksLikeSignature(box: BoundingBox, canvasWidth: number, canvasHeight: number): boolean {
    const relativeY = box.y / canvasHeight;
    const relativeWidth = box.width / canvasWidth;
    const aspectRatio = box.width / box.height;
    
    return relativeY > 0.7 && relativeWidth > 0.15 && relativeWidth < 0.4 && aspectRatio > 2;
  }
  
  private calculateRegionConfidence(
    box: BoundingBox, 
    type: RegionType,
    canvasWidth: number,
    canvasHeight: number
  ): number {
    let confidence = 0.7;
    
    const relativeArea = (box.width * box.height) / (canvasWidth * canvasHeight);
    if (relativeArea > 0.001 && relativeArea < 0.5) {
      confidence += 0.1;
    }
    
    const aspectRatio = box.width / box.height;
    if (type === 'paragraph' && aspectRatio > 2) confidence += 0.1;
    if (type === 'title' && aspectRatio > 3) confidence += 0.1;
    if (type === 'table' && aspectRatio > 0.5 && aspectRatio < 3) confidence += 0.1;
    
    return Math.min(1, confidence);
  }
  
  private detectDocumentType(regions: DetectedRegion[], rawText: string): DocumentType {
    const typeCount: Record<RegionType, number> = {} as Record<RegionType, number>;
    
    for (const region of regions) {
      typeCount[region.type] = (typeCount[region.type] || 0) + 1;
    }
    
    const textLower = rawText.toLowerCase();
    
    if (textLower.includes('requisito') || textLower.includes('funcionalidade') || textLower.includes('caso de uso')) {
      return 'requirements';
    }
    if (textLower.includes('contrato') || textLower.includes('cláusula') || textLower.includes('partes')) {
      return 'contract';
    }
    if (textLower.includes('ata') || textLower.includes('reunião') || textLower.includes('participantes')) {
      return 'meeting_notes';
    }
    if (textLower.includes('especificação') || textLower.includes('arquitetura') || textLower.includes('diagrama')) {
      return 'technical_spec';
    }
    
    if (typeCount.form_field >= 5) return 'form';
    if (typeCount.table >= 3) return 'report';
    if (typeCount.signature && typeCount.paragraph >= 5) return 'contract';
    if (typeCount.list_item >= 10) return 'requirements';
    if (typeCount.paragraph >= 3 && typeCount.title) return 'technical_spec';
    
    return 'unknown';
  }
  
  private buildHierarchy(regions: DetectedRegion[]): HierarchyNode[] {
    const hierarchy: HierarchyNode[] = [];
    let currentSection: HierarchyNode | null = null;
    
    const sortedRegions = [...regions].sort((a, b) => a.boundingBox.y - b.boundingBox.y);
    
    for (const region of sortedRegions) {
      const node: HierarchyNode = {
        id: generateId(),
        type: region.type,
        level: this.getHierarchyLevel(region.type),
        content: region.content,
        children: [],
        regionRef: region.id
      };
      
      if (region.type === 'title' || region.type === 'header') {
        if (currentSection) {
          hierarchy.push(currentSection);
        }
        currentSection = node;
      } else if (currentSection) {
        currentSection.children.push(node);
      } else {
        hierarchy.push(node);
      }
    }
    
    if (currentSection) {
      hierarchy.push(currentSection);
    }
    
    return hierarchy;
  }
  
  private getHierarchyLevel(type: RegionType): number {
    const levels: Record<RegionType, number> = {
      header: 0,
      title: 1,
      subtitle: 2,
      paragraph: 3,
      table: 3,
      list: 3,
      list_item: 4,
      table_cell: 4,
      form_field: 3,
      checkbox: 4,
      image: 3,
      diagram: 3,
      signature: 3,
      footer: 5,
      unknown: 3
    };
    return levels[type];
  }
  
  private calculateOverallConfidence(regions: DetectedRegion[]): number {
    if (regions.length === 0) return 0;
    const sum = regions.reduce((acc, r) => acc + r.confidence, 0);
    return sum / regions.length;
  }
  
  getConfig(): VisionConfig {
    return { ...this.config };
  }
  
  updateConfig(config: Partial<VisionConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  async terminate(): Promise<void> {
    await this.ocrEngine.terminate();
  }
}

export const createVisionEngine = (config?: Partial<VisionConfig>) => new VisionEngine(config);
