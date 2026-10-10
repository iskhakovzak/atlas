/** A CAPTCHA library on a valid PDP is not itself an access challenge. */
export function isMerchantChallengePage(html: string) {
  if (html.length < 10_000 && /<iframe\b[^>]*\bsrc=["']\/interstitial\/ic\.html["']/i.test(html)
    && /<meta\b[^>]*\bhttp-equiv=["']refresh["'][^>]*\bbm-verify=/i.test(html)) return true;
  const head = html.slice(0, 120_000);
  const title = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '';
  if (/^(?:robot check|access denied|just a moment(?:\.\.\.)?|are you (?:a )?(?:human|robot)\??|captcha(?: challenge)?)$/i.test(title)) return true;
  if (/<form\b[^>]*action=["'][^"']*\/errors\/validateCaptcha\b/i.test(head)) return true;
  const visible = head.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ');
  return /verify (?:that )?you are (?:a )?human|pardon our interruption|robot check|press (?:and|&) hold to confirm/i.test(visible);
}
