/**
 * Generic function to call Gemini through our backend proxy.
 * This keeps the API key secure on the server.
 */
export const callGemini = async (parameters: any) => {
  try {
    const { model, contents, config } = parameters;
    
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: model,
        payload: {
          contents: contents,
          ...config
        }
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Proxy request failed with status ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error: any) {
    console.error("Gemini Proxy Call Error:", error);
    throw error;
  }
};
