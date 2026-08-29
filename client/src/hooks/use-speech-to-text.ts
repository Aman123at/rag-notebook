"use client";

import * as React from "react";

export interface SpeechToText {
  /** Whether the browser exposes the Web Speech recognition API. */
  supported: boolean;
  /** Whether the microphone is actively listening. */
  listening: boolean;
  /** Start dictation. No-op if unsupported or already listening. */
  start: () => void;
  /** Stop dictation and flush the final transcript. */
  stop: () => void;
}

interface Options {
  /**
   * Called with recognised text. `isFinal` is true for settled phrases and
   * false for the live interim guess, so callers can preview then commit.
   */
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  lang?: string;
}

/**
 * Dictate into a text field with the browser's built-in speech recognition
 * (`SpeechRecognition` / `webkitSpeechRecognition`). No dependency and no
 * server round-trip. Support is Chromium/Safari only; `supported` is false
 * elsewhere so the caller can hide the control.
 *
 * Interim results stream while the user speaks; final results settle a
 * phrase. The recogniser is torn down on unmount.
 */
export function useSpeechToText(options: Options): SpeechToText {
  const { onResult, onError, lang = "en-US" } = options;
  const [listening, setListening] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognition | null>(null);

  // Keep the latest callbacks without re-creating the recogniser.
  const onResultRef = React.useRef(onResult);
  const onErrorRef = React.useRef(onError);
  React.useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  const supported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition !== undefined ||
      window.webkitSpeechRecognition !== undefined);

  const getRecognition = React.useCallback((): SpeechRecognition | null => {
    if (recognitionRef.current) return recognitionRef.current;
    if (typeof window === "undefined") return null;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (Ctor === undefined) return null;
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results.item(i);
        const alt = result.item(0);
        onResultRef.current(alt.transcript, result.isFinal);
      }
    };
    recognition.onerror = (event) => {
      onErrorRef.current?.(event.error);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return recognition;
  }, [lang]);

  const start = React.useCallback(() => {
    if (listening) return;
    const recognition = getRecognition();
    if (!recognition) return;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // `start()` throws if called while already started — ignore, the
      // recogniser is already listening.
    }
  }, [getRecognition, listening]);

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  React.useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return { supported, listening, start, stop };
}
