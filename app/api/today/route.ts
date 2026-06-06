import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

const SESSION_COOKIE = "ai_planner_session";

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.task.findMany({
    where: {
      userId,
      status: { in: ["today", "completed"] },
    },
    orderBy: [
      { status: "asc" }, // "completed" after "today"
      { priority: "asc" }, // "must" before "nice"
      { deadlineTime: "asc" },
      { createdAt: "asc" },
    ],
  });

  const inboxCount = await prisma.task.count({
    where: { userId, status: "inbox" },
  });

  return NextResponse.json({
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      estimated_duration_minutes: t.estimatedDurationMinutes,
      deadline_date: t.deadlineDate,
      deadline_time: t.deadlineTime,
      ambiguous: t.ambiguous,
      status: t.status,
      completed_at: t.completedAt,
      created_at: t.createdAt,
    })),
    inbox_count: inboxCount,
  });
}
