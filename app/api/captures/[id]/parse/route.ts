import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseCapture } from "@/lib/anthropic";
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
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const capture = await prisma.rawCapture.findUnique({ where: { id } });
  if (!capture || capture.userId !== userId) {
    return NextResponse.json({ error: "Capture not found" }, { status: 404 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const timezone = user?.timezone ?? "UTC";

    const result = await parseCapture(capture.rawText, timezone);

    // Persist tasks
    const tasks = await Promise.all(
      result.tasks.map((t) =>
        prisma.task.create({
          data: {
            userId,
            title: t.title,
            priority: t.priority,
            estimatedDurationMinutes: t.estimated_duration_minutes,
            deadlineDate: t.deadline_date ?? null,
            deadlineTime: t.deadline_time ?? null,
            ambiguous: t.ambiguous,
            status: "inbox",
            sourceCapureId: capture.id,
          },
        })
      )
    );

    await prisma.rawCapture.update({
      where: { id },
      data: {
        parsingStatus: "success",
        aiResponse: JSON.stringify(result),
      },
    });

    return NextResponse.json({
      capture_id: capture.id,
      parsing_status: "success",
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        estimated_duration_minutes: t.estimatedDurationMinutes,
        deadline_date: t.deadlineDate,
        deadline_time: t.deadlineTime,
        ambiguous: t.ambiguous,
        status: t.status,
        created_at: t.createdAt,
      })),
    });
  } catch (error) {
    console.error("Parse error:", error);

    await prisma.rawCapture.update({
      where: { id },
      data: { parsingStatus: "failed" },
    });

    return NextResponse.json(
      { error: "AI parsing failed. Please try again.", capture_id: id, raw_text: capture.rawText },
      { status: 502 }
    );
  }
}
