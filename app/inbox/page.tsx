"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import TaskCard, { type Task } from "@/components/TaskCard";
import UndoToast from "@/components/UndoToast";

type LoadState = "loading" | "error" | "success";

interface UndoItem {
  task: Task;
  message: string;
}

export default function InboxPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [undoItem, setUndoItem] = useState<UndoItem | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setTasks(data.tasks || []);
      setLoadState("success");
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleAddToToday = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    // Optimistic remove from inbox
    setTasks((prev) => prev.filter((t) => t.id !== id));

    try {
      const res = await fetch(`/api/tasks/${id}/add-to-today`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
    } catch {
      loadTasks();
    }
  };

  const handleDelete = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    // Optimistic remove
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setUndoItem({ task, message: "Task deleted" });

    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    } catch {
      loadTasks();
    }
  };

  const handleUndo = async () => {
    if (!undoItem) return;
    const { task } = undoItem;
    setUndoItem(null);

    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "inbox" }),
      });
      setTasks((prev) => [task, ...prev]);
    } catch {
      loadTasks();
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
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
          <p className="text-sm text-slate-400 mt-3">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} to review
          </p>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 px-5 pb-8">
        {loadState === "loading" && (
          <div className="flex flex-col gap-3 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse-soft" />
            ))}
          </div>
        )}

        {loadState === "error" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-slate-500 text-center">Failed to load inbox</p>
            <button onClick={loadTasks} className="text-indigo-500 font-semibold text-sm">
              Retry
            </button>
          </div>
        )}

        {loadState === "success" && tasks.length === 0 && (
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

        {loadState === "success" && tasks.length > 0 && (
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

      {/* Undo toast */}
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
