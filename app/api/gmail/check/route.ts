import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API || process.env.ANTHROPIC_API_KEY,
});

interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  body: string;
}

// Decode base64url Gmail body
function decodeBody(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

// Extract plain text from Gmail message payload
function extractText(payload: Record<string, unknown>): string {
  const mimeType = payload.mimeType as string;
  const body = payload.body as Record<string, unknown>;
  const parts = payload.parts as Record<string, unknown>[] | undefined;

  if (mimeType === "text/plain" && body?.data) {
    return decodeBody(body.data as string).slice(0, 2000);
  }
  if (parts) {
    for (const part of parts) {
      const text = extractText(part as Record<string, unknown>);
      if (text) return text;
    }
  }
  return "";
}

// Fetch one email's details
async function fetchEmail(id: string, accessToken: string): Promise<EmailMessage | null> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const msg = await res.json();

  const headers: { name: string; value: string }[] = msg.payload?.headers || [];
  const subject = headers.find((h) => h.name === "Subject")?.value || "(no subject)";
  const from = headers.find((h) => h.name === "From")?.value || "";
  const snippet = msg.snippet || "";
  const body = extractText(msg.payload || {});

  return { id, subject, from, snippet, body };
}

// Ask AI if this email contains any actionable tasks
async function parseEmailTasks(email: EmailMessage, currentDate: string) {
  const content = `From: ${email.from}
Subject: ${email.subject}
---
${email.body || email.snippet}`;

  const prompt = `You are a task extractor. Read this email and extract any action items the RECIPIENT needs to do.

Be conservative — only extract clear, concrete actions. Skip newsletters, promotions, notifications with no action needed.
If no real tasks found, return {"tasks":[]}.

Current date: ${currentDate}

Email:
"""
${content.slice(0, 3000)}
"""

Return ONLY JSON (no markdown):
{"tasks":[{"title":"...","priority":"must"|"nice","estimated_duration_minutes":number,"deadline_date":"YYYY-MM-DD"|null,"deadline_time":"HH:mm"|null}]}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];

  const parsed = JSON.parse(match[0]);
  return Array.isArray(parsed.tasks) ? parsed.tasks : [];
}

export async function POST(request: NextRequest) {
  const { access_token, processed_ids = [], timezone = "UTC" } = await request.json();

  if (!access_token) {
    return NextResponse.json({ error: "access_token required" }, { status: 400 });
  }

  const currentDate = new Date().toLocaleDateString("en-CA", { timeZone: timezone });

  try {
    // Fetch only today's unread emails from inbox
    const todayDate = new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
    const afterDate = todayDate.replace(/-/g, "/"); // Gmail format: YYYY/MM/DD
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread in:inbox after:${afterDate}&maxResults=20`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (listRes.status === 401) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }
    if (!listRes.ok) {
      const errBody = await listRes.json().catch(() => ({}));
      console.error("Gmail list error:", listRes.status, errBody);
      const msg = errBody?.error?.message || errBody?.error || "Gmail API error";
      return NextResponse.json({ error: `Gmail: ${msg}` }, { status: 502 });
    }

    const listData = await listRes.json();
    const messages: { id: string }[] = listData.messages || [];

    // Filter out already-processed emails
    const newMessages = messages.filter((m) => !processed_ids.includes(m.id));
    if (newMessages.length === 0) {
      return NextResponse.json({ tasks: [], processed_ids: [] });
    }

    // Process up to 5 emails
    const toProcess = newMessages.slice(0, 5);
    const allTasks: unknown[] = [];
    const processedIds: string[] = [];

    for (const msg of toProcess) {
      const email = await fetchEmail(msg.id, access_token);
      if (!email) continue;

      const tasks = await parseEmailTasks(email, currentDate);
      if (tasks.length > 0) {
        allTasks.push(
          ...tasks.map((t: Record<string, unknown>) => ({
            ...t,
            source: "mail",
            sourceEmailId: email.id,
            sourceEmailSubject: email.subject,
          }))
        );
      }
      processedIds.push(email.id);
    }

    return NextResponse.json({ tasks: allTasks, processed_ids: processedIds });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Gmail check error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
