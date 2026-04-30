import express from "express";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import proxyHandler from "./api/proxy.js"; // Note: Vercel functions use JS/TS

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Middleware to adapt Express req/res to Vercel handler
  app.all("/api/*", async (req, res) => {
    // Vercel handles body parsing, but for local express we already have express.json()
    // We just pass req and res to the proxyHandler
    try {
      await proxyHandler(req, res);
    } catch (error: any) {
      console.error("Local Proxy Error:", error);
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
    console.log(`Local development server running on http://localhost:${PORT}`);
    console.log(`API routes and Vercel-style proxy active.`);
  });
}

startServer();
