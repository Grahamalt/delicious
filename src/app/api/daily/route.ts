import { NextRequest, NextResponse } from "next/server";
import {
  getDailyEntry,
  getDailyRange,
  upsertDailyEntry,
  deleteDailyEntry,
  getGoals,
  getTodayISO,
} from "@/lib/daily";

function weekRange(anchor: string): { start: string; end: string } {
  const d = new Date(anchor + "T12:00:00");
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const iso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { start: iso(sunday), end: iso(saturday) };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  const goals = await getGoals();

  if (date) {
    const entry = await getDailyEntry(date);
    return NextResponse.json({ entry, goals });
  }

  let s = start;
  let e = end;
  if (!s || !e) {
    const r = weekRange(getTodayISO());
    s = r.start;
    e = r.end;
  }

  const entries = await getDailyRange(s, e);
  return NextResponse.json({ entries, goals, start: s, end: e });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.date) {
    return NextResponse.json({ error: "date required" }, { status: 400 });
  }
  const saved = await upsertDailyEntry({
    date: body.date,
    calories: Number(body.calories) || 0,
    fat: Number(body.fat) || 0,
    carbs: Number(body.carbs) || 0,
    protein: Number(body.protein) || 0,
    description: body.description || "",
    source: body.source || "edit",
  });
  return NextResponse.json({ entry: saved });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "date required" }, { status: 400 });
  }
  await deleteDailyEntry(date);
  return NextResponse.json({ ok: true });
}
