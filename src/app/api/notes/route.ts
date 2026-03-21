import { NextRequest, NextResponse } from "next/server";
import { getNotes, saveNotes } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const password = req.headers.get("x-app-password");
  if (password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const notes = await getNotes();
    return NextResponse.json({ notes });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const password = req.headers.get("x-app-password");
  if (password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { notes } = (await req.json()) as { notes: string[] };
    await saveNotes(notes);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
