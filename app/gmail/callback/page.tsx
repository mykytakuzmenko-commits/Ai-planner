"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveGmailAuth } from "@/lib/gmail-client";

function CallbackInner() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const err = searchParams.get("error");

    if (err || !code) {
      setStatus("error");
      setError(err === "access_denied" ? "Доступ відхилено" : "Помилка авторизації");
      return;
    }

    fetch("/api/gmail/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        saveGmailAuth({
          accessToken: data.access_token,
          refreshToken: data.refresh_token || "",
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
          email: data.email,
          processedIds: [],
        });
        setStatus("success");
        setTimeout(() => router.push("/"), 1800);
      })
      .catch((e) => {
        setStatus("error");
        setError(e.message || "Помилка підключення");
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center gap-6">
      {status === "loading" && (
        <>
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ animation: "spin 1s linear infinite" }}>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <p className="text-slate-700 font-semibold text-lg">Підключаємо Gmail…</p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-slate-700 font-semibold text-lg">Gmail підключено!</p>
          <p className="text-slate-400 text-sm">Повертаємось до додатку…</p>
        </>
      )}

      {status === "error" && (
        <>
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-slate-700 font-semibold text-lg">Помилка підключення</p>
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => router.push("/")}
            className="mt-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold rounded-full text-sm">
            Повернутись
          </button>
        </>
      )}
    </div>
  );
}

export default function GmailCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-500"
          style={{ animation: "spin 1s linear infinite" }} />
      </div>
    }>
      <CallbackInner />
    </Suspense>
  );
}
