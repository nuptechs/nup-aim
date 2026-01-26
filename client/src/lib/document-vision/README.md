# DocumentVision v2.0

Módulo de visão computacional para análise inteligente de documentos com OCR e suporte a PDF.

## Filosofia

Este módulo implementa a abordagem "Olhos Humanos" - analisa documentos da mesma forma que um ser humano faria:

1. **Olhar** - Captura a imagem completa
2. **Focar** - Detecta regiões de interesse (títulos, tabelas, parágrafos)
3. **Entender** - Classifica cada região e entende a estrutura
4. **Lembrar** - Identifica padrões baseado em documentos similares

## Instalação

Copie esta pasta para `src/lib/` do seu projeto.

### Dependências necessárias:
```bash
npm install tesseract.js pdfjs-dist @tensorflow/tfjs @tensorflow-models/coco-ssd
```

```
src/
  lib/
    document-vision/     <- Copie aqui
      core/
      components/
      hooks/
      types/
      utils/
      index.ts
```

## Uso Rápido

```tsx
import { DocumentScanner, DocumentAnalysisResult } from '@/lib/document-vision';

function App() {
  const [doc, setDoc] = useState(null);

  return (
    <div>
      <DocumentScanner onDocumentScanned={setDoc} />
      {doc && <DocumentAnalysisResult document={doc} />}
    </div>
  );
}
```

## Componentes

### DocumentScanner

Scanner completo com suporte a câmera e upload de arquivos.

```tsx
<DocumentScanner
  onDocumentScanned={(doc) => console.log(doc)}
  onError={(err) => console.error(err)}
  showOverlay={true}           // Mostra overlay visual das regiões
  autoCapture={false}          // Captura automática via câmera
  autoCaptureDelay={2000}      // Delay para auto-captura
  config={{
    confidenceThreshold: 0.5,  // Confiança mínima para detectar região
    detectTables: true,        // Detectar tabelas
    detectForms: true,         // Detectar formulários
    detectSignatures: true     // Detectar assinaturas
  }}
  labels={{
    startCamera: 'Iniciar Câmera',
    capture: 'Capturar',
    uploadFile: 'Enviar Arquivo'
  }}
/>
```

### DocumentAnalysisResult

Exibe o resultado da análise de forma estruturada.

```tsx
<DocumentAnalysisResult 
  document={document} 
  showDetails={true}  // Mostra estrutura hierárquica
/>
```

## Hooks

### useDocumentVision

Hook para processar imagens programaticamente.

```tsx
const { 
  isProcessing,      // Boolean: está processando?
  document,          // DocumentStructure: resultado
  error,             // string: erro se houver
  processImage,      // (source) => Promise: processa imagem
  processVideo,      // (video) => Promise: processa frame de vídeo
  reset              // () => void: limpa resultado
} = useDocumentVision();
```

### useCamera

Hook para controle de câmera.

```tsx
const {
  videoRef,          // Ref para elemento <video>
  canvasRef,         // Ref para elemento <canvas>
  isStreaming,       // Boolean: câmera ativa?
  error,             // string: erro se houver
  startCamera,       // () => Promise: inicia câmera
  stopCamera,        // () => void: para câmera
  captureFrame,      // () => string: captura frame como base64
  switchCamera       // () => Promise: troca câmera frontal/traseira
} = useCamera();
```

## Tipos de Região Detectados

| Tipo | Descrição |
|------|-----------|
| `title` | Título principal |
| `subtitle` | Subtítulo |
| `paragraph` | Parágrafo de texto |
| `table` | Tabela |
| `list` | Lista |
| `list_item` | Item de lista |
| `form_field` | Campo de formulário |
| `signature` | Assinatura |
| `image` | Imagem/figura |
| `diagram` | Diagrama |
| `header` | Cabeçalho |
| `footer` | Rodapé |

## Tipos de Documento

| Tipo | Detectado quando |
|------|------------------|
| `requirements` | Muitos itens de lista |
| `contract` | Assinatura + muitos parágrafos |
| `form` | Muitos campos de formulário |
| `report` | Muitas tabelas |
| `technical_spec` | Parágrafos + título |

## API Programática

```tsx
import { VisionEngine } from '@/lib/document-vision';

const engine = new VisionEngine({
  enableGPU: true,
  confidenceThreshold: 0.5,
  maxRegions: 100
});

const result = await engine.processImage(file);

if (result.success) {
  console.log('Tipo:', result.document.type);
  console.log('Regiões:', result.document.regions);
  console.log('Hierarquia:', result.document.hierarchy);
}
```

## Diferencial

Este módulo combina múltiplas tecnologias de ponta:

### Visão Computacional
- **Detecção de bordas** com Sobel operator
- **Segmentação** por flood fill
- **Classificação** baseada em posição, tamanho e aspectRatio
- **Hierarquização** automática da estrutura

### OCR (Reconhecimento de Texto)
- **Tesseract.js** - OCR de alta qualidade no navegador
- Suporte a português e inglês
- Extração de blocos com bounding boxes

### Processamento de PDF
- **PDF.js** - Renderização nativa de PDFs
- Conversão automática de páginas para análise
- Extração de metadados (título, autor, data)

### Vantagens
- Análise 100% no navegador
- Sem envio de dados para servidores externos
- Privacidade total dos documentos

## Licença

MIT - Use livremente em projetos comerciais ou pessoais.
