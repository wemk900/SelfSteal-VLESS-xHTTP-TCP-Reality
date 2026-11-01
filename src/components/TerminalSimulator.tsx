import React, { useState } from 'react';
import { Play, RotateCcw, Terminal as TerminalIcon, CheckCircle2 } from 'lucide-react';
import {
  type SelfStealConfig,
  generateTerminalSummaryOutput,
  generateCliCommandPreview,
  normalizeXhttpPath,
  normalizeTargetAddress,
  getBaseDirectory,
} from '../utils/generator';

interface TerminalSimulatorProps {
  config: SelfStealConfig;
  onChange: (updater: (prev: SelfStealConfig) => SelfStealConfig) => void;
}

type ConsoleViewMode = 'install' | 'cli-start' | 'cli-status' | 'cli-remove';

export const TerminalSimulator: React.FC<TerminalSimulatorProps> = ({ config, onChange }) => {
  const [step, setStep] = useState<number>(5);
  const [consoleMode, setConsoleMode] = useState<ConsoleViewMode>('install');
  const [simulateDnsMismatch, setSimulateDnsMismatch] = useState<boolean>(false);

  const baseDir = getBaseDirectory(config.webServer);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const { fullTarget } = normalizeTargetAddress(config.target);

  const startInteractiveWalkthrough = () => {
    setConsoleMode('install');
    setStep(1);
  };

  const getActiveTerminalCommandLabel = () => {
    switch (consoleMode) {
      case 'cli-start':
        return 'root@vps:~# selfssteal';
      case 'cli-status':
        return 'root@vps:~# selfssteal status';
      case 'cli-remove':
        return 'root@vps:~# selfssteal remove';
      default:
        return 'root@vps:~# bash install-selfsteal.sh';
    }
  };

  const getActiveTerminalOutput = () => {
    switch (consoleMode) {
      case 'cli-start':
        return generateCliCommandPreview(config, 'start');
      case 'cli-status':
        return generateCliCommandPreview(config, 'status');
      case 'cli-remove':
        return generateCliCommandPreview(config, 'remove');
      default:
        return generateTerminalSummaryOutput(config, simulateDnsMismatch);
    }
  };

  return (
    <div className="space-y-5">
      <div className="border border-slate-800 rounded-lg bg-slate-900/70 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Симулятор терминала: установка + проверка DNS (1.1.1.1 / 8.8.8.8 / 9.9.9.9) и команда selfssteal
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Протестируйте пошаговый установщик, проверку DNS и команды управления <span className="font-mono text-slate-300">selfssteal</span>, <span className="font-mono text-slate-300">selfssteal status</span>, <span className="font-mono text-slate-300">selfssteal remove</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startInteractiveWalkthrough}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Опрос по шагам (1 → 4)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setConsoleMode('install');
                setStep(5);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Лог установки</span>
            </button>
          </div>
        </div>

        {/* Быстрое переключение команд CLI selfssteal и режима проверки DNS */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 mr-1">Выполнить в консоли:</span>
            <button
              type="button"
              onClick={() => {
                setConsoleMode('install');
                setStep(5);
              }}
              className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                consoleMode === 'install'
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              bash install-selfsteal.sh
            </button>
            <button
              type="button"
              onClick={() => setConsoleMode('cli-start')}
              className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                consoleMode === 'cli-start'
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              selfssteal (запуск)
            </button>
            <button
              type="button"
              onClick={() => setConsoleMode('cli-status')}
              className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                consoleMode === 'cli-status'
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              selfssteal status (Uptime + SSL/HTML)
            </button>
            <button
              type="button"
              onClick={() => setConsoleMode('cli-remove')}
              className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                consoleMode === 'cli-remove'
                  ? 'bg-rose-500 text-slate-950 font-semibold'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              selfssteal remove (удалить)
            </button>
          </div>

          {consoleMode === 'install' && (
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={simulateDnsMismatch}
                onChange={(e) => setSimulateDnsMismatch(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-400 rounded cursor-pointer"
              />
              <span>Симулировать расхождение DNS (9.9.9.9)</span>
            </label>
          )}
        </div>
      </div>

      {/* Interactive step controls when stepping through 1..4 */}
      {consoleMode === 'install' && step < 5 && (
        <div className="border border-sky-500/40 rounded-lg bg-slate-900 p-4 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-sky-400">ШАГ ТЕРМИНАЛА {step} ИЗ 4</span>
            <span>Введите ответ как в консоли Linux</span>
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <div className="text-sm font-mono text-slate-200">
                1) Выберите веб-сервер для SelfSteal: [1] Caddy (/opt/ss-caddy) или [2] Nginx (/opt/nginx)
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onChange((prev) => ({ ...prev, webServer: 'caddy' }));
                    setStep(2);
                  }}
                  className="px-4 py-2 text-xs font-mono font-medium bg-sky-500 text-slate-950 rounded-md hover:bg-sky-400 transition-colors cursor-pointer"
                >
                  Ввести 1 (Caddy) → Enter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange((prev) => ({ ...prev, webServer: 'nginx' }));
                    setStep(2);
                  }}
                  className="px-4 py-2 text-xs font-mono font-medium bg-slate-800 text-slate-200 border border-slate-700 rounded-md hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Ввести 2 (Nginx) → Enter
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="text-sm font-mono text-slate-200">
                2) Укажите ваш домен для SelfSteal (будет проверен у 1.1.1.1, 8.8.8.8, 9.9.9.9):
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  aria-label="Домен в терминале"
                  value={config.domain}
                  onChange={(e) => onChange((prev) => ({ ...prev, domain: e.target.value }))}
                  className="px-3 py-1.5 text-sm font-mono bg-slate-950 border border-slate-700 rounded-md text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-xs font-mono font-medium bg-sky-500 text-slate-950 rounded-md hover:bg-sky-400 transition-colors cursor-pointer"
                >
                  Подтвердить домен → Enter
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="text-sm font-mono text-slate-200">
                3) Выберите транспорт: XHTTP (с запросом пути {config.domain}/media/v3/chunk/) или TCP:
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onChange((prev) => ({ ...prev, transport: 'xhttp' }))}
                  className={`px-3 py-1.5 text-xs font-mono rounded-md cursor-pointer ${
                    config.transport === 'xhttp'
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  [1] XHTTP
                </button>
                <button
                  type="button"
                  onClick={() => onChange((prev) => ({ ...prev, transport: 'tcp' }))}
                  className={`px-3 py-1.5 text-xs font-mono rounded-md cursor-pointer ${
                    config.transport === 'tcp'
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  [2] TCP
                </button>
                {config.transport === 'xhttp' && (
                  <input
                    type="text"
                    aria-label="Путь XHTTP в терминале"
                    value={config.xhttpPath}
                    onChange={(e) => onChange((prev) => ({ ...prev, xhttpPath: e.target.value }))}
                    placeholder="/media/v3/chunk/"
                    className="px-3 py-1.5 text-sm font-mono bg-slate-950 border border-slate-700 rounded-md text-slate-100"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-4 py-2 text-xs font-mono font-medium bg-sky-500 text-slate-950 rounded-md hover:bg-sky-400 transition-colors cursor-pointer"
                >
                  Далее → Enter
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="text-sm font-mono text-slate-200">
                4) На каком порту будет target (по умолчанию 127.0.0.1:9443):
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  aria-label="Target в терминале"
                  value={config.target}
                  onChange={(e) => onChange((prev) => ({ ...prev, target: e.target.value }))}
                  placeholder="127.0.0.1:9443"
                  className="px-3 py-1.5 text-sm font-mono bg-slate-950 border border-slate-700 rounded-md text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-medium bg-emerald-400 text-slate-950 rounded-md hover:bg-emerald-300 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Запустить установку и проверку DNS → Enter</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Terminal Output Console */}
      <div className="border border-slate-800 rounded-lg bg-slate-950 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />
            <span>{getActiveTerminalCommandLabel()}</span>
          </div>
          <div className="text-xs font-mono text-slate-400">
            {baseDir} · {config.transport.toUpperCase()} · {fullTarget}
          </div>
        </div>
        <div className="p-5 overflow-x-auto">
          <pre className="text-xs font-mono leading-relaxed text-slate-200 whitespace-pre">
            {getActiveTerminalOutput()}
          </pre>
          {consoleMode === 'install' && config.transport === 'xhttp' && (
            <div className="mt-4 pt-4 border-t border-slate-800/80 text-xs font-mono text-emerald-400">
              ✓ Проверка маршрута XHTTP SelfSteal: https://{config.domain}
              {normPath} -&gt; {fullTarget} (TLS 1.3 + Let&apos;s Encrypt)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
