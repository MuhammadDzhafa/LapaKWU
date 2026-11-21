const NOMOR_LAPAKWU = '6281297490280';

export const KONTAK_WA = process.env.NEXT_PUBLIC_KONTAK_WA?.replace(/\D/g, '') || NOMOR_LAPAKWU;
export const TAUTAN_WA = `https://wa.me/${KONTAK_WA}`;
export const LABEL_WA = KONTAK_WA === NOMOR_LAPAKWU ? '+62 812-9749-0280' : `+${KONTAK_WA}`;
