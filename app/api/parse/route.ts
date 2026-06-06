import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API;
  if (!apiKey) {
    console.error("No Anthropic API key found");
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { raw_text, timezone = "UTC", current_date } = body;

  if (!raw_text || typeof raw_text !== "string" || !raw_text.trim()) {
    return NextResponse.json({ error: "raw_text is required" }, { status: 400 });
  }

  if (raw_text.length > 4000) {
    return NextResponse.json({ error: "Input too long (max 4000 chars)" }, { status: 400 });
  }

  const today = current_date || new Date().toLocaleDateString("en-CA");

  const prompt = `Extract tasks from this brain-dump and return ONLY a JSON object — no markdown, no explanation.

Current date: ${today} (timezone: ${timezone})

Rules:
- Split into atomic single-action tasks (one verb/outcome each)
- title: short imperative phrase
- priority "must": urgent/committed ("need to", "must", "don't forget", has time/deadline)
- priority "nice": optional ("maybe", "later", "would be nice")
- estimated_duration_minutes: always a number (message=5, call=20, meeting=60, gym=60, focused work=45)
- deadline_date: YYYY-MM-DD or null. "today" = ${today}
- deadline_time: HH:mm (24h) or null
- ambiguous: true if too vague to act on

Brain-dump:
"""
${raw_text.trim()}
"""

Respond with ONLY this JSON (no other text):
{"tasks":[{"title":"...","priority":"must","estimated_duration_minutes":10,"deadline_date":null,"deadline_time":null,"ambiguous":false}]}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    console.log("Claude raw response:", raw);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", raw);
      return NextResponse.json({ tasks: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    return NextResponse.json({ tasks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Anthropic API error:", msg);
    return NextResponse.json(
      { error: `AI parsing failed: ${msg}` },
      { status: 502 }
    );
  }
}
