// In-memory Map — survives page refresh via app session, not persisted to DB
const walletSessions = new Map<string, { expiresAt: Date }>();

export function grantWalletSession(sessionId: string, timeoutMins: number): void {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + timeoutMins);
  walletSessions.set(sessionId, { expiresAt });
}

export function hasWalletSession(sessionId: string): boolean {
  const session = walletSessions.get(sessionId);
  if (!session) return false;
  if (new Date() > session.expiresAt) {
    walletSessions.delete(sessionId);
    return false;
  }
  return true;
}

export function revokeWalletSession(sessionId: string): void {
  walletSessions.delete(sessionId);
}
