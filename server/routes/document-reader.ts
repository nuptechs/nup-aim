import { Router } from "express";
import { parseDocumentStructure, DocumentStructure } from "../lib/document-structure-parser";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

const router = Router();

router.post("/analyze", async (req, res) => {
  try {
    const { text, fileBase64, mimeType, fileName } = req.body;

    if (!text && !fileBase64) {
      return res.status(400).json({ error: "Texto ou arquivo é obrigatório" });
    }

    let extractedText = text || "";

    if (fileBase64) {
      const buffer = Buffer.from(fileBase64, "base64");

      if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName?.endsWith(".docx")
      ) {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
        console.log(`[DocumentReader] DOCX extraído: ${extractedText.length} caracteres`);
      } else if (mimeType === "application/pdf" || fileName?.endsWith(".pdf")) {
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { totalPages, text: pdfPages } = await extractText(pdf, { mergePages: false });
        extractedText = Array.isArray(pdfPages) ? pdfPages.join('\n\n') : String(pdfPages);
        console.log(`[DocumentReader] PDF extraído: ${totalPages} páginas, ${extractedText.length} caracteres`);
      } else if (mimeType === "text/plain" || fileName?.endsWith(".txt")) {
        extractedText = buffer.toString("utf-8");
        console.log(`[DocumentReader] TXT extraído: ${extractedText.length} caracteres`);
      } else if (mimeType?.startsWith("image/")) {
        return res.status(400).json({ 
          error: "Imagens não são suportadas. Envie arquivos PDF, DOCX ou TXT." 
        });
      } else {
        extractedText = buffer.toString("utf-8");
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: "Nenhum texto foi extraído do arquivo" });
    }

    const result: DocumentStructure = parseDocumentStructure(extractedText);
    res.json(result);
  } catch (error) {
    console.error("Erro ao analisar documento:", error);
    res.status(500).json({ error: "Erro ao processar documento" });
  }
});

export default router;
