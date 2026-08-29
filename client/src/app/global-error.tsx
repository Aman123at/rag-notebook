"use client";

import { useState } from "react";

/**
 * Last-resort boundary. It renders when the root layout itself throws, which
 * means no providers, no fonts, and no design tokens — globals.css may never
 * have loaded. So every value here is written out literally, and the world is
 * carried by geometry rather than by CSS variables: the enamel ground, the
 * porcelain hairline chassis, the scarlet spine down the disruption, the
 * roundel drawn as an inline SVG, and the digest in mono.
 *
 * The hex values are the tokens from globals.css, copied deliberately. This is
 * the one file in the app allowed to restate them, because the only way it can
 * be wrong is if the stylesheet is missing — which is exactly when it renders.
 */

const ENAMEL = "#0b1230";
const RAISED = "#111a3d";
const PORCELAIN = "#ffffff";
const DIM = "#9bb0d4";
const HAIRLINE = "rgba(255, 255, 255, 0.22)";
const SCARLET_TEXT = "#ff6b63"; /* 6.59:1 on enamel — the text tint, not the raw ink */
const COBALT = "#1e5bff";
const SANS = "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const digest = error.digest ?? "";
  const cause = error.message.trim();
  const [copied, setCopied] = useState(false);

  async function copyDigest() {
    try {
      await navigator.clipboard.writeText(digest);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <html lang="en">
      <body
        style={{
          background: ENAMEL,
          color: PORCELAIN,
          fontFamily: SANS,
          minHeight: "100vh",
          margin: 0,
          padding: "48px 16px",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <main style={{ maxWidth: 560, marginInline: "auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 24,
            }}
          >
            {/* The roundel, drawn here rather than imported: this boundary must
                not depend on anything the failing layout also depends on. */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="8" stroke="#7ba4ff" strokeWidth="3.2" />
              <rect x="1.5" y="10.1" width="21" height="3.8" rx="0.6" fill="#7ba4ff" />
            </svg>
            RAG Notebook
          </div>

          <section
            role="alert"
            style={{
              background: RAISED,
              border: `1px solid ${HAIRLINE}`,
              borderLeft: `3px solid ${SCARLET_TEXT}`,
              borderRadius: 14,
              padding: 24,
            }}
          >
            <p
              style={{
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: SCARLET_TEXT,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {/* Icon and word together — colour never carries the severity alone. */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3.5 22 20H2L12 3.5Z"
                  stroke={SCARLET_TEXT}
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path d="M12 10v4" stroke={SCARLET_TEXT} strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="17" r="1.1" fill={SCARLET_TEXT} />
              </svg>
              Service suspended
            </p>

            <h1 style={{ fontSize: 24, lineHeight: 1.2, margin: "14px 0 0", fontWeight: 700 }}>
              The app failed to start.
            </h1>

            <p style={{ color: DIM, fontSize: 14, lineHeight: 1.65, margin: "12px 0 0" }}>
              {cause || "Something failed before any screen could be drawn."}
            </p>
            <p style={{ color: DIM, fontSize: 14, lineHeight: 1.65, margin: "12px 0 0" }}>
              This is the whole application, not one page. Reloading is the only
              recovery from here
              {digest ? "; if it happens again, send support the digest below." : "."}
            </p>

            <button
              type="button"
              onClick={reset}
              style={{
                background: COBALT,
                color: PORCELAIN,
                padding: "10px 20px",
                marginTop: 20,
                borderRadius: 8,
                border: 0,
                cursor: "pointer",
                fontFamily: SANS,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Reload the app
            </button>

            {digest ? (
              <div style={{ borderTop: `1px solid ${HAIRLINE}`, marginTop: 24, paddingTop: 16 }}>
                <span
                  style={{
                    color: DIM,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Digest
                </span>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 6,
                  }}
                >
                  <code
                    style={{
                      fontFamily: MONO,
                      fontSize: 12,
                      wordBreak: "break-all",
                      color: PORCELAIN,
                    }}
                  >
                    {digest}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyDigest()}
                    style={{
                      background: "transparent",
                      color: PORCELAIN,
                      border: `1px solid rgba(255, 255, 255, 0.42)`,
                      borderRadius: 8,
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontFamily: SANS,
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </main>
      </body>
    </html>
  );
}
