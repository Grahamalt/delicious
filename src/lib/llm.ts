import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { WeekData, MealEntry } from "./sheets";

function formatWeekContext(weekData: WeekData): string {
  let context = `## Current Week: ${weekData.weekStart}\n\n`;
  context += `**Goals:** ${weekData.goals.calories} cal, ${weekData.goals.fat}g fat, ${weekData.goals.carbs}g carbs, ${weekData.goals.protein}g protein\n`;
  context += `**Week Average So Far:** ${weekData.averages.calories} cal, ${weekData.averages.fat}g fat, ${weekData.averages.carbs}g carbs, ${weekData.averages.protein}g protein\n\n`;

  for (const day of weekData.days) {
    if (day.meals.length === 0) continue;
    context += `### ${day.dayLabel} (${day.date})\n`;
    for (const meal of day.meals) {
      context += `- ${meal.description}: ${meal.calories} cal, ${meal.fat}g F, ${meal.carbs}g C, ${meal.protein}g P\n`;
    }
    context += `**Day Total:** ${day.totals.calories} cal, ${day.totals.fat}g F, ${day.totals.carbs}g C, ${day.totals.protein}g P\n\n`;
  }

  return context;
}

function getSystemPrompt(weekData: WeekData, notes: string[] = []): string {
  const today = new Date();
  const dayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday",
  ];
  const todayName = dayNames[today.getDay()];

  const notesSection = notes.length > 0
    ? `\n## User's Goals & Notes\n${notes.map((n) => `- ${n}`).join("\n")}\n`
    : "";

  return `You are a nutrition assistant helping track daily calories and macros. You have access to the user's food log spreadsheet data.

${formatWeekContext(weekData)}${notesSection}

Today is ${todayName}, ${today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.

Your role:
1. When the user tells you what they ate, estimate the calories, fat, carbs, and protein. Be accurate and consistent with common nutrition databases.
2. Give brief, practical advice about hitting their macro goals based on what they've eaten so far today and this week.
3. When logging a meal, respond with your best macro estimate and include a JSON block so the system can log it to their spreadsheet.

When the user wants to log a meal, include this JSON block at the END of your response (after your conversational reply):

\`\`\`meal_log
{
  "description": "Brief meal description",
  "calories": 500,
  "fat": 20,
  "carbs": 45,
  "protein": 35,
  "date": "YYYY-MM-DD"
}
\`\`\`

Use today's date unless the user specifies otherwise. Keep descriptions concise but descriptive (similar to their existing style like "2 servings Fage, 1 tbs honey" or "Kind bar").

Important guidelines:
${process.env.CHAT_STYLE === "friendly" ? `- Be warm, friendly, and encouraging! Use emojis to make the conversation fun and engaging 🎉
- Give thorough, detailed responses with explanations and tips.
- Celebrate wins and progress enthusiastically.
- When giving advice, explain the reasoning behind it.
- Use bullet points and structure to make responses easy to read.` : `- Be concise in your responses. No need for long explanations unless asked.`}
- When estimating, be transparent about uncertainty.
- Match the user's existing food description style in the log.
- Consider their weekly averages and remaining days when giving advice.
- If they ask about strategy, consider their workout schedule (weights vs cardio days).`;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  message: string;
  mealToLog?: MealEntry;
  dateToLog?: string;
}

async function chatClaude(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

async function chatOpenAI(
  messages: ChatMessage[],
  systemPrompt: string
): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    max_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });

  return response.choices[0]?.message?.content || "";
}

function parseResponse(text: string): ChatResponse {
  const mealMatch = text.match(/```meal_log\s*\n([\s\S]*?)\n```/);
  let mealToLog: MealEntry | undefined;
  let dateToLog: string | undefined;

  if (mealMatch) {
    try {
      const parsed = JSON.parse(mealMatch[1]);
      mealToLog = {
        description: parsed.description,
        calories: parsed.calories,
        fat: parsed.fat,
        carbs: parsed.carbs,
        protein: parsed.protein,
      };
      dateToLog = parsed.date;
    } catch {
      // Invalid JSON, skip logging
    }
  }

  const cleanMessage = text.replace(/```meal_log\s*\n[\s\S]*?\n```/, "").trim();

  return { message: cleanMessage, mealToLog, dateToLog };
}

export async function chat(
  messages: ChatMessage[],
  weekData: WeekData,
  notes: string[] = []
): Promise<ChatResponse> {
  const systemPrompt = getSystemPrompt(weekData, notes);
  const provider = process.env.LLM_PROVIDER || "claude";

  let text: string;
  if (provider === "openai") {
    text = await chatOpenAI(messages, systemPrompt);
  } else {
    text = await chatClaude(messages, systemPrompt);
  }

  return parseResponse(text);
}
