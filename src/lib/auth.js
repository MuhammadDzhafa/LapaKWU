// src/lib/auth.js — Autentikasi berbasis JWT + cookie (pengganti Appwrite Account)
// Pakai jose (Edge-compatible) untuk sign/verify JWT.
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { cariSatu, tulis, ubahData } from './db';
import bcrypt from 'bcryptjs';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'ganti-dengan-secret-panjang-acak-minimal-32-karakter'
);
const COOKIE = 'lapakwu_sess';
const TTL = 60 * 60 * 24 * 30; // 30 hari

// ── Token JWT ──────────────────────────────────────────────
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(SECRET);
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

// ── Cookie sesi ────────────────────────────────────────────
export async function setSesiCookie(userId) {
  const token = await signToken({ sub: userId });
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
  return payload?.sub ?? null;
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
  const { nama, email, created_at } = user;
  return { id, nama, email, created_at };
}

export async function ubahPassword(userId, passwordBaru) {
  const hash = await bcrypt.hash(passwordBaru, 12);
  await ubahData('users', { _id: userId }, { password_hash: hash });
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
