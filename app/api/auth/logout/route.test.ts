import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { prisma } from '@/src/db/prisma';
import { createSession } from '@/src/lib/auth/session';
import { randomUUID } from 'crypto';

describe('Logout API Route', () => {
  let testUserId: string;
  let rawToken: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `logout-${randomUUID()}@example.com`,
        passwordHash: 'dummyhash',
        name: 'Logout Test'
      }
    });
    testUserId = user.id;
    rawToken = await createSession(user.id);
  });

  it('should successfully logout and clear cookie', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { cookie: `praxis_session=${rawToken}` }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('praxis_session=;');
    expect(setCookie).toContain('Max-Age=0');

    const sessions = await prisma.session.findMany({ where: { userId: testUserId } });
    expect(sessions.length).toBe(0);
  });
});
