"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { DisplayNameForm } from "./display-name-form";
import { TokenSummary } from "./token-summary";
import { UsageChart } from "./usage-chart";
import { CouponForm } from "./coupon-form";
import { UpgradeCta } from "./upgrade-cta";

export function ProfileSection() {
  const me = useCurrentUser();

  if (me.isLoading) {
    return (
      <p role="status" className="flex items-center gap-3 text-sm text-[var(--color-fg-muted)]">
        <span className="arrivals-track" aria-hidden />
        Loading your account
      </p>
    );
  }
  if (me.isError || !me.data) {
    return (
      <div
        role="alert"
        className="chassis space-y-2 p-5 text-sm"
        style={{ borderLeft: "var(--spine-width) solid var(--color-line-scarlet-text)" }}
      >
        <p className="font-medium text-[var(--color-fg)]">Your account couldn’t be loaded.</p>
        <p className="text-[var(--color-fg-muted)]">
          Reload the page to try again. Your plan and tokens are unchanged.
        </p>
      </div>
    );
  }

  const user = me.data;

  return (
    <div className="space-y-8">
      <Panel heading="Your fare card">
        <TokenSummary me={user} />
        {user.planTier === "FREE" && <UpgradeCta />}
      </Panel>

      <UsageChart />

      <Panel
        heading="Your details"
        description="Your display name is what the assistant calls you in chat."
      >
        <DisplayNameForm me={user} />
      </Panel>

      <Panel
        heading="Redeem a code"
        description="Plan codes sent to you by the team are applied to your account straight away."
      >
        <CouponForm />
      </Panel>
    </div>
  );
}

/**
 * One section of the profile. The fare card leads, because the question people
 * open this page with is "how much have I got left", not "what is my name".
 */
function Panel({
  heading,
  description,
  children,
}: {
  heading: string;
  description?: string;
  children: React.ReactNode;
}) {
  const headingId = `panel-${heading.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="chassis space-y-4 p-5">
      {/* No label above the heading. Every one of these read "PLAN AND TOKENS"
          over "Your fare card" — a category word restating the title under it,
          which is the kicker the roadmap page already removed in R4 and the
          marketing sections removed in R8. `.label-track` is for field labels. */}
      <header className="space-y-1">
        <h2 id={headingId} className="font-display text-lg text-[var(--color-fg)]">
          {heading}
        </h2>
        {description ? (
          <p className="max-w-prose text-sm leading-relaxed text-[var(--color-fg-muted)]">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
