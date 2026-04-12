import { NextRequest, NextResponse } from "next/server";
import { checkBearerAuth } from "@/lib/auth";
import {
  upsertDailyEntry,
  mergeDailyEntry,
  deleteDailyEntry,
  getDailyEntry,
} from "@/lib/daily";

export async function POST(req: NextRequest) {
  if (!checkBearerAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (!body.date) {
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
  }

  const intent = body.intent === "merge" ? "merge" : "override";
  const previous = await getDailyEntry(body.date);

  const entryInput = {
    date: body.date,
    calories: Number(body.calories) || 0,
    fat: Number(body.fat) || 0,
    carbs: Number(body.carbs) || 0,
    protein: Number(body.protein) || 0,
    description: body.description || "",
    source: "llm" as const,
  };

  const saved =
    intent === "merge" ? await mergeDailyEntry(entryInput) : await upsertDailyEntry(entryInput);

  return NextResponse.json({ logged: true, intent, previous, entry: saved });
}

export async function DELETE(req: NextRequest) {
  if (!checkBearerAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "date required" }, { status: 400 });
  }
  await deleteDailyEntry(date);
  return NextResponse.json({ ok: true, deleted: date });
}
