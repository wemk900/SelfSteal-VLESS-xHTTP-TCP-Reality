/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Download, Copy, Check } from 'lucide-react';
import {
  type SelfStealConfig,
  validateConfig,
  generateRealityCredentials,
  generateBashInstallScript,
  generateXrayConfig,
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
  camouflageTheme: 'cdn-edge',
  uuid: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  privateKey: 'cO7rV8pW9zL1mK3nJ5bH7vG9fC2dX4sA6qW8eR0tY2u',
  publicKey: 'pU8bL2kM4nJ6vH8xG0cF3dZ5sA7qW9eR1tY3uI5oP7a',
  shortId: 'a1b2c3d4e5f60718',
};

export default function App() {
  const [config, setConfig] = useState<SelfStealConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<ActiveTab>('bash');
  const [uriCopied, setUriCopied] = useState(false);

  const validation = useMemo(() => validateConfig(config), [config]);
  const baseDir = getBaseDirectory(config.webServer);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const { fullTarget } = normalizeTargetAddress(config.target);

  const bashScript = useMemo(() => generateBashInstallScript(config), [config]);
  const xrayConfig = useMemo(() => generateXrayConfig(config), [config]);
  const webServerConfig = useMemo(() => generateWebServerConfig(config), [config]);
  const sslRenewScript = useMemo(() => generateSslRenewalScript(config), [config]);
  const logrotateConfig = useMemo(() => generateLogrotateConfig(config), [config]);
  const vlessUri = useMemo(() => generateVlessClientUri(config), [config]);
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

  const handleCopyUri = async () => {
    try {
      await navigator.clipboard.writeText(vlessUri);
      setUriCopied(true);
      setTimeout(() => setUriCopied(false), 1800);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-slate-950/90 sticky top-0 z-30 backdrop-blur-sm">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('bash');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          SelfSteal Bash Architect
        </a>

        <nav
          aria-label="Основная навигация"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400"
        >
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
          <a
            href="#webserver"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('webserver');
            }}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'webserver' ? 'text-sky-400 underline underline-offset-4' : ''
            }`}
          >
            Сервер и SSL
          </a>
          <a
            href="#directories"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('directories');
            }}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'directories' ? 'text-sky-400 underline underline-offset-4' : ''
            }`}
          >
            Директории и DNS
          </a>
          <a
            href="#readme"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('readme');
            }}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'readme' ? 'text-sky-400 underline underline-offset-4' : ''
            }`}
          >
            README.md
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadBashScript}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Скачать install-selfsteal.sh</span>
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
              <span>Let&apos;s Encrypt EC-256 Auto-Renew</span>
              <span aria-hidden="true"> · </span>
              <span>{baseDir}</span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100"
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
            <div className="border border-slate-800 rounded-lg bg-slate-900/60 p-4">
              <div className="text-xs text-slate-400">1. Веб-сервер и директория</div>
              <div className="text-sm font-semibold font-mono text-slate-100 mt-1">
                {config.webServer === 'caddy' ? 'Caddy' : 'Nginx'} · {baseDir}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                conf · html · ssl · logs
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg bg-slate-900/60 p-4">
              <div className="text-xs text-slate-400">2. Домен SelfSteal (SNI)</div>
              <div className="text-sm font-semibold font-mono text-sky-400 mt-1 truncate">
                {config.domain || 'poland.example.xyz'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Let&apos;s Encrypt + DNS A/CAA
              </div>
            </div>

            <div className="border border-slate-800 rounded-lg bg-slate-900/60 p-4">
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

            <div className="border border-slate-800 rounded-lg bg-slate-900/60 p-4">
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
            {/* Segmented Control Tabs */}
            <div
              role="tablist"
              aria-label="Разделы генератора"
              className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-lg"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'bash'}
                onClick={() => setActiveTab('bash')}
                className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 truncate cursor-pointer ${
                  activeTab === 'bash'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                1. Bash (.sh)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'xray'}
                onClick={() => setActiveTab('xray')}
                className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 truncate cursor-pointer ${
                  activeTab === 'xray'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                2. Xray &amp; Reality
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'webserver'}
                onClick={() => setActiveTab('webserver')}
                className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 truncate cursor-pointer ${
                  activeTab === 'webserver'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                3. {config.webServer === 'caddy' ? 'Caddy' : 'Nginx'} + SSL
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'directories'}
                onClick={() => setActiveTab('directories')}
                className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 truncate cursor-pointer ${
                  activeTab === 'directories'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                4. {baseDir} &amp; DNS
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'simulator'}
                onClick={() => setActiveTab('simulator')}
                className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 truncate cursor-pointer ${
                  activeTab === 'simulator'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                5. Терминал
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'readme'}
                onClick={() => setActiveTab('readme')}
                className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 truncate cursor-pointer ${
                  activeTab === 'readme'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                6. README.md
              </button>
            </div>

            {/* TAB 1: BASH INSTALL SCRIPT */}
            {activeTab === 'bash' && (
              <div className="space-y-5">
                <div className="border border-slate-800 rounded-lg bg-slate-900/60 p-4 space-y-2">
                  <div className="text-xs font-semibold text-slate-200">
                    Запуск на сервере (Ubuntu / Debian)
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-sky-300">
                    <span className="select-all">
                      nano install-selfsteal.sh &amp;&amp; chmod +x install-selfsteal.sh &amp;&amp; sudo ./install-selfsteal.sh
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    При запуске скрипт интерактивно спросит: 1) Caddy/Nginx, 2) Домен, 3) XHTTP (и путь вида <span className="font-mono text-slate-300">{config.domain}{normPath}</span>) или TCP, 4) Порт Target (<span className="font-mono text-slate-300">{fullTarget}</span> по умолчанию), а если просто нажимать Enter — подставит выбранные вами значения.
                  </p>
                </div>

                <CodeBlock
                  title="install-selfsteal.sh — Полный Bash-скрипт установки SelfSteal"
                  subtitle={`Автоустановка ${config.webServer.toUpperCase()} в ${baseDir} + Let's Encrypt Cron + Логирование`}
                  code={bashScript}
                  filename="install-selfsteal.sh"
                  maxHeight="max-h-[620px]"
                />
              </div>
            )}

            {/* TAB 2: XRAY CONFIG & REALITY SETTINGS */}
            {activeTab === 'xray' && (
              <div className="space-y-6">
                {/* Таблица ключевых настроек Reality */}
                <div className="border border-slate-800 rounded-lg bg-slate-900/70 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-100">
                      Параметры Reality для ввода в Xray / 3X-UI / Marzban
                    </h3>
                    <span className="text-xs font-mono text-sky-400">
                      VLESS + {config.transport.toUpperCase()} + Reality
                    </span>
                  </div>
                  <div className="divide-y divide-slate-800/70 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 px-4 py-2.5 gap-2">
                      <span className="text-slate-400">Target (Dest):</span>
                      <span className="sm:col-span-2 font-mono text-emerald-400 select-all">
                        {fullTarget}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 px-4 py-2.5 gap-2">
                      <span className="text-slate-400">ServerNames (SNI):</span>
                      <span className="sm:col-span-2 font-mono text-slate-100 select-all">
                        {config.domain}
                      </span>
                    </div>
                    {config.transport === 'xhttp' ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 px-4 py-2.5 gap-2">
                          <span className="text-slate-400">XHTTP Path (Путь чанков):</span>
                          <span className="sm:col-span-2 font-mono text-sky-400 select-all">
                            {normPath}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 px-4 py-2.5 gap-2">
                          <span className="text-slate-400">Полный адрес XHTTP SelfSteal:</span>
                          <span className="sm:col-span-2 font-mono text-slate-200 select-all">
                            {config.domain}{normPath}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 px-4 py-2.5 gap-2">
                        <span className="text-slate-400">Flow (Поток TCP):</span>
                        <span className="sm:col-span-2 font-mono text-sky-400 select-all">
                          xtls-rprx-vision
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 px-4 py-2.5 gap-2">
                      <span className="text-slate-400">Private Key (Сервер):</span>
                      <span className="sm:col-span-2 font-mono text-amber-300 break-all select-all">
                        {config.privateKey}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 px-4 py-2.5 gap-2">
                      <span className="text-slate-400">Public Key (Клиент pbk):</span>
                      <span className="sm:col-span-2 font-mono text-amber-300 break-all select-all">
                        {config.publicKey}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 px-4 py-2.5 gap-2">
                      <span className="text-slate-400">ShortIds (sid):</span>
                      <span className="sm:col-span-2 font-mono text-slate-200 select-all">
                        {config.shortId}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Блок streamSettings для Xray */}
                <CodeBlock
                  title="Что прописать в конфиг Xray (блок streamSettings)"
                  subtitle={`streamSettings: network "${config.transport}" + security "reality" -> dest ${fullTarget}`}
                  code={xrayConfig}
                  filename="xray-streamSettings.json"
                />
              </div>
            )}

            {/* TAB 3: WEB SERVER (CADDY / NGINX) + SSL AUTO-RENEW & LOGS */}
            {activeTab === 'webserver' && (
              <div className="space-y-6">
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
                    subtitle="Автоматический выпуск, копирование сертификатов в /ssl и перезагрузка без обрыва соединений"
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

            {/* TAB 4: DIRECTORIES (/opt/ss-caddy or /opt/nginx) & DNS RECORDS */}
            {activeTab === 'directories' && <DirectoryExplorer config={config} />}

            {/* TAB 5: TERMINAL SIMULATOR */}
            {activeTab === 'simulator' && (
              <TerminalSimulator config={config} onChange={setConfig} />
            )}

            {/* TAB 6: GITHUB README.MD */}
            {activeTab === 'readme' && (
              <div className="space-y-5">
                <div className="border border-slate-800 rounded-lg bg-slate-900/60 p-4 space-y-1">
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

      {/* Quiet Footer */}
      <footer className="border-t border-slate-900 py-5 px-6 text-xs text-slate-500 mt-12">
        <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <span>SelfSteal Bash Architect · VLESS XHTTP / TCP Reality</span>
          <span className="font-mono">
            Директории: /opt/ss-caddy · /opt/nginx · Target: {fullTarget}
          </span>
        </div>
      </footer>
    </div>
  );
}
