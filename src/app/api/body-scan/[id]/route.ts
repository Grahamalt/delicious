import { NextRequest, NextResponse } from "next/server";
import { getBodyScanById, updateBodyScan, deleteBodyScan } from "@/lib/body";
import type { UpdateBodyScanInput } from "@/types/body-tracking";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const scan = await getBodyScanById(id);
    if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    return NextResponse.json({ scan });
  } catch (err) {
    console.error("[GET /api/body-scan/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await req.json()) as UpdateBodyScanInput;

    if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json(
        { error: "date must be in YYYY-MM-DD format" },
        { status: 400 },
      );
    }

    const scan = await updateBodyScan(id, body);
    if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    return NextResponse.json({ scan });
  } catch (err) {
    console.error("[PATCH /api/body-scan/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const deleted = await deleteBodyScan(id);
    if (!deleted) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/body-scan/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
