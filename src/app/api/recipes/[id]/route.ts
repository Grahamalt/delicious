import { NextRequest, NextResponse } from "next/server";
import { getRecipe, updateRecipe, deleteRecipe, listIngredients } from "@/lib/recipes";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipe(Number(id));
  if (!recipe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ingredients = await listIngredients(Number(id));
  return NextResponse.json({ recipe, ingredients });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const recipe = await updateRecipe(Number(id), {
    name: body.name,
    notes: body.notes,
  });
  return NextResponse.json({ recipe });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteRecipe(Number(id));
  return NextResponse.json({ ok: true });
}
