import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { prisma } from '@/src/db/prisma';
import { createSession } from '@/src/lib/auth/session';
import { randomUUID } from 'crypto';

describe('Me API Route', () => {
  let testUserId: string;
  let rawToken: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `me-${randomUUID()}@example.com`,
        passwordHash: 'dummyhash',
        name: 'Me Test'
      }
    });
    testUserId = user.id;
    rawToken = await createSession(user.id);
  });

  it('should return user info with a valid session cookie', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/me', {
      headers: { cookie: `praxis_session=${rawToken}` }
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe(testUserId);
  });

  it('should return 401 without a session cookie', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/me');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
