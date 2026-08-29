"use client";

import * as React from "react";

export interface TextToSpeech {
  /** Whether the browser exposes the Web Speech synthesis API. */
  supported: boolean;
  /** Whether an utterance is currently being spoken. */
  speaking: boolean;
  /** Speak `text`; cancels anything already playing. No-op if unsupported. */
  speak: (text: string) => void;
  /** Stop any in-progress speech. */
  stop: () => void;
}

/**
 * Read text aloud with the browser's built-in speech synthesis. No network
 * and no dependency — `window.speechSynthesis` ships in every evergreen
 * browser. Cancels on unmount so navigating away silences playback.
 */
export function useTextToSpeech(): TextToSpeech {
  const [speaking, setSpeaking] = React.useState(false);
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  React.useEffect(() => {
    if (!supported) return;
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const stop = React.useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = React.useCallback(
    (text: string) => {
      if (!supported) return;
      const clean = stripMarkdown(text);
      if (clean.length === 0) return;
      // Cancel first so a second click restarts rather than queues.
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [supported],
  );

  return { supported, speaking, speak, stop };
}

/**
 * Flatten the lightweight markdown an answer uses into plain prose so the
 * synthesiser doesn't read "hash", "asterisk" or citation brackets aloud.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
