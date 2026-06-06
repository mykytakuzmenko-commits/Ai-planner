"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import CaptureModal from "@/components/CaptureModal";
import UndoToast from "@/components/UndoToast";
import TimelineView from "@/components/TimelineView";
import {
  getTodayTasks,
  getInboxCount,
  completeTask,
  addToToday,
  updateTask,
  type Task,
} from "@/lib/storage";

interface UndoItem {
  taskId: string;
  message: string;
}

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [showCapture, setShowCapture] = useState(false);
  const [undoItem, setUndoItem] = useState<UndoItem | null>(null);
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    setTasks(getTodayTasks());
    setInboxCount(getInboxCount());
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, [refresh]);

  const handleTasksCreated = (newTasks: Task[]) => {
    setInboxCount((c) => c + newTasks.filter((t) => t.status === "inbox").length);
    refresh();
  };

  const handleComplete = (id: string, completed: boolean) => {
    completeTask(id, completed);
    refresh();
  };

  const handleRemove = (id: string) => {
    updateTask(id, { status: "inbox" });
    setUndoItem({ taskId: id, message: "Задачу переміщено у вхідні" });
    refresh();
  };

  const handleUndo = () => {
    if (!undoItem) return;
    addToToday(undoItem.taskId);
    setUndoItem(null);
    refresh();
  };

  const todayShort = new Date().toLocaleDateString("uk-UA", {
    month: "long",
    day: "numeric",
  });

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "completed").length;

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-5 pt-12 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/70 text-xs font-semibold text-slate-500 shadow-sm backdrop-blur-sm mb-2 capitalize">
              {todayShort}
            </span>
            <h1 className="text-[28px] font-bold text-slate-800 leading-tight">
              Сьогодні
            </h1>
          </div>

          {inboxCount > 0 && (
            <Link
              href="/inbox"
              className="flex items-center gap-1.5 bg-indigo-500 text-white px-3.5 py-2 rounded-full text-sm font-semibold shadow-sm hover:bg-indigo-600 transition-colors mt-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              {inboxCount}
            </Link>
          )}
        </div>

        {total > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold">{done} / {total} задач</span>
              <span className="text-indigo-500 font-bold">{Math.round((done / total) * 100)}%</span>
            </div>
            <div className="h-2 bg-white/60 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 px-4 pb-36">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
            <div className="w-24 h-24 rounded-full bg-white/70 shadow-sm flex items-center justify-center">
              <svg className="w-11 h-11 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">День вільний</h2>
              <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
                Злий все з голови — AI розбере і впорядкує.
              </p>
            </div>
          </div>
        ) : (
          <TimelineView
            tasks={tasks}
            onTasksChange={refresh}
            onComplete={handleComplete}
            onRemove={handleRemove}
          />
        )}
      </main>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-8 pt-6 bg-gradient-to-t from-[#fff7ed]/90 via-[#fdf4ff]/70 to-transparent">
        <button
          onClick={() => setShowCapture(true)}
          className="w-full h-14 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 active:scale-95 text-white font-bold text-[16px] rounded-full shadow-lg shadow-indigo-200/60 transition-all touch-manipulation flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Додати задачі
        </button>
      </div>

      {showCapture && (
        <CaptureModal
          onClose={() => { setShowCapture(false); refresh(); }}
          onTasksCreated={handleTasksCreated}
        />
      )}

      {undoItem && (
        <UndoToast
          message={undoItem.message}
          onUndo={handleUndo}
          onDismiss={() => setUndoItem(null)}
        />
      )}
    </div>
  );
}
