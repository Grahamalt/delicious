import { getSupabase } from "./supabase";

export type ExerciseCategory = "push" | "pull" | "legs" | "upper";

export const EXERCISE_CATEGORIES: ExerciseCategory[] = ["push", "pull", "legs", "upper"];

export interface Exercise {
  id: number;
  name: string;
  description: string;
  category: ExerciseCategory;
  created_at?: string;
}

export interface ExerciseSet {
  id: number;
  exercise_id: number;
  date: string;
  weight: number;
  reps: number;
  notes: string;
  created_at?: string;
}

export async function listExercises(): Promise<Exercise[]> {
  const { data, error } = await getSupabase()
    .from("exercises")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(`listExercises failed: ${error.message}`);
  return (data || []) as Exercise[];
}

export async function getExercise(id: number): Promise<Exercise | null> {
  const { data, error } = await getSupabase()
    .from("exercises")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getExercise failed: ${error.message}`);
  return data as Exercise | null;
}

export async function createExercise(
  name: string,
  description: string,
  category: ExerciseCategory
): Promise<Exercise> {
  const { data, error } = await getSupabase()
    .from("exercises")
    .insert({ name, description, category })
    .select()
    .single();
  if (error) throw new Error(`createExercise failed: ${error.message}`);
  return data as Exercise;
}

export async function updateExercise(
  id: number,
  fields: { name?: string; description?: string; category?: ExerciseCategory }
): Promise<Exercise> {
  const { data, error } = await getSupabase()
    .from("exercises")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateExercise failed: ${error.message}`);
  return data as Exercise;
}

export async function deleteExercise(id: number): Promise<void> {
  const { error } = await getSupabase().from("exercises").delete().eq("id", id);
  if (error) throw new Error(`deleteExercise failed: ${error.message}`);
}

export async function listSetsForExercise(exerciseId: number): Promise<ExerciseSet[]> {
  const { data, error } = await getSupabase()
    .from("exercise_sets")
    .select("*")
    .eq("exercise_id", exerciseId)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listSetsForExercise failed: ${error.message}`);
  return (data || []) as ExerciseSet[];
}

export async function addSet(
  exerciseId: number,
  data: { date: string; weight: number; reps: number; notes?: string }
): Promise<ExerciseSet> {
  const { data: row, error } = await getSupabase()
    .from("exercise_sets")
    .insert({
      exercise_id: exerciseId,
      date: data.date,
      weight: data.weight,
      reps: data.reps,
      notes: data.notes || "",
    })
    .select()
    .single();
  if (error) throw new Error(`addSet failed: ${error.message}`);
  return row as ExerciseSet;
}

export async function deleteSet(id: number): Promise<void> {
  const { error } = await getSupabase().from("exercise_sets").delete().eq("id", id);
  if (error) throw new Error(`deleteSet failed: ${error.message}`);
}
