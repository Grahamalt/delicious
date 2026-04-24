import { NextRequest, NextResponse } from "next/server";
import { uploadImage } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const { dataUrl } = (await req.json()) as { dataUrl?: string };
    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "dataUrl required" }, { status: 400 });
    }
    const url = await uploadImage(dataUrl);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[POST /api/body-scan/upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
