
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
  toolId: string,
  fileName: string,
  mimeType: string,
  fileSize: number,
  source: "result" | "input" = "result"
): Promise<UploadResult> => {
  const response = await fetch("/api/upload/direct-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, toolId, fileName, mimeType, fileSize, source }),
  });
  return response.json();
};

/**
 * Commits a direct-uploaded image to the SaaS database.
 */
export const commitUpload = async (
  userId: string,
  toolId: string,
  objectKey: string,
  fileSize: number,
  source: "result" = "result"
): Promise<UploadResult> => {
  const response = await fetch("/api/upload/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, toolId, objectKey, fileSize, source }),
  });
  return response.json();
};

/**
 * Helper to convert Base64 to Blob for direct OSS upload.
 */
const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
};

/**
 * Higher-level helper to handle "Result Image" persistence after generation.
 * Follows the V6 recommended process: 
 * 1. direct-token (source=result) 
 * 2. PUT to OSS uploadUrl
 * 3. commit (source=result)
 * 
 * Note: consume should happen BEFORE this call as per doc sequence.
 */
export const persistResultImage = async (
  userId: string,
  toolId: string,
  base64: string
): Promise<string | null> => {
    try {
        const blob = base64ToBlob(base64);
        const fileName = `result_${Date.now()}.png`;
        
        // 1. Get Token
        const token = await getDirectUploadToken(
            userId, 
            toolId, 
            fileName, 
            blob.type, 
            blob.size, 
            "result"
        );
        
        if (!token.success || !token.uploadUrl || !token.objectKey) {
            throw new Error(token.message || "Failed to get upload token");
        }

        // 2. Direct PUT to OSS
        // We use the provided headers (especially Content-Type)
        const uploadRes = await fetch(token.uploadUrl, {
            method: token.method || "PUT",
            headers: token.headers,
            body: blob
        });

        if (!uploadRes.ok) {
            throw new Error(`OSS Upload failed with status ${uploadRes.status}`);
        }

        // 3. Commit to SaaS
        const commit = await commitUpload(
            userId, 
            toolId, 
            token.objectKey, 
            blob.size, 
            "result"
        );

        if (commit.success && commit.url) {
            return commit.url;
        }

        return token.readUrl || token.publicUrl || null;
    } catch (error) {
        console.error("Failed to persist result image (V6 Flow):", error);
        // Fallback to simple upload if possible, though doc discourages it
        return null;
    }
};
