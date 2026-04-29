import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini AI on the backend
// Use a getter or initialize inside startServer to ensure env is ready
let ai: GoogleGenAI;

async function startServer() {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS and Iframe Headers - CRITICAL for this environment
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

  const proxyRequest = async (req: express.Request, res: express.Response, targetPath: string) => {
    const targetUrl = `http://aibigtree.com${targetPath}`;
    console.log(`[PROXY] ${req.method} to ${targetUrl}`);
    try {
      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        headers: { 
          'Content-Type': 'application/json',
        }
      });
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error(`[PROXY ERROR] ${targetPath}:`, error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "代理转发失败" });
    }
  };

  // Root Debug Route
  app.get("/ping", (req, res) => res.send(`pong - ${new Date().toISOString()}`));

  // API Health Check
  app.get("/api/health", (req, res) => {
    console.log("[API] Health check requested");
    res.json({ 
      status: "ok", 
      time: new Date().toISOString(), 
      env: !!process.env.GEMINI_API_KEY 
    });
  });

  // SaaS Proxy Routes
  app.post("/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
  app.post("/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
  app.post("/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));

  // Gemini Proxy
  app.post("/api/gemini", async (req, res) => {
    console.log("[API] Gemini request received");
    try {
      const { model, payload } = req.body;
      if (!model) {
        return res.status(400).json({ error: "Missing model name" });
      }
      
      if (!process.env.GEMINI_API_KEY) {
        console.error("[AI] GEMINI_API_KEY is not set");
        return res.status(500).json({ error: "GEMINI_API_KEY missing on server" });
      }

      const response = await ai.models.generateContent({
        model,
        ...payload
      });
      
      res.json({
        text: response.text || "",
        candidates: response.candidates,
        usageMetadata: response.usageMetadata
      });
    } catch (error: any) {
      console.error("[AI ERROR]", error.message);
      res.status(error.status || 500).json({ 
        error: error.message || "Gemini API error",
        details: error.response?.data || null 
      });
    }
  });

  // API 404 Debugger - MUST be after all API routes but before Vite
  app.all("/api/*", (req, res) => {
    console.warn(`[API 404] NOT FOUND: ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: "API endpoint not found", 
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
