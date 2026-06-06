import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { raw_text, timezone = "UTC", current_date } = body;

  if (!raw_text || typeof raw_text !== "string" || !raw_text.trim()) {
    return NextResponse.json({ error: "raw_text is required" }, { status: 400 });
  }

  if (raw_text.length > 4000) {
    return NextResponse.json({ error: "Input too long (max 4000 chars)" }, { status: 400 });
  }

  const today = current_date || new Date().toLocaleDateString("en-CA");

  const prompt = `You are a task extractor. Convert this brain-dump into structured tasks as JSON.

Current date: ${today}
Timezone: ${timezone}

Rules:
- Split into atomic single-action tasks
- title: short imperative ("Message Anna", "Finish the deck")
- priority "must": urgent signals ("need to", "must", "don't forget") or has a specific time/deadline
- priority "nice": optional ("maybe", "later", "if I have time")
- estimated_duration_minutes: always estimate (message=5, email=10, call=20, meeting=60, gym=60, focused work=30-90)
- deadline_date/deadline_time: only when explicitly stated, else null. Resolve "today"→${today}, "15:00"→"15:00"
- ambiguous: true if too vague to act on
- Return ONLY valid JSON, no markdown, no explanation.

Input: "${raw_text.trim()}"

Return this exact JSON format:
{
  "tasks": [
    {
      "title": "string",
      "priority": "must" | "nice",
      "estimated_duration_minutes": number,
      "deadline_date": "YYYY-MM-DD" | null,
      "deadline_time": "HH:mm" | null,
      "ambiguous": boolean
    }
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ tasks: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ tasks: parsed.tasks || [] });
  } catch (err) {
    console.error("Parse error:", err);
    return NextResponse.json(
      { error: "AI parsing failed. Please try again." },
      { status: 502 }
    );
  }
}
