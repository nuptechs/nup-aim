import { Router } from "express";
import { readDocumentFromText, DocumentStructure } from "../lib/document-reader";
import mammoth from "mammoth";

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
      } else if (mimeType === "text/plain" || fileName?.endsWith(".txt")) {
        extractedText = buffer.toString("utf-8");
      } else if (mimeType?.startsWith("image/")) {
        return res.status(400).json({ 
          error: "Imagens não são suportadas ainda. Envie arquivos .docx ou .txt" 
        });
      } else {
        extractedText = buffer.toString("utf-8");
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: "Nenhum texto foi extraído do arquivo" });
    }

    const maxLength = 50000;
    if (extractedText.length > maxLength) {
      extractedText = extractedText.substring(0, maxLength) + "\n\n[TEXTO TRUNCADO...]";
    }

    const result: DocumentStructure = await readDocumentFromText(extractedText);
    res.json(result);
  } catch (error) {
    console.error("Erro ao analisar documento:", error);
    res.status(500).json({ error: "Erro ao processar documento" });
  }
});

export default router;
