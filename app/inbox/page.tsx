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
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/70 shadow-sm hover:bg-white transition-colors touch-manipulation"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/70 text-xs font-semibold text-slate-500 shadow-sm mb-1.5">
              Перегляд
            </span>
            <h1 className="text-[28px] font-bold text-slate-800 leading-tight">Вхідні</h1>
          </div>
        </div>
        {tasks.length > 0 && (
          <p className="text-sm text-slate-500 mt-3 ml-14 font-medium">
            {tasks.length} задач{tasks.length === 1 ? "а" : tasks.length < 5 ? "и" : ""} для перегляду
          </p>
        )}
      </header>

      <main className="flex-1 px-5 pb-8">
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
            <div className="w-24 h-24 rounded-full bg-white/70 shadow-sm flex items-center justify-center">
              <svg className="w-11 h-11 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Нічого не знайдено</h2>
              <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">Зроби brain-dump — AI заповнить вхідні.</p>
            </div>
            <Link
              href="/"
              className="mt-2 px-7 py-3.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold rounded-full text-sm hover:from-indigo-600 hover:to-violet-600 transition-all shadow-md shadow-indigo-200/50"
            >
              На сьогодні
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
