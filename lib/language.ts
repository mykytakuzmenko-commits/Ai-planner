const KEY = "ai_planner_lang";

export type AppLang = "uk-UA" | "en-US";

export function getLang(): AppLang {
  if (typeof window === "undefined") return "uk-UA";
  return (localStorage.getItem(KEY) as AppLang) || "uk-UA";
}

export function saveLang(lang: AppLang): void {
  localStorage.setItem(KEY, lang);
}
