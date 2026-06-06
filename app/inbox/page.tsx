"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import TaskCard from "@/components/TaskCard";
import UndoToast from "@/components/UndoToast";
import { getInboxTasks, addToToday, deleteTask, restoreTask, type Task } from "@/lib/storage";

interface UndoItem {
  task: Task;
  message: string;
}

export default function InboxPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [undoItem, setUndoItem] = useState<UndoItem | null>(null);
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    setTasks(getInboxTasks());
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
  }, [refresh]);

  const handleAddToToday = (id: string) => {
    addToToday(id);
    refresh();
  };

  const handleDelete = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    deleteTask(id);
    setUndoItem({ task, message: "Task deleted" });
    refresh();
  };

  const handleUndo = () => {
    if (!undoItem) return;
    restoreTask(undoItem.task.id, "inbox");
    setUndoItem(null);
    refresh();
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-5 pt-12 pb-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors touch-manipulation"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Review</p>
            <h1 className="text-2xl font-bold text-slate-800">Inbox</h1>
          </div>
        </div>
        {tasks.length > 0 && (
          <p className="text-sm text-slate-400 mt-3 ml-13">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} to review
          </p>
        )}
      </header>

      <main className="flex-1 px-5 pb-8">
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Nothing to review</h2>
              <p className="text-slate-400 text-sm mt-1">Capture a brain-dump and AI will fill this up.</p>
            </div>
            <Link
              href="/"
              className="mt-2 px-6 py-3 bg-indigo-500 text-white font-bold rounded-2xl text-sm hover:bg-indigo-600 transition-colors"
            >
              Go to Today
            </Link>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="flex flex-col gap-3 mt-4">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                context="inbox"
                onAddToToday={handleAddToToday}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

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
