import { NextRequest, NextResponse } from "next/server";
import { listRecipes, createRecipe } from "@/lib/recipes";

export async function GET() {
  const recipes = await listRecipes();
  return NextResponse.json({ recipes });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const recipe = await createRecipe(body.name, body.notes || "");
  return NextResponse.json({ recipe });
}
