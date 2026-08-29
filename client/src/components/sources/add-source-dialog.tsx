"use client";

import * as React from "react";
import { Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/providers/toast";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import {
  useCreateSource,
  useUploadIntent,
  type CreateSourceBody,
} from "@/hooks/use-sources";
import {
  FILE_TYPE_SPECS,
  FREE_PLAYLIST_CAP,
  SOURCE_TYPE_OPTIONS,
  detectUrlType,
  extractPlaylistId,
  formatBytes,
  normalizeTextUpload,
  uploadFileToCloudinary,
  validateFile,
  type FileSourceType,
  type SourceType,
  type UrlSourceType,
} from "@/lib/api/upload";

interface Props {
  workspaceId: string;
  sourceCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Selected = SourceType;

export function AddSourceDialog({ workspaceId, sourceCount, open, onOpenChange }: Props) {
  const [selected, setSelected] = React.useState<Selected>("PDF");
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [urlInput, setUrlInput] = React.useState("");
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const plan = usePlanLimits();
  const uploadIntent = useUploadIntent();
  const createSource = useCreateSource();

  const maxFileBytes = plan.limits?.maxFileBytes ?? null;
  const maxSources = plan.limits?.maxSourcesPerWorkspace ?? null;
  const remainingSlots =
    maxSources === null ? Infinity : Math.max(0, maxSources - sourceCount);

  function reset() {
    setSelected("PDF");
    setFile(null);
    setFileError(null);
    setUrlInput("");
    setUrlError(null);
    setProgress(null);
    setSubmitting(false);
    abortRef.current?.abort();
    abortRef.current = null;
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  // Paste detection: if the user pastes a URL while on a file tab (or vice
  // versa), move the segmented control so the input stays coherent.
  function handleUrlChange(next: string) {
    setUrlInput(next);
    setUrlError(null);
    const detected = detectUrlType(next);
    if (detected !== null && isUrlType(selected) && detected !== selected) {
      setSelected(detected);
    } else if (detected !== null && !isUrlType(selected)) {
      setSelected(detected);
    }
  }

  function handlePickFile(picked: File | null) {
    if (!picked) {
      setFile(null);
      setFileError(null);
      return;
    }
    if (!isFileType(selected)) {
      // The user dropped a file while on a URL tab — infer from extension.
      const inferred = inferFileType(picked.name);
      if (inferred !== null) setSelected(inferred);
      else {
        setFileError("Unrecognised file type. Pick PDF, .txt/.md or .vtt.");
        return;
      }
    }
    const spec =
      FILE_TYPE_SPECS[
        (isFileType(selected) ? selected : inferFileType(picked.name)) as FileSourceType
      ];
    const err = validateFile(picked, spec, maxFileBytes);
    if (err) {
      setFile(null);
      setFileError(err.message);
      return;
    }
    setFile(picked);
    setFileError(null);
  }

  async function submitFile(pickedType: FileSourceType) {
    if (!file) {
      setFileError("Choose a file first.");
      return;
    }
    const spec = FILE_TYPE_SPECS[pickedType];
    const validationError = validateFile(file, spec, maxFileBytes);
    if (validationError) {
      setFileError(validationError.message);
      return;
    }
    // Markdown is uploaded as plain text: Cloudinary's raw uploader (and the
    // server's mime gate) reject a `.md` extension, so relabel it to `.txt`
    // with the same bytes before the transfer.
    const uploadFile = normalizeTextUpload(file);
    setSubmitting(true);
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const envelope = await uploadIntent.mutateAsync({
        workspaceId,
        fileName: uploadFile.name,
        mimeType: uploadFile.type || spec.mimeTypes[0] || "application/octet-stream",
        sizeBytes: uploadFile.size,
      });
      const uploadResult = await uploadFileToCloudinary({
        envelope,
        file: uploadFile,
        onProgress: setProgress,
        signal: controller.signal,
      });
      const body: CreateSourceBody = {
        type: pickedType,
        // publicId: envelope.publicId,
        publicId: uploadResult.publicId,
        fileName: uploadFile.name,
        sizeBytes: uploadFile.size,
      };
      await createSource.mutateAsync({ workspaceId, body });
      toast.success(`Added "${uploadFile.name}".`);
      handleOpenChange(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setFileError("Upload cancelled.");
      } else if (toast.isApiError(err)) {
        if (err.code === "PLAN_LIMIT_EXCEEDED") {
          setFileError(err.message || "You've reached your source limit on this plan.");
        } else {
          setFileError(err.message);
          toast.error(err, "Upload failed");
        }
      } else if (err instanceof Error) {
        setFileError(err.message);
      } else {
        setFileError("Upload failed.");
      }
      setProgress(null);
      setSubmitting(false);
      abortRef.current = null;
    }
  }

  async function submitUrl(pickedType: UrlSourceType) {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setUrlError("Paste a URL.");
      return;
    }
    if (detectUrlType(trimmed) === null) {
      setUrlError("That doesn't look like a valid http(s) URL.");
      return;
    }
    setSubmitting(true);
    try {
      const body: CreateSourceBody = { type: pickedType, url: trimmed };
      await createSource.mutateAsync({ workspaceId, body });
      toast.success("Source queued.");
      handleOpenChange(false);
    } catch (err) {
      if (toast.isApiError(err)) {
        if (err.code === "PLAN_LIMIT_EXCEEDED") {
          setUrlError(err.message || "You've reached your source limit on this plan.");
        } else {
          setUrlError(err.message);
          toast.error(err, "Couldn't add source");
        }
      } else if (err instanceof Error) {
        setUrlError(err.message);
      }
      setSubmitting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (remainingSlots === 0) {
      const msg = "This workspace is at its source limit for your plan.";
      if (isFileType(selected)) setFileError(msg);
      else setUrlError(msg);
      return;
    }
    if (isFileType(selected)) {
      await submitFile(selected);
    } else {
      await submitUrl(selected);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <DialogHeader>
            <DialogTitle>Add source</DialogTitle>
            <DialogDescription>
              Attach content this workspace can chat against. A source belongs
              to exactly one workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <SegmentedControl
              value={selected}
              onChange={(next) => {
                setSelected(next);
                setFileError(null);
                setUrlError(null);
              }}
              disabled={submitting}
            />
          </div>

          <div className="mt-4">
            {isFileType(selected) ? (
              <FilePane
                type={selected}
                file={file}
                error={fileError}
                onPick={handlePickFile}
                maxFileBytes={maxFileBytes}
                progress={progress}
                disabled={submitting}
              />
            ) : (
              <UrlPane
                type={selected}
                value={urlInput}
                onChange={handleUrlChange}
                error={urlError}
                remainingSlots={remainingSlots}
                disabled={submitting}
              />
            )}
          </div>

          <DialogFooter className="mt-6">
            {submitting && progress !== null ? (
              <Button
                variant="secondary"
                type="button"
                onClick={() => abortRef.current?.abort()}
              >
                Cancel upload
              </Button>
            ) : (
              <Button
                variant="secondary"
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
            )}
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting
                ? isFileType(selected) && progress !== null
                  ? `Uploading ${Math.round(progress * 100)}%`
                  : "Adding…"
                : selected === "YOUTUBE_PLAYLIST"
                  ? "Import playlist"
                  : "Add source"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- segmented control ---------- */

function SegmentedControl({
  value,
  onChange,
  disabled,
}: {
  value: Selected;
  onChange: (next: Selected) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Source type"
      className="grid grid-cols-3 gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)] p-1"
    >
      {SOURCE_TYPE_OPTIONS.map((opt) => {
        const active = opt.type === value;
        return (
          <button
            key={opt.type}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.type)}
            disabled={disabled}
            className={cn(
              "relative rounded-[6px] px-2 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] transition-colors",
              active
                ? "bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- file pane ---------- */

function FilePane({
  type,
  file,
  error,
  onPick,
  maxFileBytes,
  progress,
  disabled,
}: {
  type: FileSourceType;
  file: File | null;
  error: string | null;
  onPick: (file: File | null) => void;
  maxFileBytes: number | null;
  progress: number | null;
  disabled: boolean;
}) {
  const spec = FILE_TYPE_SPECS[type];
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          const dropped = e.dataTransfer.files[0] ?? null;
          onPick(dropped);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) inputRef.current?.click();
          }
        }}
        aria-disabled={disabled}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-chassis)] border-2 border-dashed p-7 text-center transition-colors",
          dragging
            ? "border-[var(--color-line-cobalt)] bg-[var(--color-surface-2)]"
            : "border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]",
          disabled && "cursor-not-allowed opacity-70",
        )}
      >
        <Upload className="h-5 w-5 text-[var(--color-fg-muted)]" aria-hidden />
        {file ? (
          <div>
            <p className="text-sm font-medium">{file.name}</p>
            <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
              {formatBytes(file.size)}
            </p>
          </div>
        ) : (
          <div className="text-xs text-[var(--color-fg-muted)]">
            <p>
              Drop your {spec.label} here or{" "}
              <span className="text-[var(--color-line-cobalt-text)] underline">browse</span>.
            </p>
            <p className="mt-1">
              Accepts {spec.extensions.join(", ")}
              {maxFileBytes !== null && ` · up to ${formatBytes(maxFileBytes)}`}
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={spec.accept}
          disabled={disabled}
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </div>
      {progress !== null && (
        <div>
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div
              className="h-full rounded-full bg-[var(--color-line-cobalt)] transition-[width] duration-200 ease-out"
              style={{ width: `${Math.round(progress * 100)}%` }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label="Upload progress"
            />
          </div>
          <p className="tabular mt-1.5 flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)]">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Uploading {Math.round(progress * 100)}%
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-[var(--color-danger-text)]">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------- URL pane ---------- */

function UrlPane({
  type,
  value,
  onChange,
  error,
  remainingSlots,
  disabled,
}: {
  type: UrlSourceType;
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  remainingSlots: number;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <label htmlFor="source-url" className="text-sm text-[var(--color-fg)]">
        {labelFor(type)}
      </label>
      <input
        id="source-url"
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder={placeholderFor(type)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={error !== null}
        aria-describedby={error ? "source-url-error" : undefined}
        className="w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)] px-3 py-2.5 text-sm text-[var(--color-fg)] transition-colors placeholder:text-[var(--color-fg-muted)] focus:border-[var(--color-line-cobalt)]"
      />
      {type === "YOUTUBE_PLAYLIST" && (
        <PlaylistNotice value={value} remainingSlots={remainingSlots} />
      )}
      {error && (
        <p id="source-url-error" role="alert" className="text-xs text-[var(--color-danger-text)]">
          {error}
        </p>
      )}
    </div>
  );
}

function PlaylistNotice({
  value,
  remainingSlots,
}: {
  value: string;
  remainingSlots: number;
}) {
  const playlistId = extractPlaylistId(value);
  // The client cannot know the exact video count without a YouTube API call,
  // so we do the honest thing: show the plan cap the import will be measured
  // against, and warn if the workspace's remaining source slots are the
  // tighter constraint.
  return (
    <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)] p-3 text-xs leading-relaxed text-[var(--color-fg-muted)]">
      <p className="font-medium text-[var(--color-fg)]">Before you import</p>
      <p className="mt-1">
        Every video in the playlist becomes its own source and counts against
        this workspace&rsquo;s source limit
        {Number.isFinite(remainingSlots)
          ? ` (${remainingSlots} slot${remainingSlots === 1 ? "" : "s"} left)`
          : ""}
        . Free plans cap imports at {FREE_PLAYLIST_CAP} videos per playlist. If
        the import would exceed either cap the server rejects the whole thing
        &mdash; nothing partial is created.
      </p>
      {playlistId === null && value.trim().length > 0 && (
        <p className="mt-2 text-[var(--color-danger-text)]">
          Couldn&rsquo;t find a playlist id in that URL. Make sure it contains
          <code className="mx-1">?list=…</code>.
        </p>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function isFileType(t: SourceType): t is FileSourceType {
  return t === "PDF" || t === "TEXT" || t === "VTT";
}

function isUrlType(t: SourceType): t is UrlSourceType {
  return t === "WEB_URL" || t === "YOUTUBE_VIDEO" || t === "YOUTUBE_PLAYLIST";
}

function inferFileType(fileName: string): FileSourceType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "TEXT";
  if (lower.endsWith(".vtt")) return "VTT";
  return null;
}

function labelFor(type: UrlSourceType): string {
  switch (type) {
    case "WEB_URL":
      return "Web page URL";
    case "YOUTUBE_VIDEO":
      return "YouTube video URL";
    case "YOUTUBE_PLAYLIST":
      return "YouTube playlist URL";
  }
}

function placeholderFor(type: UrlSourceType): string {
  switch (type) {
    case "WEB_URL":
      return "https://example.com/article";
    case "YOUTUBE_VIDEO":
      return "https://youtube.com/watch?v=…";
    case "YOUTUBE_PLAYLIST":
      return "https://youtube.com/playlist?list=…";
  }
}
