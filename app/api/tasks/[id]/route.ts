import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

const SESSION_COOKIE = "ai_planner_session";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.userId !== userId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await request.json();
  const allowed = ["status", "title", "priority", "estimated_duration_minutes", "deadline_date", "deadline_time"];
  const updateData: Record<string, unknown> = {};

  if (body.status !== undefined && ["inbox", "today", "completed", "deleted"].includes(body.status)) {
    updateData.status = body.status;
  }
  if (body.title !== undefined) updateData.title = body.title;
  if (body.priority !== undefined && ["must", "nice"].includes(body.priority)) {
    updateData.priority = body.priority;
  }
  if (body.estimated_duration_minutes !== undefined) {
    updateData.estimatedDurationMinutes = body.estimated_duration_minutes;
  }
  if (body.deadline_date !== undefined) updateData.deadlineDate = body.deadline_date;
  if (body.deadline_time !== undefined) updateData.deadlineTime = body.deadline_time;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.task.update({ where: { id }, data: updateData });

  return NextResponse.json({
    task: {
      id: updated.id,
      title: updated.title,
      priority: updated.priority,
      estimated_duration_minutes: updated.estimatedDurationMinutes,
      deadline_date: updated.deadlineDate,
      deadline_time: updated.deadlineTime,
      ambiguous: updated.ambiguous,
      status: updated.status,
      completed_at: updated.completedAt,
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.userId !== userId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const deleted = await prisma.task.update({
    where: { id },
    data: { status: "deleted" },
  });

  return NextResponse.json({ task_id: deleted.id, status: "deleted" });
}
