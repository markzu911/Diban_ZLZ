import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini AI on the backend
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // Debug Logger
  app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
  });

  // CORS and Iframe Headers
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    next();
  });

  // Health check for debugging 404s
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: { 
        hasApiKey: !!process.env.GEMINI_API_KEY,
        nodeEnv: process.env.NODE_ENV
      } 
    });
  });

  const proxyRequest = async (req: express.Request, res: express.Response, targetPath: string) => {
    const targetUrl = `http://aibigtree.com${targetPath}`;
    console.log(`[Proxy] ${req.method} ${req.url} -> ${targetUrl}`);
    try {
      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Studio-App'
        },
        timeout: 10000 // 10s timeout
      });
      console.log(`[Proxy Success] ${targetPath} -> ${response.status}`);
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error(`[Proxy Error] ${targetPath}:`, error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { success: false, message: "代理转发失败", error: error.message });
    }
  };

  // SaaS Proxy Routes - following V4-3Step naming
  app.post("/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
  app.post("/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
  app.post("/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));

  // Generic Gemini API Proxy - handling /api/gemini correctly
  app.post("/api/gemini", async (req, res) => {
    console.log(`[AI] Incoming request to /api/gemini`);
    try {
      const { model, payload } = req.body;
      if (!process.env.GEMINI_API_KEY) {
        console.error("[AI Error] Missing GEMINI_API_KEY");
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }
      
      console.log(`[AI] Processing for model: ${model}`);
      const generativeModel = ai.getGenerativeModel({ model });
      
      const { contents, config, ...rest } = payload;
      
      const result = await generativeModel.generateContent({
        contents,
        generationConfig: config,
        ...rest
      });

      const response = await result.response;
      const text = response.text ? response.text() : "";
      
      console.log(`[AI Success] Generated response for ${model}`);
      res.json({
        ...response,
        text: text
      });
    } catch (error: any) {
      console.error("[AI Error]:", error.stack || error.message);
      res.status(500).json({ 
        error: error.message,
        details: "AI generation failed on the server."
      });
    }
  });

  // Alias for /api/generate if needed by best practices
  app.post("/api/generate", (req, res) => {
    // This could combine verify + generate + consume in one go for higher security
    // For now, redirecting to /api/gemini to maintain compatibility
    res.redirect(307, '/api/gemini');
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
