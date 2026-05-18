import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CaptchaModalProps {
  open: boolean;
  /** Project being activated — shown so the user knows which connection this is for. */
  projectName?: string;
  /** Server URL — shown for confirmation (matches what the dataCenter requires). */
  baseUrl?: string;
  /** `data:image/...;base64,...` URL of the current CAPTCHA image. */
  image?: string;
  /** Last server-side rejection ('CAPTCHA wrong' / 'expired' / etc). */
  error?: string;
  onSubmit: (code: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onCancel: () => void;
}

/**
 * Global CAPTCHA prompt — overlay shown whenever connection state is
 * `'captcha-required'`. Renders independently of the current page so the
 * user can activate a project from anywhere (Workspace rail, Projects
 * page, ...) and still be prompted without navigating.
 *
 * Local state holds the typed code; cleared on close to avoid the previous
 * attempt leaking into the next CAPTCHA round.
 */
export function CaptchaModal({
  open,
  projectName,
  baseUrl,
  image,
  error,
  onSubmit,
  onRefresh,
  onCancel,
}: CaptchaModalProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setCode('');
  }, [open]);

  // Escape to cancel — a captcha prompt should be dismissible without forcing
  // the user to click. Enter to submit is handled on the input element.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const trimmed = code.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setBusy(false);
    }
  };

  const refresh = async (): Promise<void> => {
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in oklch, var(--bg) 50%, #000 40%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{
          padding: 20,
          width: 'min(420px, 100%)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('projects.captcha.modalTitle')}</h3>
        <div
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          {t('projects.captcha.intro')}
        </div>

        {(projectName || baseUrl) && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--muted)',
              fontFamily: 'var(--font-mono)',
              marginBottom: 12,
              padding: '6px 8px',
              border: '1px solid var(--border)',
              borderRadius: 3,
              wordBreak: 'break-all',
            }}
          >
            {projectName && <span style={{ fontWeight: 600 }}>{projectName}</span>}
            {projectName && baseUrl && <span> · </span>}
            {baseUrl}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          {image && (
            <img
              src={image}
              alt="captcha"
              style={{
                height: 40,
                border: '1px solid var(--border)',
                borderRadius: 3,
                background: '#fff',
              }}
            />
          )}
          <button
            type="button"
            className="btn"
            onClick={() => void refresh()}
            disabled={busy}
            title={t('projects.captcha.refreshHint')}
          >
            {t('projects.captcha.refresh')}
          </button>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
            placeholder={t('projects.captcha.placeholder')}
            maxLength={8}
            autoFocus
            style={{
              flex: 1,
              minWidth: 110,
              padding: '6px 10px',
              fontSize: 15,
              fontFamily: 'var(--font-mono)',
              letterSpacing: 2,
            }}
          />
        </div>

        {error && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--danger)',
              marginBottom: 12,
              wordBreak: 'break-word',
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            {t('projects.cancel')}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void submit()}
            disabled={!canSubmit}
          >
            {busy ? t('projects.captcha.submitting') : t('projects.captcha.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CaptchaModal;
