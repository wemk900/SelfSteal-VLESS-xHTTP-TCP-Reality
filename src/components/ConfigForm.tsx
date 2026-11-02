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
    <aside className="border border-slate-800 rounded-lg bg-[#13102a] p-5 space-y-6">
      <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Параметры установщика</h2>
        </div>
        <button
          type="button"
          onClick={onResetDefaults}
          className="px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-[#0d0a1a] hover:bg-slate-800 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Сбросить
        </button>
      </div>

      {/* ШАГ 1: Веб-сервер Caddy / Nginx */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-200">01. Веб-сервер SelfSteal</span>
          <span className="font-mono text-slate-400">{baseDir}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0d0a1a] border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => onChange((prev) => ({ ...prev, webServer: 'caddy' }))}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              config.webServer === 'caddy'
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-[#13102a]'
            }`}
          >
            Caddy (/opt/ss-caddy)
          </button>
          <button
            type="button"
            onClick={() => onChange((prev) => ({ ...prev, webServer: 'nginx' }))}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              config.webServer === 'nginx'
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-[#13102a]'
            }`}
          >
            Nginx (/opt/nginx)
          </button>
        </div>
      </div>

      {/* ШАГ 2: Домен */}
      <div className="space-y-1.5">
        <label htmlFor="domain-input" className="block text-xs font-semibold text-slate-200">
          02. Домен для SelfSteal и сертификата
        </label>
        <input
          id="domain-input"
          type="text"
          value={config.domain}
          onChange={(e) => onChange((prev) => ({ ...prev, domain: e.target.value }))}
          onBlur={handleDomainBlur}
          placeholder="poland.example.xyz"
          className="w-full px-3 py-2 text-sm font-mono bg-[#0d0a1a] border border-slate-800 focus:border-sky-400 focus:outline-none rounded-md text-slate-100 placeholder:text-slate-600"
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
          <span className="font-semibold text-slate-200">03. Транспорт VLESS Reality</span>
          <span className="text-slate-400 font-mono">
            {config.transport === 'xhttp' ? 'SplitHTTP / XHTTP' : 'TCP + Vision'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0d0a1a] border border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => onChange((prev) => ({ ...prev, transport: 'xhttp' }))}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              config.transport === 'xhttp'
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-[#13102a]'
            }`}
          >
            VLESS XHTTP Reality
          </button>
          <button
            type="button"
            onClick={() => onChange((prev) => ({ ...prev, transport: 'tcp' }))}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              config.transport === 'tcp'
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-[#13102a]'
            }`}
          >
            VLESS TCP Reality
          </button>
        </div>

        {config.transport === 'xhttp' && (
          <div className="space-y-1.5 pt-1">
            <label htmlFor="xhttp-path-input" className="block text-xs font-semibold text-slate-200">
              Путь (Path) для XHTTP SelfSteal
            </label>
            <input
              id="xhttp-path-input"
              type="text"
              value={config.xhttpPath}
              onChange={(e) => onChange((prev) => ({ ...prev, xhttpPath: e.target.value }))}
              onBlur={handlePathBlur}
              placeholder="/media/v3/chunk/"
              className="w-full px-3 py-2 text-sm font-mono bg-[#0d0a1a] border border-slate-800 focus:border-sky-400 focus:outline-none rounded-md text-slate-100 placeholder:text-slate-600"
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
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="target-input" className="block text-xs font-semibold text-slate-200">
            04. Порт и адрес Target (Dest)
          </label>
          <button
            type="button"
            onClick={() => onChange((prev) => ({ ...prev, target: '127.0.0.1:9443' }))}
            className="text-xs text-sky-400 hover:text-sky-300 font-mono shrink-0 whitespace-nowrap cursor-pointer"
          >
            127.0.0.1:9443
          </button>
        </div>
        <input
          id="target-input"
          type="text"
          value={config.target}
          onChange={(e) => onChange((prev) => ({ ...prev, target: e.target.value }))}
          onBlur={handleTargetBlur}
          placeholder="127.0.0.1:9443"
          className="w-full px-3 py-2 text-sm font-mono bg-[#0d0a1a] border border-slate-800 focus:border-sky-400 focus:outline-none rounded-md text-slate-100 placeholder:text-slate-600"
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
        <div className="flex items-center justify-between gap-2 text-xs">
          <label htmlFor="stub-template-select" className="font-semibold text-slate-200">
            05. Маскировочная HTML-заглушка
          </label>
          <span className="font-mono text-sky-400 shrink-0 whitespace-nowrap">
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
          className="w-full px-3 py-2 text-xs font-mono bg-[#0d0a1a] border border-slate-800 rounded-md text-slate-100 focus:border-sky-400 focus:outline-none"
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

      {/* Ключи Reality (без верхнего заголовка) */}
      <div className="pt-4 border-t border-slate-800 space-y-2.5">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onRegenerateKeys}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-sky-400 hover:text-sky-300 bg-[#0d0a1a] border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Обновить ключи</span>
          </button>
        </div>
        <div className="p-2.5 rounded-md bg-[#0d0a1a] border border-slate-800 space-y-1 text-xs font-mono">
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
