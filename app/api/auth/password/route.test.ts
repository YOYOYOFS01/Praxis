import { describe, it, expect, beforeEach } from 'vitest';
import { PATCH } from './route';
import { NextRequest } from 'next/server';
import { prisma } from '@/src/db/prisma';
import { hashPassword, verifyPassword } from '@/src/lib/auth/password';
import { createSession } from '@/src/lib/auth/session';
import { randomUUID } from 'crypto';

describe('Password API Route', () => {
  let testUserId: string;
  let rawToken: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `pw-${randomUUID()}@example.com`,
        passwordHash: await hashPassword('oldpassword'),
        name: 'Password Test'
      }
    });
    testUserId = user.id;
    rawToken = await createSession(user.id);
  });

  it('should successfully change password', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/password', {
      method: 'PATCH',
      headers: { cookie: `praxis_session=${rawToken}` },
      body: JSON.stringify({ currentPassword: 'oldpassword', newPassword: 'newpassword123' })
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    const isValid = await verifyPassword('newpassword123', user!.passwordHash);
    expect(isValid).toBe(true);

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('praxis_session=');
  });

  it('should reject incorrect current password', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/password', {
      method: 'PATCH',
      headers: { cookie: `praxis_session=${rawToken}` },
      body: JSON.stringify({ currentPassword: 'wrongpassword', newPassword: 'newpassword123' })
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});
