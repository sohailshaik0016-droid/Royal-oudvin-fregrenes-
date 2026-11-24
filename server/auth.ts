import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';

const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

interface AdminRow {
  id: number;
  admin_email: string;
  password_hash: string;
  password_salt: string;
  recovery_hash: string;
  recovery_salt: string;
  token_version: number;
  updated_at: string;
}

export interface AdminTokenPayload {
  email: string;
  v: number;
  exp: number;
}

function hashSecret(plain: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, actualSalt, 64).toString('hex');
  return { hash: derived, salt: actualSalt };
}

function verifySecret(plain: string, storedHash: string, storedSalt: string): boolean {
  const derived = crypto.scryptSync(plain, storedSalt, 64);
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

function safeCompareStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function getAdminRecord(): AdminRow | undefined {
  return db.prepare('SELECT * FROM admin_auth WHERE id = 1').get() as AdminRow | undefined;
}

export function hasEnvAdminPassword(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
}

export function getAdminSetupStatus() {
  const record = getAdminRecord();
  const envConfigured = hasEnvAdminPassword();
  return {
    isConfigured: envConfigured || Boolean(record),
    needsFirstRunSetup: !envConfigured && !record,
    envOverrideActive: envConfigured,
    adminEmail: record?.admin_email || null,
  };
}

export function claimInitialAdmin(email: string, password: string, recoveryPassphrase: string) {
  if (hasEnvAdminPassword()) {
    throw new Error('Admin password is already managed by server environment configuration.');
  }
  const existing = getAdminRecord();
  if (existing) {
    throw new Error('Admin account has already been claimed. Please sign in or use password reset.');
  }
  const pwd = hashSecret(password);
  const rec = hashSecret(recoveryPassphrase);

  db.prepare(`
    INSERT INTO admin_auth (id, admin_email, password_hash, password_salt, recovery_hash, recovery_salt, token_version)
    VALUES (1, ?, ?, ?, ?, ?, 1)
  `).run(email.trim().toLowerCase(), pwd.hash, pwd.salt, rec.hash, rec.salt);

  return signAdminToken(email.trim().toLowerCase(), 1);
}

export function authenticateAdmin(email: string, password: string): { token: string; email: string } | null {
  const record = getAdminRecord();
  const envPassword = process.env.ADMIN_PASSWORD?.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (envPassword) {
    if (!safeCompareStrings(password, envPassword)) {
      return null;
    }
    const tokenVersion = record?.token_version ?? 1;
    const resolvedEmail = normalizedEmail || record?.admin_email || 'admin@oudvin.com';
    return { token: signAdminToken(resolvedEmail, tokenVersion), email: resolvedEmail };
  }

  if (!record) {
    return null;
  }

  if (normalizedEmail && normalizedEmail !== record.admin_email.toLowerCase()) {
    return null;
  }

  if (!verifySecret(password, record.password_hash, record.password_salt)) {
    return null;
  }

  return {
    token: signAdminToken(record.admin_email, record.token_version),
    email: record.admin_email,
  };
}

export function resetAdminPassword(email: string, recoveryKey: string, newPassword: string): { ok: boolean; error?: string } {
  if (hasEnvAdminPassword()) {
    return {
      ok: false,
      error: 'Admin password is set via server Secrets (ADMIN_PASSWORD). Update ADMIN_PASSWORD in your deployment Secrets panel to change it.',
    };
  }

  const record = getAdminRecord();
  if (!record) {
    return { ok: false, error: 'Admin account has not been set up yet.' };
  }

  const envRecovery = process.env.ADMIN_RECOVERY_KEY?.trim();
  const matchesEnvRecovery = Boolean(envRecovery && safeCompareStrings(recoveryKey, envRecovery));
  const matchesStoredRecovery = verifySecret(recoveryKey, record.recovery_hash, record.recovery_salt);

  if (!matchesEnvRecovery && !matchesStoredRecovery) {
    return { ok: false, error: 'Invalid recovery passphrase or key.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail && normalizedEmail !== record.admin_email.toLowerCase()) {
    return { ok: false, error: 'Email does not match the registered admin email.' };
  }

  const nextPwd = hashSecret(newPassword);
  db.prepare(`
    UPDATE admin_auth
    SET password_hash = ?, password_salt = ?, token_version = token_version + 1, updated_at = datetime('now')
    WHERE id = 1
  `).run(nextPwd.hash, nextPwd.salt);

  return { ok: true };
}

export function signAdminToken(email: string, tokenVersion: number): string {
  const payload: AdminTokenPayload = {
    email,
    v: tokenVersion,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  if (!safeCompareStrings(signature, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AdminTokenPayload;
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    const record = getAdminRecord();
    if (record && parsed.v !== record.token_version) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized. Admin sign-in required.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  (req as Request & { admin?: AdminTokenPayload }).admin = payload;
  next();
}
