import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { i18n } from '@renderer/i18n';
import { useSettingsStore } from '@renderer/stores/settings-store';
import { PROVIDERS, PROVIDER_BY_ID, resolveActiveModel, type LlmProvider, type LlmModel } from '@renderer/data/providers';
import type { Language, Theme } from '@shared/types';

const LANGUAGES: { value: Language; labelKey: string }[] = [
  { value: 'zh-CN', labelKey: 'zh-CN' },
  { value: 'en-US', labelKey: 'en-US' }
];

const THEMES: { value: Theme; labelKey: string }[] = [
  { value: 'light', labelKey: 'settings.themeLight' },
  { value: 'dark', labelKey: 'settings.themeDark' },
  { value: 'system', labelKey: 'settings.themeSystem' }
];

type SettingsSection = 'appearance' | 'llm' | 'about';

/**
 * SettingsPage — settings surface of OpenDeploy.
 *
 * Restructured from a flat long page to a 2-column layout with a left
 * sub-nav. Sections:
 *
 * - Appearance: language + theme.
 * - LLM Provider: 11-card provider grid + API Key input (Ollama is local
 *   and skips the input).
 * - About: version, license, source link, copyright.
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const [section, setSection] = useState<SettingsSection>('appearance');

  const navItems: { key: SettingsSection; label: string }[] = [
    { key: 'appearance', label: t('settings.sectionAppearance') },
    { key: 'llm', label: t('settings.sectionLlm') },
    { key: 'about', label: t('settings.sectionAbout') }
  ];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left sub-nav */}
      <nav
        style={{
          width: 200,
          borderRight: '1px solid var(--border)',
          padding: '20px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          overflowY: 'auto'
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, margin: '0 4px 16px' }}>
          {t('settings.title')}
        </div>
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSection(item.key)}
            style={{
              padding: '8px 12px',
              textAlign: 'left',
              border: 'none',
              borderRadius: 6,
              background:
                section === item.key ? 'var(--surface-hover)' : 'transparent',
              color: section === item.key ? 'var(--ink)' : 'var(--muted)',
              fontWeight: section === item.key ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Right content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        {section === 'appearance' && <AppearanceSection />}
        {section === 'llm' && <LlmSection />}
        {section === 'about' && <AboutSection />}
      </div>
    </div>
  );
}

/**
 * AppearanceSection — language + theme switcher.
 */
function AppearanceSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const handleLanguageChange = async (lang: Language): Promise<void> => {
    await setLanguage(lang);
    await i18n.changeLanguage(lang);
  };

  const handleThemeChange = async (theme: Theme): Promise<void> => {
    await setTheme(theme);
  };

  return (
    <section>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{t('settings.appearance')}</h3>
      <div className="setting-row">
        <div>
          <div className="lbl">{t('settings.language')}</div>
        </div>
        <div className="ctl" style={{ display: 'flex', gap: 6 }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              type="button"
              className={`btn${settings.language === l.value ? ' primary' : ''}`}
              onClick={() => {
                void handleLanguageChange(l.value);
              }}
            >
              {l.value === 'zh-CN' ? '中文' : 'English'}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row" style={{ borderBottom: 'none' }}>
        <div>
          <div className="lbl">{t('settings.theme')}</div>
        </div>
        <div className="ctl" style={{ display: 'flex', gap: 6 }}>
          {THEMES.map((th) => (
            <button
              key={th.value}
              type="button"
              className={`btn${settings.theme === th.value ? ' primary' : ''}`}
              onClick={() => {
                void handleThemeChange(th.value);
              }}
            >
              {t(th.labelKey)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * LlmSection — 11-card provider grid + API Key input + Save.
 */
function LlmSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const setLlmProvider = useSettingsStore((s) => s.setLlmProvider);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const setPlanApiKey = useSettingsStore((s) => s.setPlanApiKey);
  const setApiAccessMode = useSettingsStore((s) => s.setApiAccessMode);
  const setApiBaseUrlOverride = useSettingsStore((s) => s.setApiBaseUrlOverride);
  const setModel = useSettingsStore((s) => s.setModel);
  const setOllamaModelInput = useSettingsStore((s) => s.setOllamaModelInput);

  const initialProviderId = settings.llmProvider ?? 'deepseek';
  const [selectedProviderId, setSelectedProviderId] =
    useState<string>(initialProviderId);
  const provider: LlmProvider | undefined = PROVIDER_BY_ID[selectedProviderId];

  const [apiKeyInput, setApiKeyInput] = useState<string>(
    settings.apiKeys?.[initialProviderId] ?? ''
  );
  const [planKeyInput, setPlanKeyInput] = useState<string>(
    settings.planApiKeys?.[initialProviderId] ?? ''
  );
  const [baseUrlInput, setBaseUrlInput] = useState<string>(
    settings.apiBaseUrlOverride?.[initialProviderId] ?? ''
  );
  const [advancedOpen, setAdvancedOpen] = useState(
    !!settings.apiBaseUrlOverride?.[initialProviderId]
  );
  const activeMode: 'payg' | 'plan' =
    settings.apiAccessMode?.[selectedProviderId] ?? 'payg';
  const [saved, setSaved] = useState(false);

  const [selectedModelId, setSelectedModelId] = useState<string>(
    () => resolveActiveModel(selectedProviderId, settings.modelByProvider)?.id ?? ''
  );
  const selectedModel: LlmModel | undefined =
    provider?.models.find((m) => m.id === selectedModelId);

  const [ollamaInput, setOllamaInput] = useState<string>(
    () => settings.ollamaModelInput ?? PROVIDER_BY_ID['ollama']?.modelInputDefault ?? ''
  );

  // Re-resolve when provider changes (selectedProviderId mutates as user clicks cards)
  useEffect(() => {
    const m = resolveActiveModel(selectedProviderId, settings.modelByProvider);
    setSelectedModelId(m?.id ?? '');
  }, [selectedProviderId, settings.modelByProvider]);

  const handleModelChange = async (id: string): Promise<void> => {
    setSelectedModelId(id);
    await setModel(selectedProviderId, id);
  };
  const handleOllamaInputBlur = async (): Promise<void> => {
    const trimmed = ollamaInput.trim();
    if (trimmed) {
      await setOllamaModelInput(trimmed);
      return;
    }
    // Empty input → snap back to default so user sees what will actually be sent.
    const fallback = PROVIDER_BY_ID['ollama']?.modelInputDefault ?? '';
    setOllamaInput(fallback);
    await setOllamaModelInput(fallback);
  };

  const handleProviderSelect = async (provider: LlmProvider): Promise<void> => {
    setSelectedProviderId(provider.id);
    setApiKeyInput(settings.apiKeys?.[provider.id] ?? '');
    setPlanKeyInput(settings.planApiKeys?.[provider.id] ?? '');
    setBaseUrlInput(settings.apiBaseUrlOverride?.[provider.id] ?? '');
    setAdvancedOpen(!!settings.apiBaseUrlOverride?.[provider.id]);
    setSaved(false);
    await setLlmProvider(provider.id);
  };

  const handleSavePayg = async (): Promise<void> => {
    await setApiKey(selectedProviderId, apiKeyInput);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const handleSavePlan = async (): Promise<void> => {
    await setPlanApiKey(selectedProviderId, planKeyInput);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const handleModeChange = async (mode: 'payg' | 'plan'): Promise<void> => {
    await setApiAccessMode(selectedProviderId, mode);
  };

  const handleSaveBaseUrl = async (): Promise<void> => {
    await setApiBaseUrlOverride(selectedProviderId, baseUrlInput);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const handleResetBaseUrl = async (): Promise<void> => {
    setBaseUrlInput('');
    await setApiBaseUrlOverride(selectedProviderId, '');
  };

  const isOllama = selectedProviderId === 'ollama';

  return (
    <>
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{t('settings.llmSection')}</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          {t('settings.llmSectionDesc')}
        </p>
        <div className="prov-grid">
          {PROVIDERS.map((p) => {
            const active = selectedProviderId === p.id;
            return (
              <div
                key={p.id}
                className={`prov-card${active ? ' on' : ''}`}
                onClick={() => {
                  void handleProviderSelect(p);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void handleProviderSelect(p);
                  }
                }}
              >
                <div className="prov-title">
                  <span className={`prov-dot ${p.dot}`}>{p.letter}</span>
                  {p.label}
                  {p.recommended && !active && (
                    <span className="chip" style={{ marginLeft: 'auto', fontSize: 10 }}>
                      {t('settings.recommended')}
                    </span>
                  )}
                  {active && (
                    <span className="chip accent" style={{ marginLeft: 'auto' }}>
                      active
                    </span>
                  )}
                </div>
                <div className="prov-sub">{p.sub}</div>
                <div className="prov-row">
                  <span>
                    {p.id === 'ollama'
                      ? t('settings.customModel')
                      : t('settings.modelCount', { count: p.models.length })}
                  </span>
                  <span
                    className={`chip${p.region === 'Local' ? ' good' : p.region === 'CN' ? ' accent' : ''}`}
                    style={{ marginLeft: 'auto', fontSize: 10 }}
                  >
                    {t(`settings.regions.${p.region}`)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {!isOllama && provider && provider.models.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{t('settings.model')}</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{t('settings.modelHint')}</p>
          <div className="setting-row" style={{ borderBottom: 'none', alignItems: 'flex-start' }}>
            <div>
              <div className="lbl">{provider.label}</div>
            </div>
            <div className="ctl" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select
                value={selectedModelId}
                onChange={(e) => { void handleModelChange(e.target.value); }}
                style={{ minWidth: 280, padding: '6px 8px' }}
              >
                {provider.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}{m.recommended ? ` (${t('settings.recommendedShort')})` : ''} — {m.hint}
                  </option>
                ))}
              </select>
              {selectedModel && (
                <div className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
                  {t('settings.contextLabel')}: {(selectedModel.contextWindow / 1000).toFixed(0)}K ·{' '}
                  {t('settings.maxOutputLabel')}: {(selectedModel.maxOutput / 1000).toFixed(1)}K ·{' '}
                  {t('settings.priceLabel')}: {selectedModel.pricing}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {isOllama && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{t('settings.model')}</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{t('settings.modelOllamaHint')}</p>
          <div className="setting-row" style={{ borderBottom: 'none' }}>
            <div><div className="lbl">{t('settings.model')}</div></div>
            <div className="ctl">
              <input
                type="text"
                value={ollamaInput}
                onChange={(e) => setOllamaInput(e.target.value)}
                onBlur={() => { void handleOllamaInputBlur(); }}
                placeholder={t('settings.modelOllamaPlaceholder')}
                style={{ minWidth: 280 }}
              />
            </div>
          </div>
        </section>
      )}

      <section>
        <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{t('settings.apiKeySection')}</h3>
        {isOllama ? (
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            {t('settings.ollamaNoKey')}
          </p>
        ) : (
          <>
            {/* Mode toggle — only render when this provider publishes a plan
                endpoint. For everyone else (DeepSeek/GPT/Claude/…) we keep
                the page lean and never surface the concept. */}
            {provider?.tokenPlan && (
              <div className="setting-row">
                <div>
                  <div className="lbl">{t('settings.accessMode.label')}</div>
                  <div className="muted small" style={{ marginTop: 4, lineHeight: 1.5 }}>
                    {activeMode === 'plan'
                      ? t('settings.accessMode.planHint')
                      : t('settings.accessMode.paygHint')}
                    {activeMode === 'plan' && provider.tokenPlan.docsUrl && (
                      <>
                        {'  '}
                        <a
                          href={provider.tokenPlan.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--accent-deep)' }}
                        >
                          {t('settings.accessMode.planDocsLink')}
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div className="ctl" style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className={`btn${activeMode === 'payg' ? ' primary' : ''}`}
                    onClick={() => {
                      void handleModeChange('payg');
                    }}
                  >
                    {t('settings.accessMode.payg')}
                  </button>
                  <button
                    type="button"
                    className={`btn${activeMode === 'plan' ? ' primary' : ''}`}
                    onClick={() => {
                      void handleModeChange('plan');
                    }}
                  >
                    {t('settings.accessMode.plan')}
                  </button>
                </div>
              </div>
            )}

            {/* Pay-as-you-go key row — always shown for non-Ollama providers. */}
            <div className="setting-row">
              <div>
                <div className="lbl">
                  {t('settings.apiKey')} ({selectedProviderId})
                  {provider?.tokenPlan && activeMode === 'payg' && (
                    <span className="chip accent" style={{ marginLeft: 8, fontSize: 10 }}>
                      active
                    </span>
                  )}
                </div>
              </div>
              <div className="ctl" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setSaved(false);
                  }}
                  placeholder={
                    provider?.tokenPlan
                      ? t('settings.paygApiKeyPlaceholder')
                      : t('settings.apiKeyPlaceholder')
                  }
                  style={{ minWidth: 260 }}
                />
                <button
                  type="button"
                  className="btn primary lg"
                  onClick={() => {
                    void handleSavePayg();
                  }}
                >
                  {t('settings.save')}
                </button>
              </div>
            </div>

            {/* Plan key row — only when this provider has a plan endpoint.
                Keeping both keys editable side-by-side (instead of swapping
                in place when mode changes) lets users keep both buckets
                filled and flip the mode toggle without re-pasting keys. */}
            {provider?.tokenPlan && (
              <div className="setting-row">
                <div>
                  <div className="lbl">
                    {t('settings.planApiKey')} ({selectedProviderId})
                    {activeMode === 'plan' && (
                      <span className="chip accent" style={{ marginLeft: 8, fontSize: 10 }}>
                        active
                      </span>
                    )}
                  </div>
                  {provider.tokenPlan.keyPrefix &&
                    planKeyInput.trim() !== '' &&
                    !planKeyInput.trim().startsWith(provider.tokenPlan.keyPrefix) && (
                      <div className="muted small" style={{ marginTop: 4, color: 'var(--warn, #b58900)' }}>
                        {t('settings.planKeyMismatchHint', { prefix: provider.tokenPlan.keyPrefix })}
                      </div>
                    )}
                </div>
                <div className="ctl" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="password"
                    value={planKeyInput}
                    onChange={(e) => {
                      setPlanKeyInput(e.target.value);
                      setSaved(false);
                    }}
                    placeholder={t('settings.planApiKeyPlaceholder')}
                    style={{ minWidth: 260 }}
                  />
                  <button
                    type="button"
                    className="btn primary lg"
                    onClick={() => {
                      void handleSavePlan();
                    }}
                  >
                    {t('settings.save')}
                  </button>
                </div>
              </div>
            )}

            {saved && (
              <div style={{ marginTop: 6 }}>
                <span className="chip good">{t('settings.saved')}</span>
              </div>
            )}

            {/* Advanced — base URL override.
                Folded by default; auto-expands if a value is already set so
                returning users see their override immediately. */}
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setAdvancedOpen((v) => !v)}
                style={{ fontSize: 12 }}
              >
                {advancedOpen ? '▾' : '▸'} {t('settings.advanced.header')}
              </button>
              {advancedOpen && (
                <div className="setting-row" style={{ borderBottom: 'none', alignItems: 'flex-start', marginTop: 8 }}>
                  <div>
                    <div className="lbl">{t('settings.advanced.baseUrlLabel')}</div>
                    <div className="muted small" style={{ marginTop: 4, lineHeight: 1.5 }}>
                      {t('settings.advanced.baseUrlHint')}
                    </div>
                  </div>
                  <div className="ctl" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      value={baseUrlInput}
                      onChange={(e) => {
                        setBaseUrlInput(e.target.value);
                        setSaved(false);
                      }}
                      placeholder={t('settings.advanced.baseUrlPlaceholder')}
                      style={{ minWidth: 320, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                    />
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => {
                        void handleSaveBaseUrl();
                      }}
                    >
                      {t('settings.save')}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        void handleResetBaseUrl();
                      }}
                    >
                      {t('settings.advanced.resetDefault')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}

/**
 * AboutSection — version, license, source, copyright.
 */
function AboutSection() {
  const { t } = useTranslation();
  return (
    <section>
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{t('settings.sectionAbout')}</h3>
      <div className="setting-row">
        <div>
          <div className="lbl">{t('settings.aboutVersion')}</div>
        </div>
        <div className="ctl">
          <span className="mono small">v{__APP_VERSION__}</span>
        </div>
      </div>
      <div className="setting-row">
        <div>
          <div className="lbl">{t('settings.aboutSupportedErp')}</div>
        </div>
        <div className="ctl">
          <span className="small">{t('settings.aboutSupportedErpValue')}</span>
        </div>
      </div>
      <div className="setting-row">
        <div>
          <div className="lbl">{t('settings.aboutLicense')}</div>
        </div>
        <div className="ctl">
          <span className="mono small">MIT</span>
        </div>
      </div>
      <div className="setting-row">
        <div>
          <div className="lbl">{t('settings.aboutSource')}</div>
        </div>
        <div className="ctl">
          <a
            href="https://github.com/yourname/opendeploy"
            target="_blank"
            rel="noreferrer"
            className="mono small"
            style={{ color: 'var(--accent-deep)' }}
          >
            github.com/yourname/opendeploy
          </a>
        </div>
      </div>
      <div className="setting-row">
        <div>
          <div className="lbl">{t('settings.aboutCopyright')}</div>
        </div>
      </div>

      <h3 style={{ margin: '24px 0 4px', fontSize: 16 }}>{t('settings.diagnosticsHeader')}</h3>
      <RawDumpRow />
    </section>
  );
}

function RawDumpRow(): React.ReactElement {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const setLlmRawDump = useSettingsStore((s) => s.setLlmRawDump);
  const enabled = settings.llmRawDump !== false;
  return (
    <div className="setting-row" style={{ borderBottom: 'none' }}>
      <div style={{ flex: 1 }}>
        <div className="lbl">{t('settings.rawDumpLabel')}</div>
        <div className="muted small" style={{ marginTop: 4, lineHeight: 1.5 }}>
          {t('settings.rawDumpDescription')}
        </div>
      </div>
      <div className="ctl">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              void setLlmRawDump(e.target.checked);
            }}
          />
          {enabled ? t('settings.rawDumpOn') : t('settings.rawDumpOff')}
        </label>
      </div>
    </div>
  );
}

export default SettingsPage;
