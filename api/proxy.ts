import axios from "axios";

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
    // 1. Handle Gemini API Proxy
    if (normalizedUrl.includes("/api/gemini")) {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
      }

      const { model, payload } = body;
      if (!model || !payload) {
        return res.status(400).json({ error: "Missing model or payload in request body" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server" });
      }

      // Support models with or without models/ prefix
      const modelId = model.startsWith("models/") ? model : `models/${model}`;
      const targetUrl = `https://generativelanguage.googleapis.com/v1beta/${modelId}:generateContent?key=${apiKey}`;

      console.log(`Forwarding Gemini request to: ${modelId}, payload size: ${JSON.stringify(payload).length}`);

      const response = await axios({
        method: "POST",
        url: targetUrl,
        data: payload,
        headers: {
          "Content-Type": "application/json",
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      // Extract text content for easier frontend usage if desired, 
      // but return the full original response structure as requested.
      return res.status(response.status).json(response.data);
    }

    // 2. Handle SaaS API Proxy (Launch, Verify, Consume, Upload)
    const saasEndpoints = ["/api/tool/", "/api/upload/"];
    const matchedEndpoint = saasEndpoints.find(ep => normalizedUrl.includes(ep));

    if (matchedEndpoint) {
      const restPath = reqUrl.split(matchedEndpoint)[1];
      const targetUrl = `http://aibigtree.com${matchedEndpoint}${restPath}`;
      
      console.log(`Forwarding SaaS request to: ${targetUrl}`);

      const response = await axios({
        method: method,
        url: targetUrl,
        data: body,
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 60000, // Extend timeout for uploads
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
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
