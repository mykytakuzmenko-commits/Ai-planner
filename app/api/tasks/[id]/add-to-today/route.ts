import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

const SESSION_COOKIE = "ai_planner_session";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function POST(
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
  if (task.status === "today") {
    return NextResponse.json({ error: "Task already in Today" }, { status: 409 });
  }

  const updated = await prisma.task.update({
    where: { id },
    data: { status: "today" },
  });

  // Update or create DayPlan
  const today = new Date().toLocaleDateString("en-CA");
  const dayPlan = await prisma.dayPlan.findUnique({
    where: { userId_date: { userId, date: today } },
  });

  if (dayPlan) {
    const taskIds = JSON.parse(dayPlan.taskIds) as string[];
    if (!taskIds.includes(id)) {
      await prisma.dayPlan.update({
        where: { userId_date: { userId, date: today } },
        data: { taskIds: JSON.stringify([...taskIds, id]) },
      });
    }
  } else {
    await prisma.dayPlan.create({
      data: { userId, date: today, taskIds: JSON.stringify([id]) },
    });
  }

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
    },
  });
}
