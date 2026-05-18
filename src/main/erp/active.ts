import { K3CloudConnector, CaptchaRequiredError, CaptchaLoginError } from './k3cloud/connector';
import { createLogger } from '../logger';
import type { BosRpcCredentials, ErpConnectionState, Project } from '@shared/erp-types';

const logger = createLogger('erp/active');

/**
 * Format BOS credentials for logs. baseUrl + acctId verbatim (no secret),
 * username masked to first 3 chars + `***` so the value is recognisable in
 * support tickets without leaking the local account name to a leaked log.
 * Password is never emitted.
 */
function sanitizedBos(bos: BosRpcCredentials): string {
  const user = bos.username ?? '';
  const masked = user.length <= 3 ? user + '***' : user.slice(0, 3) + '***';
  return `baseUrl=${bos.baseUrl} acctId=${bos.acctId} user=${masked}`;
}

/**
 * Singleton holder for the currently-active connector. Only one project is
 * "live" at a time — switching projects tears down the outgoing pool so we
 * never accidentally run a query against the wrong account set.
 */

let connector: K3CloudConnector | null = null;
/**
 * Connector that's mid-login waiting for the user to enter a CAPTCHA.
 * Holds the ASP.NET_SessionId cookie that ties the displayed CAPTCHA
 * image to the eventual `submitCaptcha` retry. Promoted to `connector`
 * on successful submission; discarded if the user switches project.
 */
let pendingCaptchaConnector: K3CloudConnector | null = null;
let pendingCaptchaProject: Project | null = null;
let pendingCaptchaStartedAt: number = 0;
let state: ErpConnectionState = { projectId: null, status: 'idle' };
let listeners: Array<(s: ErpConnectionState) => void> = [];

function updateState(patch: Partial<ErpConnectionState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l(state);
}

export function subscribe(l: (s: ErpConnectionState) => void): () => void {
  listeners.push(l);
  l(state);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

export function getActiveConnector(): K3CloudConnector | null {
  return connector;
}

export function getConnectionState(): ErpConnectionState {
  return state;
}

/**
 * Swap the active connector. Passing `null` tears the current one down.
 *
 * Error semantics: if connect() throws, we leave `connector` null and
 * `state.status = 'error'` — the caller (IPC layer) should surface the
 * error to the UI but not throw, so the user's UI stays responsive.
 */
async function teardownConnectors(): Promise<void> {
  if (connector) {
    await connector.disconnect().catch(() => undefined);
    connector = null;
  }
  if (pendingCaptchaConnector) {
    await pendingCaptchaConnector.disconnect().catch(() => undefined);
    pendingCaptchaConnector = null;
    pendingCaptchaProject = null;
  }
}

export async function setActiveProject(project: Project | null): Promise<void> {
  // Tear down both the outgoing live connector and any abandoned
  // CAPTCHA-pending connector — switching project mid-CAPTCHA discards the
  // server session (no resume across switches).
  await teardownConnectors();

  if (!project) {
    updateState({
      projectId: null,
      status: 'idle',
      error: undefined,
      erpProvider: undefined,
      captchaImage: undefined,
    });
    return;
  }

  updateState({
    projectId: project.id,
    status: 'connecting',
    error: undefined,
    erpProvider: project.erpProvider,
    captchaImage: undefined,
  });
  if (!project.bos) {
    void logger.error(
      `activate project ${project.id} (${project.name}) failed — missing BOS credentials`,
    );
    updateState({
      status: 'error',
      error: 'project has no BOS credentials — configure BOS endpoint + login in the project settings'
    });
    return;
  }
  void logger.info(
    `connecting project ${project.id} (${project.name}) | ${sanitizedBos(project.bos)}`,
  );
  const startedAt = Date.now();
  const next = new K3CloudConnector(project.bos, project.id);
  try {
    await next.connect();
    connector = next;
    void logger.info(
      `connected project ${project.id} (${project.name}) in ${Date.now() - startedAt}ms | ${sanitizedBos(project.bos)}`,
    );
    updateState({
      status: 'connected',
      lastTestedAt: new Date().toISOString()
    });
  } catch (err) {
    if (err instanceof CaptchaRequiredError) {
      // Stash the connector mid-login; the user fills in the CAPTCHA via UI
      // → submitCaptcha() resumes the flow on the same ASP.NET session.
      pendingCaptchaConnector = next;
      pendingCaptchaProject = project;
      pendingCaptchaStartedAt = startedAt;
      void logger.info(
        `project ${project.id} (${project.name}) login paused — CAPTCHA required`,
      );
      try {
        const { dataUrl } = await next.fetchCaptchaImage();
        updateState({
          status: 'captcha-required',
          captchaImage: dataUrl,
          error: undefined,
        });
      } catch (imgErr) {
        const m = imgErr instanceof Error ? imgErr.message : String(imgErr);
        void logger.error(
          `fetch CAPTCHA image failed for project ${project.id} | ${sanitizedBos(project.bos)} | ${m}`,
          imgErr instanceof Error ? imgErr : undefined,
        );
        pendingCaptchaConnector = null;
        pendingCaptchaProject = null;
        updateState({ status: 'error', error: m });
      }
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    void logger.error(
      `activate project ${project.id} (${project.name}) failed after ${Date.now() - startedAt}ms | ${sanitizedBos(project.bos)}`,
      err instanceof Error ? err : new Error(message)
    );
    updateState({
      status: 'error',
      error: message
    });
  }
}

/**
 * User entered the CAPTCHA code. Resume the paused login with it. Outcomes:
 *   - Success → promote pending connector to active, state becomes 'connected'.
 *   - Wrong code (002099000005375) → refresh image, stay in 'captcha-required'
 *     with `error` describing the rejection.
 *   - Server session expired (002099000005373) → re-start the whole connect
 *     flow from scratch so we get a fresh ASP.NET session, then surface
 *     'captcha-required' again from there.
 *   - Anything else → tear down pending connector, transition to 'error'.
 */
export async function submitCaptcha(code: string): Promise<void> {
  const pendingConn = pendingCaptchaConnector;
  const pendingProj = pendingCaptchaProject;
  if (!pendingConn || !pendingProj) {
    throw new Error('submitCaptcha: no pending CAPTCHA — call setActiveProject first');
  }
  try {
    await pendingConn.submitCaptcha(code);
    connector = pendingConn;
    pendingCaptchaConnector = null;
    pendingCaptchaProject = null;
    void logger.info(
      `connected project ${pendingProj.id} (${pendingProj.name}) via CAPTCHA in ${Date.now() - pendingCaptchaStartedAt}ms | ${sanitizedBos(pendingProj.bos!)}`,
    );
    updateState({
      status: 'connected',
      captchaImage: undefined,
      error: undefined,
      lastTestedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof CaptchaLoginError && (err.kind === 'wrong' || err.kind === 'expired')) {
      void logger.warn(
        `CAPTCHA submit ${err.kind} for project ${pendingProj.id} (msgCode=${err.messageCode}) — refreshing image`,
      );
      try {
        const { dataUrl } = await pendingConn.fetchCaptchaImage();
        updateState({
          status: 'captcha-required',
          captchaImage: dataUrl,
          error: err.message,
        });
      } catch (imgErr) {
        const m = imgErr instanceof Error ? imgErr.message : String(imgErr);
        pendingCaptchaConnector = null;
        pendingCaptchaProject = null;
        updateState({ status: 'error', error: m });
      }
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    void logger.error(
      `CAPTCHA submit failed (non-recoverable) for project ${pendingProj.id} | ${message}`,
      err instanceof Error ? err : new Error(message),
    );
    pendingCaptchaConnector = null;
    pendingCaptchaProject = null;
    updateState({ status: 'error', error: message, captchaImage: undefined });
  }
}

/**
 * User clicked "看不清,换一张". Rotates the server-side code (a new code
 * gets bound to the same ASP.NET session). Cheap to call repeatedly.
 */
export async function refreshCaptcha(): Promise<void> {
  const pending = pendingCaptchaConnector;
  if (!pending) {
    throw new Error('refreshCaptcha: no pending CAPTCHA');
  }
  try {
    const { dataUrl } = await pending.fetchCaptchaImage();
    updateState({
      status: 'captcha-required',
      captchaImage: dataUrl,
      error: undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void logger.error(`refresh CAPTCHA failed | ${message}`, err instanceof Error ? err : undefined);
    throw err;
  }
}

/** Test-only helper: wipe module state between tests. */
export function _reset(): void {
  connector = null;
  pendingCaptchaConnector = null;
  pendingCaptchaProject = null;
  state = { projectId: null, status: 'idle' };
  listeners = [];
}
