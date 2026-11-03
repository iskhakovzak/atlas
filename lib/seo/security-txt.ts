// /.well-known/security.txt (RFC 9116), 3 November 2026. Contact comes from the site content the owner edits
// (Админ → Контент сайта): the support e-mail, then the support Telegram, then the phone. With none of them set the
// support page stands in, marked as a placeholder in a comment. Expires is always a year ahead (the file is built per
// request), Preferred-Languages ru, uz, en. No Cloudflare imports: app/.well-known/security.txt/route.ts reads the row.

export type SecurityContacts = { supportEmail: string | null; telegramSupport: string | null; phone: string | null };

const day = 24 * 60 * 60 * 1000;

export function securityContacts(contacts: SecurityContacts): string[] {
  const list: string[] = [];
  const email = contacts.supportEmail?.trim();
  if (email && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)) list.push(`mailto:${email}`);
  const telegram = contacts.telegramSupport?.trim().replace(/^@/, '');
  if (telegram && /^[A-Za-z0-9_]{4,64}$/.test(telegram)) list.push(`https://t.me/${telegram}`);
  const phone = contacts.phone?.replace(/[^\d+]/g, '');
  if (phone && /^\+\d{7,15}$/.test(phone)) list.push(`tel:${phone}`);
  return list;
}

export function securityTxt(input: { origin: string; contacts: SecurityContacts; now: number }) {
  const { origin, now } = input;
  const contacts = securityContacts(input.contacts);
  // Midnight UTC a year from today: a whole number of days, just under a year from the moment it is read.
  const expires = new Date(Math.floor(now / day) * day + 365 * day).toISOString().replace('.000Z', 'Z');
  return [
    '# Atlas — how to report a security problem (RFC 9116).',
    ...(contacts.length
      ? contacts.map((contact) => `Contact: ${contact}`)
      : ['# Placeholder: no support e-mail, Telegram or phone is set in the site content yet; reports go through the support page.', `Contact: ${origin}/support`]),
    `Expires: ${expires}`,
    'Preferred-Languages: ru, uz, en',
    `Canonical: ${origin}/.well-known/security.txt`,
    '',
  ].join('\n');
}
