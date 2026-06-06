"use client";

import { useState } from "react";

export interface Task {
  id: string;
  title: string;
  priority: "must" | "nice";
  estimated_duration_minutes: number;
  deadline_date: string | null;
  deadline_time: string | null;
  ambiguous: boolean;
  status: "inbox" | "today" | "completed" | "deleted";
  completed_at?: string | null;
}

interface TaskCardProps {
  task: Task;
  context: "inbox" | "today";
  onAddToToday?: (id: string) => void;
  onDelete?: (id: string) => void;
  onComplete?: (id: string, completed: boolean) => void;
  onRemove?: (id: string) => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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

  const handleAction = async (action: () => void) => {
    if (isActing) return;
    setIsActing(true);
    try {
      action();
    } finally {
      setTimeout(() => setIsActing(false), 400);
    }
  };

  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-200 animate-fade-in ${
        isCompleted
          ? "bg-slate-50 border-slate-100 opacity-60"
          : "bg-white border-slate-200 shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox for Today */}
        {context === "today" && (
          <button
            onClick={() => handleAction(() => onComplete?.(task.id, !isCompleted))}
            disabled={isActing}
            className={`mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all touch-manipulation ${
              isCompleted
                ? "bg-indigo-500 border-indigo-500 text-white"
                : "border-slate-300 hover:border-indigo-400"
            }`}
            style={{ minWidth: 24, minHeight: 24 }}
          >
            {isCompleted && (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p
            className={`text-[15px] font-medium leading-snug ${
              isCompleted ? "line-through text-slate-400" : "text-slate-800"
            }`}
          >
            {task.title}
          </p>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Priority badge */}
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                task.priority === "must"
                  ? "bg-red-50 text-red-600"
                  : "bg-violet-50 text-violet-600"
              }`}
            >
              {task.priority === "must" ? "Must" : "Nice"}
            </span>

            {/* Duration */}
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDuration(task.estimated_duration_minutes)}
            </span>

            {/* Deadline */}
            {task.deadline_time && (
              <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {task.deadline_time}
              </span>
            )}

            {/* Ambiguous flag */}
            {context === "inbox" && task.ambiguous && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Unclear
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {context === "inbox" && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
          <button
            onClick={() => handleAction(() => onAddToToday?.(task.id))}
            disabled={isActing}
            className="flex-1 py-2.5 bg-indigo-500 text-white text-sm font-semibold rounded-xl hover:bg-indigo-600 active:scale-95 transition-all touch-manipulation disabled:opacity-50"
          >
            Add to Today
          </button>
          <button
            onClick={() => handleAction(() => onDelete?.(task.id))}
            disabled={isActing}
            className="px-4 py-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all touch-manipulation disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      {context === "today" && !isCompleted && (
        <div className="flex justify-end mt-2">
          <button
            onClick={() => handleAction(() => onRemove?.(task.id))}
            disabled={isActing}
            className="text-xs text-slate-300 hover:text-slate-400 transition-colors touch-manipulation"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
