import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini AI on the backend
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
  const handleGeminiRequest = async (req: express.Request, res: express.Response) => {
    const start = Date.now();
    console.log(`[AI Request] ${req.method} ${req.url}`);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("[AI Error] GEMINI_API_KEY is not defined in environment");
        return res.status(500).json({ error: "GEMINI_API_KEY missing on server" });
      }

      const { model, payload } = req.body;
      const targetModel = model || "gemini-3-flash-preview";
      
      console.log(`[AI] Model: ${targetModel}, Payload Size: ${JSON.stringify(payload).length} bytes`);
      
      const generativeModel = ai.getGenerativeModel({ 
        model: targetModel, 
      });
      
      // Ensure specific structure for contents
      let { contents, config } = payload;
      
      // If config is missing, provide a safe default
      const generationConfig = config || {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      };

      console.log(`[AI] Calling generateContent with payload size: ${JSON.stringify(payload).length} bytes`);
      
      const result = await generativeModel.generateContent({
        contents,
        generationConfig,
      });

      const response = await result.response;
      
      // Handle the case where response might not have a text() method (e.g. image output)
      let text = "";
      try {
        text = response.text();
      } catch (e) {
        console.log("[AI] Response does not contain text segment (expected for image candidates)");
      }
      
      console.log(`[AI Success] Generated response for ${model}`);
      // Send back the whole response candidates for the client to parse, plus extracted text
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
  };

  // Consolidated AI Route matching
  const aiRoutes = [
    "/api/gemini",
    "/api/gemini/",
    "/api/generate",
    "/api/generate/",
    "/gemini",
    "/generate"
  ];

  aiRoutes.forEach(route => {
    app.post(route, handleGeminiRequest);
  });

  // Global Error Handler for JSON parsing errors (like 413)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.type === 'entity.too.large') {
      console.error(`[413] Payload too large. Content-Length: ${req.headers['content-length']}`);
      res.status(413).json({ 
        success: false, 
        message: "请求数据过大（图片过多或过大），请压缩后重试。",
        error: "Request Entity Too Large",
        limit: "50mb"
      });
      return;
    }
    console.error("[Server Error]", err.message);
    res.status(500).json({ error: "服务器内部错误", details: err.message });
  });

  // Fallback for any other API routes to help debug 404s
  app.all("/api/*", (req, res) => {
    console.warn(`[404] Unhandled API Request: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: "Route not found in API context", 
      path: req.url,
      method: req.method 
    });
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
