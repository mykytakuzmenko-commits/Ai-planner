import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

const SESSION_COOKIE = "ai_planner_session";
const MAX_LENGTH = 4000;

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { raw_text, input_type } = body;

  if (!raw_text || typeof raw_text !== "string" || raw_text.trim().length === 0) {
    return NextResponse.json({ error: "raw_text is required" }, { status: 400 });
  }

  if (raw_text.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Input too long. Maximum ${MAX_LENGTH} characters.` },
      { status: 400 }
    );
  }

  if (!["text", "voice"].includes(input_type)) {
    return NextResponse.json({ error: "input_type must be text or voice" }, { status: 400 });
  }

  const capture = await prisma.rawCapture.create({
    data: {
      userId,
      rawText: raw_text.trim(),
      inputType: input_type,
      parsingStatus: "pending",
    },
  });

  return NextResponse.json({
    capture_id: capture.id,
    parsing_status: capture.parsingStatus,
  });
}
