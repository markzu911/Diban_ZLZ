import { GoogleGenAI } from "@google/genai";
import axios from "axios";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url: reqUrl, method, body } = req;
  const normalizedUrl = reqUrl.toLowerCase();
  console.log(`Processing ${method} request for ${reqUrl}`);

  try {
    // 1. Handle Gemini API
    if (normalizedUrl.includes("/api/gemini")) {
      if (method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
      }

      const { model, payload } = body;
      const modelInstance = ai.getGenerativeModel({ model });
      const result = await modelInstance.generateContent(payload);
      const response = await result.response;
      return res.status(200).json(response);
    }

    // 2. Handle Tool Proxying
    if (normalizedUrl.includes("/api/tool/")) {
      const toolSubPath = reqUrl.split(/\/api\/tool\//i)[1];
      if (!toolSubPath) {
          return res.status(404).json({ error: "Tool Path Missing" });
      }
      const targetUrl = `http://aibigtree.com/api/tool/${toolSubPath}`;
      
      console.log(`Forwarding to: ${targetUrl}`);

      const response = await axios({
        method: method,
        url: targetUrl,
        data: body,
        headers: {
          "Content-Type": "application/json",
        },
      });

      return res.status(response.status).json(response.data);
    }

    return res.status(404).json({ error: "Path Not Found" });
  } catch (error: any) {
    console.error("Proxy Error:", error.message);
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: error.message || "Internal Server Error" };
    return res.status(status).json(data);
  }
}
