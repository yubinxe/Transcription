import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    unofficialCaptions: process.env.DAWN_UNOFFICIAL_CAPTIONS === "enabled",
  });
}
