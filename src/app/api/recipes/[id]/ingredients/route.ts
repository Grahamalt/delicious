import { NextRequest, NextResponse } from "next/server";
import { addIngredient } from "@/lib/recipes";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const ingredient = await addIngredient(Number(id), {
    name: body.name || "",
    grams: Number(body.grams) || 0,
    calories: Number(body.calories) || 0,
    fat: Number(body.fat) || 0,
    carbs: Number(body.carbs) || 0,
    protein: Number(body.protein) || 0,
    sort_order: Number(body.sort_order) || 0,
  });
  return NextResponse.json({ ingredient });
}
