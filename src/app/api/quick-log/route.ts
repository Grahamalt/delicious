import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  getTodayISO,
  upsertDailyEntry,
  mergeDailyEntry,
  getDailyEntry,
  DailyEntry,
} from "@/lib/daily";
import { checkBearerAuth } from "@/lib/auth";

export const maxDuration = 30;

interface ParsedSummary {
  date: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  description: string;
  intent: "override" | "merge";
}

export async function POST(req: NextRequest) {
  if (!checkBearerAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  let text = "";
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      text = (body.text || body.content || body.message || "").toString();
    } else {
      text = await req.text();
    }
  } catch {
    text = "";
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "Empty text" }, { status: 400 });
  }

  const today = getTodayISO();

  const systemPrompt = `You parse a daily food summary and return a single JSON object.

TODAY'S DATE: ${today}

The user sends a summary of what they ate (could be a bullet list, a paragraph, a copy-paste from another app, or a natural-language description). Estimate total calories, fat, carbs, and protein for the entire summary. Consolidate everything into ONE entry for ONE date.

Return ONLY this JSON object, no prose, no markdown fences:
{
  "date": "${today}",
  "calories": 2400,
  "fat": 70,
  "carbs": 220,
  "protein": 165,
  "description": "concise list of foods, comma-separated",
  "intent": "override"
}

Rules:
- "date": use ${today} unless the user says "yesterday" (use day before), names a specific date, or says a weekday.
- "calories"/"fat"/"carbs"/"protein": integers, your best estimate of TOTAL macros for everything in the summary.
- "description": brief comma-separated list of the foods (e.g., "oatmeal, chicken sandwich, apple, salmon dinner"). NOT a full sentence.
- "intent":
    - "override" by default — assume the user is replacing the day's entry with this complete summary.
    - "merge" ONLY if the user explicitly says "add", "also", "plus", "additionally", "on top of", or similar additive language.
- Be accurate with macro estimates based on standard nutrition data.
- If no food at all is mentioned, return: {"date":"${today}","calories":0,"fat":0,"carbs":0,"protein":0,"description":"","intent":"override"}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: text }],
  });

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  const match = reply.match(/\{[\s\S]*\}/);
  if (!match) {
    return NextResponse.json({ error: "Could not parse summary", raw: reply }, { status: 500 });
  }

  let parsed: ParsedSummary;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return NextResponse.json({ error: "Invalid JSON from model", raw: reply }, { status: 500 });
  }

  if (!parsed.description && parsed.calories === 0) {
    return NextResponse.json({ logged: false, reason: "No food detected" });
  }

  const intent = parsed.intent === "merge" ? "merge" : "override";
  const previous = await getDailyEntry(parsed.date);

  let saved: DailyEntry;
  if (intent === "merge") {
    saved = await mergeDailyEntry({
      date: parsed.date,
      calories: parsed.calories,
      fat: parsed.fat,
      carbs: parsed.carbs,
      protein: parsed.protein,
      description: parsed.description,
      source: "llm",
    });
  } else {
    saved = await upsertDailyEntry({
      date: parsed.date,
      calories: parsed.calories,
      fat: parsed.fat,
      carbs: parsed.carbs,
      protein: parsed.protein,
      description: parsed.description,
      source: "llm",
    });
  }

  return NextResponse.json({
    logged: true,
    intent,
    previous,
    entry: saved,
  });
}
