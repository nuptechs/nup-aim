export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedRegion {
  id: string;
  type: RegionType;
  boundingBox: BoundingBox;
  confidence: number;
  content?: string;
  children?: DetectedRegion[];
}

export type RegionType = 
  | 'title'
  | 'subtitle'
  | 'paragraph'
  | 'table'
  | 'table_cell'
  | 'list'
  | 'list_item'
  | 'image'
  | 'diagram'
  | 'signature'
  | 'header'
  | 'footer'
  | 'form_field'
  | 'checkbox'
  | 'unknown';

export interface DocumentStructure {
  id: string;
  type: DocumentType;
  confidence: number;
  regions: DetectedRegion[];
  hierarchy: HierarchyNode[];
  metadata: DocumentMetadata;
  rawText?: string;
}

export type DocumentType =
  | 'requirements'
  | 'contract'
  | 'meeting_notes'
  | 'technical_spec'
  | 'user_story'
  | 'form'
  | 'report'
  | 'unknown';

export interface HierarchyNode {
  id: string;
  type: RegionType;
  level: number;
  title?: string;
  content?: string;
  children: HierarchyNode[];
  regionRef: string;
}

export interface DocumentMetadata {
  pageCount: number;
  language: string;
  orientation: 'portrait' | 'landscape';
  quality: 'low' | 'medium' | 'high';
  processingTime: number;
}

export interface VisionConfig {
  enableGPU: boolean;
  confidenceThreshold: number;
  maxRegions: number;
  detectTables: boolean;
  detectForms: boolean;
  detectSignatures: boolean;
  language: string;
}

export interface ProcessingResult {
  success: boolean;
  document?: DocumentStructure;
  error?: string;
  warnings?: string[];
}

export interface CameraConfig {
  width: number;
  height: number;
  facingMode: 'user' | 'environment';
  frameRate: number;
}

export type InputSource = 'camera' | 'file' | 'url' | 'base64';

export interface InputData {
  source: InputSource;
  data: File | string | Blob;
  mimeType?: string;
}
