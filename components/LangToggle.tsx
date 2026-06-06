"use client";

import { useState, useEffect } from "react";
import { getLang, saveLang, type AppLang } from "@/lib/language";

const LANGS: { code: AppLang; flag: string; label: string }[] = [
  { code: "uk-UA", flag: "🇺🇦", label: "УКР" },
  { code: "en-US", flag: "🇬🇧", label: "ENG" },
];

interface LangToggleProps {
  onChange?: (lang: AppLang) => void;
}

export default function LangToggle({ onChange }: LangToggleProps) {
  const [lang, setLang] = useState<AppLang>("uk-UA");

  useEffect(() => {
    setLang(getLang());
  }, []);

  const toggle = () => {
    const next: AppLang = lang === "uk-UA" ? "en-US" : "uk-UA";
    saveLang(next);
    setLang(next);
    onChange?.(next);
  };

  const current = LANGS.find((l) => l.code === lang)!;

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/70 hover:bg-white rounded-full text-xs font-semibold text-slate-600 shadow-sm transition-all"
      title="Змінити мову"
    >
      <span>{current.flag}</span>
      <span>{current.label}</span>
    </button>
  );
}
