import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TASK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tasks"],
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "priority", "estimated_duration_minutes", "deadline_date", "deadline_time", "ambiguous"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 120 },
          priority: { type: "string", enum: ["must", "nice"] },
          estimated_duration_minutes: { type: "integer", minimum: 1, maximum: 600 },
          deadline_date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          deadline_time: { type: ["string", "null"], pattern: "^\\d{2}:\\d{2}$" },
          ambiguous: { type: "boolean" },
        },
      },
    },
  },
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { raw_text, timezone = "UTC", current_date } = body;

  if (!raw_text || typeof raw_text !== "string" || !raw_text.trim()) {
    return NextResponse.json({ error: "raw_text is required" }, { status: 400 });
  }

  if (raw_text.length > 4000) {
    return NextResponse.json({ error: "Input too long (max 4000 chars)" }, { status: 400 });
  }

  const systemPrompt = `You are a task extractor. Convert raw, unstructured brain-dump text into a structured list of tasks.

Rules:
- Split into atomic, single-action tasks (one verb/outcome each)
- Write title as a short imperative ("Message Anna", "Finish the deck")
- priority "must": urgency signals like "need to", "must", "don't forget", or any task with a specific time/deadline
- priority "nice": optional intent like "maybe", "later", "if I have time"
- estimated_duration_minutes: always estimate (message ~5-10m, focused work ~30-60m, calls ~15-30m, gym ~60m)
- deadline_date/deadline_time: only when explicitly stated; otherwise null. Resolve "today", "tomorrow", "15:00" using the provided date
- ambiguous: true when too vague to act on
- Do NOT invent tasks. Do NOT merge distinct tasks.
- Return tasks: [] if no actionable tasks found.

Current date: ${current_date || new Date().toLocaleDateString("en-CA")}
Timezone: ${timezone}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: raw_text.trim() }],
      tools: [
        {
          name: "extract_tasks",
          description: "Extract structured tasks from the user's brain-dump text",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          input_schema: TASK_SCHEMA as any,
        },
      ],
      tool_choice: { type: "auto" },
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ tasks: [] });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = toolUse.input as any;
    return NextResponse.json({ tasks: result.tasks || [] });
  } catch (err) {
    console.error("Parse error:", err);
    return NextResponse.json({ error: "AI parsing failed. Please try again." }, { status: 502 });
  }
}
