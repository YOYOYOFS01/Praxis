import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { prisma } from '@/src/db/prisma';
import { hashPassword } from '@/src/lib/auth/password';
import { randomUUID } from 'crypto';

describe('Login API Route', () => {
  let testEmail: string;

  beforeEach(async () => {
    testEmail = `login-${randomUUID()}@example.com`;
    await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: await hashPassword('correctpassword'),
        name: 'Login Test'
      }
    });
  });

  it('should successfully login a user', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail, password: 'correctpassword' })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user).toBeDefined();

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('praxis_session=');
  });

  it('should reject incorrect password', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail, password: 'wrongpassword' })
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
