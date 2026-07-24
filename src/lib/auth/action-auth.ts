import { prisma } from "@/src/db/prisma";
import { verifyPassword } from "./password";

export async function verifyActionCredential(
  userId: string,
  method: "pin" | "password",
  credential: string
): Promise<{ valid: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { valid: false };

  if (method === "password") {
    const valid = await verifyPassword(credential, user.passwordHash);
    return { valid };
  } else if (method === "pin") {
    if (!user.walletPin) return { valid: false };
    const valid = await verifyPassword(credential, user.walletPin);
    return { valid };
  }

  return { valid: false };
}
