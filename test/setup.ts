import { execSync } from 'child_process';
import { prisma } from '@/src/db/prisma';
import { beforeEach, afterAll, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL = 'file:./test.db';
  execSync('npx prisma db push --skip-generate', { env: { ...process.env, DATABASE_URL: 'file:./test.db' } });
});

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.runEvent.deleteMany();
  await prisma.run.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.policyConfig.deleteMany();
  await prisma.vendorAllowlist.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.tenant.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
