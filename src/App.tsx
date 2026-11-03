import React, { useEffect, useRef, useState } from 'react';
import { Language, translations } from './i18n';
import {
  generateXrayConfig,
  normalizeIncomingDeployConfig,
  XrayCheckResult,
} from './utils/generator';

type ThemeMode = 'dark' | 'light';

interface TerminalLine {
  id: number;
  text: string;
  colorClass?: string;
}

export function App() {
  // 1. Theme state (dark by default, saved in localStorage)
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('selfsteal_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore storage errors
    }
    return 'dark';
  });

  // 2. Language state (ru by default, saved in localStorage)
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('selfsteal_lang');
      if (saved === 'ru' || saved === 'en') return saved;
    } catch {
      // ignore storage errors
    }
    return 'ru';
  });

  const t = translations[lang];

  // Apply theme attribute to <html> and persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('selfsteal_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Persist language choice
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    try {
      localStorage.setItem('selfsteal_lang', lang);
    } catch {
      // ignore
    }
  }, [lang]);

  // 3. Intersection Observer for smooth section reveal on scroll
  useEffect(() => {
    const elements = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // 4. Visitor counter in footer (POST /api/stats/visit once per session + GET /api/stats)
  const [visitors, setVisitors] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function initVisitorCounter() {
      try {
        const visitedKey = 'selfsteal_visited';
        const alreadyVisited = sessionStorage.getItem(visitedKey);
        if (!alreadyVisited) {
          await fetch('/api/stats/visit', { method: 'POST' });
          sessionStorage.setItem(visitedKey, '1');
        }
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          if (active && typeof data.visitors === 'number') {
            setVisitors(data.visitors);
          }
        }
      } catch {
        // fallback if offline
      }
    }
    initVisitorCounter();
    return () => {
      active = false;
    };
  }, []);

  // Copy states
  const [copiedOneLiner, setCopiedOneLiner] = useState(false);
  const [copiedRemna, setCopiedRemna] = useState(false);

  // SSH Deploy Wizard State
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [questionIdx, setQuestionIdx] = useState<number>(0);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Step 1: SSH Credentials
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUser, setSshUser] = useState('root');
  const [sshAuthType, setSshAuthType] = useState<'password' | 'key'>('password');
  const [sshPassword, setSshPassword] = useState('');
  const [sshKey, setSshKey] = useState('');

  // Xray (Remnanode) Check State
  const [xrayChecking, setXrayChecking] = useState(false);
  const [xrayResult, setXrayResult] = useState<XrayCheckResult | null>(null);

  // Step 2: Install Questions State
  const [domain, setDomain] = useState('poland.example.xyz');
  const [webServer, setWebServer] = useState<'caddy' | 'nginx'>('caddy');
  const [transport, setTransport] = useState<'xhttp' | 'tcp'>('xhttp');
  const [xhttpPath, setXhttpPath] = useState('/media/v3/chunk/');
  const [targetPort, setTargetPort] = useState('9443');

  // Step 3: Live SSE Deploy State
  const [deployStatus, setDeployStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const terminalBodyRef = useRef<HTMLDivElement | null>(null);
  const lineSeqRef = useRef(0);

  const appendTerminalLine = (text: string, colorClass?: string) => {
    lineSeqRef.current += 1;
    const id = lineSeqRef.current;
    setTerminalLines((prev) => [...prev, { id, text, colorClass }]);
  };

  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [terminalLines]);

  const activeQuestionIndices = transport === 'xhttp' ? [0, 1, 2, 3, 4] : [0, 1, 2, 4];
  const currentQuestionPos = Math.max(0, activeQuestionIndices.indexOf(questionIdx));
  const totalQuestions = activeQuestionIndices.length;

  const validateSshStep = (): boolean => {
    if (!sshHost.trim()) {
      setWizardError(t.wizard.s1.errHost);
      return false;
    }
    if (sshAuthType === 'password' && !sshPassword) {
      setWizardError(t.wizard.s1.errPassword);
      return false;
    }
    if (sshAuthType === 'key' && !sshKey.trim()) {
      setWizardError(t.wizard.s1.errKey);
      return false;
    }
    setWizardError(null);
    return true;
  };

  const runXrayCheck = async (): Promise<XrayCheckResult> => {
    setXrayChecking(true);
    try {
      const response = await fetch('/api/ssh/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssh: {
            host: sshHost.trim(),
            port: Number(sshPort) || 22,
            username: sshUser.trim() || 'root',
            authType: sshAuthType === 'key' ? 'privateKey' : 'password',
            password: sshAuthType === 'password' ? sshPassword : '',
            privateKey: sshAuthType === 'key' ? sshKey : '',
          },
        }),
      });
      const data = (await response.json()) as XrayCheckResult;
      const normalized: XrayCheckResult = {
        xray: Boolean(data?.xray),
        method: data?.method === 'folder' || data?.method === 'docker' ? data.method : null,
      };
      setXrayResult(normalized);
      return normalized;
    } catch {
      const fallback: XrayCheckResult = { xray: false, method: null };
      setXrayResult(fallback);
      return fallback;
    } finally {
      setXrayChecking(false);
    }
  };

  const handleStep1Continue = async () => {
    if (!validateSshStep()) return;
    await runXrayCheck();
    setQuestionIdx(0);
    setWizardStep(2);
  };

  const handleNextQuestion = () => {
    if (questionIdx === 0) {
      if (!domain.trim() || !domain.includes('.')) {
        setWizardError(t.wizard.s2.q1.err);
        return;
      }
    }
    if (questionIdx === 3) {
      let cleanPath = xhttpPath.trim() || '/media/v3/chunk/';
      if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
      if (!cleanPath.endsWith('/')) cleanPath = cleanPath + '/';
      setXhttpPath(cleanPath);
    }
    if (questionIdx === 4) {
      const p = Number(targetPort);
      if (!p || p < 1 || p > 65535) {
        setWizardError(t.wizard.s2.q5.err);
        return;
      }
    }
    setWizardError(null);

    const pos = activeQuestionIndices.indexOf(questionIdx);
    if (pos < activeQuestionIndices.length - 1) {
      setQuestionIdx(activeQuestionIndices[pos + 1]);
    } else {
      setWizardStep(3);
    }
  };

  const handlePrevQuestion = () => {
    setWizardError(null);
    const pos = activeQuestionIndices.indexOf(questionIdx);
    if (pos > 0) {
      setQuestionIdx(activeQuestionIndices[pos - 1]);
    } else {
      setWizardStep(1);
    }
  };

  const handleStartDeploy = async () => {
    if (deployStatus === 'running') return;
    setWizardError(null);
    setDeployStatus('running');
    setTerminalLines([]);

    // Ensure Xray check has run right before installation if not yet checked
    const currentXray = xrayResult ?? (await runXrayCheck());

    const cleanPort = String(Number(targetPort) || 9443);
    const payload = {
      ssh: {
        host: sshHost.trim(),
        port: Number(sshPort) || 22,
        username: sshUser.trim() || 'root',
        authType: sshAuthType === 'key' ? 'privateKey' : 'password',
        password: sshAuthType === 'password' ? sshPassword : '',
        privateKey: sshAuthType === 'key' ? sshKey : '',
      },
      config: {
        domain: domain.trim(),
        webServer,
        transport,
        xhttpPath: xhttpPath.trim() || '/media/v3/chunk/',
        targetPort: Number(cleanPort),
        target: `127.0.0.1:${cleanPort}`,
        camouflageTheme: 'random',
      },
    };

    appendTerminalLine(
      `$ ssh -p ${payload.ssh.port} ${payload.ssh.username}@${payload.ssh.host}`,
      't-cyan'
    );
    appendTerminalLine(
      currentXray.xray
        ? t.wizard.xray.found
        : t.wizard.xray.notFound,
      currentXray.xray ? 't-green t-bold' : 't-yellow t-bold'
    );

    const seenSeq = new Set<number>();
    const handleSsePayload = (ev: Record<string, unknown>) => {
      if (!ev) return;
      if (typeof ev.seq === 'number') {
        if (seenSeq.has(ev.seq)) return;
        seenSeq.add(ev.seq);
      }
      if (ev.type === 'step') {
        if (ev.status === 'running') {
          appendTerminalLine(`\n━━━ ${String(ev.title || '')} ━━━`, 't-cyan t-bold');
        } else if (ev.status === 'success') {
          appendTerminalLine(
            `✓ ${String(ev.title || '')}${ev.detail ? ` (${String(ev.detail)})` : ''}`,
            't-green'
          );
        } else if (ev.status === 'error') {
          appendTerminalLine(
            `✗ ${String(ev.title || '')}${ev.detail ? `: ${String(ev.detail)}` : ''}`,
            't-yellow'
          );
        }
      } else if (ev.type === 'command') {
        appendTerminalLine(`$ ${String(ev.command || '')}`, 't-dim');
      } else if (ev.type === 'output') {
        const cleanText = String(ev.text || '').replace(/\n$/, '');
        if (cleanText) {
          appendTerminalLine(cleanText, ev.stream === 'stderr' ? 't-yellow' : undefined);
        }
      } else if (ev.type === 'done') {
        if (ev.success) {
          appendTerminalLine(`\n✅ ${String(ev.summary || 'OK')}`, 't-green t-bold');
          setDeployStatus('done');
        } else {
          appendTerminalLine(`\n❌ ${String(ev.summary || 'Error')}`, 't-yellow t-bold');
          setDeployStatus('error');
        }
      }
    };

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/deploy/stream');
      es.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          handleSsePayload(parsed);
        } catch {
          // ignore heartbeat
        }
      };
    } catch {
      // fallback to response stream
    }

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        appendTerminalLine(`HTTP Error ${response.status}: ${errText}`, 't-yellow');
        setDeployStatus('error');
        if (es) es.close();
        return;
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const part of parts) {
            const line = part.trim();
            if (line.startsWith('data:')) {
              const jsonStr = line.replace(/^data:\s*/, '');
              try {
                const ev = JSON.parse(jsonStr);
                handleSsePayload(ev);
              } catch {
                // ignore malformed chunk
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      appendTerminalLine(`Error: ${msg}`, 't-yellow');
      setDeployStatus('error');
    } finally {
      if (es) es.close();
    }
  };

  // Remnawave JSON preview based on current wizard settings
  const remnawaveJson = generateXrayConfig(
    normalizeIncomingDeployConfig({
      domain: domain.trim() || 'poland.example.xyz',
      webServer,
      transport,
      xhttpPath: xhttpPath.trim() || '/media/v3/chunk/',
      target: `127.0.0.1:${Number(targetPort) || 9443}`,
      privateKey: 'cO8v7mK2xP9qL4nR1wZ6tY3jH5gF0dS8aB2vN4mQ1kE=',
      publicKey: 'pX9kL2mN4vB8cZ1qW5eR7tY0uI3oP6aS9dF2gH5jK8l=',
      shortId: 'a1b2c3d4e5f60718',
    })
  );

  const oneLinerCmd =
    'bash <(curl -fsSL https://raw.githubusercontent.com/wemkk1/selfsteal-vless/main/install-selfsteal.sh)';

  const handleCopyOneLiner = () => {
    navigator.clipboard.writeText(oneLinerCmd);
    setCopiedOneLiner(true);
    setTimeout(() => setCopiedOneLiner(false), 1800);
  };

  const handleCopyRemna = () => {
    navigator.clipboard.writeText(remnawaveJson);
    setCopiedRemna(true);
    setTimeout(() => setCopiedRemna(false), 1800);
  };

  return (
    <div className="theme-transition">
      {/* Top Navbar */}
      <header className="topbar">
        <div className="container topbar-inner">
          <div className="brand">
            <div className="brand-badge">SS</div>
            <div>
              <div className="brand-title">SelfSteal VLESS</div>
              <div className="brand-sub">{t.brandSub}</div>
            </div>
          </div>

          <div className="nav-right">
            <nav className="nav-links">
              <a href="#ssh-deploy">{t.nav.deploy}</a>
              <a href="#architecture">{t.nav.architecture}</a>
              <a href="#cli">{t.nav.cli}</a>
              <a href="#remnawave">{t.nav.remnawave}</a>
              <a
                href="https://github.com/wemkk1/selfsteal-vless"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.nav.github}
              </a>
            </nav>

            <div className="nav-controls">
              <button
                type="button"
                id="lang-toggle-btn"
                className="ctrl-btn"
                aria-label={t.langToggle.aria}
                onClick={() => setLang((prev) => (prev === 'ru' ? 'en' : 'ru'))}
              >
                <span>🌐</span>
                <span className="ctrl-btn-badge">{lang.toUpperCase()}</span>
              </button>

              <button
                type="button"
                id="theme-toggle-btn"
                className="ctrl-btn"
                aria-label={t.themeToggle.aria}
                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              >
                <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
                <span>{theme === 'dark' ? t.themeToggle.dark : t.themeToggle.light}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        {/* Hero Section */}
        <section className="hero reveal is-visible">
          <div className="hero-grid">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-dot" />
                {t.hero.eyebrow}
              </div>
              <h1>
                {t.hero.titleStart}
                <span>{t.hero.titleHighlight}</span>
              </h1>
              <p className="hero-lead">
                {t.hero.lead}
                <code>{t.hero.leadCode}</code>.
              </p>

              <div className="hero-tags">
                {t.hero.tags.map((tagText, idx) => (
                  <span className="tag" key={idx}>
                    {tagText}
                  </span>
                ))}
              </div>

              {/* Quick 1-liner box */}
              <div className="panel" style={{ padding: '16px 18px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                    {t.quickStart.label}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    root · ports 80/443
                  </span>
                </div>
                <div className="one-liner-box">
                  <div className="one-liner-cmd">{oneLinerCmd}</div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCopyOneLiner}
                  >
                    {copiedOneLiner ? t.quickStart.copied : t.quickStart.copy}
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Terminal Preview */}
            <div className="terminal-window">
              <div className="terminal-bar">
                <span>{t.hero.previewHeader}</span>
                <span style={{ color: 'var(--green)' }}>● {t.hero.previewStatus}</span>
              </div>
              <div className="terminal-body">
                <span className="t-cyan t-bold">
                  ╔══════════════════════════════════════════════════════════════╗
                </span>
                {'\n'}
                <span className="t-cyan t-bold">║{t.terminal.title}║</span>
                {'\n'}
                <span className="t-cyan t-bold">
                  ╚══════════════════════════════════════════════════════════════╝
                </span>
                {'\n\n'}
                <span className="t-cyan t-bold">{t.terminal.step1Title}</span>
                {'\n'}
                {t.terminal.step1Sub}
                {'\n'}
                {'  '}
                <span className="t-green t-bold">1)</span> {t.terminal.step1Opt1}
                {'\n'}
                {'  '}
                <span className="t-cyan t-bold">2)</span> {t.terminal.step1Opt2}
                {'\n\n'}
                <span className="t-cyan t-bold">{t.terminal.step2Title}</span>
                {'\n'}
                {t.terminal.step2Sub}{' '}
                <span className="t-yellow">{domain || 'poland.example.xyz'}</span>
                {'\n\n'}
                <span className="t-cyan t-bold">{t.terminal.step3Title}</span>
                {'\n'}
                {'  '}
                <span className="t-green t-bold">1)</span> {t.terminal.step3Opt1}
                {'\n'}
                {'  '}
                <span className="t-cyan t-bold">2)</span> {t.terminal.step3Opt2}
                {'\n\n'}
                <span className="t-green t-bold">
                  ╔══════════════════════════════════════════════════════════════╗
                </span>
                {'\n'}
                <span className="t-green t-bold">║{t.terminal.doneTitle}║</span>
                {'\n'}
                <span className="t-green t-bold">
                  ╚══════════════════════════════════════════════════════════════╝
                </span>
                {'\n'}
                {t.terminal.manageHint}
                <span className="t-cyan">{t.terminal.manageCmd}</span>{' '}
                <span className="cursor">▊</span>
              </div>
            </div>
          </div>
        </section>

        {/* SSH Deploy Wizard Section */}
        <section className="section reveal" id="ssh-deploy">
          <div className="section-header">
            <h2 className="section-title">{t.wizard.title}</h2>
            <p className="section-sub">{t.wizard.sub}</p>
          </div>

          <div className="wizard-card">
            {/* Step Tabs */}
            <div className="wizard-steps">
              <button
                type="button"
                className={`wizard-step-tab ${wizardStep === 1 ? 'active' : 'done'}`}
                onClick={() => {
                  setWizardError(null);
                  setWizardStep(1);
                }}
              >
                <span className="wizard-step-num">{wizardStep > 1 ? '✓' : '1'}</span>
                <span>{t.wizard.steps.s1}</span>
              </button>

              <button
                type="button"
                className={`wizard-step-tab ${
                  wizardStep === 2 ? 'active' : wizardStep > 2 ? 'done' : ''
                }`}
                onClick={() => {
                  if (validateSshStep()) {
                    setWizardStep(2);
                  }
                }}
              >
                <span className="wizard-step-num">{wizardStep > 2 ? '✓' : '2'}</span>
                <span>{t.wizard.steps.s2}</span>
              </button>

              <button
                type="button"
                className={`wizard-step-tab ${wizardStep === 3 ? 'active' : ''}`}
                onClick={() => {
                  if (validateSshStep()) {
                    setWizardStep(3);
                  }
                }}
              >
                <span className="wizard-step-num">3</span>
                <span>{t.wizard.steps.s3}</span>
              </button>
            </div>

            {/* Xray Detection Banner (shown whenever xrayResult is available) */}
            {xrayResult && (
              <div
                id="xray-check-banner"
                className={`xray-banner ${
                  xrayResult.xray ? 'xray-banner-found' : 'xray-banner-missing'
                }`}
              >
                <div>
                  <span>
                    {xrayResult.xray ? t.wizard.xray.found : t.wizard.xray.notFound}
                  </span>
                  {xrayResult.xray && xrayResult.method && (
                    <span className="xray-banner-sub">
                      (
                      {xrayResult.method === 'folder'
                        ? t.wizard.xray.foundMethodFolder
                        : t.wizard.xray.foundMethodDocker}
                      )
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: '6px 12px', fontSize: '0.76rem' }}
                  disabled={xrayChecking}
                  onClick={runXrayCheck}
                >
                  {xrayChecking ? t.wizard.s1.checkingBtn : t.wizard.xray.recheckBtn}
                </button>
              </div>
            )}

            {wizardError && <div className="wizard-error">{wizardError}</div>}

            {/* STEP 1: SSH Connection */}
            {wizardStep === 1 && (
              <div>
                <div className="ssh-grid">
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        marginBottom: '6px',
                      }}
                    >
                      {t.wizard.s1.hostLabel}
                    </label>
                    <input
                      type="text"
                      id="ssh-host"
                      className="form-input"
                      placeholder={t.wizard.s1.hostPlaceholder}
                      value={sshHost}
                      onChange={(e) => setSshHost(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        marginBottom: '6px',
                      }}
                    >
                      {t.wizard.s1.portLabel}
                    </label>
                    <input
                      type="number"
                      id="ssh-port"
                      className="form-input"
                      placeholder={t.wizard.s1.portPlaceholder}
                      value={sshPort}
                      onChange={(e) => setSshPort(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        marginBottom: '6px',
                      }}
                    >
                      {t.wizard.s1.userLabel}
                    </label>
                    <input
                      type="text"
                      id="ssh-user"
                      className="form-input"
                      placeholder={t.wizard.s1.userPlaceholder}
                      value={sshUser}
                      onChange={(e) => setSshUser(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      marginBottom: '8px',
                    }}
                  >
                    {t.wizard.s1.authLabel}
                  </label>
                  <div className="choice-grid">
                    <button
                      type="button"
                      className={`choice-card ${sshAuthType === 'password' ? 'selected' : ''}`}
                      onClick={() => setSshAuthType('password')}
                    >
                      <div className="choice-card-title">{t.wizard.s1.authPassword}</div>
                    </button>
                    <button
                      type="button"
                      className={`choice-card ${sshAuthType === 'key' ? 'selected' : ''}`}
                      onClick={() => setSshAuthType('key')}
                    >
                      <div className="choice-card-title">{t.wizard.s1.authKey}</div>
                    </button>
                  </div>
                </div>

                {sshAuthType === 'password' ? (
                  <div style={{ marginBottom: '10px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        marginBottom: '6px',
                      }}
                    >
                      {t.wizard.s1.passwordLabel}
                    </label>
                    <input
                      type="password"
                      id="ssh-password"
                      className="form-input"
                      placeholder={t.wizard.s1.passwordPlaceholder}
                      value={sshPassword}
                      onChange={(e) => setSshPassword(e.target.value)}
                    />
                  </div>
                ) : (
                  <div style={{ marginBottom: '10px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        marginBottom: '6px',
                      }}
                    >
                      {t.wizard.s1.keyLabel}
                    </label>
                    <textarea
                      id="ssh-key"
                      className="form-textarea"
                      placeholder={t.wizard.s1.keyPlaceholder}
                      value={sshKey}
                      onChange={(e) => setSshKey(e.target.value)}
                    />
                  </div>
                )}

                <div className="wizard-actions" style={{ justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    id="step1-next-btn"
                    className="btn btn-primary"
                    disabled={xrayChecking}
                    onClick={handleStep1Continue}
                  >
                    {xrayChecking ? t.wizard.s1.checkingBtn : t.wizard.s1.nextBtn}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Interactive One-by-One Questions */}
            {wizardStep === 2 && (
              <div>
                <div className="question-box">
                  <div className="question-progress">
                    <span>
                      {t.wizard.s2.qPrefix} {currentQuestionPos + 1} {t.wizard.s2.of}{' '}
                      {totalQuestions}
                    </span>
                    <div className="question-dots">
                      {activeQuestionIndices.map((qIdx, idx) => (
                        <span
                          key={qIdx}
                          className={`question-dot ${
                            idx === currentQuestionPos
                              ? 'active'
                              : idx < currentQuestionPos
                              ? 'done'
                              : ''
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {questionIdx === 0 && (
                    <div>
                      <div className="question-title">{t.wizard.s2.q1.title}</div>
                      <div className="question-hint">{t.wizard.s2.q1.hint}</div>
                      <input
                        type="text"
                        id="wiz-domain"
                        className="form-input"
                        placeholder={t.wizard.s2.q1.placeholder}
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                      />
                    </div>
                  )}

                  {questionIdx === 1 && (
                    <div>
                      <div className="question-title">{t.wizard.s2.q2.title}</div>
                      <div className="question-hint">{t.wizard.s2.q2.hint}</div>
                      <div className="choice-grid">
                        <button
                          type="button"
                          className={`choice-card ${webServer === 'caddy' ? 'selected' : ''}`}
                          onClick={() => setWebServer('caddy')}
                        >
                          <div className="choice-card-title">Caddy</div>
                          <div className="choice-card-desc">{t.wizard.s2.q2.caddyDesc}</div>
                        </button>
                        <button
                          type="button"
                          className={`choice-card ${webServer === 'nginx' ? 'selected' : ''}`}
                          onClick={() => setWebServer('nginx')}
                        >
                          <div className="choice-card-title">Nginx</div>
                          <div className="choice-card-desc">{t.wizard.s2.q2.nginxDesc}</div>
                        </button>
                      </div>
                    </div>
                  )}

                  {questionIdx === 2 && (
                    <div>
                      <div className="question-title">{t.wizard.s2.q3.title}</div>
                      <div className="question-hint">{t.wizard.s2.q3.hint}</div>
                      <div className="choice-grid">
                        <button
                          type="button"
                          className={`choice-card ${transport === 'xhttp' ? 'selected' : ''}`}
                          onClick={() => setTransport('xhttp')}
                        >
                          <div className="choice-card-title">XHTTP</div>
                          <div className="choice-card-desc">{t.wizard.s2.q3.xhttpDesc}</div>
                        </button>
                        <button
                          type="button"
                          className={`choice-card ${transport === 'tcp' ? 'selected' : ''}`}
                          onClick={() => setTransport('tcp')}
                        >
                          <div className="choice-card-title">TCP</div>
                          <div className="choice-card-desc">{t.wizard.s2.q3.tcpDesc}</div>
                        </button>
                      </div>
                    </div>
                  )}

                  {questionIdx === 3 && (
                    <div>
                      <div className="question-title">{t.wizard.s2.q4.title}</div>
                      <div className="question-hint">{t.wizard.s2.q4.hint}</div>
                      <input
                        type="text"
                        id="wiz-xhttp-path"
                        className="form-input"
                        placeholder={t.wizard.s2.q4.placeholder}
                        value={xhttpPath}
                        onChange={(e) => setXhttpPath(e.target.value)}
                      />
                    </div>
                  )}

                  {questionIdx === 4 && (
                    <div>
                      <div className="question-title">{t.wizard.s2.q5.title}</div>
                      <div className="question-hint">{t.wizard.s2.q5.hint}</div>
                      <input
                        type="number"
                        id="wiz-target-port"
                        className="form-input"
                        placeholder={t.wizard.s2.q5.placeholder}
                        value={targetPort}
                        onChange={(e) => setTargetPort(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="wizard-actions">
                  <button
                    type="button"
                    id="step2-prev-btn"
                    className="btn"
                    onClick={handlePrevQuestion}
                  >
                    {t.wizard.s2.prevBtn}
                  </button>
                  <button
                    type="button"
                    id="step2-next-btn"
                    className="btn btn-primary"
                    onClick={handleNextQuestion}
                  >
                    {currentQuestionPos === totalQuestions - 1
                      ? t.wizard.s2.toStep3Btn
                      : t.wizard.s2.nextBtn}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Summary & Real-time SSE Terminal */}
            {wizardStep === 3 && (
              <div>
                <div className="wizard-summary-grid">
                  <div className="wizard-summary-box">
                    <div className="wizard-summary-label">{t.wizard.s3.sshTarget}</div>
                    <div className="wizard-summary-val">
                      {sshUser || 'root'}@{sshHost || '—'}:{sshPort || '22'}
                    </div>
                  </div>
                  <div className="wizard-summary-box">
                    <div className="wizard-summary-label">{t.wizard.s3.domain}</div>
                    <div className="wizard-summary-val">{domain}</div>
                  </div>
                  <div className="wizard-summary-box">
                    <div className="wizard-summary-label">{t.wizard.s3.webserver}</div>
                    <div className="wizard-summary-val">
                      {webServer === 'caddy' ? 'Caddy (/opt/ss-caddy)' : 'Nginx (/opt/nginx)'}
                    </div>
                  </div>
                  <div className="wizard-summary-box">
                    <div className="wizard-summary-label">{t.wizard.s3.transport}</div>
                    <div className="wizard-summary-val">{transport.toUpperCase()}</div>
                  </div>
                  {transport === 'xhttp' && (
                    <div className="wizard-summary-box">
                      <div className="wizard-summary-label">{t.wizard.s3.xhttpPath}</div>
                      <div className="wizard-summary-val">{xhttpPath}</div>
                    </div>
                  )}
                  <div className="wizard-summary-box">
                    <div className="wizard-summary-label">{t.wizard.s3.targetPort}</div>
                    <div className="wizard-summary-val">127.0.0.1:{targetPort}</div>
                  </div>
                </div>

                <div className="wizard-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={deployStatus === 'running'}
                    onClick={() => setWizardStep(2)}
                  >
                    {t.wizard.s3.backBtn}
                  </button>
                  <button
                    type="button"
                    id="deploy-start-btn"
                    className="btn btn-primary"
                    disabled={deployStatus === 'running'}
                    onClick={handleStartDeploy}
                  >
                    {deployStatus === 'running'
                      ? t.wizard.s3.installingBtn
                      : t.wizard.s3.installBtn}
                  </button>
                </div>

                <div className="deploy-terminal">
                  <div className="terminal-bar">
                    <span>{t.wizard.s3.termHeader}</span>
                    <span
                      style={{
                        color:
                          deployStatus === 'done'
                            ? 'var(--green)'
                            : deployStatus === 'error'
                            ? 'var(--amber)'
                            : 'var(--cyan)',
                      }}
                    >
                      ●{' '}
                      {deployStatus === 'idle'
                        ? t.wizard.s3.statusIdle
                        : deployStatus === 'running'
                        ? t.wizard.s3.statusRunning
                        : deployStatus === 'done'
                        ? t.wizard.s3.statusDone
                        : t.wizard.s3.statusError}
                    </span>
                  </div>
                  <div className="deploy-terminal-body" ref={terminalBodyRef}>
                    {terminalLines.length === 0 ? (
                      <>
                        <div className="t-dim">{t.wizard.s3.placeholderLine1}</div>
                        <div className="t-dim">
                          {t.wizard.s3.placeholderLine2} <span className="cursor">▊</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {terminalLines.map((line) => (
                          <div key={line.id} className={line.colorClass}>
                            {line.text}
                          </div>
                        ))}
                        <span className="cursor">▊</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Architecture Section */}
        <section className="section reveal" id="architecture">
          <div className="section-header">
            <h2 className="section-title">{t.arch.title}</h2>
            <p className="section-sub">{t.arch.sub}</p>
          </div>
          <div className="arch-grid">
            {t.arch.nodes.map((node, idx) => (
              <div className="arch-card" key={idx}>
                <div className="arch-step">{node.step}</div>
                <h3>{node.title}</h3>
                <p>{node.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CLI Utility & Templates Section */}
        <section className="section reveal" id="cli">
          <div className="section-header">
            <h2 className="section-title">{t.cli.title}</h2>
            <p className="section-sub">{t.cli.sub}</p>
          </div>

          <div className="cli-grid" style={{ marginBottom: '30px' }}>
            {t.cli.commands.map((item, idx) => (
              <div className="cli-card" key={idx}>
                <div className="cli-cmd">{item.cmd}</div>
                <div className="cli-desc">{item.desc}</div>
              </div>
            ))}
          </div>

          <div className="section-header" style={{ marginTop: '28px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{t.cli.templatesTitle}</h3>
          </div>
          <div className="tpl-grid">
            {t.cli.templates.map((tpl, idx) => (
              <div className="tpl-card" key={idx}>
                <div className="tpl-num">{tpl.id}</div>
                <div className="tpl-name">{tpl.name}</div>
                <div className="tpl-desc">{tpl.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Remnawave JSON Section */}
        <section className="section reveal" id="remnawave">
          <div className="code-card">
            <div className="code-card-header">
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{t.remna.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {t.remna.sub}
                </div>
              </div>
              <button type="button" className="btn" onClick={handleCopyRemna}>
                {copiedRemna ? t.remna.copiedBtn : t.remna.copyBtn}
              </button>
            </div>
            <pre className="code-pre" style={{ maxHeight: '420px' }}>
              {remnawaveJson}
            </pre>
          </div>
        </section>
      </main>

      {/* Footer with Visitor Counter */}
      <footer>
        <div className="container footer-inner">
          <div className="footer-left">
            <span>{t.footer.copyright}</span>
            <span id="visitor-counter" className="visitor-counter">
              {visitors !== null ? t.footer.visitorsLabel(visitors) : '👁 ...'}
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)' }}>
            {t.footer.cliHint}{' '}
            <span style={{ color: 'var(--cyan)' }}>/usr/local/bin/selfssteal</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default App;
