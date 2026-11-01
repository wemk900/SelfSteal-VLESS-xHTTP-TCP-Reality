import React, { useState, useEffect } from 'react';
import { Folder, FileText, ShieldCheck, Globe } from 'lucide-react';
import {
  type SelfStealConfig,
  getBaseDirectory,
  getDirectoryStructure,
  getDnsRecords,
} from '../utils/generator';
import { CodeBlock } from './CodeBlock';

interface DirectoryExplorerProps {
  config: SelfStealConfig;
}

export const DirectoryExplorer: React.FC<DirectoryExplorerProps> = ({ config }) => {
  const baseDir = getBaseDirectory(config.webServer);
  const files = getDirectoryStructure(config);
  const dnsRecords = getDnsRecords(config);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  useEffect(() => {
    if (selectedFileIndex >= files.length) {
      setSelectedFileIndex(0);
    }
  }, [files.length, selectedFileIndex]);

  const activeFile = files[selectedFileIndex] || files[0];

  return (
    <div className="space-y-8">
      {/* Директории управления (/opt/ss-caddy или /opt/nginx) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Директория управления конфигурациями: <span className="font-mono text-sky-400">{baseDir}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Все конфигурационные файлы {config.webServer === 'caddy' ? 'Caddy' : 'Nginx'}, SSL сертификаты Let&apos;s Encrypt, статика HTML и логи запросов собраны в единой папке
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            <span>conf/</span>
            <span aria-hidden="true"> · </span>
            <span>ssl/</span>
            <span aria-hidden="true"> · </span>
            <span>html/</span>
            <span aria-hidden="true"> · </span>
            <span>logs/</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Дерево файлов */}
          <div className="lg:col-span-5 border border-slate-800 rounded-lg bg-slate-900/70 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900 flex items-center gap-2">
              <Folder className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="text-xs font-mono font-semibold text-slate-200">{baseDir}/</span>
            </div>
            <div className="divide-y divide-slate-800/70">
              {files.map((item, idx) => {
                const isSelected = idx === selectedFileIndex;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => setSelectedFileIndex(idx)}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/10 text-sky-300'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <FileText
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isSelected ? 'text-sky-400' : 'text-slate-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono font-medium truncate">
                        {item.path}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        {item.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Просмотр выбранного файла */}
          <div className="lg:col-span-7">
            {activeFile && (
              <CodeBlock
                title={activeFile.path}
                subtitle={activeFile.description}
                code={activeFile.content || ''}
                filename={activeFile.name.split('/').pop()}
                maxHeight="max-h-[460px]"
              />
            )}
          </div>
        </div>
      </section>

      {/* Таблица доменных записей DNS */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-400 shrink-0" />
            <h3 className="text-base font-semibold text-slate-100">
              Необходимые доменные записи (DNS) для {config.domain}
            </h3>
          </div>
          <div className="text-xs text-amber-300">
            Важно: проксирование Cloudflare (оранжевое облако) должно быть отключено для работы Reality
          </div>
        </div>

        <div className="border border-slate-800 rounded-lg bg-slate-900/70 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 bg-slate-900">
                <th className="py-3 px-4 font-medium">Тип</th>
                <th className="py-3 px-4 font-medium">Имя (Host)</th>
                <th className="py-3 px-4 font-medium">Значение (Target / IP)</th>
                <th className="py-3 px-4 font-medium">TTL</th>
                <th className="py-3 px-4 font-medium">Режим проксирования</th>
                <th className="py-3 px-4 font-medium">Назначение</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {dnsRecords.map((rec, i) => (
                <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-sky-400 whitespace-nowrap">
                    {rec.type}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-200 whitespace-nowrap">
                    {rec.name}
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-400 whitespace-nowrap">
                    {rec.value}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                    {rec.ttl}
                  </td>
                  <td className="py-3 px-4 text-amber-300 whitespace-nowrap">
                    {rec.proxyStatus}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {rec.purpose}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Памятка по управлению сервисом через CLI selfssteal */}
      <section className="border border-slate-800 rounded-lg bg-slate-900/60 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <h4 className="text-sm font-semibold text-slate-100">
            Управление через глобальную команду <span className="font-mono text-sky-400">selfssteal</span> ({baseDir})
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-md bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-slate-400">Запустить SelfSteal</div>
            <div className="font-mono text-emerald-400 select-all">
              selfssteal
            </div>
          </div>
          <div className="p-3 rounded-md bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-slate-400">Статус, Uptime и директории SSL / HTML</div>
            <div className="font-mono text-sky-400 select-all">
              selfssteal status
            </div>
          </div>
          <div className="p-3 rounded-md bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-slate-400">Полное удаление SelfSteal и директорий</div>
            <div className="font-mono text-rose-400 select-all">
              selfssteal remove
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
