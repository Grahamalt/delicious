import { getSupabase } from "./supabase";
import type {
  BodyScan,
  CreateBodyScanInput,
  UpdateBodyScanInput,
} from "@/types/body-tracking";

interface BodyScanRow {
  id: string;
  date: string;
  weight_lbs: number;
  waist_cm: number;
  shoulder_cm: number | null;
  photo_front_url: string | null;
  photo_side_left_url: string | null;
  photo_side_right_url: string | null;
  photo_back_url: string | null;
  notes: string | null;
  created_at: string;
}

function rowToScan(row: BodyScanRow): BodyScan {
  return {
    id: row.id,
    date: row.date,
    weightLbs: row.weight_lbs,
    waistCm: row.waist_cm,
    shoulderCm: row.shoulder_cm,
    photoFrontUrl: row.photo_front_url,
    photoSideLeftUrl: row.photo_side_left_url,
    photoSideRightUrl: row.photo_side_right_url,
    photoBackUrl: row.photo_back_url,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mergeField<T>(incoming: T | undefined, existing: T | null | undefined): T | null {
  if (incoming !== undefined) return incoming as T;
  return (existing ?? null) as T | null;
}

function mergeNotes(incoming: string | null | undefined, existing: string | null | undefined): string | null {
  if (incoming === undefined) return existing ?? null;
  if (!incoming) return existing ?? null;
  if (!existing) return incoming;
  if (existing.includes(incoming)) return existing;
  return `${existing} · ${incoming}`;
}

function inputToUpdate(input: UpdateBodyScanInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.date !== undefined) row.date = input.date;
  if (input.weightLbs !== undefined) row.weight_lbs = input.weightLbs;
  if (input.waistCm !== undefined) row.waist_cm = input.waistCm;
  if (input.shoulderCm !== undefined) row.shoulder_cm = input.shoulderCm;
  if (input.photoFrontUrl !== undefined) row.photo_front_url = input.photoFrontUrl;
  if (input.photoSideLeftUrl !== undefined) row.photo_side_left_url = input.photoSideLeftUrl;
  if (input.photoSideRightUrl !== undefined) row.photo_side_right_url = input.photoSideRightUrl;
  if (input.photoBackUrl !== undefined) row.photo_back_url = input.photoBackUrl;
  if (input.notes !== undefined) row.notes = input.notes;
  return row;
}

export async function listBodyScans(): Promise<BodyScan[]> {
  const { data, error } = await getSupabase()
    .from("body_scans")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw new Error(`listBodyScans failed: ${error.message}`);
  return (data || []).map(rowToScan);
}

export async function upsertBodyScan(input: CreateBodyScanInput): Promise<BodyScan> {
  const supabase = getSupabase();
  const { data: existing, error: fetchErr } = await supabase
    .from("body_scans")
    .select("*")
    .eq("date", input.date)
    .maybeSingle();
  if (fetchErr) throw new Error(`upsertBodyScan fetch failed: ${fetchErr.message}`);

  const row: Record<string, unknown> = {
    date: input.date,
    weight_lbs: mergeField(input.weightLbs, existing?.weight_lbs),
    waist_cm: mergeField(input.waistCm, existing?.waist_cm),
    shoulder_cm: mergeField(input.shoulderCm, existing?.shoulder_cm),
    photo_front_url: mergeField(input.photoFrontUrl, existing?.photo_front_url),
    photo_side_left_url: mergeField(input.photoSideLeftUrl, existing?.photo_side_left_url),
    photo_side_right_url: mergeField(input.photoSideRightUrl, existing?.photo_side_right_url),
    photo_back_url: mergeField(input.photoBackUrl, existing?.photo_back_url),
    notes: mergeNotes(input.notes, existing?.notes),
  };

  const { data, error } = await supabase
    .from("body_scans")
    .upsert(row, { onConflict: "date" })
    .select()
    .single();
  if (error) throw new Error(`upsertBodyScan failed: ${error.message}`);
  return rowToScan(data as BodyScanRow);
}

export async function getBodyScanById(id: string): Promise<BodyScan | null> {
  const { data, error } = await getSupabase()
    .from("body_scans")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getBodyScanById failed: ${error.message}`);
  return data ? rowToScan(data as BodyScanRow) : null;
}

export async function updateBodyScan(
  id: string,
  input: UpdateBodyScanInput,
): Promise<BodyScan | null> {
  const patch = inputToUpdate(input);
  if (Object.keys(patch).length === 0) {
    return getBodyScanById(id);
  }
  const { data, error } = await getSupabase()
    .from("body_scans")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw new Error(`updateBodyScan failed: ${error.message}`);
  return data ? rowToScan(data as BodyScanRow) : null;
}

export async function deleteBodyScan(id: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("body_scans")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`deleteBodyScan failed: ${error.message}`);
  return (data || []).length > 0;
}
