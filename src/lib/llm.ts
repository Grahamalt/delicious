import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { DailyEntry, DailyGoals, getDailyRange, getTodayISO, getGoals } from "./daily";
import { getNotes, getCustomPrompt } from "./sheets";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDailyContext(entries: DailyEntry[], goals: DailyGoals, todayDate: string): string {
  const map = new Map(entries.map((e) => [e.date, e]));
  let context = `GOALS: ${goals.calories} cal | ${goals.fat}g fat | ${goals.carbs}g carbs | ${goals.protein}g protein\n\n`;

  // Build last 14 days
  const lines: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const isToday = iso === todayDate;
    const e = map.get(iso);
    const marker = isToday ? " <<<< TODAY" : "";
    if (!e) {
      lines.push(`[${iso}]${marker} — NO ENTRY`);
    } else {
      lines.push(
        `[${iso}]${marker} ${e.calories} cal | ${e.fat}f | ${e.carbs}c | ${e.protein}p — ${e.description || "(no description)"}`
      );
    }
  }
  context += lines.join("\n") + "\n";

  const todayEntry = map.get(todayDate);
  if (todayEntry) {
    context += `\nREMAINING TODAY: ${goals.calories - todayEntry.calories} cal | ${goals.fat - todayEntry.fat}g fat | ${goals.carbs - todayEntry.carbs}g carbs | ${goals.protein - todayEntry.protein}g protein\n`;
  }

  return context;
}

function getSystemPrompt(
  entries: DailyEntry[],
  goals: DailyGoals,
  notes: string[] = [],
  customPrompt: string | null = null
): string {
  const tz = process.env.APP_TIMEZONE || "America/New_York";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const pts = fmt.formatToParts(new Date());
  const g = (t: string) => pts.find((p) => p.type === t)?.value || "0";
  const today = new Date(parseInt(g("year")), parseInt(g("month")) - 1, parseInt(g("day")), parseInt(g("hour")), parseInt(g("minute")));
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = dayNames[today.getDay()];
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const currentTime = `${today.getHours() % 12 || 12}:${String(today.getMinutes()).padStart(2, "0")} ${today.getHours() >= 12 ? "PM" : "AM"}`;

  const notesSection = notes.length > 0
    ? `\n## User's Goals & Notes\n${notes.map((n) => `- ${n}`).join("\n")}\n`
    : "";

  const dataSection = `
=== CURRENT DATE AND TIME (AUTHORITATIVE — DO NOT GUESS) ===
TODAY IS: ${todayName}, ${today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
TODAY'S DATE: ${todayISO}
CURRENT TIME: ${currentTime} Eastern
=== END DATE ===

=== DAILY ENTRIES (SOURCE OF TRUTH) ===
This app stores ONE entry per day with estimated total macros and a description of what was eaten. The user logs their summary at end of day. The numbers below are the user's own estimates — treat them as authoritative for past days.

${formatDailyContext(entries, goals, todayISO)}${notesSection}
=== END DATA ===`;

  const loggingInstructions = `
DAILY LOGGING INSTRUCTIONS:
The user can ask you to log a daily summary. When they do, include this JSON block at the END of your response:

\`\`\`daily_log
{
  "date": "${todayISO}",
  "calories": 2400,
  "fat": 70,
  "carbs": 220,
  "protein": 165,
  "description": "concise comma-separated food list",
  "intent": "override"
}
\`\`\`

Rules:
- "intent": use "override" by default (replaces the day). Use "merge" only if the user says "add", "also", "plus", "additionally" — then macros are ADDED to whatever's already there.
- Default date is today (${todayISO}). Use a different date only if the user names one.
- If the user wants to delete a day's entry, use this block:

\`\`\`daily_remove
{"date": "${todayISO}"}
\`\`\`

HISTORY LOOKUP:
You can query the daily entries database for ranges beyond the 14 days shown above:

\`\`\`db_query
{"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}
\`\`\`

WEB SEARCH:
You can search the web for restaurant menus or branded product nutrition data:

\`\`\`search_query
exact food item nutrition facts
\`\`\`

Only use search when exact data matters. For common foods, estimate from your knowledge.`;

  if (customPrompt) {
    return `${customPrompt}\n\n${dataSection}\n\n${loggingInstructions}\n\nCRITICAL: Reference only the daily entries shown. Never invent macros for past days.`;
  }

  return `You are a nutrition assistant. The user logs ONE daily summary per day with estimated total macros. Help them estimate, log, query, and strategize against their macro goals.

${dataSection}

${loggingInstructions}

Guidelines:
${process.env.CHAT_STYLE === "friendly"
  ? `- Be warm and encouraging. Use emojis and structure your responses with bullets when helpful.`
  : `- Be concise. No long explanations unless asked.`}
- When estimating, be transparent about uncertainty.
- Reference only the daily entries shown — never invent macros for past days.
- When advising, consider weekly averages and remaining days.`;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image?: string;
}

export interface DailyLogIntent {
  date: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  description: string;
  intent: "override" | "merge";
}

export interface ChatResponse {
  message: string;
  dailyLog?: DailyLogIntent;
  dailyRemove?: { date: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildClaudeMessages(messages: ChatMessage[]): any[] {
  return messages.map((m) => {
    if (m.image && m.role === "user") {
      const base64 = m.image.replace(/^data:image\/\w+;base64,/, "");
      const mediaType = m.image.match(/^data:(image\/\w+);/)?.[1] || "image/jpeg";
      return {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: m.content || "What's in this meal? Estimate the calories and macros." },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

function buildOpenAIMessages(messages: ChatMessage[], systemPrompt: string) {
  const msgs: Array<{ role: "system" | "user" | "assistant"; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
    { role: "system", content: systemPrompt },
  ];
  for (const m of messages) {
    if (m.image && m.role === "user") {
      msgs.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: m.image } },
          { type: "text", text: m.content || "What's in this meal? Estimate the calories and macros." },
        ],
      });
    } else {
      msgs.push({ role: m.role, content: m.content });
    }
  }
  return msgs;
}

async function chatClaude(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: buildClaudeMessages(messages) as any,
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function chatOpenAI(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    max_tokens: 1024,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: buildOpenAIMessages(messages, systemPrompt) as any,
  });
  return response.choices[0]?.message?.content || "";
}

function parseResponse(text: string): ChatResponse {
  let dailyLog: DailyLogIntent | undefined;
  let dailyRemove: { date: string } | undefined;

  const logMatch = text.match(/```daily_log\s*\n([\s\S]*?)\n```/);
  if (logMatch) {
    try {
      const parsed = JSON.parse(logMatch[1]);
      dailyLog = {
        date: parsed.date,
        calories: Number(parsed.calories) || 0,
        fat: Number(parsed.fat) || 0,
        carbs: Number(parsed.carbs) || 0,
        protein: Number(parsed.protein) || 0,
        description: parsed.description || "",
        intent: parsed.intent === "merge" ? "merge" : "override",
      };
    } catch {
      // ignore
    }
  }

  const removeMatch = text.match(/```daily_remove\s*\n([\s\S]*?)\n```/);
  if (removeMatch) {
    try {
      const parsed = JSON.parse(removeMatch[1]);
      if (parsed.date) dailyRemove = { date: parsed.date };
    } catch {
      // ignore
    }
  }

  const cleanMessage = text
    .replace(/```daily_log\s*\n[\s\S]*?\n```/g, "")
    .replace(/```daily_remove\s*\n[\s\S]*?\n```/g, "")
    .trim();

  return { message: cleanMessage, dailyLog, dailyRemove };
}

export async function chat(messages: ChatMessage[]): Promise<ChatResponse> {
  const today = getTodayISO();
  const start = isoDaysAgo(14);
  const [entries, goals, notes, customPrompt] = await Promise.all([
    getDailyRange(start, today),
    getGoals(),
    getNotes(),
    getCustomPrompt(),
  ]);

  const systemPrompt = getSystemPrompt(entries, goals, notes, customPrompt);
  const provider = process.env.LLM_PROVIDER || "claude";

  const callLLM = async (msgs: ChatMessage[], sys: string): Promise<string> => {
    if (provider === "openai") return chatOpenAI(msgs, sys);
    return chatClaude(msgs, sys);
  };

  let text = await callLLM(messages, systemPrompt);

  // Web search loop
  const searchMatch = text.match(/```search_query\s*\n([\s\S]*?)\n```/);
  if (searchMatch && process.env.TAVILY_API_KEY) {
    const query = searchMatch[1].trim();
    const { searchWeb } = await import("./search");
    const searchResults = await searchWeb(query);
    const augmented: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: `I searched for: ${query}` },
      { role: "user", content: `Here are the search results:\n\n${searchResults}\n\nNow answer my original question. Do NOT output another search_query block.` },
    ];
    text = await callLLM(augmented, systemPrompt);
  }
  text = text.replace(/```search_query\s*\n[\s\S]*?\n```/g, "").trim();

  // DB query loop
  const dbMatch = text.match(/```db_query\s*\n([\s\S]*?)\n```/);
  if (dbMatch) {
    try {
      const query = JSON.parse(dbMatch[1]);
      if (query.start && query.end) {
        const results = await getDailyRange(query.start, query.end);
        const dbResults = results.length === 0
          ? `No daily entries between ${query.start} and ${query.end}.`
          : results
              .map((e) => `${e.date}: ${e.calories} cal, ${e.fat}f, ${e.carbs}c, ${e.protein}p — ${e.description}`)
              .join("\n");
        const augmented: ChatMessage[] = [
          ...messages,
          { role: "assistant", content: `I queried the daily entries.` },
          { role: "user", content: `Database results:\n\n${dbResults}\n\nNow answer my original question. Do NOT output another db_query block.` },
        ];
        text = await callLLM(augmented, systemPrompt);
      }
    } catch {
      // ignore
    }
  }
  text = text.replace(/```db_query\s*\n[\s\S]*?\n```/g, "").trim();

  return parseResponse(text);
}
