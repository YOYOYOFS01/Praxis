import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@/src/gateway/with-x402";

// Protected vendor data route — wrapped with withX402 payment enforcement.
// Requirements: 1.1, 2.1

const protectedHandler = async (_req: NextRequest): Promise<NextResponse> => {
  return NextResponse.json({
    data: "Protected vendor data — delivered after x402 payment",
    deliveredAt: new Date().toISOString(),
    paymentVerified: true,
  });
};

export const GET = withX402(
  {
    amountUsdc: "1.00",
    description: "Protected vendor data",
    confirmations: 1,
  },
  protectedHandler
);
