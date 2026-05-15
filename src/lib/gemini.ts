/**
 * Generic function to call Gemini through our backend proxy.
 * This keeps the API key secure on the server.
 */
export const callGemini = async (parameters: any) => {
  try {
    const { model, contents, config, ...rest } = parameters;
    
    // Normalize contents to the format expected by the Gemini REST API: Array<{ role?: string, parts: Array<{ text?: string, inlineData?: any }> }>
    let normalizedContents: any[] = [];
    if (typeof contents === "string") {
      normalizedContents = [{ parts: [{ text: contents }] }];
    } else if (Array.isArray(contents)) {
      normalizedContents = contents.map(c => {
        if (c.parts) return c;
        if (Array.isArray(c)) return { parts: c };
        return { parts: [c] };
      });
    } else if (contents && typeof contents === "object") {
      if (contents.parts) {
        normalizedContents = [contents];
      } else {
        // Single part object
        normalizedContents = [{ parts: [contents] }];
      }
    }

    // Map configuration: generic config goes to generationConfig, specialized configs (like imageConfig) are top-level
    // The SDK often puts imageConfig inside config, but REST expects it at the top level
    const payload: any = {
      contents: normalizedContents,
      ...rest
    };

    if (config) {
      const { imageConfig, ...generationConfig } = config;
      if (Object.keys(generationConfig).length > 0) {
        payload.generationConfig = generationConfig;
      }
      if (imageConfig) {
        payload.imageGenerationConfig = imageConfig;
      }
    }

    // The proxy expects { model, payload }
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "gemini-3-flash-preview",
        payload
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMessage = typeof errorData.error === 'object' 
        ? (errorData.error.message || JSON.stringify(errorData.error))
        : (errorData.error || `Proxy request failed with status ${res.status}`);
      throw new Error(errorMessage);
    }

    const data = await res.json();
    
    // Reconstruct a response-like object that the app expects
    // The frontend usually expects result.response.text(), or just a response object
    // We'll wrap it to provide a .text() method if it doesn't have one, or just return as is
    // Often components do: const text = response.response.text();
    // In our REST response, it's data.candidates[0].content.parts[0].text
    
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    const enhancedResponse = {
       ...data,
       text: textContent, // Direct access used by App.tsx line 400
       response: {
           ...data,
           text: () => textContent
       }
    };

    return enhancedResponse;
  } catch (error: any) {
    console.error("Gemini Proxy Call Error:", error);
    throw error;
  }
};
