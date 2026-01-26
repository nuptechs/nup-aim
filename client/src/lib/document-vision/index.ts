/**
 * DocumentVision - Módulo de Visão Computacional para Documentos
 * 
 * Este módulo é totalmente encapsulado e pode ser copiado para qualquer projeto React.
 * Ele usa tecnologia de ponta em reconhecimento de padrões visuais para analisar
 * documentos como um ser humano faria.
 * 
 * ## Instalação
 * 
 * 1. Copie a pasta `document-vision` para `src/lib/` do seu projeto
 * 2. Pronto! Não há dependências externas além de React
 * 
 * ## Uso Básico
 * 
 * ```tsx
 * import { DocumentScanner, DocumentAnalysisResult, useDocumentVision } from '@/lib/document-vision';
 * 
 * function MyComponent() {
 *   const { document, processImage } = useDocumentVision();
 * 
 *   return (
 *     <div>
 *       <DocumentScanner onDocumentScanned={(doc) => console.log(doc)} />
 *       {document && <DocumentAnalysisResult document={document} />}
 *     </div>
 *   );
 * }
 * ```
 * 
 * ## Funcionalidades
 * 
 * - Captura via câmera em tempo real
 * - Upload de arquivos (arrastar e soltar)
 * - Detecção automática de regiões (títulos, tabelas, parágrafos, etc.)
 * - Classificação de tipo de documento
 * - Análise de qualidade de imagem
 * - Overlay visual das regiões detectadas
 * 
 * @version 1.0.0
 * @author NuP_AIM Team
 */

// Core
export { VisionEngine, createVisionEngine } from './core/VisionEngine';
export { OCREngine, createOCREngine, type OCRResult, type OCRBlock } from './core/OCREngine';
export { PDFProcessor, createPDFProcessor, type PDFPage, type PDFProcessResult } from './core/PDFProcessor';

// Hooks
export { useCamera } from './hooks/useCamera';
export { useDocumentVision } from './hooks/useDocumentVision';

// Components
export { DocumentScanner } from './components/DocumentScanner';
export { DocumentAnalysisResult } from './components/DocumentAnalysisResult';
export { DocumentVisionDemo } from './components/DocumentVisionDemo';
export type { ExtractedDocumentData } from './components/DocumentVisionDemo';

// Types
export type {
  BoundingBox,
  DetectedRegion,
  RegionType,
  DocumentStructure,
  DocumentType,
  HierarchyNode,
  DocumentMetadata,
  VisionConfig,
  ProcessingResult,
  CameraConfig,
  InputSource,
  InputData
} from './types';

// Utils
export {
  generateId,
  loadImage,
  imageToCanvas,
  canvasToBlob,
  canvasToBase64,
  getImageData,
  applyGrayscale,
  applyThreshold,
  detectEdges,
  findContours,
  assessImageQuality
} from './utils/imageProcessing';
