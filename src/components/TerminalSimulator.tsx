import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal as TerminalIcon,
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
  KeyRound,
  Lock,
  Copy,
  Check,
  ShieldCheck,
  Rocket,
} from 'lucide-react';
import {
  type SelfStealConfig,
  normalizeTargetAddress,
  getBaseDirectory,
} from '../utils/generator';

interface TerminalSimulatorProps {
  config: SelfStealConfig;
  onChange: (updater: (prev: SelfStealConfig) => SelfStealConfig) => void;
}

interface LiveStepItem {
  stepId: string;
  title: string;
  status: 'running' | 'success' | 'error';
  detail?: string;
}

interface LiveLogEntry {
  id: number;
  type: 'command' | 'stdout' | 'stderr' | 'status';
  text: string;
}

interface DeployCompleteSummary {
  ok: boolean;
  vlessUri: string;
  streamSettingsJson: string;
  chosenStub: string;
  xrayStatus: string;
  httpsVerified: boolean;
  error?: string;
}

export const TerminalSimulator: React.FC<TerminalSimulatorProps> = ({
  config,
}) => {
  // SSH Connection Form State (in-memory only, never persisted)
  const [sshHost, setSshHost] = useState<string>(config.serverIp || '');
  const [sshPort, setSshPort] = useState<number>(22);
  const [sshUser, setSshUser] = useState<string>('root');
  const [authType, setAuthType] = useState<'password' | 'privateKey'>('password');
  const [sshPassword, setSshPassword] = useState<string>('');
  const [sshPrivateKey, setSshPrivateKey] = useState<string>('');

  // SSH Test & Live Deploy State
  const [testingSsh, setTestingSsh] = useState<boolean>(false);
  const [sshTestResult, setSshTestResult] = useState<{
    ok: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [liveSteps, setLiveSteps] = useState<LiveStepItem[]>([]);
  const [liveLogs, setLiveLogs] = useState<LiveLogEntry[]>([]);
  const [deploySummary, setDeploySummary] = useState<DeployCompleteSummary | null>(null);
  const [copiedField, setCopiedField] = useState<'vless' | 'stream' | null>(null);

  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const logIdCounter = useRef<number>(1);

  // Sync sshHost when serverIp changes if user hasn't customized it
  useEffect(() => {
    if (config.serverIp && (!sshHost || sshHost === '185.212.140.42')) {
      setSshHost(config.serverIp);
    }
  }, [config.serverIp, sshHost]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [liveLogs]);

  const baseDir = getBaseDirectory(config.webServer);
  const { fullTarget } = normalizeTargetAddress(config.target);

  const appendLiveLog = (type: LiveLogEntry['type'], text: string) => {
    const id = logIdCounter.current++;
    setLiveLogs((prev) => [...prev, { id, type, text }]);
  };

  const handleTestSshConnection = async () => {
    setTestingSsh(true);
    setSshTestResult(null);
    try {
      const response = await fetch('/api/ssh/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssh: {
            host: sshHost.trim(),
            port: sshPort,
            username: sshUser.trim() || 'root',
            authType,
            password: authType === 'password' ? sshPassword : undefined,
            privateKey: authType === 'privateKey' ? sshPrivateKey : undefined,
          },
        }),
      });
      const data = await response.json();
      if (data.ok) {
        setSshTestResult({
          ok: true,
          message: data.message || 'Соединение по SSH установлено',
          details: data.details,
        });
      } else {
        setSshTestResult({
          ok: false,
          message: data.error || 'Ошибка проверки SSH соединения',
        });
      }
    } catch (err: unknown) {
      setSshTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Сетевая ошибка при обращении к /api/ssh/test',
      });
    } finally {
      setTestingSsh(false);
    }
  };

  const handleStartLiveDeploy = async () => {
    if (!sshHost.trim()) {
      setSshTestResult({
        ok: false,
        message: 'Укажите IP-адрес или хост сервера для SSH-деплоя',
      });
      return;
    }
    if (authType === 'password' && !sshPassword) {
      setSshTestResult({
        ok: false,
        message: 'Введите пароль пользователя SSH перед запуском деплоя',
      });
      return;
    }
    if (authType === 'privateKey' && !sshPrivateKey.trim()) {
      setSshTestResult({
        ok: false,
        message: 'Вставьте приватный SSH-ключ перед запуском деплоя',
      });
      return;
    }

    setIsDeploying(true);
    setSshTestResult(null);
    setLiveSteps([]);
    setLiveLogs([]);
    setDeploySummary(null);

    appendLiveLog(
      'status',
      `🚀 Запуск автоматического SSH-деплоя на ${sshUser || 'root'}@${sshHost}:${sshPort} (${config.webServer.toUpperCase()} Docker · ${config.domain})...\n`
    );

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          ssh: {
            host: sshHost.trim(),
            port: sshPort,
            username: sshUser.trim() || 'root',
            authType,
            password: authType === 'password' ? sshPassword : undefined,
            privateKey: authType === 'privateKey' ? sshPrivateKey : undefined,
          },
        }),
      });

      if (!response.ok || !response.body) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const rawBlock of parts) {
          const line = rawBlock
            .split('\n')
            .find((l) => l.startsWith('data: '));
          if (!line) continue;

          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'step') {
              setLiveSteps((prev) => {
                const idx = prev.findIndex((s) => s.stepId === event.stepId);
                if (idx === -1) {
                  return [
                    ...prev,
                    {
                      stepId: event.stepId,
                      title: event.title,
                      status: event.status,
                      detail: event.detail,
                    },
                  ];
                }
                const next = [...prev];
                next[idx] = {
                  ...next[idx],
                  title: event.title,
                  status: event.status,
                  detail: event.detail ?? next[idx].detail,
                };
                return next;
              });
            } else if (event.type === 'command') {
              appendLiveLog('command', `\nroot@${sshHost}:~# ${event.command}\n`);
            } else if (event.type === 'output') {
              appendLiveLog(event.stream === 'stderr' ? 'stderr' : 'stdout', event.text);
            } else if (event.type === 'complete') {
              setDeploySummary(event);
              if (event.ok) {
                appendLiveLog(
                  'status',
                  `\n✅ Деплой SelfSteal успешно завершен! Заглушка: ${event.chosenStub}\n`
                );
              } else {
                appendLiveLog('stderr', `\n❌ Ошибка деплоя: ${event.error || 'Неизвестная ошибка'}\n`);
              }
            }
          } catch {
            // Ignore malformed SSE chunk
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка соединения во время деплоя';
      appendLiveLog('stderr', `\n❌ Ошибка подключения: ${msg}\n`);
      setDeploySummary({
        ok: false,
        vlessUri: '',
        streamSettingsJson: '',
        chosenStub: '',
        xrayStatus: 'error',
        httpsVerified: false,
        error: msg,
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCopyText = async (type: 'vless' | 'stream', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(type);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-5">
      {/* Блок 1: SSH подключение и Установка одной кнопкой */}
      <div className="border border-slate-800 rounded-lg bg-[#13102a] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Server className="w-4 h-4 text-sky-400 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                SSH подключение и установка одной кнопкой на сервер (Docker {config.webServer === 'caddy' ? 'Caddy' : 'Nginx'})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Прямой деплой через <span className="font-mono text-slate-300">ssh2</span> + автозаливка выбранной HTML-заглушки по SFTP/SCP и live-стриминг логов через SSE. Данные SSH хранятся только в памяти.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-emerald-400">
            POST /api/deploy · SSE Stream
          </span>
        </div>

        {/* Поля SSH: Host, Port, User, Auth Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5">
            <label htmlFor="ssh-host-input" className="block text-xs font-semibold text-slate-300 mb-1">
              IPv4 / Хост сервера
            </label>
            <input
              id="ssh-host-input"
              type="text"
              value={sshHost}
              onChange={(e) => setSshHost(e.target.value)}
              placeholder="185.212.140.42"
              className="w-full px-3 py-2 text-xs font-mono bg-[#0d0a1a] border border-slate-800 focus:border-sky-400 focus:outline-none rounded-md text-slate-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="ssh-port-input" className="block text-xs font-semibold text-slate-300 mb-1">
              SSH Порт
            </label>
            <input
              id="ssh-port-input"
              type="number"
              min={1}
              max={65535}
              value={sshPort}
              onChange={(e) => setSshPort(parseInt(e.target.value, 10) || 22)}
              className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#0d0a1a] border border-slate-800 focus:border-sky-400 focus:outline-none rounded-md text-slate-100"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="ssh-user-input" className="block text-xs font-semibold text-slate-300 mb-1">
              Пользователь
            </label>
            <input
              id="ssh-user-input"
              type="text"
              value={sshUser}
              onChange={(e) => setSshUser(e.target.value)}
              placeholder="root"
              className="w-full px-3 py-2 text-xs font-mono bg-[#0d0a1a] border border-slate-800 focus:border-sky-400 focus:outline-none rounded-md text-slate-100"
            />
          </div>

          <div className="sm:col-span-3">
            <span className="block text-xs font-semibold text-slate-300 mb-1">
              Метод входа
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#0d0a1a] border border-slate-800 rounded-md">
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`px-2 py-1 text-xs font-semibold rounded transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                  authType === 'password'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>Пароль</span>
              </button>
              <button
                type="button"
                onClick={() => setAuthType('privateKey')}
                className={`px-2 py-1 text-xs font-semibold rounded transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                  authType === 'privateKey'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3 h-3" />
                <span>SSH Ключ</span>
              </button>
            </div>
          </div>
        </div>

        {/* Пароль или приватный ключ */}
        {authType === 'password' ? (
          <div>
            <label htmlFor="ssh-password-input" className="block text-xs font-semibold text-slate-300 mb-1">
              Пароль SSH для {sshUser || 'root'}@{sshHost || 'server'}
            </label>
            <input
              id="ssh-password-input"
              type="password"
              value={sshPassword}
              onChange={(e) => setSshPassword(e.target.value)}
              placeholder="Введите пароль от root / VPS..."
              className="w-full px-3 py-2 text-xs font-mono bg-[#0d0a1a] border border-slate-800 focus:border-sky-400 focus:outline-none rounded-md text-slate-100"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="ssh-key-textarea" className="block text-xs font-semibold text-slate-300 mb-1">
              Приватный SSH-ключ (PEM / OpenSSH)
            </label>
            <textarea
              id="ssh-key-textarea"
              rows={3}
              value={sshPrivateKey}
              onChange={(e) => setSshPrivateKey(e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
              className="w-full px-3 py-2 text-xs font-mono bg-[#0d0a1a] border border-slate-800 focus:border-sky-400 focus:outline-none rounded-md text-slate-100"
            />
          </div>
        )}

        {/* Кнопки "Проверить соединение" и "Установить одной кнопкой" */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={testingSsh || isDeploying}
              onClick={handleTestSshConnection}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-[#0d0a1a] hover:bg-slate-800 disabled:opacity-50 border border-slate-700 rounded-md transition-colors cursor-pointer"
            >
              {testingSsh ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span>{testingSsh ? 'Проверка SSH...' : 'Проверить соединение'}</span>
            </button>

            <button
              type="button"
              disabled={isDeploying}
              onClick={handleStartLiveDeploy}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
            >
              {isDeploying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Rocket className="w-3.5 h-3.5" />
              )}
              <span>
                {isDeploying
                  ? 'Выполняется установка на сервер...'
                  : 'Установить одной кнопкой на сервер'}
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Заглушка: {config.camouflageTheme === 'random' ? '🎲 Random (1–6)' : config.camouflageTheme} → {baseDir}/html/
          </div>
        </div>

        {/* Результат проверки соединения */}
        {sshTestResult && (
          <div
            className={`p-3 rounded-md border text-xs font-mono space-y-1 ${
              sshTestResult.ok
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {sshTestResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{sshTestResult.message}</span>
            </div>
            {sshTestResult.details && (
              <pre className="text-slate-300 whitespace-pre-wrap pl-6 pt-1">
                {sshTestResult.details}
              </pre>
            )}
          </div>
        )}

        {/* Чек-лист шагов Live-деплоя с зелеными галочками и красными крестами */}
        {liveSteps.length > 0 && (
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-200">
              Прогресс установки на сервере:
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {liveSteps.map((s) => (
                <div
                  key={s.stepId}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded border text-xs ${
                    s.status === 'success'
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-200'
                      : s.status === 'error'
                      ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                      : 'bg-sky-950/20 border-sky-500/30 text-sky-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {s.status === 'success' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    {s.status === 'running' && (
                      <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
                    )}
                    {s.status === 'error' && (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="truncate">{s.title}</span>
                  </div>
                  {s.detail && (
                    <span className="font-mono text-slate-400 shrink-0 truncate max-w-[260px]">
                      {s.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Финальная карточка после успешного деплоя (валидация + VLESS URI) */}
        {deploySummary && deploySummary.ok && (
          <div className="p-4 rounded-lg bg-emerald-950/25 border border-emerald-500/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>SelfSteal успешно развернут и проверен!</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-emerald-400">
                  ✓ HTTPS заглушка: {deploySummary.httpsVerified ? 'OK (200)' : 'Проверена'}
                </span>
                <span className="text-sky-400">
                  • Xray: {deploySummary.xrayStatus}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-300">
              Активный шаблон на сервере: <span className="font-mono text-slate-100">{deploySummary.chosenStub}</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Готовая ссылка VLESS Reality URI:</span>
                <button
                  type="button"
                  onClick={() => handleCopyText('vless', deploySummary.vlessUri)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors cursor-pointer"
                >
                  {copiedField === 'vless' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedField === 'vless' ? 'Скопировано' : 'Копировать VLESS URI'}</span>
                </button>
              </div>
              <div className="p-2.5 rounded bg-[#0d0a1a] border border-slate-800 font-mono text-xs text-emerald-300 break-all select-all">
                {deploySummary.vlessUri}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Terminal Output Console */}
      <div className="border border-slate-800 rounded-lg bg-[#0d0a1a] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 bg-[#13102a] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />
            <span>{`ssh ${sshUser || 'root'}@${sshHost || config.serverIp}:${sshPort} — Live SSE Stream`}</span>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Docker {config.webServer === 'caddy' ? 'Caddy' : 'Nginx'} · {baseDir} · {fullTarget}
          </div>
        </div>
        <div
          ref={logContainerRef}
          className="p-5 overflow-x-auto max-h-[540px] overflow-y-auto"
        >
          {liveLogs.length > 0 ? (
            <div className="text-xs font-mono leading-relaxed whitespace-pre-wrap space-y-0.5">
              {liveLogs.map((entry) => (
                <span
                  key={entry.id}
                  className={
                    entry.type === 'command'
                      ? 'text-sky-400 font-semibold block mt-2'
                      : entry.type === 'stderr'
                      ? 'text-rose-400'
                      : entry.type === 'status'
                      ? 'text-emerald-400 font-semibold'
                      : 'text-slate-200'
                  }
                >
                  {entry.text}
                </span>
              ))}
            </div>
          ) : (
            <pre className="text-xs font-mono leading-relaxed text-slate-400 whitespace-pre-wrap">
{`🔗 Готов к удаленному SSH-деплою одной кнопкой (${sshUser || 'root'}@${sshHost || config.serverIp}:${sshPort})
──────────────────────────────────────────────────────────────────────────
1. Укажите IP сервера и пароль (или приватный SSH-ключ) в форме выше.
2. Нажмите «Проверить соединение» для тестового рукопожатия ssh2.
3. Нажмите «Установить одной кнопкой на сервер» — все команды и вывод stdout/stderr появятся здесь в реальном времени через SSE.
   • Автоматическая проверка и установка Docker + Docker Compose (если не установлен)
   • Автозаливка выбранной HTML-заглушки по SFTP/SCP в ${baseDir}/html/ и /var/www/html/
   • Выпуск SSL сертификата Let's Encrypt и запуск контейнера selfsteal-${config.webServer}
   • Пост-деплой проверка curl -sk https://${config.domain} и вывод готовой VLESS ссылки`}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
