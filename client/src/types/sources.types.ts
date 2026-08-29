/**
 * Source-domain type aliases: the contract-derived shapes the source
 * hooks and lib/api/upload consumers pass around.
 */
import type { GetResult, PostResult } from "@/lib/api/types";

export type SourceType =
  | "PDF"
  | "TEXT"
  | "VTT"
  | "WEB_URL"
  | "YOUTUBE_VIDEO"
  | "YOUTUBE_PLAYLIST";

export type FileSourceType = Extract<SourceType, "PDF" | "TEXT" | "VTT">;
export type UrlSourceType = Extract<
  SourceType,
  "WEB_URL" | "YOUTUBE_VIDEO" | "YOUTUBE_PLAYLIST"
>;

export type Source = GetResult<"/workspaces/{workspaceId}/sources">[number];
export type SourceDetail = GetResult<"/sources/{sourceId}">;
export type UploadIntent = PostResult<"/workspaces/{workspaceId}/sources/upload-intent">;
export type SourcePreview = GetResult<"/sources/{sourceId}/preview">;

export type CreateSourceBody =
  | {
      type: FileSourceType;
      publicId: string;
      fileName: string;
      sizeBytes: number;
    }
  | {
      type: UrlSourceType;
      url: string;
    };
