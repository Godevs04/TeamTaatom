/**
 * Client-side mirror of the backend's chat upload limits (multer `chatUpload` in
 * backend/src/routes/chat.routes.js). Kept in sync so users get immediate feedback
 * instead of a server rejection after a long upload.
 */

export const CHAT_MAX_FILES = 5;
export const CHAT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB per file

/** Exactly the mimetypes the backend's fileFilter allows. */
export const CHAT_ALLOWED_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

/** Value for an <input type="file"> accept attribute. */
export const CHAT_ATTACHMENT_ACCEPT = CHAT_ALLOWED_MIME_TYPES.join(",");

export function formatFileSize(bytes?: number): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type FileRejection = { file: File; reason: string };

/**
 * Applies the backend's limits to a newly picked batch, given what is already
 * staged. Returns the files to accept plus a reason for each rejection, so the
 * caller can tell the user exactly what was dropped rather than truncating
 * silently.
 */
export function validateChatFiles(
  incoming: File[],
  alreadySelected: number
): { accepted: File[]; rejected: FileRejection[] } {
  const accepted: File[] = [];
  const rejected: FileRejection[] = [];
  let remaining = Math.max(CHAT_MAX_FILES - alreadySelected, 0);

  for (const file of incoming) {
    if (!CHAT_ALLOWED_MIME_TYPES.includes(file.type)) {
      rejected.push({ file, reason: "unsupported file type" });
      continue;
    }
    if (file.size > CHAT_MAX_FILE_BYTES) {
      rejected.push({ file, reason: "larger than 10MB" });
      continue;
    }
    if (remaining <= 0) {
      rejected.push({ file, reason: `over the ${CHAT_MAX_FILES}-file limit` });
      continue;
    }
    accepted.push(file);
    remaining -= 1;
  }

  return { accepted, rejected };
}
