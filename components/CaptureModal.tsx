"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { addTasks, type Task } from "@/lib/storage";

interface CaptureModalProps {
  onClose: () => void;
  onTasksCreated: (tasks: Task[]) => void;
}

type State = "idle" | "recording" | "parsing" | "error";

export default function CaptureModal({ onClose, onTasksCreated }: CaptureModalProps) {
  const [text, setText] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
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
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SR) {
      setError("Voice input isn't supported in your browser. Please type instead.");
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let final = text;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + " ";
        else interim = event.results[i][0].transcript;
      }
      setText(final + interim);
    };

    recognition.onerror = () => {
      setState("idle");
      setError("Voice recognition failed. Please try again or type.");
    };

    recognition.onend = () => {
      setState("idle");
      setText(final.trim());
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
    if (!text.trim() || state === "parsing") return;
    if (text.length > HARD_LIMIT) {
      setError(`Text is too long. Max ${HARD_LIMIT} characters.`);
      return;
    }

    setState("parsing");
    setError(null);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const current_date = new Date().toLocaleDateString("en-CA");

      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: text.trim(), timezone, current_date }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);

      const parsed = data.tasks as Array<{
        title: string;
        priority: "must" | "nice";
        estimated_duration_minutes: number;
        deadline_date: string | null;
        deadline_time: string | null;
        ambiguous: boolean;
      }>;

      if (!parsed || parsed.length === 0) {
        setError("Couldn't find any tasks. Try being more specific.");
        setState("error");
        return;
      }

      // Save to localStorage
      const created = addTasks(
        parsed.map((t) => ({
          title: t.title,
          priority: t.priority,
          estimatedDurationMinutes: t.estimated_duration_minutes,
          deadlineDate: t.deadline_date,
          deadlineTime: t.deadline_time,
          ambiguous: t.ambiguous,
          status: "inbox" as const,
          completedAt: null,
        }))
      );

      onTasksCreated(created);
      onClose();
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  const isParsing = state === "parsing";
  const canSubmit = text.trim().length > 0 && !isParsing;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-slate-100">
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
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-500 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-slate-800 font-semibold text-lg">AI is parsing your tasks…</p>
            <p className="text-slate-400 text-sm mt-1">Usually takes a few seconds</p>
          </div>
        </div>
      )}

      {/* Input */}
      {!isParsing && (
        <div className="flex-1 flex flex-col px-4 py-4 gap-3 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Need to message Anna, finish the deck, gym at 18:00, call at 15:00, maybe read that article later…"
            maxLength={HARD_LIMIT}
            className="flex-1 w-full resize-none text-[16px] leading-relaxed text-slate-800 placeholder-slate-300 focus:outline-none"
            style={{ minHeight: 200 }}
          />

          {text.length > SOFT_LIMIT && (
            <p className={`text-xs text-right ${text.length > HARD_LIMIT * 0.9 ? "text-red-400" : "text-amber-400"}`}>
              {text.length} / {HARD_LIMIT}
            </p>
          )}

          {state === "error" && error && (
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {state === "recording" && (
            <div className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse-soft" />
              <span className="text-sm text-red-600 font-medium">Recording… tap mic to stop</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {!isParsing && (
        <div className="px-4 pb-8 pt-3 border-t border-slate-100 flex items-center gap-3">
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
