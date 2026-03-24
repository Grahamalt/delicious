import { NextRequest, NextResponse } from "next/server";
import { chat, ChatMessage } from "@/lib/llm";
import { getCurrentWeekData, addMeal, removeMeal, updateDayTotals, getNotes, getCustomPrompt } from "@/lib/sheets";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { messages } = (await req.json()) as { messages: ChatMessage[] };

  try {
    const [weekData, notes, customPrompt] = await Promise.all([
      getCurrentWeekData(),
      getNotes(),
      getCustomPrompt(),
    ]);
    const response = await chat(messages, weekData, notes, customPrompt);

    // If Claude suggested logging a meal, do it
    if (response.mealToLog && response.dateToLog) {
      const logDate = new Date(response.dateToLog + "T12:00:00");
      await addMeal(logDate, response.mealToLog);
      await updateDayTotals(logDate);
    }

    // If Claude suggested removing a meal, do it
    let removed = false;
    if (response.mealToRemove) {
      const removeDate = new Date(response.mealToRemove.date + "T12:00:00");
      removed = await removeMeal(removeDate, response.mealToRemove.description);
      if (removed) {
        await updateDayTotals(removeDate);
      }
    }

    return NextResponse.json({
      message: response.message,
      logged: !!response.mealToLog,
      meal: response.mealToLog,
      removed,
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
