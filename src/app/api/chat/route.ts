import { NextRequest, NextResponse } from "next/server";
import { chat, ChatMessage } from "@/lib/llm";
import { getCurrentWeekData, addMeal, updateDayTotals, getNotes } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  const { messages } = (await req.json()) as { messages: ChatMessage[] };

  try {
    const [weekData, notes] = await Promise.all([
      getCurrentWeekData(),
      getNotes(),
    ]);
    const response = await chat(messages, weekData, notes);

    // If Claude suggested logging a meal, do it
    if (response.mealToLog && response.dateToLog) {
      const logDate = new Date(response.dateToLog + "T12:00:00");
      await addMeal(logDate, response.mealToLog);
      await updateDayTotals(logDate);
    }

    return NextResponse.json({
      message: response.message,
      logged: !!response.mealToLog,
      meal: response.mealToLog,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : "";
    console.error("Chat error:", errMsg, errStack);
    return NextResponse.json(
      { error: `Failed to process chat: ${errMsg}` },
      { status: 500 }
    );
  }
}
