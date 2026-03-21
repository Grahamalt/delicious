import Anthropic from "@anthropic-ai/sdk";
import { WeekData, MealEntry } from "./sheets";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  message: string;
  mealToLog?: MealEntry;
  dateToLog?: string;
}

export async function chat(
  messages: ChatMessage[],
  weekData: WeekData
): Promise<ChatResponse> {
  const today = new Date();
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const todayName = dayNames[today.getDay()];

  const systemPrompt = `You are a nutrition assistant helping track daily calories and macros. You have access to the user's food log spreadsheet data.

${formatWeekContext(weekData)}

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
- Be concise in your responses. No need for long explanations unless asked.
- When estimating, be transparent about uncertainty.
- Match the user's existing food description style in the log.
- Consider their weekly averages and remaining days when giving advice.
- If they ask about strategy, consider their workout schedule (weights vs cardio days).`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse meal_log JSON if present
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

  // Clean the meal_log block from the displayed message
  const cleanMessage = text.replace(/```meal_log\s*\n[\s\S]*?\n```/, "").trim();

  return {
    message: cleanMessage,
    mealToLog,
    dateToLog,
  };
}
