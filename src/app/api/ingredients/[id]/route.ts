import { NextRequest, NextResponse } from "next/server";
import { updateIngredient, deleteIngredient } from "@/lib/recipes";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const fields: Record<string, string | number> = {};
  for (const k of ["name", "grams", "calories", "fat", "carbs", "protein", "sort_order"]) {
    if (body[k] !== undefined) {
      fields[k] = k === "name" ? String(body[k]) : Number(body[k]) || 0;
    }
  }
  const ingredient = await updateIngredient(Number(id), fields);
  return NextResponse.json({ ingredient });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteIngredient(Number(id));
  return NextResponse.json({ ok: true });
}
