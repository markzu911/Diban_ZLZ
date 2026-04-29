import { GoogleGenAI } from "@google/genai";

/**
 * Generic function to call Gemini through direct frontend SDK.
 * This keeps the API key access to the frontend (provided via vite define).
 */
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const callGemini = async (parameters: any) => {
  try {
    // Parameters should match GenerateContentParameters: { model, contents, config }
    const response = await ai.models.generateContent(parameters);
    
    if (!response) {
      throw new Error("Empty response from Gemini API");
    }

    return response;
  } catch (error: any) {
    console.error("Gemini Direct Call Error:", error);
    throw error;
  }
};
