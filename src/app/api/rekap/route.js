import { err } from '@/lib/server';

export async function POST() {
  return err('Ajukan pencairan melalui menu Dompet Mitra.', 410);
}