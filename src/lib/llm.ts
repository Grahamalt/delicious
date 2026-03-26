import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { WeekData, MealEntry } from "./sheets";

function formatWeekContext(weekData: WeekData, todayDate: string): string {
  let context = `WEEK: ${weekData.weekStart}\n`;
  context += `GOALS: ${weekData.goals.calories} cal | ${weekData.goals.fat}g fat | ${weekData.goals.carbs}g carbs | ${weekData.goals.protein}g protein\n`;
  context += `WEEK AVERAGE (logged days only): ${weekData.averages.calories} cal | ${weekData.averages.fat}g fat | ${weekData.averages.carbs}g carbs | ${weekData.averages.protein}g protein\n\n`;

  for (const day of weekData.days) {
    const isToday = day.date === todayDate;
    const marker = isToday ? " <<<< TODAY" : "";

    if (day.meals.length === 0) {
      context += `[${day.dayLabel}] ${day.date}${marker} — NO MEALS LOGGED\n`;
      continue;
    }

    context += `[${day.dayLabel}] ${day.date}${marker}\n`;
    for (let i = 0; i < day.meals.length; i++) {
      const meal = day.meals[i];
      context += `  ${i + 1}. ${meal.description} = ${meal.calories} cal, ${meal.fat}g fat, ${meal.carbs}g carbs, ${meal.protein}g protein\n`;
    }
    context += `  TOTAL: ${day.totals.calories} cal | ${day.totals.fat}g fat | ${day.totals.carbs}g carbs | ${day.totals.protein}g protein\n`;

    if (isToday) {
      context += `  REMAINING TODAY: ${weekData.goals.calories - day.totals.calories} cal | ${weekData.goals.fat - day.totals.fat}g fat | ${weekData.goals.carbs - day.totals.carbs}g carbs | ${weekData.goals.protein - day.totals.protein}g protein\n`;
    }
    context += `\n`;
  }

  return context;
}

function getSystemPrompt(weekData: WeekData, notes: string[] = [], customPrompt: string | null = null): string {
  const tz = process.env.APP_TIMEZONE || "America/New_York";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const pts = fmt.formatToParts(new Date());
  const g = (t: string) => pts.find((p) => p.type === t)?.value || "0";
  const today = new Date(parseInt(g("year")), parseInt(g("month")) - 1, parseInt(g("day")), parseInt(g("hour")), parseInt(g("minute")));
  const dayNames = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday",
  ];
  const todayName = dayNames[today.getDay()];

  const notesSection = notes.length > 0
    ? `\n## User's Goals & Notes\n${notes.map((n) => `- ${n}`).join("\n")}\n`
    : "";

  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const currentTime = `${today.getHours() % 12 || 12}:${String(today.getMinutes()).padStart(2, "0")} ${today.getHours() >= 12 ? "PM" : "AM"}`;

  const dataSection = `
=== CURRENT DATE AND TIME (AUTHORITATIVE — DO NOT GUESS) ===
TODAY IS: ${todayName}, ${today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
TODAY'S DATE: ${todayISO}
CURRENT TIME: ${currentTime} Eastern
DO NOT use any other date. If the user says "today", it means ${todayISO}. If the user says "yesterday", it means the day before ${todayISO}.
=== END DATE ===

=== SPREADSHEET DATA (SOURCE OF TRUTH — DO NOT FABRICATE) ===
The data below is EXACTLY what the user's spreadsheet contains right now. These numbers are PRECISE.
When the user asks "what did I eat today" or "what are my totals", you MUST use ONLY the numbers below.
Do NOT round differently, do NOT add meals that aren't listed, do NOT change any values.
If a day shows "NO MEALS LOGGED", tell the user that — do not guess what they might have eaten.

${formatWeekContext(weekData, todayISO)}${notesSection}
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

Use today's date (${todayISO}) unless the user specifies otherwise. TODAY IS ${todayISO} — do not use any other date for "today".

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
  image?: string; // base64 data URL for images
}

export interface ChatResponse {
  message: string;
  mealToLog?: MealEntry;
  dateToLog?: string;
  mealToRemove?: { description: string; date: string };
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: buildClaudeMessages(messages) as any,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: buildOpenAIMessages(messages, systemPrompt) as any,
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
