import { getSupabase } from "./supabase";

export interface DailyEntry {
  date: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  description: string;
  source: "manual" | "llm" | "edit" | "migrated";
  updated_at?: string;
}

export type DailyEntryInput = Omit<DailyEntry, "updated_at" | "source"> & {
  source?: DailyEntry["source"];
};

function todayISO(): string {
  const tz = process.env.APP_TIMEZONE || "America/New_York";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "0";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function getTodayISO(): string {
  return todayISO();
}

export async function getDailyEntry(date: string): Promise<DailyEntry | null> {
  const { data, error } = await getSupabase()
    .from("daily_entries")
    .select("*")
    .eq("date", date)
    .maybeSingle();
  if (error) throw new Error(`getDailyEntry failed: ${error.message}`);
  return data as DailyEntry | null;
}

export async function getDailyRange(startDate: string, endDate: string): Promise<DailyEntry[]> {
  const { data, error } = await getSupabase()
    .from("daily_entries")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (error) throw new Error(`getDailyRange failed: ${error.message}`);
  return (data || []) as DailyEntry[];
}

export async function upsertDailyEntry(entry: DailyEntryInput): Promise<DailyEntry> {
  const row = {
    date: entry.date,
    calories: Math.round(entry.calories),
    fat: Math.round(entry.fat),
    carbs: Math.round(entry.carbs),
    protein: Math.round(entry.protein),
    description: entry.description,
    source: entry.source || "manual",
  };
  const { data, error } = await getSupabase()
    .from("daily_entries")
    .upsert(row, { onConflict: "date" })
    .select()
    .single();
  if (error) throw new Error(`upsertDailyEntry failed: ${error.message}`);
  return data as DailyEntry;
}

export async function mergeDailyEntry(entry: DailyEntryInput): Promise<DailyEntry> {
  const existing = await getDailyEntry(entry.date);
  if (!existing) {
    return upsertDailyEntry({ ...entry, source: entry.source || "llm" });
  }
  const merged: DailyEntryInput = {
    date: entry.date,
    calories: existing.calories + entry.calories,
    fat: existing.fat + entry.fat,
    carbs: existing.carbs + entry.carbs,
    protein: existing.protein + entry.protein,
    description: existing.description
      ? `${existing.description}; ${entry.description}`
      : entry.description,
    source: entry.source || "llm",
  };
  return upsertDailyEntry(merged);
}

export async function deleteDailyEntry(date: string): Promise<void> {
  const { error } = await getSupabase().from("daily_entries").delete().eq("date", date);
  if (error) throw new Error(`deleteDailyEntry failed: ${error.message}`);
}

export interface DailyGoals {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

export async function getGoals(): Promise<DailyGoals> {
  const { data } = await getSupabase().from("goals").select("*").limit(1).single();
  if (data) {
    return { calories: data.calories, fat: data.fat, carbs: data.carbs, protein: data.protein };
  }
  return { calories: 2700, fat: 85, carbs: 230, protein: 170 };
}

export async function saveGoals(goals: DailyGoals): Promise<DailyGoals> {
  const supabase = getSupabase();
  const { data: existing } = await supabase.from("goals").select("id").limit(1).maybeSingle();
  const row = {
    calories: Math.round(goals.calories),
    fat: Math.round(goals.fat),
    carbs: Math.round(goals.carbs),
    protein: Math.round(goals.protein),
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    const { error } = await supabase.from("goals").update(row).eq("id", existing.id);
    if (error) throw new Error(`saveGoals failed: ${error.message}`);
  } else {
    const { error } = await supabase.from("goals").insert(row);
    if (error) throw new Error(`saveGoals failed: ${error.message}`);
  }
  return row;
}

export function computeRemaining(goals: DailyGoals, totals: DailyGoals): DailyGoals {
  return {
    calories: goals.calories - totals.calories,
    fat: goals.fat - totals.fat,
    carbs: goals.carbs - totals.carbs,
    protein: goals.protein - totals.protein,
  };
}
