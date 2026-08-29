import { describe, it, expect } from "vitest";
import { FILE_TYPE_SPECS, normalizeTextUpload, validateFile } from "@/lib/api/upload";

describe("normalizeTextUpload", () => {
  it("relabels a .md file as .txt with a text/plain mime, keeping the bytes", async () => {
    const md = new File(["# Title\n\nbody"], "notes.md", { type: "text/markdown" });
    const out = normalizeTextUpload(md);
    expect(out.name).toBe("notes.txt");
    expect(out.type).toBe("text/plain");
    expect(out.size).toBe(md.size);
    expect(await out.text()).toBe("# Title\n\nbody");
  });

  it("handles .markdown, a mime-only signal, and a name that is only an extension", () => {
    expect(normalizeTextUpload(new File(["x"], "readme.markdown")).name).toBe("readme.txt");
    // Markdown reported by mime only, on a name with no extension → append .txt.
    expect(
      normalizeTextUpload(new File(["x"], "plain", { type: "text/x-markdown" })).name,
    ).toBe("plain.txt");
    // Name that is only the extension → falls back to a placeholder base.
    expect(normalizeTextUpload(new File(["x"], ".md")).name).toBe("document.txt");
  });

  it("returns non-markdown files unchanged (same reference)", () => {
    const txt = new File(["hello"], "a.txt", { type: "text/plain" });
    const pdf = new File(["%PDF"], "a.pdf", { type: "application/pdf" });
    expect(normalizeTextUpload(txt)).toBe(txt);
    expect(normalizeTextUpload(pdf)).toBe(pdf);
  });
});

describe("validateFile — MIME handling", () => {
  const vttSpec = FILE_TYPE_SPECS.VTT;

  /**
   * Regression: macOS registers no MIME for `.vtt`, so Chrome reports
   * `application/octet-stream` and every legitimate subtitle upload was
   * rejected client-side even though the server accepts the file.
   */
  it("accepts a .vtt reported as application/octet-stream", () => {
    const file = new File(["WEBVTT\n\n"], "captions.vtt", {
      type: "application/octet-stream",
    });
    expect(validateFile(file, vttSpec, 10_000_000)).toBeNull();
  });

  it("accepts a .vtt with no MIME at all", () => {
    const file = new File(["WEBVTT\n\n"], "captions.vtt", { type: "" });
    expect(validateFile(file, vttSpec, 10_000_000)).toBeNull();
  });

  it("still rejects a genuinely wrong MIME", () => {
    const file = new File(["x"], "captions.vtt", { type: "image/png" });
    expect(validateFile(file, vttSpec, 10_000_000)?.code).toBe("MIME_NOT_ALLOWED");
  });

  it("still rejects a wrong extension", () => {
    const file = new File(["x"], "captions.srt", { type: "text/vtt" });
    expect(validateFile(file, vttSpec, 10_000_000)?.code).toBe("EXTENSION_NOT_ALLOWED");
  });

  it("still enforces the plan byte cap", () => {
    const file = new File(["x".repeat(500)], "captions.vtt", { type: "text/vtt" });
    expect(validateFile(file, vttSpec, 100)?.code).toBe("FILE_TOO_LARGE");
  });
});
