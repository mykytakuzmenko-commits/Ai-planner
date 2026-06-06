import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ParsedTask {
  title: string;
  priority: "must" | "nice";
  estimated_duration_minutes: number;
  deadline_date: string | null;
  deadline_time: string | null;
  ambiguous: boolean;
}

interface ParseResult {
  tasks: ParsedTask[];
}

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
        required: [
          "title",
          "priority",
          "estimated_duration_minutes",
          "deadline_date",
          "deadline_time",
          "ambiguous",
        ],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 120 },
          priority: { type: "string", enum: ["must", "nice"] },
          estimated_duration_minutes: {
            type: "integer",
            minimum: 1,
            maximum: 600,
          },
          deadline_date: {
            type: ["string", "null"],
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          },
          deadline_time: {
            type: ["string", "null"],
            pattern: "^\\d{2}:\\d{2}$",
          },
          ambiguous: { type: "boolean" },
        },
      },
    },
  },
};

export async function parseCapture(
  rawText: string,
  timezone: string = "UTC"
): Promise<ParseResult> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD
  const timeStr = now.toLocaleTimeString("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  });

  const systemPrompt = `You are a task extractor. Convert raw, unstructured brain-dump text into a structured list of tasks.

Rules:
- Split the dump into atomic, single-action tasks (one verb/outcome each)
- Write title as a short imperative ("Message Anna", "Finish the deck")
- priority:
  - "must" when input signals urgency/commitment: "need to", "must", "don't forget", or any task with a specific time/deadline
  - "nice" for optional/vague intent: "maybe", "later", "if I have time", "would be nice"
- estimated_duration_minutes: always provide a reasonable estimate even if none stated (message ~5-10 min, focused work ~30-60 min, calls ~15-30 min, gym ~60 min, admin ~10-15 min)
- deadline_date / deadline_time: only set when explicitly or clearly implied; otherwise null. Resolve relative references using provided date/timezone.
- ambiguous: true when the task is too vague to act on confidently
- Do NOT invent tasks not present in the input. Do NOT merge distinct tasks.
- Return tasks: [] if no actionable tasks found.

Current date: ${dateStr}
Current time: ${timeStr}
Timezone: ${timezone}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: rawText,
      },
    ],
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

  // Find tool use block
  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { tasks: [] };
  }

  const result = toolUse.input as ParseResult;
  return result;
}

export default anthropic;
