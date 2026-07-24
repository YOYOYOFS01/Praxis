import { randomBytes, createHash } from "crypto";
import { prisma } from "@/src/db/prisma";

const SESSION_EXPIRY_DAYS = 30;

export async function createSession(userId: string, ipAddress?: string | null, userAgent?: string | null, rememberMe: boolean = true): Promise<string> {
  const tokenBytes = randomBytes(32);
  const rawToken = tokenBytes.toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const expiresAt = new Date();
  const expiryDays = rememberMe ? SESSION_EXPIRY_DAYS : 1;
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  await prisma.session.create({
    data: {
      userId,
      token: tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  return rawToken;
}

export async function resolveSession(rawToken: string) {
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!session) return null;

  if (new Date() > session.expiresAt) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session;
}

export async function deleteSession(rawToken: string): Promise<void> {
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  await prisma.session.deleteMany({
    where: { token: tokenHash },
  });
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}
