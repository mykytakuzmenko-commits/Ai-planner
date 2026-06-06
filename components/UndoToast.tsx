"use client";

import { useEffect } from "react";

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export default function UndoToast({ message, onUndo, onDismiss, duration = 4000 }: UndoToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="bg-slate-800 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
        <span className="text-sm">{message}</span>
        <button
          onClick={onUndo}
          className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors touch-manipulation"
        >
          Undo
        </button>
      </div>
    </div>
  );
}
