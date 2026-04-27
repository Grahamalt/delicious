import { getSupabase } from "./supabase";

export interface Recipe {
  id: number;
  name: string;
  notes: string;
  created_at?: string;
}

export interface RecipeIngredient {
  id: number;
  recipe_id: number;
  name: string;
  grams: number;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  sort_order: number;
  created_at?: string;
}

export async function listRecipes(): Promise<Recipe[]> {
  const { data, error } = await getSupabase()
    .from("recipes")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(`listRecipes failed: ${error.message}`);
  return (data || []) as Recipe[];
}

export async function getRecipe(id: number): Promise<Recipe | null> {
  const { data, error } = await getSupabase()
    .from("recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getRecipe failed: ${error.message}`);
  return data as Recipe | null;
}

export async function createRecipe(name: string, notes: string): Promise<Recipe> {
  const { data, error } = await getSupabase()
    .from("recipes")
    .insert({ name, notes })
    .select()
    .single();
  if (error) throw new Error(`createRecipe failed: ${error.message}`);
  return data as Recipe;
}

export async function updateRecipe(
  id: number,
  fields: { name?: string; notes?: string }
): Promise<Recipe> {
  const { data, error } = await getSupabase()
    .from("recipes")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateRecipe failed: ${error.message}`);
  return data as Recipe;
}

export async function deleteRecipe(id: number): Promise<void> {
  const { error } = await getSupabase().from("recipes").delete().eq("id", id);
  if (error) throw new Error(`deleteRecipe failed: ${error.message}`);
}

export async function listIngredients(recipeId: number): Promise<RecipeIngredient[]> {
  const { data, error } = await getSupabase()
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", recipeId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listIngredients failed: ${error.message}`);
  return (data || []) as RecipeIngredient[];
}

export async function addIngredient(
  recipeId: number,
  fields: Partial<Omit<RecipeIngredient, "id" | "recipe_id" | "created_at">>
): Promise<RecipeIngredient> {
  const row = {
    recipe_id: recipeId,
    name: fields.name || "",
    grams: fields.grams ?? 0,
    calories: fields.calories ?? 0,
    fat: fields.fat ?? 0,
    carbs: fields.carbs ?? 0,
    protein: fields.protein ?? 0,
    sort_order: fields.sort_order ?? 0,
  };
  const { data, error } = await getSupabase()
    .from("recipe_ingredients")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(`addIngredient failed: ${error.message}`);
  return data as RecipeIngredient;
}

export async function updateIngredient(
  id: number,
  fields: Partial<Omit<RecipeIngredient, "id" | "recipe_id" | "created_at">>
): Promise<RecipeIngredient> {
  const { data, error } = await getSupabase()
    .from("recipe_ingredients")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateIngredient failed: ${error.message}`);
  return data as RecipeIngredient;
}

export async function deleteIngredient(id: number): Promise<void> {
  const { error } = await getSupabase().from("recipe_ingredients").delete().eq("id", id);
  if (error) throw new Error(`deleteIngredient failed: ${error.message}`);
}
