import { getSupabase } from "./supabase";

// Legacy filename — kept because progress, notes, goals, and custom_prompt
// helpers still live here. Per-meal helpers were removed in the daily-entry
// migration; daily entry logic lives in lib/daily.ts.

export interface ProgressEntry {
  date: string;
  time: string;
  weight: number | null;
  photo: string | null;
  note: string;
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
    return base64Data;
  }

  const { data: urlData } = getSupabase().storage
    .from("progress-photos")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
