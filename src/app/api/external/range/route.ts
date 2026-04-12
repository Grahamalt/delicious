import { NextRequest, NextResponse } from "next/server";
import { checkBearerAuth } from "@/lib/auth";
import { getDailyRange, getGoals, getTodayISO } from "@/lib/daily";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  if (!checkBearerAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  let start = url.searchParams.get("start");
  let end = url.searchParams.get("end");
  const daysParam = url.searchParams.get("days");

  if (!start || !end) {
    const days = daysParam ? Math.max(1, Math.min(parseInt(daysParam) || 30, 730)) : 30;
    start = isoDaysAgo(days);
    end = getTodayISO();
  }

  const [entries, goals] = await Promise.all([getDailyRange(start, end), getGoals()]);

  const loggedDays = entries.length;
  const sums = entries.reduce(
    (s, e) => ({
      calories: s.calories + e.calories,
      fat: s.fat + e.fat,
      carbs: s.carbs + e.carbs,
      protein: s.protein + e.protein,
    }),
    { calories: 0, fat: 0, carbs: 0, protein: 0 }
  );
  const averages = loggedDays
    ? {
        calories: Math.round(sums.calories / loggedDays),
        fat: Math.round(sums.fat / loggedDays),
        carbs: Math.round(sums.carbs / loggedDays),
        protein: Math.round(sums.protein / loggedDays),
      }
    : { calories: 0, fat: 0, carbs: 0, protein: 0 };

  return NextResponse.json({
    start,
    end,
    goals,
    daysLogged: loggedDays,
    averages,
    entries,
  });
}
