/**
 * Generic function to call Gemini through our backend proxy.
 * This keeps the API key secure on the server.
 */
export const callGemini = async (parameters: any) => {
  try {
    const { model, contents, config, ...rest } = parameters;
    
    // The proxy expects { model, payload }
    // We map contents and config into the payload the Gemini API expects
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "gemini-1.5-flash",
        payload: {
          contents: contents,
          generationConfig: config,
          ...rest
        }
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Proxy request failed with status ${res.status}`);
    }

    const data = await res.json();
    
    // Reconstruct a response-like object that the app expects
    // The frontend usually expects result.response.text(), or just a response object
    // We'll wrap it to provide a .text() method if it doesn't have one, or just return as is
    // Often components do: const text = response.response.text();
    // In our REST response, it's data.candidates[0].content.parts[0].text
    
    const enhancedResponse = {
       ...data,
       response: {
           ...data,
           text: () => {
               try {
                   return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
               } catch (e) {
                   return "";
               }
           }
       }
    };

    return enhancedResponse;
  } catch (error: any) {
    console.error("Gemini Proxy Call Error:", error);
    throw error;
  }
};
