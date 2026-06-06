"use client";

import { useState, useEffect } from "react";
import { getGmailAuth, clearGmailAuth, type GmailAuth } from "@/lib/gmail-client";

interface GmailConnectProps {
  onEmailTasksFound?: (count: number) => void;
}

export default function GmailConnect({ onEmailTasksFound }: GmailConnectProps) {
  const [auth, setAuth] = useState<GmailAuth | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    clearGmailAuth();
    setAuth(null);
    setExpanded(false);
  };

  // Not connected
  if (!auth) {
    return (
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/70 hover:bg-white rounded-full text-xs font-semibold text-slate-600 shadow-sm transition-all disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
        {connecting ? "Підключення…" : "Gmail"}
      </button>
    );
  }

  // Connected
  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 bg-green-50 hover:bg-green-100 border border-green-200 rounded-full text-xs font-semibold text-green-700 transition-all"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
        <span className="max-w-[100px] truncate">{auth.email}</span>
      </button>

      {expanded && (
        <div className="absolute right-0 top-9 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 w-52 z-30">
          <p className="text-xs text-slate-500 mb-1">Підключено як</p>
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
