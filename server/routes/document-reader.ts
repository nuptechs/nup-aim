import { Router } from "express";
import { readDocumentFromText, readDocumentFromImage, DocumentStructure } from "../lib/document-reader";

const router = Router();

router.post("/analyze", async (req, res) => {
  try {
    const { text, imageBase64, mimeType } = req.body;

    if (!text && !imageBase64) {
      return res.status(400).json({ error: "Texto ou imagem é obrigatório" });
    }

    let result: DocumentStructure;

    if (imageBase64 && mimeType) {
      result = await readDocumentFromImage(imageBase64, mimeType, text);
    } else {
      result = await readDocumentFromText(text);
    }

    res.json(result);
  } catch (error) {
    console.error("Erro ao analisar documento:", error);
    res.status(500).json({ error: "Erro ao processar documento" });
  }
});

export default router;
