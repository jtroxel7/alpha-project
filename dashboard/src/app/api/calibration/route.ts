import { NextResponse } from "next/server";
import { getCalibrationData } from "@/lib/ledger/db";

export async function GET() {
  try {
    const buckets = getCalibrationData();
    return NextResponse.json({ buckets });
  } catch (error) {
    console.error("Calibration API error:", error);
    return NextResponse.json({ buckets: [] });
  }
}
