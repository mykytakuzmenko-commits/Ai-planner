import { cookies } from "next/headers";
import prisma from "./prisma";

const SESSION_COOKIE = "ai_planner_session";

export async function getOrCreateUser(): Promise<string> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    const user = await prisma.user.findUnique({ where: { id: sessionId } });
    if (user) return user.id;
  }

  // Create new anonymous user
  const user = await prisma.user.create({
    data: {
      timezone: "UTC",
    },
  });

  return user.id;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}

export async function getUserFromRequest(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const user = await prisma.user.findUnique({ where: { id: sessionId } });
  return user?.id ?? null;
}
