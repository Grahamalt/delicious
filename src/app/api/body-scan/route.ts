import { NextRequest, NextResponse } from "next/server";
import { listBodyScans, upsertBodyScan } from "@/lib/body";
import type { CreateBodyScanInput } from "@/types/body-tracking";

export async function GET() {
  try {
    const scans = await listBodyScans();
    return NextResponse.json({ scans, total: scans.length });
  } catch (err) {
    console.error("[GET /api/body-scan]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CreateBodyScanInput>;

    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json(
        { error: "date required in YYYY-MM-DD format" },
        { status: 400 },
      );
    }

    const hasAny =
      body.weightLbs != null ||
      body.waistCm != null ||
      body.shoulderCm != null ||
      body.photoFrontUrl ||
      body.photoSideLeftUrl ||
      body.photoSideRightUrl ||
      body.photoBackUrl ||
      (body.notes && body.notes.trim().length > 0);
    if (!hasAny) {
      return NextResponse.json(
        { error: "provide at least one of: weight, waist, shoulder, photo, notes" },
        { status: 400 },
      );
    }

    const scan = await upsertBodyScan(body as CreateBodyScanInput);
    return NextResponse.json({ scan }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/body-scan]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
