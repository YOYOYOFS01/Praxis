import * as twofactor from 'node-2fa';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { hashPassword } from './password';

export async function generateTotpSecret(email: string) {
  const result = twofactor.generateSecret({ name: 'Praxis', account: email });
  const secret = result.secret;
  const uri = result.uri;
  const qrCodeUrl = await QRCode.toDataURL(uri);
  return { secret, qrCodeUrl, uri };
}

export function verifyTotp(secret: string, token: string) {
  const result = twofactor.verifyToken(secret, token);
  return result != null && result.delta === 0;
}

export async function generateBackupCodes() {
  const plainCodes = [];
  const hashedCodes = [];
  for (let i = 0; i < 10; i++) {
    const code = randomBytes(4).toString('hex');
    plainCodes.push(code);
    const hash = await hashPassword(code);
    hashedCodes.push(hash);
  }
  return { plainCodes, hashedCodes };
}
