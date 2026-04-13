import { NextRequest, NextResponse } from "next/server";
import { listSetsForExercise, addSet } from "@/lib/lifts";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sets = await listSetsForExercise(Number(id));
  return NextResponse.json({ sets });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (!body.date || body.weight == null || body.reps == null) {
    return NextResponse.json({ error: "date, weight, reps required" }, { status: 400 });
  }
  const set = await addSet(Number(id), {
    date: body.date,
    weight: Number(body.weight),
    reps: Number(body.reps),
    notes: body.notes || "",
  });
  return NextResponse.json({ set });
}
