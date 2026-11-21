import { koleksiInti, queryDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rows: [schema] } = await queryDatabase(
      `SELECT bool_and(to_regclass(nama) IS NOT NULL)
        AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('produk')
          AND attname = 'diarsipkan' AND NOT attisdropped) AS siap
        FROM unnest($1::text[]) AS tabel(nama)`,
      [[...koleksiInti, 'checkout_request', 'rate_limit']],
    );
    if (!schema?.siap) {
      return Response.json({ ok: false, database: 'schema_not_ready' }, { status: 503 });
    }
    return Response.json({ ok: true, database: 'available' });
  } catch {
    return Response.json({ ok: false, database: 'unavailable' }, { status: 503 });
  }
}
