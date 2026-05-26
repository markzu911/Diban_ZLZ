import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";
import { Readable } from "stream";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment variables.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

export async function startVideoGeneration(req: any, res: any) {
  try {
    const { prompt, imageUrl, resolution = '1080p', aspectRatio = '16:9' } = req.body;
    const ai = getAI();
    
    const imageRes = await fetch(imageUrl);
    const imageBuffer = await imageRes.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: prompt,
      image: {
        imageBytes: base64Image,
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: resolution,
        aspectRatio: aspectRatio
      }
    });

    res.json({ operationName: operation.name });
  } catch (error: any) {
    console.error("Start Video Error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function getVideoStatus(req: any, res: any) {
  try {
    const { operationName } = req.body;
    const ai = getAI();
    const op = new GenerateVideosOperation();
    op.name = operationName;
    
    const updated = await ai.operations.getVideosOperation({ operation: op });
    res.json({ done: updated.done, error: updated.error });
  } catch (error: any) {
    console.error("Status Poll Error:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function downloadVideo(req: any, res: any) {
  try {
    const { operationName } = req.body;
    const ai = getAI();
    const op = new GenerateVideosOperation();
    op.name = operationName;
    
    const updated = await ai.operations.getVideosOperation({ operation: op });
    
    if (!updated.done) {
      return res.status(400).json({ error: "Video not ready" });
    }

    if (updated.error) {
      return res.status(500).json({ error: updated.error.message });
    }

    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      return res.status(500).json({ error: "Video URI not found" });
    }

    const videoRes = await fetch(uri, {
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    });

    if (!videoRes.ok) {
      const errorText = await videoRes.text();
      throw new Error(`Failed to fetch video from URI: ${videoRes.status} ${errorText}`);
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="video_${Date.now()}.mp4"`);
    
    if (videoRes.body) {
      // @ts-ignore - Readable.fromWeb exists in Node 18+
      Readable.fromWeb(videoRes.body).pipe(res);
    } else {
      throw new Error("Video response body is empty");
    }
  } catch (error: any) {
    console.error("Download Error:", error);
    res.status(500).json({ error: error.message });
  }
}
