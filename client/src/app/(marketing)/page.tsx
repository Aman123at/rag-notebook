import type { Metadata } from "next";
import Link from "next/link";
import { Show } from "@clerk/nextjs";
import {
  CircleCheck,
  Database,
  Infinity as InfinityIcon,
  KeyRound,
  Layers,
  Lock,
  MessageSquareQuote,
  Radio,
  Server,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerPreview } from "@/components/marketing/answer-preview";
import { PrimaryCta } from "@/components/marketing/primary-cta";
import { RoadmapPreview } from "@/components/marketing/roadmap-preview";
import { SectionMark } from "@/components/marketing/section-mark";
import { Roundel } from "@/components/ui/roundel";
import { limitsForPlan, retrievalTunables } from "@/lib/limits";

export const metadata: Metadata = {
  title: "RAG Notebook — answers you can check, line by line",
  description:
    "Ask your PDFs, videos, and web sources. Every sentence links to the page or timestamp it came from, and the free plan is built to actually be used.",
};

const free = limitsForPlan("FREE");
const pro = limitsForPlan("PRO");
const retrieval = retrievalTunables();

function count(n: number | null): string {
  return n === null ? "Unlimited" : n.toLocaleString("en-US");
}

function megabytes(bytes: number | null): string {
  return bytes === null ? "Unlimited" : `${Math.round(bytes / 1_048_576)} MB`;
}

/**
 * One rendering of a token allowance, everywhere. This used to abbreviate a
 * million to "1M" while the fare card in the app wrote the same number as
 * "1,000,000" — the same allowance in two notations, one click apart. The
 * grouped form is the one the product already uses where the number matters.
 */
function tokens(n: number | null): string {
  return n === null ? "Unlimited" : n.toLocaleString("en-US");
}

const PIPELINE = [
  {
    icon: Layers,
    step: "01",
    title: "Two searches, not one",
    body: `Each question runs a dense semantic search and a sparse keyword search side by side — ${retrieval.denseTopK} candidates each. Meaning-based search alone misses exact terms; keyword search alone misses paraphrase. Running both catches what either would drop.`,
  },
  {
    icon: Target,
    step: "02",
    title: "Fused, then narrowed hard",
    body: `Reciprocal rank fusion merges both lists, and only the top ${retrieval.finalTopK} passages survive — at most ${retrieval.maxPerSource} from any single source. A long document can’t crowd out the one paragraph that actually answers you.`,
  },
  {
    icon: MessageSquareQuote,
    step: "03",
    title: "Bound to its evidence",
    body: "Every sentence carries the passage it came from. Click a marker and the PDF opens on that page with the exact text highlighted, or the video seeks to that second. Checking an answer takes one click, not a re-read.",
  },
] as const;

const FEATURES = [
  {
    title: "It says when it doesn’t know",
    body: "When the retrieved passages don’t answer the question, you get told that — not a confident paragraph assembled from nothing. Silence is a valid answer here.",
  },
  {
    title: "PDFs with real page anchors",
    body: "Citations resolve to a page and a highlighted run of text in the rendered document, not a vague filename reference.",
  },
  {
    title: "Video that answers by timestamp",
    body: "Drop a video or a whole playlist. Transcripts are chunked on topic boundaries, so a citation lands on the moment, not the hour.",
  },
  {
    title: "A workspace, told back as a podcast",
    body: "Turn every ready source into a ~5-minute audio overview — two hosts talking through the material the way a briefing would. Generated on demand and streamed back as audio you can play anywhere.",
  },
  {
    title: "Web pages, kept as sources",
    body: "Add a URL and it becomes a first-class source in the workspace — retrieved, ranked, and cited like everything else.",
  },
  {
    title: "Memories that carry over",
    body: "Tell a workspace what matters once — house style, an acronym, who the audience is — and every later answer takes it into account.",
  },
  {
    title: "Indexing status you can trust",
    body: "A source reads “indexed” only after the server finishes embedding it. No progress bar theatre, no answering from a half-read file.",
  },
] as const;

const ROADMAP_POINTS = [
  `Up to ${count(free.maxPlaylistVideos)} videos in a playlist on the free plan, ${count(pro.maxPlaylistVideos)} on Pro.`,
  "Every video in the route stays a source in the workspace, so a question about the course comes back cited to the minute it was answered at.",
  "Videos that never finished indexing are named, not hidden — you always know what the route doesn’t cover.",
  "Ticking a module off is kept in your browser, so the route remembers where you stopped.",
] as const;

const SECURITY = [
  {
    icon: Lock,
    title: "Your sources stay yours",
    body: "Documents are stored per workspace, scoped to your account, and never pooled into training data.",
  },
  {
    icon: KeyRound,
    title: "Authenticated on every call",
    body: "Every request carries a signed session. There is no anonymous read path to a workspace, ever.",
  },
  {
    icon: Server,
    title: "Retrieval runs server-side",
    body: "Embeddings and ranking happen on our infrastructure and answers are streamed back — your files are never shipped to the browser to be searched.",
  },
  {
    icon: Database,
    title: "Delete means deleted",
    body: "Remove a source and its chunks and embeddings go with it. Delete a workspace and the whole index is dropped.",
  },
] as const;

/**
 * Podcast slots are not in the vendored client limits contract yet — it predates
 * the feature and can't be re-vendored in this tree — so these mirror
 * `maxPodcasts` in the server contract's plan limits (a concurrent-slot count
 * across all of a user's workspaces). Swap to `count(free.maxPodcasts)` once a
 * contract drop publishes the field.
 */
const FREE_PODCASTS = 1;
const PRO_PODCASTS = 10;

const COMPARISON = [
  { label: "Workspaces", free: count(free.maxWorkspaces), pro: count(pro.maxWorkspaces) },
  {
    label: "Sources per workspace",
    free: count(free.maxSourcesPerWorkspace),
    pro: count(pro.maxSourcesPerWorkspace),
  },
  { label: "Tokens included", free: tokens(free.lifetimeTokens), pro: tokens(pro.lifetimeTokens) },
  { label: "Upload size", free: megabytes(free.maxFileBytes), pro: megabytes(pro.maxFileBytes) },
  {
    label: "Videos per playlist",
    free: count(free.maxPlaylistVideos),
    pro: count(pro.maxPlaylistVideos),
  },
  {
    label: "Podcast overviews",
    free: count(FREE_PODCASTS),
    pro: count(PRO_PODCASTS),
  },
  { label: "Citations on every answer", free: "Included", pro: "Included" },
] as const;

const FAQ = [
  {
    q: "What stops it from making things up?",
    a: "Answers are generated only from passages retrieved out of your own sources, and every sentence is bound to the passage behind it. If retrieval comes back empty, the answer says so instead of filling the gap. You never have to take a claim on faith — the evidence is one click away.",
  },
  {
    q: "Is the free plan a trial?",
    a: `No. It’s a plan. You get ${count(free.maxWorkspaces)} workspaces, ${count(free.maxSourcesPerWorkspace)} sources in each, and ${tokens(free.lifetimeTokens)} tokens without entering a card. Upgrade when you outgrow it, not when a countdown ends.`,
  },
  {
    q: "What can I put in a workspace?",
    a: `PDFs and documents up to ${megabytes(free.maxFileBytes)} on the free plan, videos and playlists up to ${count(free.maxPlaylistVideos)} videos, and web pages by URL. Everything in a workspace is searched together, and every answer tells you which source it leaned on.`,
  },
  {
    q: "Do you train on my documents?",
    a: "No. Your sources are used to answer your questions inside your workspaces. They are not pooled, not shared between accounts, and not used as training data.",
  },
  {
    q: "What happens when I run out of tokens?",
    a: "Answering pauses and the app tells you plainly, with your remaining balance shown in your profile. Nothing is deleted, and your workspaces stay exactly as you left them.",
  },
] as const;

export default function MarketingHome() {
  return (
    <main id="main">
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div
          aria-hidden="true"
          className="marketing-bloom pointer-events-none absolute inset-0"
        />

        <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="marketing-reveal space-y-8">
            {/* The status pill that used to sit here made two claims the
                headline and the free-plan line below already make, in tracked
                caps the system reserves for wayfinding. The network mark opens
                the page instead. */}
            {/* Announcement banner — the newest capability, surfaced at the top
                of the page rather than buried in the feature list below. */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-1.5 pr-4">
              <span className="rounded-full bg-[var(--color-line-cobalt)] px-2.5 py-0.5 font-display text-[0.625rem] uppercase tracking-[0.1em] text-[var(--color-porcelain)]">
                New
              </span>
              <span className="flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)]">
                <Radio className="size-3.5 text-[var(--color-line-cobalt-text)]" aria-hidden="true" />
                Two-host audio overviews of any workspace
              </span>
            </div>

            <Roundel size={40} className="text-[var(--color-line-cobalt-text)]" />

            <h1 className="text-balance text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
              Answers you can check,{" "}
              <span className="text-[var(--color-citation-text)] italic">line by line</span>.
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-[var(--color-fg-muted)]">
              RAG Notebook reads your PDFs, videos, and web pages, then answers
              from them — and only from them. Every sentence links back to the
              page or timestamp it came from, so verifying an answer takes a
              click instead of an afternoon.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <PrimaryCta size="lg" withArrow />
              <Button asChild variant="secondary" size="lg">
                <Link href="#how">See how it retrieves</Link>
              </Button>
            </div>

            <Show when="signed-out">
              <p className="text-sm text-[var(--color-fg-muted)]">
                {tokens(free.lifetimeTokens)} tokens, {count(free.maxWorkspaces)}{" "}
                workspaces, no card required.
              </p>
            </Show>
          </div>

          <div className="marketing-reveal reveal-delay-2 lg:pl-4">
            <AnswerPreview />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- Value prop */}
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <h2 className="text-balance text-3xl leading-tight sm:text-4xl">
              Most RAG tools answer confidently. This one answers{" "}
              <span className="text-[var(--color-line-cobalt-text)]">checkably</span>.
            </h2>
            <div className="space-y-4 text-lg leading-relaxed text-[var(--color-fg-muted)]">
              <p>
                A fluent paragraph with nothing underneath it is the failure
                mode of every retrieval tool — and it&rsquo;s invisible until someone
                acts on it. The fix isn&rsquo;t a better-worded prompt. It&rsquo;s better
                retrieval, and evidence attached to the output.
              </p>
              <p className="text-[var(--color-fg)]">
                So we made the evidence non-optional. If a claim can&rsquo;t point at
                a passage in your sources, it doesn&rsquo;t get made.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- How it works */}
      <section id="how" className="scroll-mt-20 border-b border-[var(--color-border)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <header className="max-w-2xl space-y-3">
            <SectionMark />
            <h2 className="text-3xl leading-tight sm:text-4xl">
              Accuracy is a pipeline, not a prompt
            </h2>
            <p className="text-lg text-[var(--color-fg-muted)]">
              Three things happen between your question and the answer. Each one
              exists to throw away the wrong passage before it reaches the model.
            </p>
          </header>

          {/* An ordered pipeline is a route, so it is drawn as one: three
              numbered stations on a single line. The hidden rule is tucked away
              once the columns stack, because a horizontal line between
              vertically stacked cards would be describing a journey that
              isn't there. */}
          <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
            {PIPELINE.map(({ icon: Icon, step, title, body }, i) => (
              <li key={step} className="relative">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="tabular grid h-9 w-9 flex-none place-items-center rounded-full border-[3px] border-[var(--color-line-cobalt-text)] bg-[var(--color-bg)] font-mono text-xs font-semibold text-[var(--color-line-cobalt-text)]"
                  >
                    {step}
                  </span>
                  {i < PIPELINE.length - 1 && (
                    /* `-mr-6` bridges the grid gutter. Without it the line
                       stops at the column edge and restarts after it, so the
                       route reads as three separate dashes rather than one
                       line running through three stations. */
                    <span
                      aria-hidden="true"
                      className="hidden h-[3px] flex-1 rounded-full bg-[var(--color-line-cobalt-text)] md:-mr-6 md:block"
                    />
                  )}
                </div>
                <Icon
                  className="mt-6 h-5 w-5 text-[var(--color-line-cobalt-text)]"
                  aria-hidden="true"
                />
                <h3 className="mt-3 text-xl">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ Features */}
      <section id="features" className="scroll-mt-20 border-b border-[var(--color-border)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <header className="max-w-2xl space-y-3">
            <SectionMark ink="var(--color-line-amber-text)" />
            <h2 className="text-3xl leading-tight sm:text-4xl">
              Built for the moment someone asks &ldquo;where does that come from?&rdquo;
            </h2>
          </header>

          {/* Six capabilities off one trunk line, each a stop on it. This was a
              3x2 grid of same-size cards carrying an icon, a heading and a
              paragraph — the one section on this page with no form of its own,
              and the shape the craft floor refuses first. The pipeline section
              above already proves the line device carries content; there is no
              reason this section spoke a different language. */}
          <ul className="marketing-branch mt-12 grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {FEATURES.map(({ title, body }) => (
              <li key={title} className="marketing-stop">
                <h3 className="text-lg leading-snug">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------- Roadmap */}
      <section id="roadmap" className="scroll-mt-20 border-b border-[var(--color-border)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-16">
            <header className="space-y-4 lg:sticky lg:top-24">
              <SectionMark ink="var(--color-line-teal-text)" />
              <h2 className="text-3xl leading-tight sm:text-4xl">
                A playlist arrives as a course, not a pile of videos
              </h2>
              <p className="text-lg leading-relaxed text-[var(--color-fg-muted)]">
                Add a YouTube playlist and the server lays out a route through
                it once indexing finishes: modules in order, each one saying
                what you should be able to do at the end of it, how long it
                runs, and which videos it covers.
              </p>

              {/* Stations rather than icon cards: these are stops on the same
                  line the roadmap draws, and each one is a fact the shipped
                  surface already carries. */}
              <ul className="space-y-3 pt-2">
                {ROADMAP_POINTS.map((point) => (
                  <li key={point} className="flex gap-3 text-sm leading-relaxed">
                    <span
                      aria-hidden="true"
                      className="mt-[0.45em] h-2.5 w-2.5 flex-none rounded-full border-2 border-[var(--color-line-teal-text)]"
                    />
                    <span className="text-[var(--color-fg-muted)]">{point}</span>
                  </li>
                ))}
              </ul>
            </header>

            <RoadmapPreview />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Limits */}
      <section id="limits" className="scroll-mt-20 border-b border-[var(--color-border)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
            <header className="space-y-4">
              <SectionMark ink="var(--color-line-green-text)" />
              <h2 className="text-3xl leading-tight sm:text-4xl">
                A free plan you can actually work in
              </h2>
              <p className="text-lg leading-relaxed text-[var(--color-fg-muted)]">
                Most tools hand you three documents and a countdown. You get{" "}
                {count(free.maxWorkspaces)} workspaces,{" "}
                {count(free.maxSourcesPerWorkspace)} sources in each, and{" "}
                {tokens(free.lifetimeTokens)} tokens — enough to finish a real
                project before you decide anything.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <PrimaryCta />
                <Button asChild variant="secondary">
                  <Link href="/pricing">Compare plans</Link>
                </Button>
              </div>
            </header>

            <div className="chassis overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <caption className="sr-only">
                  Free and Pro plan limits, taken from the current plan contract.
                </caption>
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-well)] text-left">
                    <th scope="col" className="px-4 py-3 font-medium">
                      Limit
                    </th>
                    {/* The same two inks the fare card and the pricing cards
                        use for these tiers: porcelain for Free, cobalt for Pro. */}
                    <th scope="col" className="px-4 py-3 font-medium text-[var(--color-porcelain-dim)]">
                      Free
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium text-[var(--color-line-cobalt-text)]">
                      Pro
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.label} className="border-b border-[var(--color-border)] last:border-0">
                      <th scope="row" className="px-4 py-3 text-left font-normal text-[var(--color-fg-muted)]">
                        {row.label}
                      </th>
                      <td className="tabular px-4 py-3 font-medium text-[var(--color-fg)]">
                        {row.free}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-line-cobalt-text)]">
                        <span className="tabular inline-flex items-center gap-1.5">
                          {row.pro === "Unlimited" ? (
                            <InfinityIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {row.pro}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Security */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <header className="max-w-2xl space-y-3">
            <SectionMark ink="var(--color-line-violet-text)" />
            <h2 className="text-3xl leading-tight sm:text-4xl">
              Your documents, and nobody else&rsquo;s business
            </h2>
          </header>

          <ul className="mt-12 grid gap-8 sm:grid-cols-2">
            {SECURITY.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)]">
                  <Icon className="h-4 w-4 text-[var(--color-line-violet-text)]" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-lg">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ----------------------------------------------------------------- FAQ */}
      <section id="faq" className="scroll-mt-20 border-b border-[var(--color-border)]">
        <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
          <h2 className="text-3xl leading-tight sm:text-4xl">Questions worth asking</h2>

          <div className="mt-10 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--radius-control)] text-left text-lg marker:hidden">
                  <span className="font-display">{item.q}</span>
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-fg-muted)] transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 pr-10 leading-relaxed text-[var(--color-fg-muted)]">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- Final CTA */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="marketing-bloom pointer-events-none absolute inset-0 rotate-180"
        />
        <div className="relative mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-28">
          <h2 className="text-balance text-3xl leading-tight sm:text-4xl">
            Put your sources in. Get answers you can defend.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--color-fg-muted)]">
            Create a workspace, add a PDF, and ask it something you already know
            the answer to. Then check the citation.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <PrimaryCta size="lg" withArrow />
            <Button asChild variant="secondary" size="lg">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
