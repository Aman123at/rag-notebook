/**
 * Source-domain object shapes shared by the upload flow.
 */
import type { FileSourceType } from "@/types/sources.types";

/** Per-file-type constraints resolved from the file's extension. */
export interface FileTypeSpec {
  readonly type: FileSourceType;
  readonly label: string;
  readonly accept: string;
  readonly extensions: readonly string[];
  readonly mimeTypes: readonly string[];
}

export interface FileValidationError {
  readonly code:
    | "EXTENSION_NOT_ALLOWED"
    | "MIME_NOT_ALLOWED"
    | "FILE_TOO_LARGE"
    | "EMPTY_FILE";
  readonly message: string;
}

/** Cloudinary upload envelope returned by POST /workspaces/:id/sources/upload-intent. */
export interface UploadEnvelope {
  uploadUrl: string;
  publicId: string;
  timestamp: number;
  signature: string;
  apiKey: string;
  resourceType: "auto" | "image" | "video" | "raw";
  expiresAt: string;
}

export interface UploadResult {
  publicId: string;
}
