import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini AI on the backend
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

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

  const proxyRequest = async (req: express.Request, res: express.Response, targetPath: string) => {
    const targetUrl = `http://aibigtree.com${targetPath}`;
    console.log(`Proxying ${req.method} to ${targetUrl}`);
    try {
      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        headers: { 
          'Content-Type': 'application/json',
          // Here you can add your backend-only SaaS Secret Key if needed
          // 'X-SaaS-Key': process.env.SAAS_SECRET_KEY 
        }
      });
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error("Proxy Error:", error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "代理转发失败" });
    }
  };

  // SaaS Proxy Routes
  app.post("/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
  app.post("/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
  app.post("/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));

  // AI Room Analysis (Backend)
  app.post("/api/ai/analyze-room", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      const prompt = `Analyze this room image for floor replacement. Identify:
      1. Space Type (e.g. Living Room, Bedroom)
      2. Design Style (e.g. Modern, Vintage)
      3. Current Floor Type
      4. Lighting conditions
      5. Furniture/Obstacles to preserve.
      Return JSON format: {spaceType, designStyle, currentFloor, lighting, obstacles: string[]}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: image.split(',')[1] } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              spaceType: { type: Type.STRING },
              designStyle: { type: Type.STRING },
              currentFloor: { type: Type.STRING },
              lighting: { type: Type.STRING },
              obstacles: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI Material Analysis (Backend)
  app.post("/api/ai/analyze-material", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      const prompt = `Identify this flooring material sample. 
      Analyze with extreme care for physical surface characteristics:
      1. Material Name (e.g. "Natural Oak")
      2. Shape of the units (e.g. "rectangular planks", "square tiles", "hexagon")
      3. Pattern/Layout (e.g. "Herringbone", "Fishbone", "Straight", "Chessboard")
      4. Texture/Grain (e.g. "deep wood grain", "smooth marble", "coarse stone")
      5. Physical Relief/Bumps (e.g. "wavy irregular protrusions", "deeply embossed grain", "flat smooth surface", "three-dimensional relief"). 
      6. Finish/Surface (e.g. "matte", "glossy", "brushed", "satin")
      Return JSON: { materialName, shape, pattern, texture, relief, finish }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: image.split(',')[1] } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              materialName: { type: Type.STRING },
              shape: { type: Type.STRING },
              pattern: { type: Type.STRING },
              texture: { type: Type.STRING },
              relief: { type: Type.STRING },
              finish: { type: Type.STRING }
            }
          }
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI Recommendation Engine (Backend)
  app.post("/api/ai/recommend", async (req, res) => {
    try {
      const { image } = req.body;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: "user",
          parts: [
            { text: `Based on this room image, recommend a flooring material that would look best. 
            Consider the wall color, lighting, and existing style. 
            Return JSON: { name: string, reason: string, details: { color: string, shape: string, pattern: string, texture: string, relief: string, finish: string } }` },
            { inlineData: { mimeType: "image/jpeg", data: image.split(',')[1] } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              reason: { type: Type.STRING },
              details: {
                type: Type.OBJECT,
                properties: {
                  color: { type: Type.STRING },
                  shape: { type: Type.STRING },
                  pattern: { type: Type.STRING },
                  texture: { type: Type.STRING },
                  relief: { type: Type.STRING },
                  finish: { type: Type.STRING }
                }
              }
            }
          }
        }
      });

      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error("AI Recommendation Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Rendering Engine (Backend)
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { prompt, images } = req.body;
      
      const parts: any[] = [{ text: prompt }];
      images.forEach((img: string) => {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: img.split(',')[1] } });
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: [{ role: "user", parts }]
      });

      const imageUrl = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
      
      if (imageUrl) {
        res.json({ imageUrl: `data:image/jpeg;base64,${imageUrl}` });
      } else {
        res.status(500).json({ error: "Failed to generate image" });
      }
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: error.message });
    }
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
