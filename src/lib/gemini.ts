import { GoogleGenAI } from "@google/genai";

/**
 * Initializes the Gemini AI client using the platform-provided environment variable.
 * In the AI Studio/SaaS environment, process.env.GEMINI_API_KEY is handled externally.
 */
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * Generic function to call Gemini directly from the frontend.
 * @param parameters - GenerateContentParameters including model, contents, and config.
 * @returns GenerateContentResponse
 */
export const callGemini = async (parameters: any) => {
  try {
    // Check if we are in a dev environment without a key, though usually handled by platform
    if (!process.env.GEMINI_API_KEY && !window.location.hostname.includes('localhost')) {
      console.warn("GEMINI_API_KEY is not defined in the environment.");
    }

    const response = await ai.models.generateContent(parameters);
    
    // Ensure we return the standardized response object
    if (!response) {
      throw new Error("Empty response from Gemini API");
    }
    
    return response;
  } catch (error: any) {
    console.error("Gemini Direct Call Error:", error);
    throw error;
  }
};
