"use client";

import { useState, useEffect, useCallback } from "react";
import { getGmailAuth, clearGmailAuth, markEmailsProcessed, type GmailAuth } from "@/lib/gmail-client";
import { addTasks } from "@/lib/storage";

interface GmailConnectProps {
  onTasksFound: () => void;
}

export default function GmailConnect({ onTasksFound }: GmailConnectProps) {
  const [auth, setAuth] = useState<GmailAuth | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    setAuth(getGmailAuth());
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/gmail/auth-url");
      const { url, error } = await res.json();
      if (error) { alert(error); setConnecting(false); return; }
      window.location.href = url;
    } catch {
      alert("Помилка підключення");
      setConnecting(false);
    }
  };

  const handleCheck = useCallback(async () => {
    const currentAuth = getGmailAuth();
    if (!currentAuth || checking) return;
    setChecking(true);
    setLastResult(null);
    setExpanded(false);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch("/api/gmail/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: currentAuth.accessToken,
          processed_ids: currentAuth.processedIds,
          timezone,
        }),
      });

      const data = await res.json();

      if (res.status === 401) {
        setLastResult("❌ Токен застарів — перепідключи Gmail");
        setChecking(false);
        return;
      }

      if (!res.ok) {
        setLastResult("❌ Помилка Gmail API");
        setChecking(false);
        return;
      }

      const tasks = data.tasks || [];
      const processedIds = data.processed_ids || [];

      if (tasks.length > 0) {
        const current_date = new Date().toLocaleDateString("en-CA");
        addTasks(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tasks.map((t: any) => ({
            title: t.title,
            priority: t.priority || "nice",
            estimatedDurationMinutes: t.estimated_duration_minutes || 15,
            deadlineDate: t.deadline_date || null,
            deadlineTime: t.deadline_time || null,
            ambiguous: false,
            status: (t.deadline_date === current_date ? "today" : "inbox") as "today" | "inbox",
            completedAt: null,
            source: "mail" as const,
            sourceEmailId: t.sourceEmailId,
            sourceEmailSubject: t.sourceEmailSubject,
          }))
        );
        markEmailsProcessed(processedIds);
        setLastResult(`✅ Знайдено ${tasks.length} задач з пошти`);
        onTasksFound();
      } else {
        if (processedIds.length > 0) markEmailsProcessed(processedIds);
        setLastResult("📭 Нових задач в пошті немає");
      }
    } catch {
      setLastResult("❌ Помилка перевірки");
    } finally {
      setChecking(false);
    }
  }, [checking, onTasksFound]);

  const handleDisconnect = () => {
    clearGmailAuth();
    setAuth(null);
    setExpanded(false);
    setLastResult(null);
  };

  // ── Not connected ──────────────────────────────────────────
  if (!auth) {
    return (
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/70 hover:bg-white rounded-full text-xs font-semibold text-slate-500 shadow-sm transition-all disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
        {connecting ? "Підключення…" : "Gmail"}
      </button>
    );
  }

  // ── Connected ──────────────────────────────────────────────
  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        {/* Check now button */}
        <button
          onClick={handleCheck}
          disabled={checking}
          title="Перевірити пошту зараз"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-full text-xs font-semibold text-sky-600 transition-all disabled:opacity-50"
        >
          {checking ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                style={{ animation: "spin 1s linear infinite" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Перевіряю…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            </>
          )}
        </button>

        {/* Account button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-7 h-7 rounded-full bg-white/70 hover:bg-white shadow-sm flex items-center justify-center text-xs font-bold text-slate-500 transition-all"
        >
          ⋯
        </button>
      </div>

      {/* Result toast */}
      {lastResult && (
        <div className="absolute top-10 right-0 bg-slate-800 text-white rounded-2xl px-3 py-2 text-xs font-medium whitespace-nowrap z-30 shadow-lg">
          {lastResult}
        </div>
      )}

      {/* Dropdown */}
      {expanded && (
        <div className="absolute right-0 top-10 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 w-52 z-30">
          <p className="text-xs text-slate-400 mb-0.5">Підключено як</p>
          <p className="text-sm font-semibold text-slate-800 truncate mb-3">{auth.email}</p>
          <button
            onClick={handleDisconnect}
            className="w-full py-2 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          >
            Відключити Gmail
          </button>
        </div>
      )}
    </div>
  );
}
