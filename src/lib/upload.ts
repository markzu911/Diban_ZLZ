
/**
 * Interface for the upload result from the server.
 */
export interface UploadResult {
  success: boolean;
  url?: string;
  images?: { url: string; fileName: string }[];
  objectKey?: string;
  uploadUrl?: string;
  method?: string;
  headers?: Record<string, string>;
  message?: string;
  savedToRecords?: boolean;
}

/**
 * Uploads an image using Base64 method (standard/compat).
 */
export const uploadImageBase64 = async (
  userId: string, 
  base64: string, 
  source: "result" | "input" = "result"
): Promise<UploadResult> => {
  const response = await fetch("/api/upload/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, base64, source }),
  });
  return response.json();
};

/**
 * Gets a direct upload token for OSS.
 */
export const getDirectUploadToken = async (
  userId: string,
  fileName: string,
  mimeType: string,
  fileSize: number,
  source: "result" | "input" = "result"
): Promise<UploadResult> => {
  const response = await fetch("/api/upload/direct-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, fileName, mimeType, fileSize, source }),
  });
  return response.json();
};

/**
 * Commits a direct-uploaded image to the SaaS database.
 */
export const commitUpload = async (
  userId: string,
  objectKey: string,
  fileSize: number,
  source: "result" = "result"
): Promise<UploadResult> => {
  const response = await fetch("/api/upload/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, objectKey, fileSize, source }),
  });
  return response.json();
};

/**
 * Higher-level helper to handle "Result Image" persistence after generation.
 * Follows the doc recommended process: direct upload (optional) -> consume -> commit.
 * Or simple Base64 upload after consume.
 */
export const persistResultImage = async (
  userId: string,
  toolId: string,
  base64: string
): Promise<string | null> => {
    try {
        // 1. Consume points (already happens in App.tsx or we trigger it here)
        // For simplicity, we use the standard Base64 upload for now as it's easier to integrate.
        const result = await uploadImageBase64(userId, base64, "result");
        if (result.success && result.url) {
            return result.url;
        }
        return null;
    } catch (error) {
        console.error("Failed to persist result image:", error);
        return null;
    }
};
