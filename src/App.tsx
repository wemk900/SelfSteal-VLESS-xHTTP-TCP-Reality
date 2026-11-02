/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Download, Copy, Check, Rocket, Eye } from 'lucide-react';
import {
  type SelfStealConfig,
  validateConfig,
  generateRealityCredentials,
  generateBashInstallScript,
  generateXrayConfig,
  generateDockerComposeConfig,
  generateWebServerConfig,
  generateSslRenewalScript,
  generateLogrotateConfig,
  generateVlessClientUri,
  generateGithubReadme,
  getBaseDirectory,
  normalizeXhttpPath,
  normalizeTargetAddress,
} from './utils/generator';
import { ConfigForm } from './components/ConfigForm';
import { CodeBlock } from './components/CodeBlock';
import { DirectoryExplorer } from './components/DirectoryExplorer';
import { TerminalSimulator } from './components/TerminalSimulator';

type ActiveTab = 'bash' | 'xray' | 'webserver' | 'directories' | 'simulator' | 'readme';

const DEFAULT_CONFIG: SelfStealConfig = {
  webServer: 'caddy',
  domain: 'poland.example.xyz',
  transport: 'xhttp',
  xhttpPath: '/media/v3/chunk/',
  target: '127.0.0.1:9443',
  xhttpInternalPort: 8080,
  xrayInboundPort: 443,
  serverIp: '185.212.140.42',
  ipv6Address: '2a01:4f8:c012:3456::1',
  acmeEmail: 'admin@example.xyz',
  autoRenewCert: true,
  renewIntervalDays: 1,
  enableAccessLog: true,
  enableErrorLog: true,
  logFormat: 'json',
  logRetentionDays: 14,
  camouflageTheme: 'random',
  uuid: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  privateKey: 'cO7rV8pW9zL1mK3nJ5bH7vG9fC2dX4sA6qW8eR0tY2u',
  publicKey: 'pU8bL2kM4nJ6vH8xG0cF3dZ5sA7qW9eR1tY3uI5oP7a',
  shortId: 'a1b2c3d4e5f60718',
};

export default function App() {
  const [config, setConfig] = useState<SelfStealConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<ActiveTab>('simulator');
  const [githubRepo, setGithubRepo] = useState(
    'https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh'
  );
  const [oneLinerCopied, setOneLinerCopied] = useState<'process' | 'pipe' | null>(null);
  const [siteStats, setSiteStats] = useState<{
    deploysDay: number;
    deploysMonth: number;
    deploysYear: number;
    deploysTotal: number;
    visitsDay: number;
    visitsMonth: number;
    visitsYear: number;
    visitsTotal: number;
  }>({
    deploysDay: 0,
    deploysMonth: 0,
    deploysYear: 0,
    deploysTotal: 0,
    visitsDay: 0,
    visitsMonth: 0,
    visitsYear: 0,
    visitsTotal: 0,
  });

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data?.ok && data.stats) {
        setSiteStats(data.stats);
      }
    } catch {
      // Ignore network errors
    }
  }, []);

  useEffect(() => {
    const visitedFlag = 'selfsteal_visit_recorded';
    const alreadyRecorded = sessionStorage.getItem(visitedFlag);
    if (!alreadyRecorded) {
      sessionStorage.setItem(visitedFlag, '1');
      fetch('/api/stats/visit', { method: 'POST' })
        .then((r) => r.json())
        .then((data) => {
          if (data?.ok && data.stats) {
            setSiteStats(data.stats);
          }
        })
        .catch(() => {
          refreshStats();
        });
    } else {
      refreshStats();
    }
  }, [refreshStats]);

  const validation = useMemo(() => validateConfig(config), [config]);
  const baseDir = getBaseDirectory(config.webServer);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const { fullTarget } = normalizeTargetAddress(config.target);

  const bashScript = useMemo(() => generateBashInstallScript(config), [config]);
  const xrayConfig = useMemo(() => generateXrayConfig(config), [config]);
  const dockerComposeConfig = useMemo(() => generateDockerComposeConfig(config), [config]);
  const webServerConfig = useMemo(() => generateWebServerConfig(config), [config]);
  const sslRenewScript = useMemo(() => generateSslRenewalScript(config), [config]);
  const logrotateConfig = useMemo(() => generateLogrotateConfig(config), [config]);
  const githubReadme = useMemo(() => generateGithubReadme(config), [config]);

  const handleRegenerateKeys = () => {
    const creds = generateRealityCredentials();
    setConfig((prev) => ({
      ...prev,
      ...creds,
    }));
  };

  const handleResetDefaults = () => {
    setConfig(DEFAULT_CONFIG);
  };

  const handleDownloadBashScript = () => {
    const blob = new Blob([bashScript], { type: 'text/x-shellscript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'install-selfsteal.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const trimmedRepoInput = githubRepo.trim();
  const rawScriptUrl = trimmedRepoInput.startsWith('http://') || trimmedRepoInput.startsWith('https://')
    ? trimmedRepoInput
    : `https://raw.githubusercontent.com/${
        trimmedRepoInput.replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '') ||
        'wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality'
      }/refs/heads/main/install-selfsteal.sh`;
  const bashProcessOneLiner = `bash <(curl -fsSL "${rawScriptUrl}")`;
  const bashPipeOneLiner = `curl -fsSL "${rawScriptUrl}" | bash`;

  const handleCopyOneLiner = async (type: 'process' | 'pipe') => {
    const text = type === 'process' ? bashProcessOneLiner : bashPipeOneLiner;
    try {
      await navigator.clipboard.writeText(text);
      setOneLinerCopied(type);
      setTimeout(() => setOneLinerCopied(null), 1800);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0a1a] text-slate-100 flex flex-col">
      {/* Top Bar Contract */}
      <header className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800 bg-[#0d0a1a]/95 sticky top-0 z-30 backdrop-blur-sm">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('simulator');
          }}
          className="text-sm sm:text-base font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          SelfSteal Bash Architect
        </a>

        <nav
          aria-label="Основная навигация"
          className="hidden xl:flex items-center gap-4 text-[11px] font-semibold text-slate-400"
        >
          <a
            href="#simulator"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('simulator');
            }}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'simulator' ? 'text-emerald-400 underline underline-offset-4 font-semibold' : ''
            }`}
          >
            SSH Деплой (1 клик)
          </a>
          <a
            href="#bash"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('bash');
            }}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'bash' ? 'text-sky-400 underline underline-offset-4' : ''
            }`}
          >
            Bash-скрипт
          </a>
          <a
            href="#xray"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('xray');
            }}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'xray' ? 'text-sky-400 underline underline-offset-4' : ''
            }`}
          >
            Xray Reality
          </a>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>🚀 Установить в 1 клик (SSH)</span>
          </button>
          <button
            type="button"
            onClick={() => handleCopyOneLiner('process')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {oneLinerCopied === 'process' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>
              {oneLinerCopied === 'process' ? 'Скопировано' : 'bash <(curl)'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleDownloadBashScript}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 bg-[#13102a] hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.sh файл</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero / Overview Header + 4-Parameter KPI Strip */}
        <section className="space-y-5">
          <div className="max-w-3xl space-y-2">
            <div className="text-xs text-slate-400 font-mono">
              <span>VLESS XHTTP / TCP Reality</span>
              <span aria-hidden="true"> · </span>
              <span>Author: t.me/wemkz</span>
              <span aria-hidden="true"> · </span>
              <span>🎲 6 HTML-заглушек (Random)</span>
              <span aria-hidden="true"> · </span>
              <span>{baseDir}</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-100"
              style={{ textWrap: 'balance' }}
            >
              Установщик SelfSteal для VLESS XHTTP и TCP Reality через Bash
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Скрипт последовательно запрашивает веб-сервер (Caddy или Nginx), домен, протокол транспорта (XHTTP с путем чанков или TCP) и локальный порт Target (127.0.0.1:9443 по умолчанию), настраивает автообновление Let&apos;s Encrypt, логирование запросов и выводит готовую конфигурацию для Xray.
            </p>
          </div>

          {/* 4-Step Parameter Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-slate-800 rounded-lg bg-[#13102a] p-4">
              <div className="text-xs text-slate-400">1. Веб-сервер и директория</div>
              <div className="text-sm font-semibold font-mono text-slate-100 mt-1">
                {config.webServer === 'caddy' ? 'Caddy' : 'Nginx'} · {baseDir}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                conf · html · ssl · logs
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg bg-[#13102a] p-4">
              <div className="text-xs text-slate-400">2. Домен SelfSteal (SNI)</div>
              <div className="text-sm font-semibold font-mono text-sky-400 mt-1 truncate">
                {config.domain || 'poland.example.xyz'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Let&apos;s Encrypt + DNS A/CAA
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg bg-[#13102a] p-4">
              <div className="text-xs text-slate-400">3. Протокол и путь</div>
              <div className="text-sm font-semibold font-mono text-slate-100 mt-1 truncate">
                {config.transport === 'xhttp'
                  ? `XHTTP · ${normPath}`
                  : 'TCP · xtls-rprx-vision'}
              </div>
              <div className="text-xs text-slate-500 mt-1 truncate">
                {config.transport === 'xhttp'
                  ? `${config.domain}${normPath}`
                  : 'Прямой fallback на SelfSteal'}
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg bg-[#13102a] p-4">
              <div className="text-xs text-slate-400">4. Target (Dest порт)</div>
              <div className="text-sm font-semibold font-mono text-emerald-400 tabular-nums mt-1">
                {fullTarget}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Локальный сокет Reality dest
              </div>
            </div>
          </div>
        </section>

        {/* Main Workspace Split: Left Config Form + Right Multi-Tab Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4">
            <ConfigForm
              config={config}
              validation={validation}
              onChange={setConfig}
              onRegenerateKeys={handleRegenerateKeys}
              onResetDefaults={handleResetDefaults}
            />
          </div>

          <div className="lg:col-span-8 space-y-5">
            {/* Segmented Control Tabs (SSH Deploy first) */}
            <div
              role="tablist"
              aria-label="Разделы генератора"
              className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1.5 bg-[#13102a] border border-slate-800 rounded-lg"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'simulator'}
                onClick={() => setActiveTab('simulator')}
                className={`px-2.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 truncate cursor-pointer ${
                  activeTab === 'simulator'
                    ? 'bg-emerald-400 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-[#0d0a1a]'
                }`}
              >
                1. SSH Деплой (1 клик)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'bash'}
                onClick={() => setActiveTab('bash')}
                className={`px-2.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 truncate cursor-pointer ${
                  activeTab === 'bash'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-[#0d0a1a]'
                }`}
              >
                2. Bash (.sh)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'xray'}
                onClick={() => setActiveTab('xray')}
                className={`px-2.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 truncate cursor-pointer ${
                  activeTab === 'xray'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-[#0d0a1a]'
                }`}
              >
                3. Xray &amp; Reality
              </button>
            </div>

            {/* TAB 1: SSH DEPLOY */}
            {activeTab === 'simulator' && (
              <TerminalSimulator
                config={config}
                onChange={setConfig}
                onDeploySuccess={refreshStats}
              />
            )}

            {/* TAB 2: BASH INSTALL SCRIPT */}
            {activeTab === 'bash' && (
              <div className="space-y-5">
                <div className="border border-slate-800 rounded-lg bg-[#13102a] p-4 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-100">
                        Запуск одной командой через Bash (из GitHub Raw без скачивания)
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Все вопросы скрипта читают ввод через <span className="font-mono text-slate-300">/dev/tty</span>, поэтому интерактивный диалог работает напрямую через <span className="font-mono text-slate-300">bash &lt;(curl ...)</span> и <span className="font-mono text-slate-300">curl | bash</span>.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <label htmlFor="github-repo-input" className="text-xs text-slate-400 whitespace-nowrap">
                        GitHub Raw URL:
                      </label>
                      <input
                        id="github-repo-input"
                        type="text"
                        value={githubRepo}
                        onChange={(e) => setGithubRepo(e.target.value)}
                        placeholder="https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh"
                        className="px-2.5 py-1 text-xs font-mono bg-[#0d0a1a] border border-slate-800 focus:border-sky-400 focus:outline-none rounded text-slate-100 w-full sm:w-80"
                      />
                    </div>
                  </div>

                  {/* Вариант 1: bash <(curl -fsSL ...) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Вариант 1 (рекомендуемый — через подстановку процесса Bash):</span>
                      <button
                        type="button"
                        onClick={() => handleCopyOneLiner('process')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-200 bg-[#0d0a1a] hover:bg-slate-800 border border-slate-700 rounded transition-colors cursor-pointer"
                      >
                        {oneLinerCopied === 'process' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{oneLinerCopied === 'process' ? 'Скопировано' : 'Копировать'}</span>
                      </button>
                    </div>
                    <div className="p-2.5 rounded bg-[#0d0a1a] border border-slate-800 font-mono text-xs text-sky-300 select-all break-all">
                      {bashProcessOneLiner}
                    </div>
                  </div>

                  {/* Вариант 2: curl -fsSL ... | bash */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Вариант 2 (классический пайп curl | bash):</span>
                      <button
                        type="button"
                        onClick={() => handleCopyOneLiner('pipe')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-200 bg-[#0d0a1a] hover:bg-slate-800 border border-slate-700 rounded transition-colors cursor-pointer"
                      >
                        {oneLinerCopied === 'pipe' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{oneLinerCopied === 'pipe' ? 'Скопировано' : 'Копировать'}</span>
                      </button>
                    </div>
                    <div className="p-2.5 rounded bg-[#0d0a1a] border border-slate-800 font-mono text-xs text-emerald-300 select-all break-all">
                      {bashPipeOneLiner}
                    </div>
                  </div>
                </div>

                <CodeBlock
                  title="install-selfsteal.sh — Исходный код скрипта для вашего GitHub репозитория"
                  subtitle={`Положите этот файл в корень GitHub репозитория (уже сохранен в /install-selfsteal.sh)`}
                  code={bashScript}
                  filename="install-selfsteal.sh"
                  maxHeight="max-h-[620px]"
                />
              </div>
            )}

            {/* TAB 3: XRAY CONFIG & REALITY SETTINGS */}
            {activeTab === 'xray' && (
              <div className="space-y-6">
                {/* Таблица ключевых настроек Reality для Remnawave */}
                <div className="border border-slate-800 rounded-lg bg-[#13102a] overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 bg-[#13102a] flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-100">
                      Параметры Reality для Remnawave
                    </h3>
                    <span className="text-xs font-mono text-sky-400">
                      VLESS + {config.transport.toUpperCase()} + Reality
                    </span>
                  </div>
                  <div className="divide-y divide-slate-800/70 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 px-4 py-2.5 gap-2">
                      <span className="text-slate-400">ServerNames (SNI):</span>
                      <span className="sm:col-span-2 font-mono text-slate-100 select-all">
                        {config.domain}
                      </span>
                    </div>
                    {config.transport === 'xhttp' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 px-4 py-2.5 gap-2">
                        <span className="text-slate-400">XHTTP Path:</span>
                        <span className="sm:col-span-2 font-mono text-sky-400 select-all">
                          {normPath}
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 px-4 py-2.5 gap-2">
                      <span className="text-slate-400">Private Key:</span>
                      <span className="sm:col-span-2 font-mono text-amber-300 break-all select-all">
                        {config.privateKey}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 px-4 py-2.5 gap-2">
                      <span className="text-slate-400">Public Key:</span>
                      <span className="sm:col-span-2 font-mono text-amber-300 break-all select-all">
                        {config.publicKey}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 px-4 py-2.5 gap-2">
                      <span className="text-slate-400">ShortId:</span>
                      <span className="sm:col-span-2 font-mono text-slate-200 select-all">
                        {config.shortId}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Блок streamSettings для Xray */}
                <CodeBlock
                  title="Что прописать в конфиг Xray (блок streamSettings)"
                  subtitle={`streamSettings: network "${config.transport}" + security "reality"`}
                  code={xrayConfig}
                  filename="xray-streamSettings.json"
                />
              </div>
            )}

            {/* TAB 4: DOCKER WEB SERVER (CADDY / NGINX) + SSL AUTO-RENEW & LOGS */}
            {activeTab === 'webserver' && (
              <div className="space-y-6">
                <CodeBlock
                  title={`Docker Compose (${baseDir}/docker-compose.yml)`}
                  subtitle={`Контейнер selfsteal-${config.webServer} (${
                    config.webServer === 'caddy' ? 'caddy:2-alpine' : 'nginx:stable-alpine'
                  }) · network_mode: host · автоустановка Docker если отсутствует`}
                  code={dockerComposeConfig}
                  filename="docker-compose.yml"
                  maxHeight="max-h-[300px]"
                />

                <CodeBlock
                  title={`Конфигурация ${config.webServer === 'caddy' ? 'Caddy' : 'Nginx'} (${baseDir}/conf/${
                    config.webServer === 'caddy' ? 'Caddyfile' : 'nginx.conf'
                  })`}
                  subtitle={`Слушает ${fullTarget} · SSL из ${baseDir}/ssl · Статика из ${baseDir}/html`}
                  code={webServerConfig}
                  filename={config.webServer === 'caddy' ? 'Caddyfile' : 'nginx.conf'}
                />

                <div className="grid grid-cols-1 gap-6">
                  <CodeBlock
                    title={`Скрипт автообновления Let's Encrypt (${baseDir}/ssl/renew-hook.sh)`}
                    subtitle="Фоновый выпуск и мягкая перезагрузка Docker-контейнера"
                    code={sslRenewScript}
                    filename="renew-hook.sh"
                    maxHeight="max-h-[320px]"
                  />

                  <CodeBlock
                    title={`Конфигурация ротации логов запросов (/etc/logrotate.d/selfsteal-${config.webServer})`}
                    subtitle={`Ежедневная ротация ${baseDir}/logs/*.log · Хранение ${config.logRetentionDays} дней`}
                    code={logrotateConfig}
                    filename={`selfsteal-${config.webServer}.logrotate`}
                    maxHeight="max-h-[260px]"
                  />
                </div>
              </div>
            )}

            {/* TAB 5: DIRECTORIES (/opt/ss-caddy or /opt/nginx) & DNS RECORDS */}
            {activeTab === 'directories' && <DirectoryExplorer config={config} />}

            {/* TAB 6: GITHUB README.MD */}
            {activeTab === 'readme' && (
              <div className="space-y-5">
                <div className="border border-slate-800 rounded-lg bg-[#13102a] p-4 space-y-1">
                  <div className="text-xs font-semibold text-slate-200">
                    Готовая документация README.md для вашего GitHub-репозитория
                  </div>
                  <p className="text-xs text-slate-400">
                    Файл <span className="font-mono text-slate-300">/README.md</span> уже сохранен в корне проекта, а ниже представлена динамическая версия с вашими текущими параметрами ({config.domain}, {baseDir}, {fullTarget}).
                  </p>
                </div>
                <CodeBlock
                  title="README.md — Документация для GitHub репозитория"
                  subtitle={`Схема архитектуры, 4 шага установки, структура ${baseDir}, DNS и Xray Reality`}
                  code={githubReadme}
                  filename="README.md"
                  maxHeight="max-h-[620px]"
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Counter & Quiet Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0d0a1a] py-6 px-6 text-xs text-slate-400 mt-12">
        <div className="max-w-[1380px] mx-auto space-y-4">
          {/* Счетчик SSH деплоев (день / месяц / год) и посещений сайта */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-800 rounded-lg bg-[#13102a] p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Rocket className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-100">
                    Счетчик SSH-деплоев
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Установок в 1 клик через веб-панель
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 font-mono tabular-nums">
                <div className="text-center">
                  <div className="text-[10px] text-slate-400">За день</div>
                  <div className="text-sm font-semibold text-emerald-400">
                    {siteStats.deploysDay}
                  </div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div className="text-center">
                  <div className="text-[10px] text-slate-400">За месяц</div>
                  <div className="text-sm font-semibold text-sky-400">
                    {siteStats.deploysMonth}
                  </div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div className="text-center">
                  <div className="text-[10px] text-slate-400">За год</div>
                  <div className="text-sm font-semibold text-slate-100">
                    {siteStats.deploysYear}
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg bg-[#13102a] p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-sky-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-100">
                    Посещения сайта
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Сколько раз открывали веб-установщик
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 font-mono tabular-nums">
                <div className="text-center">
                  <div className="text-[10px] text-slate-400">За день</div>
                  <div className="text-sm font-semibold text-sky-400">
                    {siteStats.visitsDay}
                  </div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div className="text-center">
                  <div className="text-[10px] text-slate-400">За месяц</div>
                  <div className="text-sm font-semibold text-slate-200">
                    {siteStats.visitsMonth}
                  </div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div className="text-center">
                  <div className="text-[10px] text-slate-400">Всего входов</div>
                  <div className="text-sm font-semibold text-emerald-400">
                    {siteStats.visitsTotal}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/60 text-slate-500">
            <span>SelfSteal Bash Architect · VLESS XHTTP / TCP Reality · Author: t.me/wemkz</span>
            <span className="font-mono">
              Директории: /opt/ss-caddy · /opt/nginx · Target: {fullTarget}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
