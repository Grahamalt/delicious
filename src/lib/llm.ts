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

function getSystemPrompt(weekData: WeekData, notes: string[] = [], customPrompt: string | null = null): string {
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday",
  ];
  const todayName = dayNames[today.getDay()];

  const notesSection = notes.length > 0
    ? `\n## User's Goals & Notes\n${notes.map((n) => `- ${n}`).join("\n")}\n`
    : "";

  const dataSection = `
=== SPREADSHEET DATA (SOURCE OF TRUTH) ===
The following is the user's ACTUAL food log from their spreadsheet. You MUST reference this data when discussing what they've eaten. Do NOT invent, guess, or hallucinate any meals or totals. If the user asks about what they ate, ONLY reference entries listed below.

${formatWeekContext(weekData)}${notesSection}
Today is ${todayName}, ${today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
=== END SPREADSHEET DATA ===`;

  const mealLogInstructions = `
MEAL LOGGING INSTRUCTIONS (always follow these):
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

Use today's date (${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}) unless the user specifies otherwise.

When the user wants to remove/delete a meal entry, include this JSON block at the END:

\`\`\`meal_remove
{
  "description": "the meal description to match",
  "date": "YYYY-MM-DD"
}
\`\`\`

WEB SEARCH:
You DO have the ability to search the web. The system will execute the search for you and return results. Do NOT say you cannot access links or search the internet — you can.

If the user asks about a specific restaurant menu item, branded food product, or anything where looking up exact nutrition data would help, request a web search by including this block INSTEAD of your normal response:

\`\`\`search_query
exact name of food item nutrition facts macros
\`\`\`

Only use search when exact data matters (restaurant items, specific branded products). For common foods like "chicken breast" or "banana", just estimate from your knowledge. NEVER tell the user you cannot search or access the web — you can.`;

  // If there's a custom prompt, use it as the main coaching instructions
  if (customPrompt) {
    return `${customPrompt}

${dataSection}

${mealLogInstructions}

CRITICAL RULES:
- ONLY reference meals and totals from the SPREADSHEET DATA above. Never make up or guess what the user ate.
- When calculating totals, use ONLY the numbers from the spreadsheet data.
- If the spreadsheet shows no meals for today, say so — do not invent entries.`;
  }

  // Default prompt
  return `You are a nutrition assistant helping track daily calories and macros.

${dataSection}

${mealLogInstructions}

Your role:
1. When the user tells you what they ate, estimate the calories, fat, carbs, and protein. Be accurate and consistent with common nutrition databases.
2. Give brief, practical advice about hitting their macro goals based on what they've eaten so far today and this week.
3. When logging a meal, respond with your best macro estimate.

Important guidelines:
${process.env.CHAT_STYLE === "friendly" ? `- Be warm, friendly, and encouraging! Use emojis to make the conversation fun and engaging.
- Give thorough, detailed responses with explanations and tips.
- Celebrate wins and progress enthusiastically.
- When giving advice, explain the reasoning behind it.
- Use bullet points and structure to make responses easy to read.` : `- Be concise in your responses. No need for long explanations unless asked.`}
- When estimating, be transparent about uncertainty.
- Match the user's existing food description style in the log.
- Consider their weekly averages and remaining days when giving advice.
- ONLY reference meals and totals from the SPREADSHEET DATA above. Never make up or guess what the user ate.
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
  mealToRemove?: { description: string; date: string };
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

  // Parse meal_remove JSON if present
  const removeMatch = text.match(/```meal_remove\s*\n([\s\S]*?)\n```/);
  let mealToRemove: { description: string; date: string } | undefined;

  if (removeMatch) {
    try {
      const parsed = JSON.parse(removeMatch[1]);
      mealToRemove = { description: parsed.description, date: parsed.date };
    } catch {
      // Invalid JSON, skip
    }
  }

  const cleanMessage = text
    .replace(/```meal_log\s*\n[\s\S]*?\n```/, "")
    .replace(/```meal_remove\s*\n[\s\S]*?\n```/, "")
    .trim();

  return { message: cleanMessage, mealToLog, dateToLog, mealToRemove };
}

export async function chat(
  messages: ChatMessage[],
  weekData: WeekData,
  notes: string[] = [],
  customPrompt: string | null = null
): Promise<ChatResponse> {
  const systemPrompt = getSystemPrompt(weekData, notes, customPrompt);
  const provider = process.env.LLM_PROVIDER || "claude";

  const callLLM = async (msgs: ChatMessage[], sys: string): Promise<string> => {
    if (provider === "openai") {
      return chatOpenAI(msgs, sys);
    }
    return chatClaude(msgs, sys);
  };

  let text = await callLLM(messages, systemPrompt);

  // Check if the model wants to search
  const searchMatch = text.match(/```search_query\s*\n([\s\S]*?)\n```/);
  if (searchMatch) {
    const query = searchMatch[1].trim();

    if (process.env.TAVILY_API_KEY) {
      const { searchWeb } = await import("./search");
      const searchResults = await searchWeb(query);

      // Re-send with search results
      const augmentedMessages: ChatMessage[] = [
        ...messages,
        { role: "assistant", content: `I searched for: ${query}` },
        { role: "user", content: `Here are the search results:\n\n${searchResults}\n\nNow please answer my original question using this data. Do NOT output another search_query block.` },
      ];

      text = await callLLM(augmentedMessages, systemPrompt);
    }

    // Always clean search_query blocks from output
    text = text.replace(/```search_query\s*\n[\s\S]*?\n```/g, "").trim();
  }

  return parseResponse(text);
}
