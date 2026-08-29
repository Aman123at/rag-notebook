"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/chassis";
import { toast } from "@/providers/toast";
import { useUpdateMe } from "@/hooks/use-update-me";
import type { Me } from "@/hooks/use-current-user";

const FIELD =
  "w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-well)] px-3 py-2 text-sm text-[var(--color-fg)] transition-colors placeholder:text-[var(--color-fg-muted)] focus:border-[var(--color-line-cobalt-text)] focus:outline-none disabled:opacity-45";

export function DisplayNameForm({ me }: { me: Me }) {
  const [name, setName] = React.useState(me.displayName ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const update = useUpdateMe();

  const dirty = name.trim() !== (me.displayName ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give yourself a name.");
      return;
    }
    if (trimmed === (me.displayName ?? "")) return;
    setError(null);
    try {
      await update.mutateAsync({ displayName: trimmed });
      toast.success("Profile saved.");
    } catch (err) {
      if (!toast.isApiError(err)) return;
      if (err.code === "VALIDATION_ERROR") {
        setError(err.message);
        return;
      }
      toast.error(err, "Couldn't save profile");
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="display-name" className="label-track block">
          Display name
        </label>
        <input
          id="display-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? "display-name-error" : undefined}
          disabled={update.isPending}
          maxLength={120}
          className={`${FIELD} max-w-sm`}
          style={error ? { borderColor: "var(--color-line-scarlet-text)" } : undefined}
        />
        {error ? (
          <p
            id="display-name-error"
            role="alert"
            className="text-xs text-[var(--color-line-scarlet-text)]"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Email</FieldLabel>
        <p className="text-sm text-[var(--color-fg-muted)]">{me.email}</p>
      </div>

      <Button type="submit" variant="secondary" size="sm" disabled={!dirty || update.isPending}>
        {update.isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
