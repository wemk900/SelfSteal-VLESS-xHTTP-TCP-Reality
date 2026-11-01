import React, { useState } from 'react';
import { Play, RotateCcw, Terminal as TerminalIcon, CheckCircle2 } from 'lucide-react';
import {
  type SelfStealConfig,
  generateTerminalSummaryOutput,
  normalizeXhttpPath,
  normalizeTargetAddress,
  getBaseDirectory,
} from '../utils/generator';

interface TerminalSimulatorProps {
  config: SelfStealConfig;
  onChange: (updater: (prev: SelfStealConfig) => SelfStealConfig) => void;
}

export const TerminalSimulator: React.FC<TerminalSimulatorProps> = ({ config, onChange }) => {
  const [step, setStep] = useState<number>(5); // Default to full completed transcript, user can step through 1..5
  const baseDir = getBaseDirectory(config.webServer);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const { fullTarget } = normalizeTargetAddress(config.target);

  const startInteractiveWalkthrough = () => {
    setStep(1);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 rounded-lg bg-slate-900/70 p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Интерактивная проверка диалога Bash-скрипта (Шаги 1–4 + Итог установки)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Проверьте, как скрипт последовательно запрашивает параметры в терминале и какой отчет выводит после установки
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startInteractiveWalkthrough}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Пройти по шагам (1 → 4)</span>
          </button>
          <button
            type="button"
            onClick={() => setStep(5)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Показать полный вывод</span>
          </button>
        </div>
      </div>

      {/* Interactive step controls when stepping through 1..4 */}
      {step < 5 && (
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
                2) Укажите ваш домен для SelfSteal (например, poland.example.xyz):
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
                  <span>Запустить установку и вывести итог → Enter</span>
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
            <span>root@vps:~# bash install-selfsteal.sh</span>
          </div>
          <div className="text-xs font-mono text-slate-400">
            {baseDir} · {config.transport.toUpperCase()} · {fullTarget}
          </div>
        </div>
        <div className="p-5 overflow-x-auto">
          <pre className="text-xs font-mono leading-relaxed text-slate-200 whitespace-pre">
            {generateTerminalSummaryOutput(config)}
          </pre>
          {config.transport === 'xhttp' && (
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
