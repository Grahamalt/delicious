import { NextRequest, NextResponse } from "next/server";
import { listExercises, createExercise, EXERCISE_CATEGORIES, ExerciseCategory } from "@/lib/lifts";

export async function GET() {
  const exercises = await listExercises();
  return NextResponse.json({ exercises });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const category = EXERCISE_CATEGORIES.includes(body.category)
    ? (body.category as ExerciseCategory)
    : "push";
  const exercise = await createExercise(body.name, body.description || "", category);
  return NextResponse.json({ exercise });
}
