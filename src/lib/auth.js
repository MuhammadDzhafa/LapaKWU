// src/lib/auth.js — Autentikasi berbasis JWT + cookie (pengganti Appwrite Account)
// Pakai jose (Edge-compatible) untuk sign/verify JWT.
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { cariSatu, tulis, ubahData } from './db';
import bcrypt from 'bcryptjs';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('JWT_SECRET harus berisi minimal 32 karakter acak.');
  return new TextEncoder().encode(secret);
}
const COOKIE = 'lapakwu_sess';
const TTL = 60 * 60 * 24 * 30; // 30 hari

// ── Token JWT ──────────────────────────────────────────────
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(getJwtSecret());
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch {
    return null;
  }
}

// ── Cookie sesi ────────────────────────────────────────────
export async function setSesiCookie(userId) {
  const akun = await cariAkunById(userId);
  if (!akun) throw new Error('Akun tidak ditemukan.');
  const token = await signToken({ sub: userId, sv: akun.session_version || 0 });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TTL,
    path: '/',
  });
  return token;
}

export async function hapusSesiCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

// Ambil userId dari cookie sesi (server-side)
export async function getUserIdDariCookie() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.sub) return null;
  const akun = await cariAkunById(payload.sub);
  if (!akun || (payload.sv ?? 0) !== (akun.session_version || 0)) return null;
  const profil = await cariSatu('pengguna', { _id: payload.sub });
  if (!profil || profil.status_akun === 'DIBLOKIR') return null;
  return payload.sub;
}

// ── Operasi akun di tabel `users` ─────────────────────────
// Tabel users: id, nama, email, password_hash, created_at, updated_at
// (dikelola langsung di sini, bukan lewat Appwrite)

export async function buatAkun({ id, email, password, nama }) {
  const hash = await bcrypt.hash(password, 12);
  await tulis('users', id, { nama, email, password_hash: hash });
}

export async function cariAkunByEmail(email) {
  return cariSatu('users', { email });
}

export async function cariAkunById(id) {
  if (typeof id !== 'string') return null;
  const user = await cariSatu('users', { _id: id });
  if (!user) return null;
  const { nama, email, created_at, session_version = 0 } = user;
  return { id, nama, email, created_at, session_version };
}

export async function ubahPassword(userId, passwordBaru) {
  const hash = await bcrypt.hash(passwordBaru, 12);
  await ubahData('users', { _id: userId }, { password_hash: hash }, { inc: { session_version: 1 } });
}

export async function ubahNama(userId, nama) {
  await ubahData('users', { _id: userId }, { nama });
}

export async function ubahEmail(userId, email) {
  await ubahData('users', { _id: userId }, { email });
}

export async function verifikasiPassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}

export async function hapusAkun(userId) {
  const { del } = await import('./server');
  await del(null, 'users', userId);
}
