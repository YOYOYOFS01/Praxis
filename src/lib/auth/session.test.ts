import { describe, it, expect, beforeEach } from 'vitest';
import { createSession, resolveSession, deleteSession, deleteAllUserSessions } from './session';
import { prisma } from '@/src/db/prisma';
import { randomUUID } from 'crypto';

describe('Session Utility', () => {
  let testUserId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-${randomUUID()}@example.com`,
        passwordHash: 'dummyhash',
        name: 'Test User'
      }
    });
    testUserId = user.id;
  });

  it('should create a session and return a raw token', async () => {
    const rawToken = await createSession(testUserId, '127.0.0.1', 'Vitest');
    expect(rawToken).toBeDefined();
    expect(rawToken.length).toBeGreaterThan(0);

    const sessions = await prisma.session.findMany({ where: { userId: testUserId } });
    expect(sessions.length).toBe(1);
  });

  it('should resolve a valid session', async () => {
    const rawToken = await createSession(testUserId);
    const session = await resolveSession(rawToken);
    expect(session).toBeDefined();
    expect(session?.userId).toBe(testUserId);
    expect(session?.user.email).toBeDefined();
  });

  it('should return null for an invalid token', async () => {
    const session = await resolveSession('invalidtoken123');
    expect(session).toBeNull();
  });

  it('should delete a specific session', async () => {
    const rawToken = await createSession(testUserId);
    await deleteSession(rawToken);
    const session = await resolveSession(rawToken);
    expect(session).toBeNull();
  });

  it('should delete all user sessions', async () => {
    await createSession(testUserId);
    await createSession(testUserId);
    
    let sessions = await prisma.session.findMany({ where: { userId: testUserId } });
    expect(sessions.length).toBe(2);

    await deleteAllUserSessions(testUserId);

    sessions = await prisma.session.findMany({ where: { userId: testUserId } });
    expect(sessions.length).toBe(0);
  });
});
