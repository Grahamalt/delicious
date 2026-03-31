import { getSupabase } from "./supabase";

// ---- Shared types (unchanged) ----

export interface MealEntry {
  description: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

export interface DayData {
  date: string;
  dayLabel: string;
  meals: MealEntry[];
  totals: { calories: number; fat: number; carbs: number; protein: number };
}

export interface WeekData {
  weekStart: string;
  days: DayData[];
  averages: { calories: number; fat: number; carbs: number; protein: number };
  goals: { calories: number; fat: number; carbs: number; protein: number };
}

export interface WeekSummary {
  weekStart: string;
  averages: { calories: number; fat: number; carbs: number; protein: number };
  daysLogged: number;
}

export interface ProgressEntry {
  date: string;
  time: string;
  weight: number | null;
  photo: string | null;
  note: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---- Timezone helper ----

function nowLocal(): Date {
  const tz = process.env.APP_TIMEZONE || "America/New_York";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  return new Date(
    parseInt(get("year")), parseInt(get("month")) - 1, parseInt(get("day")),
    parseInt(get("hour")), parseInt(get("minute")), parseInt(get("second"))
  );
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getSundayOfWeek(d: Date): Date {
  const result = new Date(d);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

// ---- Goals ----

async function getGoals(): Promise<{ calories: number; fat: number; carbs: number; protein: number }> {
  const { data } = await getSupabase().from("goals").select("*").limit(1).single();
  if (data) {
    return { calories: data.calories, fat: data.fat, carbs: data.carbs, protein: data.protein };
  }
  return { calories: 2650, fat: 85, carbs: 230, protein: 180 };
}

// ---- Week data ----

export async function getCurrentWeekData(date?: Date): Promise<WeekData> {
  const targetDate = date || nowLocal();
  const sunday = getSundayOfWeek(targetDate);
  const saturday = new Date(sunday);
  saturday.setDate(saturday.getDate() + 6);

  const startDate = toISO(sunday);
  const endDate = toISO(saturday);

  const [{ data: meals }, goals] = await Promise.all([
    getSupabase()
      .from("meals")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("created_at", { ascending: true }),
    getGoals(),
  ]);

  const days: DayData[] = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(sunday);
    dayDate.setDate(dayDate.getDate() + i);
    const dayISO = toISO(dayDate);

    const dayMeals = (meals || [])
      .filter((m) => m.date === dayISO)
      .map((m) => ({
        description: m.description,
        calories: m.calories,
        fat: m.fat,
        carbs: m.carbs,
        protein: m.protein,
      }));

    const totals = dayMeals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        fat: acc.fat + m.fat,
        carbs: acc.carbs + m.carbs,
        protein: acc.protein + m.protein,
      }),
      { calories: 0, fat: 0, carbs: 0, protein: 0 }
    );

    days.push({ date: dayISO, dayLabel: DAY_NAMES[i], meals: dayMeals, totals });
  }

  const daysWithMeals = days.filter((d) => d.meals.length > 0);
  const count = daysWithMeals.length || 1;
  const averages = {
    calories: Math.round(daysWithMeals.reduce((s, d) => s + d.totals.calories, 0) / count),
    fat: Math.round(daysWithMeals.reduce((s, d) => s + d.totals.fat, 0) / count),
    carbs: Math.round(daysWithMeals.reduce((s, d) => s + d.totals.carbs, 0) / count),
    protein: Math.round(daysWithMeals.reduce((s, d) => s + d.totals.protein, 0) / count),
  };

  const weekLabel = `${sunday.toLocaleString("en-US", { month: "short" }).toLowerCase()} ${sunday.getDate()} ${sunday.getFullYear()}`;

  return { weekStart: weekLabel, days, averages, goals };
}

// ---- Recent weeks (for chat context) ----

export async function getRecentWeeksData(numWeeks: number = 4): Promise<WeekData[]> {
  const now = nowLocal();
  const weeks: WeekData[] = [];

  for (let i = 0; i < numWeeks; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const weekData = await getCurrentWeekData(d);
    const hasMeals = weekData.days.some((day) => day.meals.length > 0);
    if (hasMeals) {
      weeks.push(weekData);
    }
  }

  return weeks;
}

// ---- Meal search (for LLM queries) ----

export async function searchMeals(query: string, limit: number = 20): Promise<{ date: string; description: string; calories: number; fat: number; carbs: number; protein: number }[]> {
  const { data } = await getSupabase()
    .from("meals")
    .select("date, description, calories, fat, carbs, protein")
    .ilike("description", `%${query}%`)
    .order("date", { ascending: false })
    .limit(limit);

  return data || [];
}

export async function getMealsByDateRange(startDate: string, endDate: string): Promise<{ date: string; description: string; calories: number; fat: number; carbs: number; protein: number }[]> {
  const { data } = await getSupabase()
    .from("meals")
    .select("date, description, calories, fat, carbs, protein")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  return data || [];
}

// ---- Yearly summary ----

export async function getYearlySummary(): Promise<{ weeks: WeekSummary[]; goals: { calories: number; fat: number; carbs: number; protein: number } }> {
  const now = nowLocal();
  const yearStart = `${now.getFullYear()}-01-01`;
  const yearEnd = `${now.getFullYear()}-12-31`;

  const [{ data: meals }, goals] = await Promise.all([
    getSupabase()
      .from("meals")
      .select("date, calories, fat, carbs, protein")
      .gte("date", yearStart)
      .lte("date", yearEnd)
      .order("date", { ascending: true }),
    getGoals(),
  ]);

  // Group meals by week (Sunday start)
  const weekMap = new Map<string, { totals: { calories: number; fat: number; carbs: number; protein: number }; daysSet: Set<string> }>();

  for (const meal of meals || []) {
    const d = new Date(meal.date + "T12:00:00");
    const sunday = getSundayOfWeek(d);
    const weekLabel = `${sunday.toLocaleString("en-US", { month: "short" }).toLowerCase()} ${sunday.getDate()} ${sunday.getFullYear()}`;

    if (!weekMap.has(weekLabel)) {
      weekMap.set(weekLabel, { totals: { calories: 0, fat: 0, carbs: 0, protein: 0 }, daysSet: new Set() });
    }

    const week = weekMap.get(weekLabel)!;
    week.totals.calories += meal.calories;
    week.totals.fat += meal.fat;
    week.totals.carbs += meal.carbs;
    week.totals.protein += meal.protein;
    week.daysSet.add(meal.date);
  }

  const weeks: WeekSummary[] = [];
  for (const [weekStart, { totals, daysSet }] of weekMap) {
    const daysLogged = daysSet.size;
    if (daysLogged > 0) {
      weeks.push({
        weekStart,
        averages: {
          calories: Math.round(totals.calories / daysLogged),
          fat: Math.round(totals.fat / daysLogged),
          carbs: Math.round(totals.carbs / daysLogged),
          protein: Math.round(totals.protein / daysLogged),
        },
        daysLogged,
      });
    }
  }

  return { weeks, goals };
}

// ---- Add / remove meals ----

export async function addMeal(date: Date, meal: MealEntry): Promise<void> {
  const dateStr = toISO(date);
  await getSupabase().from("meals").insert({
    date: dateStr,
    description: meal.description,
    calories: meal.calories,
    fat: meal.fat,
    carbs: meal.carbs,
    protein: meal.protein,
  });
}

export async function removeMeal(date: Date, description: string): Promise<boolean> {
  const dateStr = toISO(date);

  // Find the meal by date and description match
  const { data: matches } = await getSupabase()
    .from("meals")
    .select("id, description")
    .eq("date", dateStr);

  const descLower = description.toLowerCase();
  const match = (matches || []).find(
    (m) => m.description.toLowerCase().includes(descLower) || descLower.includes(m.description.toLowerCase())
  );

  if (!match) return false;

  await getSupabase().from("meals").delete().eq("id", match.id);
  return true;
}

// updateDayTotals is no longer needed (totals computed on the fly) but keep the signature for compatibility
export async function updateDayTotals(_date: Date): Promise<void> {
  // No-op: totals are computed dynamically from the meals table
}

// ---- Notes ----

export async function getNotes(): Promise<string[]> {
  const { data } = await getSupabase()
    .from("notes")
    .select("content")
    .order("created_at", { ascending: true });

  return (data || []).map((r) => r.content);
}

export async function saveNotes(notes: string[]): Promise<void> {
  // Clear existing notes and insert new ones
  await getSupabase().from("notes").delete().neq("id", 0);
  if (notes.length > 0) {
    await getSupabase().from("notes").insert(notes.map((n) => ({ content: n })));
  }
}

// ---- Custom prompt ----

export async function getCustomPrompt(): Promise<string | null> {
  const { data } = await getSupabase()
    .from("custom_prompt")
    .select("content")
    .limit(1)
    .single();

  return data?.content || null;
}

// ---- Progress ----

export async function getProgress(): Promise<ProgressEntry[]> {
  const { data } = await getSupabase()
    .from("progress")
    .select("*")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  return (data || []).map((r) => ({
    date: r.date,
    time: r.time,
    weight: r.weight ? Number(r.weight) : null,
    photo: r.photo || null,
    note: r.note || "",
  }));
}

export async function addProgress(entry: ProgressEntry): Promise<void> {
  await getSupabase().from("progress").insert({
    date: entry.date,
    time: entry.time,
    weight: entry.weight,
    photo: entry.photo || null,
    note: entry.note,
  });
}

// ---- Image upload (Supabase Storage) ----

export async function uploadImage(base64Data: string): Promise<string> {
  const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const filename = `progress_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;

  const { data, error } = await getSupabase().storage
    .from("progress-photos")
    .upload(filename, Buffer.from(base64, "base64"), {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error || !data) {
    // Fallback: return the original data URL
    return base64Data;
  }

  const { data: urlData } = getSupabase().storage
    .from("progress-photos")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
