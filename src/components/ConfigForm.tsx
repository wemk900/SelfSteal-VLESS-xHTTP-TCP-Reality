import React from 'react';
import { RefreshCw } from 'lucide-react';
import {
  type SelfStealConfig,
  type ValidationResult,
  type StubTemplateId,
  STUB_TEMPLATES,
  parseDomainAndPathInput,
  normalizeXhttpPath,
  normalizeTargetAddress,
  getBaseDirectory,
} from '../utils/generator';

interface ConfigFormProps {
  config: SelfStealConfig;
  validation: ValidationResult;
  onChange: (updater: (prev: SelfStealConfig) => SelfStealConfig) => void;
  onRegenerateKeys: () => void;
  onResetDefaults: () => void;
}

export const ConfigForm: React.FC<ConfigFormProps> = ({
  config,
  validation,
  onChange,
  onRegenerateKeys,
  onResetDefaults,
}) => {
  const baseDir = getBaseDirectory(config.webServer);

  const handleDomainBlur = () => {
    const parsed = parseDomainAndPathInput(config.domain, config.xhttpPath);
    onChange((prev) => ({
      ...prev,
      domain: parsed.domain,
      xhttpPath: parsed.extractedPath ? parsed.extractedPath : prev.xhttpPath,
    }));
  };

  const handlePathBlur = () => {
    onChange((prev) => ({
      ...prev,
      xhttpPath: normalizeXhttpPath(prev.xhttpPath, prev.domain),
    }));
  };

  const handleTargetBlur = () => {
    const norm = normalizeTargetAddress(config.target);
    onChange((prev) => ({
      ...prev,
      target: norm.fullTarget,
    }));
  };

  return (
    <aside className="border border-slate-800 rounded-lg bg-slate-900/70 p-5 space-y-6">
      <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Параметры установщика</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            4 шага опроса Bash-скрипта + SSL и логирование
          </p>
        </div>
        <button
          type="button"
          onClick={onResetDefaults}
          className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Сбросить
        </button>
      </div>

      {/* ШАГ 1: Веб-сервер Caddy / Nginx */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium text-slate-200">01. Веб-сервер SelfSteal</span>
          <span className="font-mono text-slate-400">{baseDir}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => onChange((prev) => ({ ...prev, webServer: 'caddy' }))}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              config.webServer === 'caddy'
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            Caddy (/opt/ss-caddy)
          </button>
          <button
            type="button"
            onClick={() => onChange((prev) => ({ ...prev, webServer: 'nginx' }))}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              config.webServer === 'nginx'
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            Nginx (/opt/nginx)
          </button>
        </div>
      </div>

      {/* ШАГ 2: Домен */}
      <div className="space-y-1.5">
        <label htmlFor="domain-input" className="block text-xs font-medium text-slate-200">
          02. Домен для SelfSteal и сертификата
        </label>
        <input
          id="domain-input"
          type="text"
          value={config.domain}
          onChange={(e) => onChange((prev) => ({ ...prev, domain: e.target.value }))}
          onBlur={handleDomainBlur}
          placeholder="poland.example.xyz"
          className="w-full px-3 py-2 text-sm font-mono bg-slate-950 border border-slate-800 focus:border-sky-400 focus:outline-none rounded-md text-slate-100 placeholder:text-slate-600"
        />
        {validation.errors.domain ? (
          <p className="text-xs text-rose-400">{validation.errors.domain}</p>
        ) : (
          <p className="text-xs text-slate-400">
            Используется в <span className="font-mono text-slate-300">serverNames (SNI)</span> и Let&apos;s Encrypt
          </p>
        )}
      </div>

      {/* ШАГ 3: XHTTP или TCP */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-200">03. Транспорт VLESS Reality</span>
          <span className="text-slate-400 font-mono">
            {config.transport === 'xhttp' ? 'SplitHTTP / XHTTP' : 'TCP + Vision'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => onChange((prev) => ({ ...prev, transport: 'xhttp' }))}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              config.transport === 'xhttp'
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            VLESS XHTTP Reality
          </button>
          <button
            type="button"
            onClick={() => onChange((prev) => ({ ...prev, transport: 'tcp' }))}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              config.transport === 'tcp'
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            VLESS TCP Reality
          </button>
        </div>

        {config.transport === 'xhttp' && (
          <div className="space-y-1.5 pt-1">
            <label htmlFor="xhttp-path-input" className="block text-xs font-medium text-slate-200">
              Путь (Path) для XHTTP SelfSteal
            </label>
            <input
              id="xhttp-path-input"
              type="text"
              value={config.xhttpPath}
              onChange={(e) => onChange((prev) => ({ ...prev, xhttpPath: e.target.value }))}
              onBlur={handlePathBlur}
              placeholder="/media/v3/chunk/"
              className="w-full px-3 py-2 text-sm font-mono bg-slate-950 border border-slate-800 focus:border-sky-400 focus:outline-none rounded-md text-slate-100 placeholder:text-slate-600"
            />
            {validation.errors.xhttpPath ? (
              <p className="text-xs text-rose-400">{validation.errors.xhttpPath}</p>
            ) : (
              <p className="text-xs text-slate-400 font-mono truncate">
                URL: {config.domain || 'poland.example.xyz'}
                {normalizeXhttpPath(config.xhttpPath, config.domain)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ШАГ 4: Порт и адрес Target */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="target-input" className="block text-xs font-medium text-slate-200">
            04. Порт и адрес Target (Dest)
          </label>
          <button
            type="button"
            onClick={() => onChange((prev) => ({ ...prev, target: '127.0.0.1:9443' }))}
            className="text-xs text-sky-400 hover:text-sky-300 font-mono cursor-pointer"
          >
            127.0.0.1:9443 (по умолч.)
          </button>
        </div>
        <input
          id="target-input"
          type="text"
          value={config.target}
          onChange={(e) => onChange((prev) => ({ ...prev, target: e.target.value }))}
          onBlur={handleTargetBlur}
          placeholder="127.0.0.1:9443"
          className="w-full px-3 py-2 text-sm font-mono bg-slate-950 border border-slate-800 focus:border-sky-400 focus:outline-none rounded-md text-slate-100 placeholder:text-slate-600"
        />
        {validation.errors.target ? (
          <p className="text-xs text-rose-400">{validation.errors.target}</p>
        ) : (
          <p className="text-xs text-slate-400">
            Локальный сокет, который слушает {config.webServer === 'caddy' ? 'Caddy' : 'Nginx'} и куда Xray направляет Reality-рукопожатия
          </p>
        )}
      </div>

      {/* ШАГ 5: Шаблон HTML-заглушки (Random из 6 или конкретный) */}
      <div className="pt-4 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="stub-template-select" className="font-semibold text-slate-200">
            05. Маскировочная HTML-заглушка (6 шаблонов)
          </label>
          <span className="font-mono text-sky-400">
            {config.camouflageTheme === 'random' ? '🎲 Random (1–6)' : config.camouflageTheme}
          </span>
        </div>
        <select
          id="stub-template-select"
          value={config.camouflageTheme}
          onChange={(e) =>
            onChange((prev) => ({
              ...prev,
              camouflageTheme: e.target.value as StubTemplateId,
            }))
          }
          className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-md text-slate-100 focus:border-sky-400 focus:outline-none"
        >
          <option value="random">
            🎲 Рандомный выбор при установке (RANDOM % 6 из всех шаблонов)
          </option>
          {STUB_TEMPLATES.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.emoji} {tpl.id} — {tpl.description}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400">
          Все 6 шаблонов сохраняются в <span className="font-mono text-slate-300">{baseDir}/html/templates/</span>, смена в 1 клик через <span className="font-mono text-sky-400">selfssteal template</span>
        </p>
      </div>

      {/* ШАГ 6: Let's Encrypt и Логирование */}
      <div className="pt-4 border-t border-slate-800 space-y-4">
        <h3 className="text-xs font-semibold text-slate-200">
          06. Сертификаты Let&apos;s Encrypt и логирование
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="server-ip-input" className="block text-xs text-slate-300 mb-1">
              IPv4 сервера (для DNS шпаргалки)
            </label>
            <input
              id="server-ip-input"
              type="text"
              value={config.serverIp}
              onChange={(e) => onChange((prev) => ({ ...prev, serverIp: e.target.value }))}
              placeholder="185.212.140.42"
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-950 border border-slate-800 focus:border-sky-400 focus:outline-none rounded-md text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="acme-email-input" className="block text-xs text-slate-300 mb-1">
              Email для Let&apos;s Encrypt
            </label>
            <input
              id="acme-email-input"
              type="email"
              value={config.acmeEmail}
              onChange={(e) => onChange((prev) => ({ ...prev, acmeEmail: e.target.value }))}
              placeholder="admin@example.xyz"
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-950 border border-slate-800 focus:border-sky-400 focus:outline-none rounded-md text-slate-100"
            />
          </div>
        </div>
        {validation.errors.acmeEmail && (
          <p className="text-xs text-rose-400">{validation.errors.acmeEmail}</p>
        )}

        <div className="space-y-2.5">
          <label className="flex items-center justify-between gap-3 text-xs text-slate-200 cursor-pointer">
            <span>Автообновление Let&apos;s Encrypt (Cron + acme.sh)</span>
            <input
              type="checkbox"
              checked={config.autoRenewCert}
              onChange={(e) => onChange((prev) => ({ ...prev, autoRenewCert: e.target.checked }))}
              className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-xs text-slate-200 cursor-pointer">
            <span>Запись логов запросов в {baseDir}/logs/</span>
            <input
              type="checkbox"
              checked={config.enableAccessLog}
              onChange={(e) => onChange((prev) => ({ ...prev, enableAccessLog: e.target.checked }))}
              className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
            />
          </label>
        </div>

        {config.enableAccessLog && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label htmlFor="log-format-select" className="block text-xs text-slate-400 mb-1">
                Формат логов
              </label>
              <select
                id="log-format-select"
                value={config.logFormat}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    logFormat: e.target.value as 'json' | 'combined',
                  }))
                }
                className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 focus:border-sky-400 focus:outline-none"
              >
                <option value="json">JSON (структурированный)</option>
                <option value="combined">Combined (стандартный)</option>
              </select>
            </div>
            <div>
              <label htmlFor="log-retention-input" className="block text-xs text-slate-400 mb-1">
                Хранение логов (дней)
              </label>
              <input
                id="log-retention-input"
                type="number"
                min={1}
                max={90}
                value={config.logRetentionDays}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    logRetentionDays: Math.max(1, parseInt(e.target.value, 10) || 14),
                  }))
                }
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-950 border border-slate-800 rounded-md text-slate-200 focus:border-sky-400 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Ключи Reality */}
      <div className="pt-4 border-t border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">Ключи X25519 &amp; ShortId</span>
          <button
            type="button"
            onClick={onRegenerateKeys}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-sky-400 hover:text-sky-300 bg-slate-950 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Обновить ключи</span>
          </button>
        </div>
        <div className="p-2.5 rounded-md bg-slate-950 border border-slate-800 space-y-1 text-xs font-mono">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">ShortId:</span>
            <span className="text-slate-200 truncate">{config.shortId}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">PrivateKey:</span>
            <span className="text-slate-200 truncate">{config.privateKey}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
