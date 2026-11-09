import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { extractIvaFromDocument } from "./server/extractIva";

dotenv.config();

const app = express();
const PORT = 3000;

// Set high limits for base64 PDF uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Single or Batch PDF/Image IVA Planilla Extraction API
app.post("/api/extract-iva", async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileData, mimeType, fileName, preferredPeriod } = req.body;

    if (!fileData) {
      res.status(400).json({
        success: false,
        error: "No se proporcionaron datos del archivo (fileData en base64 requerido).",
      });
      return;
    }

    const effectiveMimeType = mimeType || "application/pdf";
    const effectiveFileName = fileName || "Planilla_IVA.pdf";

    // Call unified extraction engine (combines direct PDF analysis, SENIAT parser & Gemini AI)
    const result = await extractIvaFromDocument(
      fileData,
      effectiveMimeType,
      effectiveFileName,
      process.env.GEMINI_API_KEY,
      preferredPeriod
    );

    res.json({
      success: true,
      data: result,
      fileName: effectiveFileName,
    });
  } catch (error: any) {
    console.error("Error al procesar planilla IVA:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al procesar y extraer los datos de la planilla.",
    });
  }
});

// Start server with Vite middleware in dev or static serving in prod
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`IVA SENIAT Summary Server running on http://localhost:${PORT}`);
  });
}

startServer();
