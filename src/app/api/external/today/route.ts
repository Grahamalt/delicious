import { NextRequest, NextResponse } from "next/server";
import { checkBearerAuth } from "@/lib/auth";
import { getDailyEntry, getGoals, getTodayISO, computeRemaining } from "@/lib/daily";

export async function GET(req: NextRequest) {
  if (!checkBearerAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getTodayISO();
  const [entry, goals] = await Promise.all([getDailyEntry(today), getGoals()]);

  const totals = entry
    ? { calories: entry.calories, fat: entry.fat, carbs: entry.carbs, protein: entry.protein }
    : { calories: 0, fat: 0, carbs: 0, protein: 0 };

  return NextResponse.json({
    date: today,
    goals,
    totals,
    remaining: computeRemaining(goals, totals),
    description: entry?.description || "",
    logged: !!entry,
  });
}
