import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export const maxDuration = 30;

interface Macros {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

function parseMacros(text: string): Macros | null {
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return {
      calories: Number(parsed.calories) || 0,
      fat: Number(parsed.fat) || 0,
      carbs: Number(parsed.carbs) || 0,
      protein: Number(parsed.protein) || 0,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { name, grams } = await req.json();
  if (!name || !grams) {
    return NextResponse.json({ error: "name and grams required" }, { status: 400 });
  }

  const prompt = `Estimate the macros for ${grams} grams of: ${name}.
Return ONLY a JSON object on a single line, no other text, no code fences:
{"calories": <kcal>, "fat": <grams>, "carbs": <grams>, "protein": <grams>}
Round to whole numbers. If the food is ambiguous, assume the most common preparation.`;

  const provider = process.env.LLM_PROVIDER || "claude";
  let text = "";

  if (provider === "openai") {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    text = r.choices[0]?.message?.content || "";
  } else {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    text = r.content[0].type === "text" ? r.content[0].text : "";
  }

  const macros = parseMacros(text);
  if (!macros) {
    return NextResponse.json({ error: "Could not parse macros", raw: text }, { status: 502 });
  }
  return NextResponse.json({ macros });
}
