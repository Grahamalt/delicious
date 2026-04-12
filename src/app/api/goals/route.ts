import { NextRequest, NextResponse } from "next/server";
import { getGoals, saveGoals } from "@/lib/daily";

export async function GET() {
  const goals = await getGoals();
  return NextResponse.json({ goals });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const goals = await saveGoals({
    calories: Number(body.calories) || 0,
    fat: Number(body.fat) || 0,
    carbs: Number(body.carbs) || 0,
    protein: Number(body.protein) || 0,
  });
  return NextResponse.json({ goals });
}
