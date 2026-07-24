import { describe, it, expect } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

describe('Signup API Route', () => {
  it('should successfully sign up a new user', async () => {
    const payload = {
      email: `test-${randomUUID()}@example.com`,
      password: 'password123',
      name: 'Test Signup'
    };

    const req = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(payload.email);

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('praxis_session=');
  });

  it('should reject invalid data', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', password: '123' })
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
