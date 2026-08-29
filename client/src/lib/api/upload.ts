import limitsJson from "@/contract/limits.json";
import type { FileTypeSpec, FileValidationError, UploadEnvelope, UploadResult } from "@/interfaces/sources.interface";
import type { FileSourceType, SourceType, UrlSourceType } from "@/types/sources.types";

export type { FileSourceType, SourceType, UrlSourceType } from "@/types/sources.types";
export type { FileTypeSpec, FileValidationError, UploadEnvelope, UploadResult } from "@/interfaces/sources.interface";

export const FILE_TYPE_SPECS: Readonly<Record<FileSourceType, FileTypeSpec>> = {
  PDF: {
    type: "PDF",
    label: "PDF",
    accept: ".pdf,application/pdf",
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
  },
  TEXT: {
    type: "TEXT",
    label: "Text",
    accept: ".txt,.md,text/plain,text/markdown",
    extensions: [".txt", ".md"],
    mimeTypes: ["text/plain", "text/markdown", "text/x-markdown"],
  },
  VTT: {
    type: "VTT",
    label: "VTT",
    accept: ".vtt,text/vtt",
    extensions: [".vtt"],
    // Some browsers report VTT with a bare text/plain mime. Accept both; the
    // server re-validates content on ingest.
    mimeTypes: ["text/vtt", "text/plain"],
  },
} as const;

/** Human-readable option list for the segmented control. */
export const SOURCE_TYPE_OPTIONS: ReadonlyArray<{
  readonly type: SourceType;
  readonly label: string;
  readonly kind: "file" | "url";
}> = [
  { type: "PDF", label: "PDF", kind: "file" },
  { type: "TEXT", label: "Text", kind: "file" },
  { type: "VTT", label: "VTT", kind: "file" },
  { type: "WEB_URL", label: "Web URL", kind: "url" },
  { type: "YOUTUBE_VIDEO", label: "YouTube video", kind: "url" },
  { type: "YOUTUBE_PLAYLIST", label: "YouTube playlist", kind: "url" },
];

/**
 * MIME strings that mean "this OS has no registration for that extension",
 * not "this is the wrong kind of file". The extension check is the real
 * gate; the server re-validates content during extraction.
 */
const UNKNOWN_MIME_TYPES: ReadonlySet<string> = new Set([
  "application/octet-stream",
  "binary/octet-stream",
]);

/**
 * Validate a picked file against the type spec AND the plan's `maxFileBytes`.
 * Called before the upload-intent request so a 10MB transfer is never wasted
 * on a file the server will reject.
 */
export function validateFile(
  file: File,
  spec: FileTypeSpec,
  maxBytes: number | null,
): FileValidationError | null {
  if (file.size === 0) {
    return { code: "EMPTY_FILE", message: "This file is empty." };
  }
  const lower = file.name.toLowerCase();
  const okExt = spec.extensions.some((ext) => lower.endsWith(ext));
  if (!okExt) {
    return {
      code: "EXTENSION_NOT_ALLOWED",
      message: `Expected ${spec.extensions.join(" or ")}, got "${file.name}".`,
    };
  }
  // The extension already matched, so a browser that reports no MIME — or the
  // generic "unknown bytes" type — is not evidence of the wrong file. macOS
  // has no registration for .vtt and reports application/octet-stream, which
  // used to block every legitimate subtitle upload. Treat those as unknown
  // and let the server re-validate the actual content on ingest.
  if (file.type && !UNKNOWN_MIME_TYPES.has(file.type) && !spec.mimeTypes.includes(file.type)) {
    return {
      code: "MIME_NOT_ALLOWED",
      message: `File reports type "${file.type}"; expected ${spec.mimeTypes.join(", ")}.`,
    };
  }
  if (maxBytes !== null && file.size > maxBytes) {
    return {
      code: "FILE_TOO_LARGE",
      message: `File is ${formatBytes(file.size)}. Your plan caps uploads at ${formatBytes(maxBytes)}.`,
    };
  }
  return null;
}

/**
 * Cloudinary's raw uploader rejects a `.md` extension, and the API server's
 * mime/extension gate only allows `.txt`/`.text` for a TEXT source. Markdown
 * is just UTF-8 text, so we relabel a picked `.md` file as `.txt` with a
 * `text/plain` mime before uploading — same bytes, an extension every layer
 * accepts. Any non-markdown file is returned unchanged.
 */
export function normalizeTextUpload(file: File): File {
  const lower = file.name.toLowerCase();
  const isMarkdown =
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    file.type === "text/markdown" ||
    file.type === "text/x-markdown";
  if (!isMarkdown) return file;
  const base = file.name.replace(/\.(md|markdown)$/i, "");
  const renamed = `${base.length > 0 ? base : "document"}.txt`;
  return new File([file], renamed, {
    type: "text/plain",
    lastModified: file.lastModified,
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

/**
 * Detect which URL-based source type a pasted string matches. Returns `null` if
 * the string is not a valid absolute HTTP(S) URL — the caller renders an inline
 * error rather than guessing. Playlist detection wins over video detection so a
 * `watch?v=...&list=...` URL is treated as a playlist.
 */
export function detectUrlType(input: string): UrlSourceType | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (YT_HOSTS.has(host)) {
    if (url.searchParams.has("list")) return "YOUTUBE_PLAYLIST";
    if (url.pathname === "/playlist") return "YOUTUBE_PLAYLIST";
    return "YOUTUBE_VIDEO";
  }
  return "WEB_URL";
}


/**
 * POST the file directly to Cloudinary using XHR so we get real byte-level
 * progress. `fetch` cannot report upload progress in any browser today — that
 * is not a limitation of this codebase, it is the browser API. The XHR wrapper
 * is a Promise so callers can `await` it. Aborting the AbortSignal cancels the
 * transfer and rejects with a DOMException.
 *
 * @param onProgress fires with 0..1 as bytes flush; may fire many times per second.
 * @throws when Cloudinary responds non-2xx, when the transfer is aborted, or on network error.
 */
export function uploadFileToCloudinary(args: {
  envelope: UploadEnvelope;
  file: File;
  onProgress: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<UploadResult> {
  const { envelope, file, onProgress, signal } = args;
  return new Promise<UploadResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", envelope.apiKey);
    form.append("timestamp", String(envelope.timestamp));
    form.append("signature", envelope.signature);
    form.append("public_id", envelope.publicId);
    form.append('type', 'authenticated');
    // form.append("folder", envelope.folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", envelope.uploadUrl, true);
    xhr.responseType = "json";

    const onAbort = () => {
      xhr.abort();
    };
    signal?.addEventListener("abort", onAbort);

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable || evt.total <= 0) return;
      const fraction = Math.min(1, evt.loaded / evt.total);
      onProgress(fraction);
    };
    xhr.onload = () => {
      signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        const body = xhr.response as { public_id?: string } | null;
        resolve({ publicId: body?.public_id ?? envelope.publicId });
      } else {
        reject(
          new Error(
            `Cloudinary upload failed (${xhr.status})${
              typeof xhr.response === "object" && xhr.response !== null
                ? `: ${JSON.stringify(xhr.response)}`
                : ""
            }`,
          ),
        );
      }
    };
    xhr.onerror = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Network error during upload"));
    };
    xhr.onabort = () => {
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };

    xhr.send(form);
  });
}

/**
 * Extract a YouTube playlist id from any URL that carries one. Returned so the
 * add-source dialog can display the video count *before* the user confirms —
 * the playlist counts against this workspace's source cap and the server
 * rejects the whole import if it would exceed the cap.
 */
export function extractPlaylistId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    const list = url.searchParams.get("list");
    return list && list.length > 0 ? list : null;
  } catch {
    return null;
  }
}

/** Small pass-through so components don't hardcode limits.json paths. */
export const FREE_PLAYLIST_CAP = limitsJson.plans.FREE.maxPlaylistVideos;
