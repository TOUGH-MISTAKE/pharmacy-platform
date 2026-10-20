export const PRESCRIPTION_BUCKET = "prescriptions";
export const MAX_FILES = 5;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const ACCEPT_ATTRIBUTE =
  ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns a friendly error message, or null when the file is acceptable. */
export function validateFile(file: File): string | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return `"${file.name}" is not supported. Please use a JPG, PNG, WebP or PDF file.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `"${file.name}" is too large (${formatFileSize(file.size)}). The limit is 10 MB per file.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  return null;
}

/** Storage path: <patient id>/<random id>-<clean file name>. The patient id folder is required by our security rules. */
export function buildStoragePath(userId: string, file: File): string {
  const extension = EXTENSION_BY_MIME[file.type] ?? "bin";
  const baseName = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const safeName = baseName || "prescription";
  return `${userId}/${crypto.randomUUID()}-${safeName}.${extension}`;
}

export function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith(".pdf");
}
