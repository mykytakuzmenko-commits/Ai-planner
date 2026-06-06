"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { addTasks, type Task } from "@/lib/storage";

interface CaptureModalProps {
  onClose: () => void;
  onTasksCreated: (tasks: Task[]) => void;
}

type State = "idle" | "recording" | "parsing" | "error";

// Waveform bars component
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-[3px] h-5">
      {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8].map((h, i) => (
        <div
          key={i}
          style={{
            height: active ? `${h * 100}%` : "30%",
            transitionDelay: `${i * 60}ms`,
            animation: active ? `wave 0.8s ease-in-out ${i * 0.1}s infinite alternate` : "none",
          }}
          className="w-[3px] bg-current rounded-full transition-all duration-200"
        />
      ))}
    </div>
  );
}

export default function CaptureModal({ onClose, onTasksCreated }: CaptureModalProps) {
  const [text, setText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const finalRef = useRef(""); // stable ref for closure
  const isRecordingRef = useRef(false);

  const SOFT_LIMIT = 1000;
  const HARD_LIMIT = 4000;

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) {
      setMicSupported(false);
    }
    setTimeout(() => textareaRef.current?.focus(), 150);
  }, []);

  // Auto-scroll textarea to bottom when text changes
  useEffect(() => {
    const el = textareaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text, interimText]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterimText("");
    setState("idle");
  }, []);

  const startRecording = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;

    setError(null);

    // Detect browser language for better recognition
    const lang = navigator.language || "uk-UA";

    const createSession = () => {
      if (!isRecordingRef.current) return;

      const recognition = new SR();
      recognition.continuous = false;      // more reliable on mobile
      recognition.interimResults = true;
      recognition.lang = lang;
      recognition.maxAlternatives = 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalRef.current += transcript + " ";
            setText(finalRef.current);
            setInterimText("");
          } else {
            interim = transcript;
            setInterimText(interim);
          }
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (e: any) => {
        if (e.error === "not-allowed") {
          isRecordingRef.current = false;
          setState("idle");
          setError("Microphone access denied. Please allow mic in browser settings.");
          return;
        }
        // Other errors (network, aborted) — restart silently
      };

      recognition.onend = () => {
        // Auto-restart while still in recording mode
        if (isRecordingRef.current) {
          setTimeout(createSession, 100);
        } else {
          setText(finalRef.current.trim());
          setInterimText("");
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        // Already started — ignore
      }
    };

    isRecordingRef.current = true;
    finalRef.current = text; // carry over any already-typed text
    setState("recording");
    createSession();
  }, [text]);

  const handleMicClick = () => {
    if (state === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSubmit = async () => {
    if (state === "recording") stopRecording();
    const finalText = (finalRef.current || text).trim();
    if (!finalText || state === "parsing") return;
    if (finalText.length > HARD_LIMIT) {
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
        body: JSON.stringify({ raw_text: finalText, timezone, current_date }),
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
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const isRecording = state === "recording";
  const isParsing = state === "parsing";
  const displayText = text + (interimText ? interimText : "");
  const canSubmit = displayText.trim().length > 0 && !isParsing;

  return (
    <>
      {/* Waveform keyframes injected inline */}
      <style>{`
        @keyframes wave {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1); }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex flex-col bg-white" style={{ animation: "slideUp 0.28s cubic-bezier(0.16,1,0.3,1) both" }}>
        <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(100%); } to { opacity:1; transform:translateY(0); } }`}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Brain dump</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Parsing state */}
        {isParsing && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-500" style={{ animation: "spin 1s linear infinite" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-slate-800 font-semibold text-lg">AI is parsing your tasks…</p>
              <p className="text-slate-400 text-sm mt-1">Usually a few seconds</p>
            </div>
          </div>
        )}

        {/* Input area */}
        {!isParsing && (
          <div className="flex-1 flex flex-col px-5 pt-4 pb-2 gap-3 overflow-hidden">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={displayText}
                onChange={(e) => {
                  if (!isRecording) {
                    setText(e.target.value);
                    finalRef.current = e.target.value;
                  }
                }}
                readOnly={isRecording}
                placeholder="Need to message Anna, finish the deck, gym at 18:00, call at 15:00, maybe read that article later…"
                className="w-full h-full resize-none text-[16px] leading-relaxed text-slate-800 placeholder-slate-300 focus:outline-none"
              />
              {/* Interim text shimmer overlay */}
              {isRecording && interimText && (
                <div className="absolute bottom-0 left-0 right-0 text-[16px] leading-relaxed pointer-events-none">
                  <span className="invisible">{text}</span>
                  <span className="text-slate-400 italic">{interimText}</span>
                </div>
              )}
            </div>

            {displayText.length > SOFT_LIMIT && (
              <p className={`text-xs text-right ${displayText.length > HARD_LIMIT * 0.9 ? "text-red-400" : "text-amber-400"}`}>
                {displayText.length} / {HARD_LIMIT}
              </p>
            )}

            {state === "error" && error && (
              <div className="bg-red-50 rounded-2xl px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Bottom bar */}
        {!isParsing && (
          <div className="px-5 pb-10 pt-3 border-t border-slate-100 flex items-center gap-3">

            {/* Mic button */}
            {micSupported ? (
              <button
                onClick={handleMicClick}
                style={isRecording ? {
                  background: "#ef4444",
                  boxShadow: "0 0 0 0 rgba(239,68,68,0.4)",
                  animation: "micPulse 1.4s ease-out infinite",
                } : {}}
                className={`relative w-14 h-14 rounded-full flex flex-col items-center justify-center gap-1 transition-all flex-shrink-0 ${
                  isRecording ? "text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95"
                }`}
              >
                <style>{`@keyframes micPulse { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 70% { box-shadow: 0 0 0 12px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }`}</style>

                {isRecording ? (
                  <>
                    <Waveform active={true} />
                    <span className="text-[9px] font-bold tracking-wide uppercase opacity-80">Stop</span>
                  </>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
            ) : (
              <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`flex-1 h-14 rounded-2xl text-[15px] font-bold transition-all ${
                canSubmit
                  ? "bg-indigo-500 text-white active:scale-95 hover:bg-indigo-600"
                  : "bg-slate-100 text-slate-300 cursor-default"
              }`}
            >
              {isRecording ? "Stop & parse" : "Parse with AI"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
