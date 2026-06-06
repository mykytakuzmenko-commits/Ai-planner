"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import TaskCard from "@/components/TaskCard";
import CaptureModal from "@/components/CaptureModal";
import UndoToast from "@/components/UndoToast";
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
    setInboxCount((c) => c + newTasks.length);
  };

  const handleComplete = (id: string, completed: boolean) => {
    completeTask(id, completed);
    refresh();
  };

  const handleRemove = (id: string) => {
    updateTask(id, { status: "inbox" });
    setUndoItem({ taskId: id, message: "Task removed from Today" });
    refresh();
  };

  const handleUndo = () => {
    if (!undoItem) return;
    addToToday(undoItem.taskId);
    setUndoItem(null);
    refresh();
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const activeTasks = tasks.filter((t) => t.status === "today");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const total = tasks.length;
  const done = completedTasks.length;

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-5 pt-12 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today</p>
            <h1 className="text-2xl font-bold text-slate-800 mt-0.5">{today}</h1>
          </div>

          {inboxCount > 0 && (
            <Link
              href="/inbox"
              className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-indigo-100 transition-colors"
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
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>{done} of {total} done</span>
              <span>{Math.round((done / total) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 px-5 pb-32">
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Your day is a blank canvas</h2>
              <p className="text-slate-400 text-sm mt-1">Dump everything on your mind — AI will sort it out.</p>
            </div>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="flex flex-col gap-3 mt-4">
            {activeTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                context="today"
                onComplete={handleComplete}
                onRemove={handleRemove}
              />
            ))}

            {completedTasks.length > 0 && (
              <>
                {activeTasks.length > 0 && (
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-slate-100" />
                    <span className="text-xs font-semibold text-slate-400">Completed</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                )}
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    context="today"
                    onComplete={handleComplete}
                    onRemove={handleRemove}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </main>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-8 pt-4 bg-gradient-to-t from-white via-white to-transparent">
        <button
          onClick={() => setShowCapture(true)}
          className="w-full h-14 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white font-bold text-[16px] rounded-2xl shadow-lg shadow-indigo-200 transition-all touch-manipulation flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add tasks for today
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
