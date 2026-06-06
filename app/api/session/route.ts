import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

const SESSION_COOKIE = "ai_planner_session";

export async function POST() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE)?.value;

  if (existing) {
    const user = await prisma.user.findUnique({ where: { id: existing } });
    if (user) {
      return NextResponse.json({ userId: user.id });
    }
  }

  const user = await prisma.user.create({
    data: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" },
  });

  const response = NextResponse.json({ userId: user.id });
  response.cookies.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return NextResponse.json({ userId: null });
  }

  const user = await prisma.user.findUnique({ where: { id: sessionId } });
  return NextResponse.json({ userId: user?.id ?? null });
}
