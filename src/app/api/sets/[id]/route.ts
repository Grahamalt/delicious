import { NextRequest, NextResponse } from "next/server";
import { deleteSet } from "@/lib/lifts";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteSet(Number(id));
  return NextResponse.json({ ok: true });
}
