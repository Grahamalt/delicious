import { NextRequest, NextResponse } from "next/server";
import { getProgress, addProgress, ProgressEntry, uploadImage } from "@/lib/sheets";

export async function GET() {
  try {
    const entries = await getProgress();
    return NextResponse.json({ entries });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const entry = (await req.json()) as ProgressEntry;

    // Upload photo to Supabase Storage if present
    if (entry.photo) {
      entry.photo = await uploadImage(entry.photo);
    }

    await addProgress(entry);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
