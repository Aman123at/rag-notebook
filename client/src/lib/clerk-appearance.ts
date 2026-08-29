import type { ComponentProps } from "react";
import type { ClerkProvider, SignIn } from "@clerk/nextjs";

/**
 * Clerk's prebuilt components, dressed as chassis cards.
 *
 * Signatures read from the installed types before use (CLAUDE.md Law 1) —
 * @clerk/nextjs 7.8.2, types in
 * node_modules/.pnpm/@clerk+react@6.14.7_.../node_modules/@clerk/react/dist/types-Dd22QRBT.d.mts:
 *
 *   type Appearance<T = Theme> = T & GlobalAppearanceOptions & { signIn?: T; signUp?: T; ... }
 *   type Theme = { theme?: BaseTheme | BaseTheme[]; options?: Options;
 *                  variables?: Variables; elements?: Elements; captcha?: ... }
 *   type GlobalAppearanceOptions = { cssLayerName?: string }
 *   type Variables = { colorPrimary?: CssColorOrScale; colorBackground?: CssColor;
 *                      colorForeground?: CssColor; colorMutedForeground?: CssColor;
 *                      colorInput?: CssColor; colorBorder?: CssColor; colorRing?: CssColor;
 *                      colorShadow?: CssColor; colorDanger/Success/Warning?: CssColorOrScale;
 *                      colorNeutral?: CssColorOrAlphaScale; fontFamily?: FontFamily;
 *                      borderRadius?: CssLengthUnit; ... }
 *   type Elements = per-element `UserDefinedStyle = string | CSSObject`
 *
 * Two decisions worth stating:
 *
 * 1. **Literal hex, not `var(--color-…)`.** Clerk derives whole shade scales
 *    from these colours, which it cannot do from a custom property it never
 *    resolves. The values below are the tokens from globals.css, and the text
 *    inks are the lightened `-text` tints — raw scarlet and raw cobalt fail as
 *    text on the enamel ground, which is the one rule this palette has.
 * 2. **`cssLayerName`.** Clerk otherwise injects unlayered CSS, and unlayered
 *    rules beat every layered Tailwind utility no matter how specific. Naming
 *    the layer puts Clerk's styles into the cascade order declared at the top
 *    of globals.css, so the element classes below actually apply.
 */

/**
 * Two different shapes, deliberately: the PROVIDER takes `Appearance`, which
 * is a `Theme` plus the global options and the per-component overrides, while
 * a component's own `appearance` prop takes the bare `Theme`. `cssLayerName`
 * exists only on the provider — verified by the compiler, not assumed.
 */
type ProviderAppearance = NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;
type ComponentAppearance = NonNullable<ComponentProps<typeof SignIn>["appearance"]>;
type Variables = NonNullable<ComponentAppearance["variables"]>;

/** The palette every Clerk component in the app is dressed in. */
const variables: Variables = {
  colorPrimary: "#1e5bff", // --color-line-cobalt
  colorPrimaryForeground: "#ffffff", // --color-porcelain
  colorBackground: "#111a3d", // --color-surface (enamel-raised)
  colorForeground: "#ffffff",
  colorMutedForeground: "#9bb0d4", // --color-porcelain-dim, 8.36:1
  colorInput: "#070b1f", // --color-well
  colorInputForeground: "#ffffff",
  colorBorder: "rgba(255, 255, 255, 0.22)", // --color-border
  colorNeutral: "#ffffff",
  colorRing: "#7ba4ff", // cobalt text tint — the focus ring must be visible on enamel
  colorShadow: "transparent", // elevation is declared once, as a border
  colorModalBackdrop: "rgba(7, 11, 31, 0.72)",
  colorDanger: "#ff6b63", // scarlet TEXT tint, 6.59:1
  colorSuccess: "#5fd97f",
  colorWarning: "#ffc20e",
  fontFamily: "var(--font-overpass), ui-sans-serif, system-ui, sans-serif",
  fontFamilyButtons: "var(--font-overpass), ui-sans-serif, system-ui, sans-serif",
  fontFamilyMono: "var(--font-spline-mono), ui-monospace, monospace",
  borderRadius: "8px", // --radius-control
};

/** Ground-level dressing, applied to every Clerk component in the app. */
export const clerkAppearance: ProviderAppearance = {
  cssLayerName: "clerk",
  variables,
};

/**
 * The signed-out card. Clerk's own header stays — it names the step the user
 * is on ("Sign in", "Verify your email") and changes as the flow moves, which
 * is exactly the wayfinding this page needs — so the page around it carries
 * the brand and never repeats the title.
 */
export const authAppearance: ComponentAppearance = {
  variables,
  options: {
    logoPlacement: "none",
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
    shimmer: false,
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full rounded-[var(--radius-chassis)] border border-[var(--color-border)] shadow-none",
    card: "bg-[var(--color-surface)] rounded-[var(--radius-chassis)]",
    header: "gap-1",
    headerTitle: "font-display text-xl text-[var(--color-fg)]",
    headerSubtitle: "text-sm text-[var(--color-fg-muted)]",

    socialButtonsBlockButton:
      "rounded-[var(--radius-control)] border-[var(--color-border-strong)] bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]",
    socialButtonsBlockButtonText: "text-xs font-medium uppercase tracking-[0.06em]",

    dividerLine: "bg-[var(--color-border)]",
    dividerText: "label-track",

    formFieldLabel: "label-track",
    // Clerk draws the field edge as a near-invisible box-shadow ring rather
    // than a border, so the width is set explicitly — without it the class
    // below only recolours a border that is 0px wide.
    formFieldInput:
      "rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)] text-[var(--color-fg)]",
    formFieldErrorText: "text-[var(--color-line-scarlet-text)]",
    formFieldAction:
      "text-[var(--color-line-cobalt-text)] underline-offset-4 hover:underline",
    formButtonPrimary:
      "rounded-[var(--radius-control)] bg-[var(--color-line-cobalt)] text-[var(--color-porcelain)] text-xs font-medium uppercase tracking-[0.06em] shadow-none hover:bg-[color-mix(in_oklab,var(--color-line-cobalt)_84%,white)]",
    formResendCodeLink: "text-[var(--color-line-cobalt-text)]",

    // Locators are always mono in this world, and a one-time code is a locator.
    otpCodeFieldInput:
      "tabular font-mono rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)] text-[var(--color-fg)]",
    identityPreview:
      "rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)]",

    footer: "bg-transparent",
    footerActionText: "text-sm text-[var(--color-fg-muted)]",
    footerActionLink:
      "text-[var(--color-line-cobalt-text)] underline-offset-4 hover:underline",
    spinner: "text-[var(--color-line-cobalt-text)]",
  },
};
