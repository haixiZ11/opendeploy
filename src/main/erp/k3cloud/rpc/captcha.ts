/**
 * CAPTCHA image fetcher for the K/3 Cloud login flow.
 *
 * The image is served by `{baseUrl}/mobile/ValidateCode.ashx` — a regular
 * ASP.NET `IHttpHandler` (`Kingdee.BOS.Web.HTML.ValidateCode`), NOT a
 * `*.common.kdsvc` RPC. The handler:
 *   1. Generates a 4-character validation code + JPEG image
 *      (`ImageUtil.CreateValidateCodeImage(4, out code)`)
 *   2. Writes the code into `Session["VerificationCode"]`
 *   3. Returns the image bytes with `Cache-Control: no-store`
 *
 * Because the code is bound to ASP.NET Session (the `ASP.NET_SessionId`
 * cookie), this fetcher MUST reuse a `KdSession` that already has a cookie
 * established by an earlier RPC (e.g. `fetchPublicKeyInfo`). Calling this
 * with a fresh session creates a new server session whose code our later
 * `ValidateLoginInfo` call will never match.
 *
 * Implementation notes captured in `.scratch/recon/captcha-login.md`.
 */

import { Buffer } from 'node:buffer';
import { applySetCookieToSession, type KdSession } from './http-client';
import { createLogger } from '../../../logger';

const logger = createLogger('erp/k3cloud/captcha');

export interface CaptchaImage {
  /** Raw image bytes. Empirically image/jpeg from the K/3 server. */
  bytes: Buffer;
  /** Content-Type header from the server (usually 'image/jpeg'). */
  contentType: string;
}

/**
 * Fetch the next CAPTCHA image. Each call rotates the server-side code,
 * so call this once per attempt (refresh-on-wrong-input rebinds a fresh
 * code to the same ASP.NET session).
 */
export async function fetchCaptchaImage(session: KdSession): Promise<CaptchaImage> {
  const url = `${session.baseUrl}/mobile/ValidateCode.ashx`;

  const cookies: string[] = [];
  if (session.kdServiceSessionId)
    cookies.push(`kdservice-sessionid=${session.kdServiceSessionId}`);
  if (session.aspNetSessionId) cookies.push(`ASP.NET_SessionId=${session.aspNetSessionId}`);

  const headers: Record<string, string> = {
    'accept': 'image/jpeg,image/png,image/*',
    'user-agent':
      'Mozilla/5.0 (compatible; OpenDeploy; Kingdee/Kingdee.BOS, Version=9.0.553.12, Culture=neutral, PublicKeyToken=null MANM)',
  };
  if (cookies.length) headers['cookie'] = cookies.join('; ');

  void logger.info(
    `ValidateCode.ashx request | aspSess=${session.aspNetSessionId ? session.aspNetSessionId.slice(0, 8) + '…' : '(none)'} ` +
      `kdSess=${session.kdServiceSessionId ? session.kdServiceSessionId.slice(0, 8) + '…' : '(none)'}`,
  );

  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', headers });
  } catch (err) {
    void logger.error(
      `ValidateCode.ashx transport failed | url=${url}`,
      err instanceof Error ? err : undefined,
    );
    throw err instanceof Error ? err : new Error(String(err));
  }

  if (!res.ok) {
    const snippet = await res.text().catch(() => '');
    void logger.warn(
      `ValidateCode.ashx http ${res.status} | url=${url} | body=${snippet.slice(0, 200)}`,
    );
    throw new Error(`fetch CAPTCHA failed: HTTP ${res.status}`);
  }

  const sc = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.();
  if (sc) applySetCookieToSession(session, sc);

  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';

  void logger.info(
    `ValidateCode.ashx response | status=${res.status} contentType=${contentType} bytes=${buf.length} ` +
      `aspSess=${session.aspNetSessionId ? session.aspNetSessionId.slice(0, 8) + '…' : '(none)'}`,
  );

  return { bytes: buf, contentType };
}

/** Convenience: encode CAPTCHA image as a data URL for renderer `<img src>`. */
export function captchaToDataUrl(img: CaptchaImage): string {
  return `data:${img.contentType};base64,${img.bytes.toString('base64')}`;
}
