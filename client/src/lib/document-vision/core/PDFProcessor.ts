import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PDFPage {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface PDFProcessResult {
  pages: PDFPage[];
  pageCount: number;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creationDate?: Date;
  };
}

export class PDFProcessor {
  private scale: number;
  
  constructor(scale = 2.0) {
    this.scale = scale;
  }
  
  async process(source: File | ArrayBuffer | string): Promise<PDFProcessResult> {
    let data: ArrayBuffer | string;
    
    if (source instanceof File) {
      data = await source.arrayBuffer();
    } else {
      data = source;
    }
    
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    
    const pages: PDFPage[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: this.scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas
      } as any).promise;
      
      pages.push({
        pageNumber: i,
        canvas,
        width: viewport.width,
        height: viewport.height
      });
    }
    
    let metadata;
    try {
      const meta = await pdf.getMetadata();
      if (meta.info) {
        metadata = {
          title: (meta.info as any).Title,
          author: (meta.info as any).Author,
          subject: (meta.info as any).Subject,
          creationDate: (meta.info as any).CreationDate ? new Date((meta.info as any).CreationDate) : undefined
        };
      }
    } catch {
      // Metadata not available
    }
    
    return {
      pages,
      pageCount: pdf.numPages,
      metadata
    };
  }
  
  async processFirstPage(source: File | ArrayBuffer | string): Promise<PDFPage | null> {
    const result = await this.process(source);
    return result.pages[0] || null;
  }
}

export const createPDFProcessor = (scale?: number) => new PDFProcessor(scale);
