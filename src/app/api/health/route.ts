import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    captions: process.env.DAWN_UNOFFICIAL_CAPTIONS === "enabled",
  });
}
