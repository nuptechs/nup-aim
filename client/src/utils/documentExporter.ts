import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, Packer, ImageRun, PageBreak, Header, Footer, PageNumber, NumberFormat, convertInchesToTwip, SectionType, VerticalAlign, TableLayoutType } from 'docx';
import { saveAs } from 'file-saver';
import { ImpactAnalysis } from '../types';

interface ImageData {
  id: string;
  base64: string;
  name: string;
}

const COLORS = {
  primary: "1E40AF",
  primaryLight: "3B82F6",
  headerBg: "F1F5F9",
  headerText: "1E293B",
  tableBorder: "CBD5E1",
  tableHeaderBg: "E2E8F0",
  mutedText: "64748B",
  bodyText: "334155",
  accent: "0EA5E9",
};

const FONT_SIZES = {
  title: 36,
  subtitle: 20,
  heading1: 26,
  heading2: 22,
  heading3: 20,
  body: 22,
  small: 18,
  caption: 16,
};

const SPACING = {
  sectionGap: 400,
  paragraphAfter: 200,
  listItem: 120,
  tableRow: 80,
};

export const exportToWord = async (data: ImpactAnalysis) => {
  const base64ToBuffer = (base64: string): Uint8Array => {
    try {
      const base64Data = base64.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (error) {
      console.error('Error converting base64 to buffer:', error);
      return new Uint8Array(0);
    }
  };

  const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        resolve({ width: 600, height: 400 });
      };
      img.src = base64;
    });
  };

  const calculateScaledDimensions = (
    originalWidth: number,
    originalHeight: number,
    maxWidth: number = 500,
    maxHeight: number = 350
  ): { width: number; height: number } => {
    const aspectRatio = originalWidth / originalHeight;
    let newWidth = originalWidth;
    let newHeight = originalHeight;

    if (newWidth > maxWidth) {
      newWidth = maxWidth;
      newHeight = newWidth / aspectRatio;
    }

    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = newHeight * aspectRatio;
    }

    return { width: Math.round(newWidth), height: Math.round(newHeight) };
  };

  const parseImageData = (data: string): { images: ImageData[], text: string } => {
    if (!data) return { images: [], text: '' };
    
    const lines = data.split('\n');
    const images: ImageData[] = [];
    const textLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('IMAGE_DATA:')) {
        try {
          const imageJson = line.replace('IMAGE_DATA:', '');
          const imageData = JSON.parse(imageJson);
          images.push(imageData);
        } catch (error) {
          console.error('Error parsing image data:', error);
        }
      } else if (line.trim() && !line.startsWith('[Imagem ')) {
        textLines.push(line);
      }
    }

    return { images, text: textLines.join('\n') };
  };

  const parseFunctionPointAnalysis = (workDetails: string | undefined) => {
    if (!workDetails) return null;
    
    if (!workDetails.includes('=== DADOS EXTRAÍDOS POR IA ===')) return null;
    
    const extractedDataSection = workDetails.split('=== DADOS EXTRAÍDOS POR IA ===')[1];
    if (!extractedDataSection) return null;
    
    const processTypeMatch = extractedDataSection.match(/Processo Elementar: (\w+) \(([^)]+)\)/);
    const complexityMatch = extractedDataSection.match(/Complexidade: (\w+)/);
    const totalFPMatch = extractedDataSection.match(/Total de Pontos de Função: (\d+)/);
    
    if (!processTypeMatch || !complexityMatch || !totalFPMatch) return null;
    
    return {
      processType: processTypeMatch[1],
      processTypeDescription: processTypeMatch[2],
      complexity: complexityMatch[1],
      totalFunctionPoints: parseInt(totalFPMatch[1], 10)
    };
  };

  const splitTextIntoParagraphs = (text: string): Paragraph[] => {
    if (!text) return [];
    
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => 
      new Paragraph({
        children: [new TextRun({ text: line, size: FONT_SIZES.body, color: COLORS.bodyText })],
        spacing: { after: SPACING.listItem },
      })
    );
  };

  const createTableBorders = () => ({
    top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
    left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
    right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder },
  });

  const createHeaderCell = (text: string, width: number) => 
    new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, bold: true, size: FONT_SIZES.body, color: COLORS.headerText })]
      })],
      width: { size: width, type: WidthType.PERCENTAGE },
      shading: { fill: COLORS.tableHeaderBg },
      margins: { top: convertInchesToTwip(0.08), bottom: convertInchesToTwip(0.08), left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
    });

  const createDataCell = (text: string, width?: number, options?: { bold?: boolean; color?: string }) => 
    new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ 
          text, 
          size: FONT_SIZES.body, 
          color: options?.color || COLORS.bodyText,
          bold: options?.bold || false 
        })]
      })],
      ...(width ? { width: { size: width, type: WidthType.PERCENTAGE } } : {}),
      margins: { top: convertInchesToTwip(0.06), bottom: convertInchesToTwip(0.06), left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
    });

  const createLabelCell = (text: string, width?: number) =>
    new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, bold: true, size: FONT_SIZES.body, color: COLORS.headerText })]
      })],
      ...(width ? { width: { size: width, type: WidthType.PERCENTAGE } } : {}),
      shading: { fill: COLORS.headerBg },
      margins: { top: convertInchesToTwip(0.06), bottom: convertInchesToTwip(0.06), left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
    });

  const createSectionHeading = (number: string, text: string, level: 1 | 2 | 3 = 1) => {
    const sizes = { 1: FONT_SIZES.heading1, 2: FONT_SIZES.heading2, 3: FONT_SIZES.heading3 };
    const spacings = { 1: 300, 2: 240, 3: 200 };
    
    return new Paragraph({
      children: [
        new TextRun({ text: `${number} `, bold: true, size: sizes[level], color: COLORS.primary }),
        new TextRun({ text, bold: true, size: sizes[level], color: COLORS.headerText }),
      ],
      spacing: { before: spacings[level], after: 160 },
    });
  };

  const processImages = async (images: ImageData[]): Promise<Paragraph[]> => {
    const elements: Paragraph[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      try {
        const imageBuffer = base64ToBuffer(imageData.base64);
        if (imageBuffer.length > 0) {
          const dimensions = await getImageDimensions(imageData.base64);
          const scaled = calculateScaledDimensions(dimensions.width, dimensions.height);
          
          elements.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: {
                    width: scaled.width,
                    height: scaled.height,
                  },
                }),
              ],
              spacing: { before: 120, after: 80 },
              alignment: AlignmentType.CENTER,
            })
          );
          
          elements.push(
            new Paragraph({
              children: [
                new TextRun({ text: `Figura ${i + 1}: `, bold: true, size: FONT_SIZES.caption, color: COLORS.mutedText }),
                new TextRun({ text: imageData.name, italics: true, size: FONT_SIZES.caption, color: COLORS.mutedText }),
              ],
              spacing: { after: 200 },
              alignment: AlignmentType.CENTER,
            })
          );
        }
      } catch (error) {
        console.error('Error processing image:', error);
        elements.push(
          new Paragraph({
            children: [new TextRun({ text: `[Erro ao processar: ${imageData.name}]`, italics: true, size: FONT_SIZES.small, color: "DC2626" })],
            spacing: { after: 120 },
            alignment: AlignmentType.CENTER,
          })
        );
      }
    }
    
    return elements;
  };

  const buildFunctionalityElements = async (): Promise<(Table | Paragraph)[]> => {
    const allElements: (Table | Paragraph)[] = [];
    
    if (data.scope.processes.length === 0) {
      allElements.push(
        new Paragraph({
          children: [new TextRun({ text: "Nenhuma funcionalidade definida no escopo.", size: FONT_SIZES.body, color: COLORS.mutedText, italics: true })],
          spacing: { after: SPACING.sectionGap },
        })
      );
      return allElements;
    }

    for (let index = 0; index < data.scope.processes.length; index++) {
      const process = data.scope.processes[index];
      const { images, text } = parseImageData(process.screenshots || '');
      const fpAnalysis = parseFunctionPointAnalysis(process.workDetails);

      allElements.push(
        new Paragraph({
          children: [
            new TextRun({ text: `2.1.${index + 1} `, bold: true, size: FONT_SIZES.heading3, color: COLORS.primaryLight }),
            new TextRun({ text: process.name, bold: true, size: FONT_SIZES.heading3, color: COLORS.headerText }),
          ],
          spacing: { before: index > 0 ? 300 : 0, after: 160 },
        })
      );

      const tableRows: TableRow[] = [
        new TableRow({
          children: [
            createLabelCell("Status", 25),
            createDataCell(translateStatus(process.status), 75),
          ],
        }),
      ];

      if (process.status === 'alterada' && process.websisCreated !== undefined) {
        tableRows.push(
          new TableRow({
            children: [
              createLabelCell("Websis Criou/Alterou Antes"),
              createDataCell(process.websisCreated ? 'SIM' : 'NÃO'),
            ],
          })
        );
      }

      if (fpAnalysis) {
        tableRows.push(
          new TableRow({
            children: [
              createLabelCell("Pontos de Função"),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${fpAnalysis.processType} (${fpAnalysis.processTypeDescription})`, size: FONT_SIZES.body, color: COLORS.bodyText }),
                      new TextRun({ text: ` | Complexidade: `, size: FONT_SIZES.body, color: COLORS.mutedText }),
                      new TextRun({ text: fpAnalysis.complexity, bold: true, size: FONT_SIZES.body, color: COLORS.primary }),
                      new TextRun({ text: ` | Total: `, size: FONT_SIZES.body, color: COLORS.mutedText }),
                      new TextRun({ text: `${fpAnalysis.totalFunctionPoints} PF`, bold: true, size: FONT_SIZES.body, color: COLORS.accent }),
                    ],
                  }),
                ],
                margins: { top: convertInchesToTwip(0.06), bottom: convertInchesToTwip(0.06), left: convertInchesToTwip(0.1), right: convertInchesToTwip(0.1) },
              }),
            ],
          })
        );
      }

      allElements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: createTableBorders(),
          layout: TableLayoutType.FIXED,
          rows: tableRows,
        })
      );

      if (process.workDetails && process.workDetails.trim()) {
        let cleanWorkDetails = process.workDetails;
        if (cleanWorkDetails.includes('=== DADOS EXTRAÍDOS POR IA ===')) {
          cleanWorkDetails = cleanWorkDetails.split('=== DADOS EXTRAÍDOS POR IA ===')[0].trim();
        }
        
        if (cleanWorkDetails) {
          allElements.push(
            new Paragraph({
              children: [new TextRun({ text: "Detalhamento do Trabalho:", bold: true, size: FONT_SIZES.body, color: COLORS.headerText })],
              spacing: { before: 200, after: 100 },
            })
          );
          
          allElements.push(...splitTextIntoParagraphs(cleanWorkDetails));
        }
      }

      if (images.length > 0 || text.trim()) {
        allElements.push(
          new Paragraph({
            children: [new TextRun({ text: "Evidências (Prints de Tela):", bold: true, size: FONT_SIZES.body, color: COLORS.headerText })],
            spacing: { before: 200, after: 120 },
          })
        );

        if (text.trim()) {
          allElements.push(...splitTextIntoParagraphs(text));
        }

        if (images.length > 0) {
          const imageElements = await processImages(images);
          allElements.push(...imageElements);
        }
      }

      allElements.push(new Paragraph({ text: "", spacing: { after: 200 } }));
      
      if (index < data.scope.processes.length - 1 && (images.length > 2 || (process.workDetails?.length || 0) > 500)) {
        allElements.push(new Paragraph({ children: [new PageBreak()] }));
      }
    }
    
    return allElements;
  };

  const functionalityElements = await buildFunctionalityElements();

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: FONT_SIZES.body,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: data.title || "Análise de Impacto", size: FONT_SIZES.small, color: COLORS.mutedText }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "NuPTechs - Sua fábrica de softwares inteligentes", size: FONT_SIZES.caption, color: COLORS.mutedText, italics: true }),
                  new TextRun({ text: "  |  Página ", size: FONT_SIZES.caption, color: COLORS.mutedText }),
                  new TextRun({ children: [PageNumber.CURRENT], size: FONT_SIZES.caption, color: COLORS.mutedText }),
                  new TextRun({ text: " de ", size: FONT_SIZES.caption, color: COLORS.mutedText }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: FONT_SIZES.caption, color: COLORS.mutedText }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: data.title || "Análise de Impacto", bold: true, size: FONT_SIZES.title, color: COLORS.primary })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          
          new Paragraph({
            children: [new TextRun({ text: "Documento de Análise de Pontos de Função", size: FONT_SIZES.subtitle, color: COLORS.mutedText })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: createTableBorders(),
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                children: [
                  createLabelCell("Número PA", 20),
                  createDataCell(data.title || "N/A", 30),
                  createLabelCell("Projeto", 20),
                  createDataCell(data.project || "N/A", 30),
                ],
              }),
              new TableRow({
                children: [
                  createLabelCell("Autor"),
                  createDataCell(data.author || "N/A"),
                  createLabelCell("Data"),
                  createDataCell(data.date ? new Date(data.date).toLocaleDateString('pt-BR') : "N/A"),
                ],
              }),
              new TableRow({
                children: [
                  createLabelCell("Versão"),
                  createDataCell(data.version || "1.0"),
                  createLabelCell("Status"),
                  createDataCell("Em Análise"),
                ],
              }),
            ],
          }),

          new Paragraph({ text: "", spacing: { after: SPACING.sectionGap } }),

          ...(data.description ? [
            createSectionHeading("1.", "Descrição"),
            ...splitTextIntoParagraphs(data.description),
            new Paragraph({ text: "", spacing: { after: 200 } }),
          ] : []),

          createSectionHeading("2.", "Escopo da Análise"),
          createSectionHeading("2.1", "Funcionalidades Impactadas", 2),
          
          ...functionalityElements,

          ...(data.risks.length > 0 ? [
            createSectionHeading("3.", "Matriz de Riscos"),
            
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: createTableBorders(),
              layout: TableLayoutType.FIXED,
              rows: [
                new TableRow({
                  children: [
                    createHeaderCell("Descrição do Risco", 40),
                    createHeaderCell("Impacto", 15),
                    createHeaderCell("Probabilidade", 15),
                    createHeaderCell("Mitigação", 30),
                  ],
                }),
                ...data.risks.map(risk => 
                  new TableRow({
                    children: [
                      createDataCell(risk.description),
                      createDataCell(capitalize(risk.impact)),
                      createDataCell(capitalize(risk.probability)),
                      createDataCell(risk.mitigation || 'N/A'),
                    ],
                  })
                ),
              ],
            }),
            new Paragraph({ text: "", spacing: { after: SPACING.sectionGap } }),
          ] : []),

          ...(data.mitigations.length > 0 ? [
            createSectionHeading("4.", "Plano de Mitigação"),
            
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: createTableBorders(),
              layout: TableLayoutType.FIXED,
              rows: [
                new TableRow({
                  children: [
                    createHeaderCell("Ação", 35),
                    createHeaderCell("Responsável", 25),
                    createHeaderCell("Prazo", 20),
                    createHeaderCell("Prioridade", 20),
                  ],
                }),
                ...data.mitigations.map(mitigation => 
                  new TableRow({
                    children: [
                      createDataCell(mitigation.action),
                      createDataCell(mitigation.responsible),
                      createDataCell(new Date(mitigation.deadline).toLocaleDateString('pt-BR')),
                      createDataCell(capitalize(mitigation.priority)),
                    ],
                  })
                ),
              ],
            }),
            new Paragraph({ text: "", spacing: { after: SPACING.sectionGap } }),
          ] : []),

        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${(data.title || 'Analise_de_Impacto').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`;
  saveAs(blob, fileName);
};

function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    'incluida': 'Incluída',
    'alterada': 'Alterada',
    'excluida': 'Excluída',
  };
  return translations[status] || capitalize(status);
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

