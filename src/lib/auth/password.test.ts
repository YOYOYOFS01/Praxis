import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('Password Utility', () => {
  it('should hash a password and return a different string', async () => {
    const plain = 'mysecretpassword';
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash).toBeDefined();
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should successfully verify a correct password', async () => {
    const plain = 'mysecretpassword';
    const hash = await hashPassword(plain);
    const isValid = await verifyPassword(plain, hash);
    expect(isValid).toBe(true);
  });

  it('should fail to verify an incorrect password', async () => {
    const plain = 'mysecretpassword';
    const wrongPlain = 'wrongpassword';
    const hash = await hashPassword(plain);
    const isValid = await verifyPassword(wrongPlain, hash);
    expect(isValid).toBe(false);
  });
});
