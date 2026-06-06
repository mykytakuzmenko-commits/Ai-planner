"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { updateTask, type Task } from "@/lib/storage";

// 06:00 → 23:00
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

function getTaskHour(task: Task): number | null {
  if (!task.deadlineTime) return null;
  const h = parseInt(task.deadlineTime.split(":")[0], 10);
  return isNaN(h) ? null : h;
}

function formatDur(min: number) {
  if (min < 60) return `${min}м`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}г ${m}м` : `${h}г`;
}

// ─────────────────────────────────────────────
// Mini task card (used inside timeline + drag overlay)
// ─────────────────────────────────────────────
function MiniCard({
  task,
  onComplete,
  onRemove,
  isDragOverlay = false,
}: {
  task: Task;
  onComplete: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
  isDragOverlay?: boolean;
}) {
  const done = task.status === "completed";
  return (
    <div
      className={`rounded-2xl px-3 py-2.5 flex items-center gap-2.5 transition-all ${
        done
          ? "bg-white/40 opacity-50"
          : isDragOverlay
          ? "bg-white shadow-xl shadow-indigo-200/40 ring-2 ring-indigo-200"
          : "bg-white"
      }`}
      style={
        !done && !isDragOverlay
          ? { boxShadow: "0 2px 8px rgba(99,102,241,0.09), 0 1px 2px rgba(0,0,0,0.05)" }
          : undefined
      }
    >
      {/* Checkbox */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onComplete(task.id, !done)}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
          done ? "bg-indigo-500 border-indigo-500" : "border-slate-300 hover:border-indigo-400"
        }`}
      >
        {done && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold leading-snug ${done ? "line-through text-slate-400" : "text-slate-800"}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            task.priority === "must" ? "bg-red-50 text-red-500" : "bg-violet-50 text-violet-500"
          }`}>
            {task.priority === "must" ? "Must" : "Nice"}
          </span>
          <span className="text-[10px] text-slate-400">
            {formatDur(task.estimatedDurationMinutes)}
          </span>
          {task.deadlineTime && (
            <span className="text-[10px] text-indigo-400 font-semibold">
              {task.deadlineTime}
            </span>
          )}
          {task.source === "mail" && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-full">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              Mail
            </span>
          )}
        </div>
      </div>

      {/* Drag handle (hidden when done) */}
      {!done && (
        <div className="text-slate-200 flex-shrink-0">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="7" cy="4" r="1.5" /><circle cx="13" cy="4" r="1.5" />
            <circle cx="7" cy="10" r="1.5" /><circle cx="13" cy="10" r="1.5" />
            <circle cx="7" cy="16" r="1.5" /><circle cx="13" cy="16" r="1.5" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Draggable wrapper
// ─────────────────────────────────────────────
function DraggableCard({
  task,
  onComplete,
  onRemove,
}: {
  task: Task;
  onComplete: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: task.status === "completed",
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.35 : 1,
        cursor: task.status === "completed" ? "default" : "grab",
        zIndex: isDragging ? 50 : undefined,
      }}
      {...listeners}
      {...attributes}
    >
      <MiniCard task={task} onComplete={onComplete} onRemove={onRemove} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Hour slot (droppable)
// ─────────────────────────────────────────────
function HourSlot({
  hour,
  tasks,
  isCurrentHour,
  onComplete,
  onRemove,
}: {
  hour: number;
  tasks: Task[];
  isCurrentHour: boolean;
  onComplete: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `hour-${hour}` });

  return (
    <div id={`hour-${hour}`} className="flex gap-2 group">
      {/* Time label */}
      <div className="w-11 flex-shrink-0 pt-2.5 text-right select-none">
        <span className={`text-[11px] font-semibold tabular-nums ${
          isCurrentHour ? "text-indigo-500" : "text-slate-300"
        }`}>
          {formatHour(hour)}
        </span>
      </div>

      {/* Divider + drop zone */}
      <div className="flex-1 flex flex-col">
        {/* Horizontal rule with current-hour indicator */}
        <div className="flex items-center gap-1.5 mb-1.5">
          {isCurrentHour && (
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0 -ml-1.5 ring-2 ring-indigo-100" />
          )}
          <div className={`flex-1 h-px ${isCurrentHour ? "bg-indigo-200" : "bg-slate-100"}`} />
        </div>

        {/* Drop target */}
        <div
          ref={setNodeRef}
          className={`flex-1 min-h-[36px] rounded-2xl transition-all flex flex-col gap-1.5 ${
            isOver
              ? "bg-indigo-50/80 border-2 border-dashed border-indigo-300 p-2"
              : tasks.length > 0
              ? "pb-2"
              : ""
          }`}
        >
          {isOver && tasks.length === 0 && (
            <div className="flex items-center justify-center h-8 text-xs text-indigo-400 font-semibold">
              Відпусти тут
            </div>
          )}
          {tasks.map((task) => (
            <DraggableCard key={task.id} task={task} onComplete={onComplete} onRemove={onRemove} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main TimelineView
// ─────────────────────────────────────────────
export default function TimelineView({
  tasks,
  onTasksChange,
  onComplete,
  onRemove,
}: {
  tasks: Task[];
  onTasksChange: () => void;
  onComplete: (id: string, done: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const currentHour = new Date().getHours();
  const currentHourRef = useRef<HTMLDivElement>(null);

  // Scroll to current hour on mount
  useEffect(() => {
    setTimeout(() => {
      const el = document.getElementById(`hour-${currentHour}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  }, [currentHour]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  // Bucket tasks
  const unscheduled = tasks.filter((t) => !t.deadlineTime && t.status !== "completed");
  const completedNoTime = tasks.filter((t) => t.status === "completed" && !t.deadlineTime);
  const scheduled = tasks.filter((t) => !!t.deadlineTime);

  const byHour: Record<number, Task[]> = {};
  for (const h of HOURS) byHour[h] = [];
  for (const t of scheduled) {
    const h = getTaskHour(t);
    if (h !== null && byHour[h]) byHour[h].push(t);
  }

  const handleDragStart = useCallback(
    (e: DragStartEvent) => {
      setActiveTask(tasks.find((t) => t.id === e.active.id) ?? null);
    },
    [tasks]
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = e;
      if (!over) return;
      const overId = String(over.id);
      if (overId.startsWith("hour-")) {
        const hour = parseInt(overId.replace("hour-", ""), 10);
        const time = `${String(hour).padStart(2, "0")}:00`;
        updateTask(String(active.id), { deadlineTime: time });
        onTasksChange();
      }
    },
    [onTasksChange]
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* ── Unscheduled pool ── */}
      {unscheduled.length > 0 && (
        <div className="mb-5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5 px-1 flex items-center gap-2">
            <span>Без часу</span>
            <span className="normal-case font-normal tracking-normal text-slate-300">· перетягни на годину</span>
          </p>
          <div className="flex flex-col gap-2">
            {unscheduled.map((task) => (
              <DraggableCard key={task.id} task={task} onComplete={onComplete} onRemove={onRemove} />
            ))}
          </div>
        </div>
      )}

      {/* Completed without time */}
      {completedNoTime.length > 0 && (
        <div className="mb-5 flex flex-col gap-2">
          {completedNoTime.map((task) => (
            <MiniCard key={task.id} task={task} onComplete={onComplete} onRemove={onRemove} />
          ))}
        </div>
      )}

      {/* ── Timeline ── */}
      <div ref={currentHourRef} className="flex flex-col">
        {HOURS.map((hour) => (
          <HourSlot
            key={hour}
            hour={hour}
            tasks={byHour[hour]}
            isCurrentHour={hour === currentHour}
            onComplete={onComplete}
            onRemove={onRemove}
          />
        ))}
      </div>

      {/* ── Drag overlay (floating ghost) ── */}
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
        {activeTask && (
          <div className="rotate-1 scale-[1.03]">
            <MiniCard task={activeTask} onComplete={() => {}} onRemove={() => {}} isDragOverlay />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
