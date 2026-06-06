"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Task } from "./TaskCard";

interface CaptureModalProps {
  onClose: () => void;
  onTasksCreated: (tasks: Task[]) => void;
}

type State = "idle" | "recording" | "submitting" | "parsing" | "error";

export default function CaptureModal({ onClose, onTasksCreated }: CaptureModalProps) {
  const [text, setText] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [rawTextBackup, setRawTextBackup] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const SOFT_LIMIT = 1000;
  const HARD_LIMIT = 4000;

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  const startRecording = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Voice input is not supported in your browser. Please type instead.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = text;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim = event.results[i][0].transcript;
        }
      }
      setText(finalTranscript + interim);
    };

    recognition.onerror = () => {
      setState("idle");
      setError("Voice recognition failed. Please try again or type.");
    };

    recognition.onend = () => {
      setState("idle");
      setText(finalTranscript.trim());
    };

    recognitionRef.current = recognition;
    recognition.start();
    setState("recording");
    setError(null);
  }, [text]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setState("idle");
  }, []);

  const handleSubmit = async () => {
    if (!text.trim() || state === "submitting" || state === "parsing") return;
    if (text.length > HARD_LIMIT) {
      setError(`Text is too long. Please keep it under ${HARD_LIMIT} characters.`);
      return;
    }

    setRawTextBackup(text);
    setState("submitting");
    setError(null);

    try {
      // Step 1: persist capture
      const captureRes = await fetch("/api/captures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: text.trim(), input_type: "text" }),
      });

      if (!captureRes.ok) {
        const err = await captureRes.json();
        throw new Error(err.error || "Failed to save your input");
      }

      const { capture_id } = await captureRes.json();
      setCaptureId(capture_id);

      // Step 2: parse
      setState("parsing");
      const parseRes = await fetch(`/api/captures/${capture_id}/parse`, {
        method: "POST",
      });

      if (!parseRes.ok) {
        const err = await parseRes.json();
        throw new Error(err.error || "AI parsing failed. Please try again.");
      }

      const { tasks } = await parseRes.json();

      if (!tasks || tasks.length === 0) {
        setError("Couldn't find any tasks in your input. Try being more specific.");
        setState("error");
        return;
      }

      onTasksCreated(tasks);
      onClose();
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  const handleRetry = async () => {
    if (!captureId) return;
    setState("parsing");
    setError(null);

    try {
      const parseRes = await fetch(`/api/captures/${captureId}/parse`, { method: "POST" });
      if (!parseRes.ok) throw new Error("Parsing failed again");
      const { tasks } = await parseRes.json();
      if (!tasks || tasks.length === 0) {
        setError("Still couldn't find tasks. Try editing your input.");
        setState("error");
        return;
      }
      onTasksCreated(tasks);
      onClose();
    } catch {
      setState("error");
      setError("Parsing failed again. Please edit your input and try again.");
    }
  };

  const isParsing = state === "submitting" || state === "parsing";
  const canSubmit = text.trim().length > 0 && !isParsing;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">Brain dump</h2>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors touch-manipulation"
        >
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Parsing overlay */}
      {isParsing && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-indigo-500 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-slate-800 font-semibold text-lg">
              {state === "submitting" ? "Saving your input…" : "AI is parsing your tasks…"}
            </p>
            <p className="text-slate-400 text-sm mt-1">This usually takes a few seconds</p>
          </div>
        </div>
      )}

      {/* Input area */}
      {!isParsing && (
        <div className="flex-1 flex flex-col px-4 py-4 gap-4 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Need to message Anna, finish the deck, gym at 18:00, call at 15:00, maybe read that article later…"
            maxLength={HARD_LIMIT}
            className="flex-1 w-full resize-none text-[16px] leading-relaxed text-slate-800 placeholder-slate-300 focus:outline-none"
            style={{ minHeight: 200 }}
          />

          {/* Char count warning */}
          {text.length > SOFT_LIMIT && (
            <p className={`text-xs text-right ${text.length > HARD_LIMIT * 0.9 ? "text-red-400" : "text-amber-400"}`}>
              {text.length}/{HARD_LIMIT}
            </p>
          )}

          {/* Error */}
          {state === "error" && error && (
            <div className="bg-red-50 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-sm text-red-600">{error}</p>
              {captureId && (
                <button onClick={handleRetry} className="text-sm font-semibold text-red-600 underline self-start">
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Recording indicator */}
          {state === "recording" && (
            <div className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse-soft" />
              <span className="text-sm text-red-600 font-medium">Recording… tap mic to stop</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom actions */}
      {!isParsing && (
        <div className="px-4 pb-6 pt-3 border-t border-slate-100 safe-bottom flex items-center gap-3">
          {/* Mic button */}
          <button
            onClick={state === "recording" ? stopRecording : startRecording}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all touch-manipulation flex-shrink-0 ${
              state === "recording"
                ? "bg-red-500 text-white recording-pulse"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex-1 h-12 rounded-2xl text-[15px] font-bold transition-all touch-manipulation ${
              canSubmit
                ? "bg-indigo-500 text-white active:scale-95 hover:bg-indigo-600"
                : "bg-slate-100 text-slate-300 cursor-default"
            }`}
          >
            Parse tasks with AI
          </button>
        </div>
      )}
    </div>
  );
}
