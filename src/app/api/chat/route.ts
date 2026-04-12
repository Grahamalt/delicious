import { NextRequest, NextResponse } from "next/server";
import { chat, ChatMessage } from "@/lib/llm";
import { upsertDailyEntry, mergeDailyEntry, deleteDailyEntry } from "@/lib/daily";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.ANTHROPIC_API_KEY && process.env.LLM_PROVIDER !== "openai") missing.push("ANTHROPIC_API_KEY");
  if (!process.env.OPENAI_API_KEY && process.env.LLM_PROVIDER === "openai") missing.push("OPENAI_API_KEY");
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing environment variables: ${missing.join(", ")}.` },
      { status: 500 }
    );
  }

  const { messages } = (await req.json()) as { messages: ChatMessage[] };

  const response = await chat(messages);

  let logged = false;
  let removed = false;
  let entry = null;

  if (response.dailyLog) {
    const input = {
      date: response.dailyLog.date,
      calories: response.dailyLog.calories,
      fat: response.dailyLog.fat,
      carbs: response.dailyLog.carbs,
      protein: response.dailyLog.protein,
      description: response.dailyLog.description,
      source: "llm" as const,
    };
    entry =
      response.dailyLog.intent === "merge"
        ? await mergeDailyEntry(input)
        : await upsertDailyEntry(input);
    logged = true;
  }

  if (response.dailyRemove) {
    await deleteDailyEntry(response.dailyRemove.date);
    removed = true;
  }

  return NextResponse.json({
    message: response.message,
    logged,
    removed,
    entry,
    intent: response.dailyLog?.intent,
  });
}
