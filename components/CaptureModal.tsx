"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { addTasks, type Task } from "@/lib/storage";
import { getLang } from "@/lib/language";

interface CaptureModalProps {
  onClose: () => void;
  onTasksCreated: (tasks: Task[]) => void;
}

type State = "idle" | "recording" | "parsing" | "error";

function Waveform() {
  return (
    <div className="flex items-center gap-[3px] h-5">
      {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8].map((h, i) => (
        <div
          key={i}
          style={{
            height: `${h * 100}%`,
            animation: `wave 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
          }}
          className="w-[3px] bg-white rounded-full"
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
  const isRecordingRef = useRef(false);
  // Two refs to track text without stale closure issues
  const finalRef = useRef("");   // confirmed words
  const interimRef = useRef(""); // current unconfirmed words

  const SOFT_LIMIT = 1000;
  const HARD_LIMIT = 4000;

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) setMicSupported(false);
    setTimeout(() => textareaRef.current?.focus(), 150);
  }, []);

  // Commit interim + stop recognition, return full text
  const flushAndStop = useCallback(() => {
    isRecordingRef.current = false;
    // Commit any interim words that haven't been finalized yet
    if (interimRef.current.trim()) {
      finalRef.current = (finalRef.current + " " + interimRef.current).trim() + " ";
      interimRef.current = "";
    }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    const committed = finalRef.current.trim();
    setText(committed);
    setInterimText("");
    setState("idle");
    return committed;
  }, []);

  const startRecording = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;

    setError(null);
    isRecordingRef.current = true;
    finalRef.current = text; // carry over anything already typed
    interimRef.current = "";
    setState("recording");

    const createSession = () => {
      if (!isRecordingRef.current) return;

      const recognition = new SR();
      recognition.continuous = false;   // most reliable across browsers
      recognition.interimResults = true;
      recognition.lang = getLang();
      recognition.maxAlternatives = 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalRef.current += transcript + " ";
            interimRef.current = "";
            setText(finalRef.current);
            setInterimText("");
          } else {
            interim = transcript;
            interimRef.current = interim; // always keep ref in sync
            setInterimText(interim);
          }
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (e: any) => {
        if (e.error === "not-allowed") {
          isRecordingRef.current = false;
          setState("idle");
          setError("Мікрофон заблоковано. Дозволь доступ у налаштуваннях браузера.");
        }
        // aborted / network — will restart via onend
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          // Session ended naturally (pause detected) — restart immediately
          setTimeout(createSession, 80);
        }
      };

      recognitionRef.current = recognition;
      try { recognition.start(); } catch { /* already started */ }
    };

    createSession();
  }, [text, lang]);

  const handleMicClick = () => {
    if (state === "recording") flushAndStop();
    else startRecording();
  };

  const handleSubmit = useCallback(async () => {
    if (state === "parsing") return;

    // Commit any in-flight interim text, then get the full string
    let finalText: string;
    if (state === "recording") {
      finalText = flushAndStop();
    } else {
      finalText = finalRef.current.trim() || text.trim();
    }

    if (!finalText) return;
    if (finalText.length > HARD_LIMIT) {
      setError(`Текст задовгий. Максимум ${HARD_LIMIT} символів.`);
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
        setError("Не знайшов задач. Спробуй описати детальніше.");
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
          status: (t.deadline_date === current_date ? "today" : "inbox") as "today" | "inbox",
          completedAt: null,
        }))
      );

      onTasksCreated(created);
      onClose();
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Щось пішло не так. Спробуй ще раз.");
    }
  }, [state, text, flushAndStop, onTasksCreated, onClose]);

  const isRecording = state === "recording";
  const isParsing = state === "parsing";
  const displayText = text + interimText;
  const canSubmit = displayText.trim().length > 0 && !isParsing;

  return (
    <>
      <style>{`
        @keyframes wave { from { transform:scaleY(0.3); } to { transform:scaleY(1); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(100%); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes micPulse { 0%{box-shadow:0 0 0 0 rgba(239,68,68,.5);} 70%{box-shadow:0 0 0 14px rgba(239,68,68,0);} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0);} }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{
          animation: "slideUp 0.28s cubic-bezier(0.16,1,0.3,1) both",
          background: "linear-gradient(160deg, #ede9fe 0%, #fdf4ff 40%, #fff7ed 100%)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <h2 className="text-[22px] font-bold text-slate-800">Brain dump</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/70 shadow-sm hover:bg-white transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Parsing */}
        {isParsing && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
            <div className="w-20 h-20 rounded-full bg-white/70 shadow-sm flex items-center justify-center">
              <svg style={{ animation: "spin 1s linear infinite" }} className="w-9 h-9 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-slate-800 font-bold text-xl">AI розбирає твої задачі…</p>
              <p className="text-slate-400 text-sm mt-1.5">Зазвичай кілька секунд</p>
            </div>
          </div>
        )}

        {/* Input */}
        {!isParsing && (
          <div className="flex-1 flex flex-col px-5 pt-2 pb-2 gap-3 overflow-hidden">
            {/* Textarea card */}
            <div
              className="flex-1 relative overflow-hidden rounded-3xl bg-white shadow-sm"
              style={{ boxShadow: "0 2px 12px rgba(99,102,241,0.07), 0 1px 3px rgba(0,0,0,0.06)" }}
            >
              <textarea
                ref={textareaRef}
                value={displayText}
                onChange={(e) => {
                  if (!isRecording) {
                    setText(e.target.value);
                    finalRef.current = e.target.value;
                    interimRef.current = "";
                  }
                }}
                readOnly={isRecording}
                placeholder="Написати Ані, закінчити презентацію, зал о 18:00, дзвінок о 15:00, може прочитати статтю пізніше…"
                className="w-full h-full resize-none text-[16px] leading-relaxed focus:outline-none p-5"
                style={{ color: isRecording && interimText ? "#94a3b8" : "#1e293b" }}
              />
            </div>

            {displayText.length > SOFT_LIMIT && (
              <p className={`text-xs text-right px-1 ${displayText.length > HARD_LIMIT * 0.9 ? "text-red-400" : "text-amber-400"}`}>
                {displayText.length} / {HARD_LIMIT}
              </p>
            )}

            {/* Recording hint */}
            {isRecording && (
              <div className="flex items-center gap-2 bg-red-50 rounded-full px-4 py-2.5 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-red-500" style={{ animation: "micPulse 1.4s ease-out infinite" }} />
                <span className="text-sm text-red-600 font-semibold">
                  Говори — {LANGS.find(l => l.code === lang)?.flag} розпізнаю…
                </span>
              </div>
            )}

            {state === "error" && error && (
              <div className="bg-red-50 rounded-2xl px-4 py-3 shadow-sm">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Bottom bar */}
        {!isParsing && (
          <div className="px-5 pb-10 pt-3 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {/* Mic button */}
              {micSupported ? (
                <button
                  onClick={handleMicClick}
                  style={isRecording ? { background: "#ef4444", animation: "micPulse 1.4s ease-out infinite" } : {}}
                  className={`w-14 h-14 rounded-full flex flex-col items-center justify-center gap-1 transition-all flex-shrink-0 shadow-sm ${
                    isRecording ? "text-white" : "bg-white/80 text-slate-500 hover:bg-white active:scale-95"
                  }`}
                >
                  {isRecording ? (
                    <>
                      <Waveform />
                      <span className="text-[9px] font-bold tracking-wide uppercase opacity-80">Стоп</span>
                    </>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
              ) : (
                <div className="w-14 h-14 rounded-full bg-white/50 shadow-sm flex items-center justify-center flex-shrink-0" title="Голосовий ввід не підтримується">
                  <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`flex-1 h-14 rounded-full text-[15px] font-bold transition-all shadow-sm ${
                  canSubmit
                    ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white active:scale-95 hover:from-indigo-600 hover:to-violet-600 shadow-indigo-200/60"
                    : "bg-slate-200 text-slate-400 cursor-default"
                }`}
              >
                {isRecording ? "Стоп і розібрати" : "Розібрати з AI"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
