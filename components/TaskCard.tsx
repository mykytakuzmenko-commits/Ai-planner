"use client";

import { useState } from "react";
import type { Task } from "@/lib/storage";

export type { Task };

interface TaskCardProps {
  task: Task;
  context: "inbox" | "today";
  onAddToToday?: (id: string) => void;
  onDelete?: (id: string) => void;
  onComplete?: (id: string, completed: boolean) => void;
  onRemove?: (id: string) => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}м`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}г ${m}м` : `${h}г`;
}

export default function TaskCard({
  task,
  context,
  onAddToToday,
  onDelete,
  onComplete,
  onRemove,
}: TaskCardProps) {
  const [isActing, setIsActing] = useState(false);
  const isCompleted = task.status === "completed";

  const act = (fn: () => void) => {
    if (isActing) return;
    setIsActing(true);
    fn();
    setTimeout(() => setIsActing(false), 400);
  };

  return (
    <div
      className={`rounded-3xl p-4 transition-all duration-200 animate-fade-in ${
        isCompleted
          ? "bg-white/50 opacity-60 shadow-none"
          : "bg-white shadow-sm shadow-slate-200/80"
      }`}
      style={{ boxShadow: isCompleted ? "none" : "0 2px 12px rgba(99,102,241,0.07), 0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox — Today only */}
        {context === "today" && (
          <button
            onClick={() => act(() => onComplete?.(task.id, !isCompleted))}
            disabled={isActing}
            className={`mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all touch-manipulation ${
              isCompleted
                ? "bg-indigo-500 border-indigo-500 text-white"
                : "border-slate-300 hover:border-indigo-400"
            }`}
          >
            {isCompleted && (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <p className={`text-[15px] font-medium leading-snug ${isCompleted ? "line-through text-slate-400" : "text-slate-800"}`}>
            {task.title}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {/* Priority badge */}
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              task.priority === "must"
                ? "bg-red-50 text-red-600"
                : "bg-violet-50 text-violet-600"
            }`}>
              {task.priority === "must" ? "Must" : "Nice"}
            </span>

            {/* Duration chip */}
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-full">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDuration(task.estimatedDurationMinutes)}
            </span>

            {/* Deadline time */}
            {task.deadlineTime && (
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-full">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {task.deadlineTime}
              </span>
            )}

            {context === "inbox" && task.ambiguous && (
              <span className="text-[11px] text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-semibold">
                ⚠ Не зрозуміло
              </span>
            )}

            {task.source === "mail" && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                З пошти
              </span>
            )}
          </div>

          {task.source === "mail" && task.sourceEmailSubject && (
            <p className="text-[11px] text-slate-400 mt-1.5 truncate">
              📧 {task.sourceEmailSubject}
            </p>
          )}
        </div>
      </div>

      {/* Inbox actions */}
      {context === "inbox" && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100/80">
          <button
            onClick={() => act(() => onAddToToday?.(task.id))}
            disabled={isActing}
            className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-bold rounded-full hover:from-indigo-600 hover:to-violet-600 active:scale-95 transition-all touch-manipulation disabled:opacity-50 shadow-sm shadow-indigo-200/60"
          >
            Додати на сьогодні
          </button>
          <button
            onClick={() => act(() => onDelete?.(task.id))}
            disabled={isActing}
            className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all touch-manipulation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Today: remove button */}
      {context === "today" && !isCompleted && (
        <div className="flex justify-end mt-2">
          <button
            onClick={() => act(() => onRemove?.(task.id))}
            className="text-xs text-slate-300 hover:text-slate-400 transition-colors touch-manipulation"
          >
            Видалити
          </button>
        </div>
      )}
    </div>
  );
}
