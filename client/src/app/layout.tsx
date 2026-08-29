import type { Metadata, Viewport } from "next";
import { Archivo, Overpass, Spline_Sans_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { LoaderProvider } from "@/providers/loader";
import { QueryProvider } from "@/providers/query";
import { ApiProvider } from "@/providers/api";
import { ToastProvider } from "@/providers/toast";
import "./globals.css";

// Faces verified against node_modules/next/dist/compiled/@next/font/dist/google/index.d.ts
// before use, per CLAUDE.md Law 1. Archivo exposes a real `wdth` axis, so the
// expanded display caps are native rather than synthetically stretched.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: "variable",
  axes: ["wdth"],
  display: "swap",
});

// Overpass descends from Highway Gothic — the actual wayfinding tradition this
// world is built from, rather than an allusion to it.
const overpass = Overpass({
  subsets: ["latin"],
  variable: "--font-overpass",
  weight: "variable",
  display: "swap",
});

// Every locator, timecode, token count and request id.
const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-spline-mono",
  weight: "variable",
  display: "swap",
});

const DIRECTION_CONTRACT = `<!--
THESIS: A workspace is a transit network - sources are lines, citations are stations,
an answer is a traced route. Refuses the category's grey rail beside a chat transcript
with footnote-sized citations.
OWN-WORLD: Midnight enamel ground, porcelain hairline chassis cards, eight saturated
line inks, tracked caps labels, tabular mono locators. Recognizable with all content
removed.
STORY: The reader sees which line carried each claim, and rides it to the source.
FIRST VIEWPORT: Workspace as live network - line legend left, answer centre, each
citation a station tag; composer as journey planner docked bottom.
FORM: Midnight transit diagram; user-chosen challenger over assigned index 3; seed ragnb01.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`;

export const metadata: Metadata = {
  title: "RAG Notebook",
  description: "Chat against your PDFs, videos, and web sources with traceable citations.",
};

export const viewport: Viewport = {
  themeColor: "#0b1230",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html
        lang="en"
        className={`dark ${archivo.variable} ${overpass.variable} ${splineMono.variable}`}
        // Browser extensions commonly stamp classes/attributes onto <html> before
        // React hydrates (e.g. a trailing `hydrated` class), which React reports as a
        // mismatch. This suppresses the warning for this element's own attributes
        // only — mismatches anywhere inside the tree are still reported.
        suppressHydrationWarning
      >
        <body className="min-h-screen antialiased">
          {/* The direction contract, emitted as a real HTML comment so it survives the
              production build and can be grepped in the output by its seed key. React
              does not render JSX comments into markup, hence the hidden carrier. */}
          <div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
          <QueryProvider>
            <ApiProvider>
              <LoaderProvider>
                {children}
                <ToastProvider />
              </LoaderProvider>
            </ApiProvider>
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
