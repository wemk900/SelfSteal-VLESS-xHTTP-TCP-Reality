export type WebServerType = 'caddy' | 'nginx';
export type TransportType = 'xhttp' | 'tcp';
export type LogFormatType = 'json' | 'combined';
export type CamouflageTheme = 'cdn-edge' | 'cloud-storage' | 'corporate-node';

export interface SelfStealConfig {
  webServer: WebServerType;
  domain: string;
  transport: TransportType;
  xhttpPath: string;
  target: string; // e.g. "127.0.0.1:9443"
  xhttpInternalPort: number; // e.g. 8080 for XHTTP internal reverse proxy when needed
  xrayInboundPort: number; // 443
  serverIp: string; // e.g. "185.212.140.42"
  ipv6Address?: string;
  acmeEmail: string;
  autoRenewCert: boolean;
  renewIntervalDays: number;
  enableAccessLog: boolean;
  enableErrorLog: boolean;
  logFormat: LogFormatType;
  logRetentionDays: number;
  camouflageTheme: CamouflageTheme;
  uuid: string;
  privateKey: string;
  publicKey: string;
  shortId: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: {
    domain?: string;
    xhttpPath?: string;
    target?: string;
    acmeEmail?: string;
  };
}

export interface DirectoryFileItem {
  path: string;
  name: string;
  type: 'dir' | 'file';
  category: 'config' | 'ssl' | 'html' | 'logs' | 'scripts';
  description: string;
  content?: string;
}

export interface DnsRecordItem {
  type: 'A' | 'AAAA' | 'CAA';
  name: string;
  value: string;
  ttl: string;
  proxyStatus: string;
  purpose: string;
}

/**
 * Normalizes a user-provided domain or domain+path string.
 * For example, if someone pastes "poland.example.xyz/media/v3/chunk/",
 * extracts domain "poland.example.xyz" and path "/media/v3/chunk/".
 */
export function parseDomainAndPathInput(
  rawDomainInput: string,
  currentPath: string
): { domain: string; extractedPath?: string } {
  const trimmed = rawDomainInput.trim().replace(/^https?:\/\//i, '');
  const slashIndex = trimmed.indexOf('/');
  if (slashIndex !== -1) {
    const domainPart = trimmed.slice(0, slashIndex).trim().toLowerCase();
    const pathPart = normalizeXhttpPath(trimmed.slice(slashIndex));
    return {
      domain: domainPart,
      extractedPath: pathPart || currentPath,
    };
  }
  return {
    domain: trimmed.toLowerCase(),
  };
}

/**
 * Normalizes an XHTTP path Input.
 * Accepts either "/media/v3/chunk/" or "poland.example.xyz/media/v3/chunk/"
 * and returns a clean path starting and ending with "/".
 */
export function normalizeXhttpPath(rawInput: string, domainHint?: string): string {
  let cleaned = rawInput.trim().replace(/^https?:\/\//i, '');
  if (!cleaned) return '/media/v3/chunk/';

  if (domainHint && cleaned.toLowerCase().startsWith(domainHint.toLowerCase())) {
    cleaned = cleaned.slice(domainHint.length);
  } else if (!cleaned.startsWith('/') && cleaned.includes('/')) {
    const firstSlash = cleaned.indexOf('/');
    const maybeHost = cleaned.slice(0, firstSlash);
    if (maybeHost.includes('.')) {
      cleaned = cleaned.slice(firstSlash);
    }
  }

  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }
  if (!cleaned.endsWith('/')) {
    cleaned = cleaned + '/';
  }
  // Collapse accidental double slashes
  cleaned = cleaned.replace(/\/{2,}/g, '/');
  return cleaned;
}

/**
 * Normalizes target host:port (defaults to 127.0.0.1:9443).
 * If user provides only a port number like "9443", converts to "127.0.0.1:9443".
 */
export function normalizeTargetAddress(rawTarget: string): {
  fullTarget: string;
  host: string;
  port: number;
} {
  const trimmed = rawTarget.trim();
  if (!trimmed) {
    return { fullTarget: '127.0.0.1:9443', host: '127.0.0.1', port: 9443 };
  }
  if (/^\d+$/.test(trimmed)) {
    const portNum = parseInt(trimmed, 10);
    const validPort = portNum >= 1 && portNum <= 65535 ? portNum : 9443;
    return { fullTarget: `127.0.0.1:${validPort}`, host: '127.0.0.1', port: validPort };
  }
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon === -1) {
    return { fullTarget: `${trimmed}:9443`, host: trimmed, port: 9443 };
  }
  const host = trimmed.slice(0, lastColon).trim() || '127.0.0.1';
  const portRaw = parseInt(trimmed.slice(lastColon + 1).trim(), 10);
  const port = !Number.isNaN(portRaw) && portRaw >= 1 && portRaw <= 65535 ? portRaw : 9443;
  return {
    fullTarget: `${host}:${port}`,
    host,
    port,
  };
}

export function getBaseDirectory(webServer: WebServerType): string {
  return webServer === 'caddy' ? '/opt/ss-caddy' : '/opt/nginx';
}

export function validateConfig(config: SelfStealConfig): ValidationResult {
  const errors: ValidationResult['errors'] = {};

  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  if (!config.domain.trim()) {
    errors.domain = 'Укажите домен для SelfSteal (например, poland.example.xyz)';
  } else if (!domainRegex.test(config.domain.trim())) {
    errors.domain = 'Некорректный формат домена (используйте поддомен или домен вида poland.example.xyz)';
  }

  if (config.transport === 'xhttp') {
    if (!config.xhttpPath.trim() || !config.xhttpPath.startsWith('/')) {
      errors.xhttpPath = 'Путь XHTTP должен начинаться со слэша / (например, /media/v3/chunk/)';
    }
  }

  const targetMatch = /^([a-zA-Z0-9.-]+|\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/.exec(config.target.trim());
  if (!targetMatch) {
    errors.target = 'Формат target должен быть IP:PORT (по умолчанию 127.0.0.1:9443)';
  } else {
    const portNum = parseInt(targetMatch[2], 10);
    if (portNum < 1 || portNum > 65535) {
      errors.target = 'Порт должен быть в диапазоне от 1 до 65535';
    }
  }

  if (config.autoRenewCert && config.acmeEmail.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(config.acmeEmail.trim())) {
      errors.acmeEmail = 'Введите корректный email для уведомлений Let\'s Encrypt';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Generates deterministic or fresh Reality credentials for preview & config
 */
export function generateRealityCredentials(): {
  uuid: string;
  privateKey: string;
  publicKey: string;
  shortId: string;
} {
  const hexChars = '0123456789abcdef';
  const base64UrlChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  const randHex = (len: number) =>
    Array.from({ length: len }, () => hexChars[Math.floor(Math.random() * hexChars.length)]).join('');

  const randB64 = (len: number) =>
    Array.from({ length: len }, () => base64UrlChars[Math.floor(Math.random() * base64UrlChars.length)]).join('');

  const uuid = `${randHex(8)}-${randHex(4)}-4${randHex(3)}-a${randHex(3)}-${randHex(12)}`;
  const shortId = randHex(16);
  const privateKey = randB64(43);
  const publicKey = randB64(43);

  return { uuid, privateKey, publicKey, shortId };
}

/**
 * Generates the Web Server Config (Caddyfile or nginx.conf) located in /opt/ss-caddy or /opt/nginx
 */
export function generateWebServerConfig(config: SelfStealConfig): string {
  const baseDir = getBaseDirectory(config.webServer);
  const { host, port } = normalizeTargetAddress(config.target);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);

  if (config.webServer === 'caddy') {
    const logBlock = config.enableAccessLog
      ? `  log {
    output file ${baseDir}/logs/access.log {
      roll_size 50MiB
      roll_keep 5
      roll_keep_for ${config.logRetentionDays * 24}h
    }
    format ${config.logFormat === 'json' ? 'json' : 'console'}
    level ${config.enableErrorLog ? 'INFO' : 'ERROR'}
  }`
      : `  # Логирование запросов отключено`;

    const xhttpRouteBlock =
      config.transport === 'xhttp'
        ? `
  # Маршрутизация XHTTP (SplitHTTP) трафика: ${config.domain}${normPath}
  handle ${normPath}* {
    reverse_proxy 127.0.0.1:${config.xhttpInternalPort} {
      transport http {
        versions h2c 1.1
      }
      header_up Host {host}
      header_up X-Forwarded-For {remote_host}
    }
  }`
        : `  # Режим VLESS TCP Reality: прямой SelfSteal fallback с Xray dest -> ${host}:${port}`;

    return `# ============================================================================
# Конфигурация Caddy для VLESS ${config.transport.toUpperCase()} Reality (SelfSteal)
# Путь файла: ${baseDir}/conf/Caddyfile
# Домен: ${config.domain} | Target: ${host}:${port}
# ============================================================================
{
  https_port ${port}
  default_bind ${host}
  auto_https disable_redirects
  storage file_system {
    root ${baseDir}/ssl
  }
  ${config.acmeEmail ? `email ${config.acmeEmail}` : '# ACME без привязки email'}
  log default {
    output file ${baseDir}/logs/error.log
    level WARN
  }
}

https://${config.domain}:${port} {
  bind ${host}

  tls ${baseDir}/ssl/fullchain.pem ${baseDir}/ssl/privkey.pem {
    protocols tls1.2 tls1.3
    alpn h2 http/1.1
  }

${logBlock}
${xhttpRouteBlock}

  # Заголовки безопасности для маскировки под легитимный узел
  header {
    Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "SAMEORIGIN"
    Referrer-Policy "strict-origin-when-cross-origin"
    -Server
  }

  # Маскировочный сайт (SelfSteal HTML)
  handle {
    root * ${baseDir}/html
    try_files {path} {path}/ /index.html
    file_server
  }
}

# HTTP -> HTTPS редирект на 80 порту (используется и для HTTP-01 Let's Encrypt)
http://${config.domain}:80 {
  bind 0.0.0.0
  handle /.well-known/acme-challenge/* {
    root * ${baseDir}/html
    file_server
  }
  handle {
    redir https://${config.domain}{uri} permanent
  }
}
`;
  }

  // NGINX configuration
  const logFormatDirective =
    config.logFormat === 'json'
      ? `    log_format selfsteal_json escape=json
      '{"time_local":"$time_local",'
      '"remote_addr":"$remote_addr",'
      '"request":"$request",'
      '"status": "$status",'
      '"body_bytes_sent":"$body_bytes_sent",'
      '"request_time":"$request_time",'
      '"http_user_agent":"$http_user_agent",'
      '"ssl_protocol":"$ssl_protocol",'
      '"ssl_cipher":"$ssl_cipher"}';`
      : `    log_format selfsteal_combined '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$ssl_protocol/$ssl_cipher"';`;

  const accessLogLine = config.enableAccessLog
    ? `    access_log ${baseDir}/logs/access.log ${config.logFormat === 'json' ? 'selfsteal_json' : 'selfsteal_combined'};`
    : `    access_log off;`;

  const errorLogLine = config.enableErrorLog
    ? `error_log ${baseDir}/logs/error.log warn;`
    : `error_log /dev/null crit;`;

  const xhttpLocationBlock =
    config.transport === 'xhttp'
      ? `
        # Обработка XHTTP (SplitHTTP) чанков: ${config.domain}${normPath}
        location ${normPath} {
            grpc_pass grpc://127.0.0.1:${config.xhttpInternalPort};
            proxy_pass http://127.0.0.1:${config.xhttpInternalPort};
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_buffering off;
            client_max_body_size 0;
        }`
      : `        # Режим VLESS TCP Reality: отдача статики SelfSteal для Xray dest (${host}:${port})`;

  return `# ============================================================================
# Конфигурация Nginx для VLESS ${config.transport.toUpperCase()} Reality (SelfSteal)
# Путь файла: ${baseDir}/conf/nginx.conf
# Домен: ${config.domain} | Target: ${host}:${port}
# ============================================================================
user www-data;
worker_processes auto;
pid /run/nginx.pid;
${errorLogLine}

events {
    worker_connections 2048;
    multi_accept on;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    server_tokens off;

${logFormatDirective}
${accessLogLine}

    # HTTP 80 порт для выпуска/продления сертификатов Let's Encrypt и редиректа
    server {
        listen 80;
        listen [::]:80;
        server_name ${config.domain};

        location ^~ /.well-known/acme-challenge/ {
            root ${baseDir}/html;
            allow all;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # Целевой сервер SelfSteal для Xray Reality dest (${host}:${port})
    server {
        listen ${host}:${port} ssl http2;
        server_name ${config.domain};

        root ${baseDir}/html;
        index index.html;

        # SSL сертификаты Let's Encrypt в директории ${baseDir}/ssl
        ssl_certificate     ${baseDir}/ssl/fullchain.pem;
        ssl_certificate_key ${baseDir}/ssl/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;
        ssl_session_tickets off;

        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
${xhttpLocationBlock}

        location / {
            try_files $uri $uri/ /index.html =404;
        }
    }
}
`;
}

/**
 * Generates Xray streamSettings JSON config for VLESS + XHTTP/TCP + Reality (without UUID/clients wrapper)
 */
export function generateXrayConfig(config: SelfStealConfig): string {
  const { fullTarget } = normalizeTargetAddress(config.target);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);

  if (config.transport === 'xhttp') {
    const xrayObj = {
      streamSettings: {
        network: 'xhttp',
        security: 'reality',
        realitySettings: {
          show: false,
          dest: fullTarget,
          target: fullTarget,
          xver: 0,
          serverNames: [config.domain],
          privateKey: config.privateKey,
          shortIds: [config.shortId],
          spiderX: '/',
        },
        xhttpSettings: {
          path: normPath,
          host: config.domain,
          mode: 'auto',
        },
      },
    };
    return JSON.stringify(xrayObj, null, 2);
  }

  // TCP Reality
  const xrayTcpObj = {
    streamSettings: {
      network: 'tcp',
      security: 'reality',
      realitySettings: {
        show: false,
        dest: fullTarget,
        target: fullTarget,
        xver: 0,
        serverNames: [config.domain],
        privateKey: config.privateKey,
        shortIds: [config.shortId],
        spiderX: '/',
      },
      tcpSettings: {
        acceptProxyProtocol: false,
      },
    },
  };

  return JSON.stringify(xrayTcpObj, null, 2);
}

/**
 * Generates VLESS share link URI for client import (v2rayN / Nekoray / Hiddify / Streisand)
 */
export function generateVlessClientUri(config: SelfStealConfig): string {
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const label = encodeURIComponent(`SelfSteal-${config.transport.toUpperCase()}-${config.domain}`);
  if (config.transport === 'xhttp') {
    return `vless://${config.uuid}@${config.domain}:${config.xrayInboundPort}?encryption=none&security=reality&sni=${config.domain}&fp=chrome&pbk=${config.publicKey}&sid=${config.shortId}&spx=%2F&type=xhttp&host=${config.domain}&path=${encodeURIComponent(normPath)}&mode=auto#${label}`;
  }
  return `vless://${config.uuid}@${config.domain}:${config.xrayInboundPort}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=${config.domain}&fp=chrome&pbk=${config.publicKey}&sid=${config.shortId}&spx=%2F&type=tcp&headerType=none#${label}`;
}

/**
 * Generates required DNS records for the user's domain
 */
export function getDnsRecords(config: SelfStealConfig): DnsRecordItem[] {
  const domainParts = config.domain.split('.');
  const isSubdomain = domainParts.length > 2;
  const hostName = isSubdomain ? domainParts.slice(0, domainParts.length - 2).join('.') : '@';

  const records: DnsRecordItem[] = [
    {
      type: 'A',
      name: hostName,
      value: config.serverIp || 'YOUR_SERVER_IPV4',
      ttl: '300 (Auto)',
      proxyStatus: 'DNS Only (Серое облако / Без проксирования)',
      purpose: `Привязка ${config.domain} напрямую к IP VPS для валидации TLS Reality и выпуска Let's Encrypt`,
    },
    {
      type: 'CAA',
      name: '@',
      value: '0 issue "letsencrypt.org"',
      ttl: '3600',
      proxyStatus: 'DNS Only',
      purpose: 'Разрешает центру сертификации Let\'s Encrypt автоматический выпуск и обновление SSL сертификатов',
    },
  ];

  if (config.ipv6Address && config.ipv6Address.trim()) {
    records.splice(1, 0, {
      type: 'AAAA',
      name: hostName,
      value: config.ipv6Address.trim(),
      ttl: '300 (Auto)',
      proxyStatus: 'DNS Only (Без проксирования)',
      purpose: 'IPv6 маршрутизация до узла SelfSteal',
    });
  }

  return records;
}

/**
 * Generates camouflage HTML file stored in /opt/ss-caddy/html/index.html or /opt/nginx/html/index.html
 */
export function generateCamouflageHtml(config: SelfStealConfig): string {
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${config.domain} — Edge Content Delivery Node</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0b0f17;
      color: #e2e8f0;
      display: flex;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
    }
    .card {
      max-width: 540px;
      width: 90%;
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 10px;
      padding: 32px;
    }
    .meta {
      font-family: monospace;
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 12px;
    }
    h1 { font-size: 20px; margin: 0 0 12px; color: #f8fafc; }
    p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 20px; }
    .grid {
      border-top: 1px solid #1f2937;
      padding-top: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      font-family: monospace;
      font-size: 12px;
    }
    .label { color: #64748b; }
    .val { color: #cbd5e1; margin-top: 4px; }
  </style>
</head>
<body>
  <main class="card">
    <div class="meta">EDGE NODE · ${config.domain.toUpperCase()}</div>
    <h1>Static Media &amp; Object Storage Gateway</h1>
    <p>This edge gateway serves static media segments and encrypted transport streams for authorized origin endpoints.</p>
    <div class="grid">
      <div>
        <div class="label">TLS Profile</div>
        <div class="val">TLS 1.3 / ALPN h2</div>
      </div>
      <div>
        <div class="label">Endpoint Path</div>
        <div class="val">${config.transport === 'xhttp' ? normPath : '/static/v1/'}</div>
      </div>
    </div>
  </main>
</body>
</html>`;
}

/**
 * Generates Let's Encrypt auto-renewal script & cron configuration
 */
export function generateSslRenewalScript(config: SelfStealConfig): string {
  const baseDir = getBaseDirectory(config.webServer);
  const reloadCmd =
    config.webServer === 'caddy'
      ? `systemctl reload caddy || caddy reload --config ${baseDir}/conf/Caddyfile`
      : `nginx -t && systemctl reload nginx`;

  return `#!/usr/bin/env bash
# ============================================================================
# Скрипт автоматического обновления SSL сертификатов Let's Encrypt
# Путь файла: ${baseDir}/ssl/renew-hook.sh
# Cron расписание: 15 3 */${config.renewIntervalDays > 7 ? 1 : config.renewIntervalDays} * *
# ============================================================================
set -euo pipefail

DOMAIN="${config.domain}"
BASE_DIR="${baseDir}"
SSL_DIR="\${BASE_DIR}/ssl"
LOG_FILE="\${BASE_DIR}/logs/ssl-renew.log"

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

echo "[\$(timestamp)] Проверка обновления сертификата Let's Encrypt для \${DOMAIN}..." >> "\${LOG_FILE}"

if command -v ~/.acme.sh/acme.sh >/dev/null 2>&1; then
  ~/.acme.sh/acme.sh --cron --home ~/.acme.sh >> "\${LOG_FILE}" 2>&1
  ~/.acme.sh/acme.sh --install-cert -d "\${DOMAIN}" --ecc \\
    --fullchain-file "\${SSL_DIR}/fullchain.pem" \\
    --key-file "\${SSL_DIR}/privkey.pem" \\
    --reloadcmd "${reloadCmd}" >> "\${LOG_FILE}" 2>&1
elif command -v certbot >/dev/null 2>&1; then
  certbot renew --quiet --deploy-hook "cp -f /etc/letsencrypt/live/\${DOMAIN}/fullchain.pem \${SSL_DIR}/fullchain.pem && cp -f /etc/letsencrypt/live/\${DOMAIN}/privkey.pem \${SSL_DIR}/privkey.pem && chmod 600 \${SSL_DIR}/privkey.pem && ${reloadCmd}" >> "\${LOG_FILE}" 2>&1
fi

chmod 644 "\${SSL_DIR}/fullchain.pem"
chmod 600 "\${SSL_DIR}/privkey.pem"
echo "[\$(timestamp)] Сертификаты в \${SSL_DIR} актуальны, сервис ${config.webServer} перезагружен." >> "\${LOG_FILE}"
`;
}

/**
 * Generates Logrotate config for request logs
 */
export function generateLogrotateConfig(config: SelfStealConfig): string {
  const baseDir = getBaseDirectory(config.webServer);
  const postRotateCmd =
    config.webServer === 'caddy'
      ? 'systemctl reload caddy >/dev/null 2>&1 || true'
      : '[ -f /run/nginx.pid ] && kill -USR1 $(cat /run/nginx.pid) || true';

  return `# Ротация логов запросов SelfSteal (${config.webServer.toUpperCase()})
# Путь: /etc/logrotate.d/selfsteal-${config.webServer}
${baseDir}/logs/*.log {
    daily
    missingok
    rotate ${config.logRetentionDays}
    compress
    delaycompress
    notifempty
    create 0640 root adm
    sharedscripts
    postrotate
        ${postRotateCmd}
    endscript
}
`;
}

/**
 * Generates the /usr/local/bin/selfssteal (and symlink /usr/local/bin/selfsteal) CLI management script
 */
export function generateSelfstealCliScript(config: SelfStealConfig): string {
  const baseDir = getBaseDirectory(config.webServer);
  const { fullTarget } = normalizeTargetAddress(config.target);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const confFile = config.webServer === 'caddy' ? 'Caddyfile' : 'nginx.conf';

  return `#!/usr/bin/env bash
# ==============================================================================
# CLI утилита управления SelfSteal: /usr/local/bin/selfssteal (алиас: selfsteal)
# Команды:
#   selfssteal          — запустить сервис SelfSteal и показать краткую сводку
#   selfssteal status   — статус сервиса, точный Uptime и директории SSL / HTML / Конфигов
#   selfssteal remove   — полное удаление SelfSteal, очистка Cron и директорий
#   selfssteal restart  — перезапуск сервиса (${config.webServer})
#   selfssteal logs     — просмотр логов запросов в реальном времени
# ==============================================================================
set -euo pipefail

WEB_SERVER="${config.webServer}"
BASE_DIR="${baseDir}"
DOMAIN="${config.domain}"
TRANSPORT="${config.transport}"
XHTTP_PATH="${normPath}"
TARGET="${fullTarget}"
CONF_FILE="\${BASE_DIR}/conf/${confFile}"
SSL_DIR="\${BASE_DIR}/ssl"
HTML_DIR="\${BASE_DIR}/html"
LOGS_DIR="\${BASE_DIR}/logs"

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
CYAN='\\033[0;36m'
BOLD='\\033[1m'
NC='\\033[0m'

get_service_uptime() {
  local pid
  pid=\$(systemctl show -p MainPID --value "\${WEB_SERVER}" 2>/dev/null || echo "0")
  if [[ -n "\${pid}" && "\${pid}" != "0" ]] && ps -p "\${pid}" >/dev/null 2>&1; then
    local etime
    etime=\$(ps -o etime= -p "\${pid}" 2>/dev/null | xargs || echo "N/A")
    local since
    since=\$(systemctl show -p ActiveEnterTimestamp --value "\${WEB_SERVER}" 2>/dev/null || echo "")
    echo "\${etime} (с момента запуска: \${since})"
  else
    echo "Остановлен (0s)"
  fi
}

get_ssl_expiry() {
  if [[ -f "\${SSL_DIR}/fullchain.pem" ]]; then
    openssl x509 -enddate -noout -in "\${SSL_DIR}/fullchain.pem" 2>/dev/null | cut -d= -f2 || echo "Сертификат присутствует"
  else
    echo "Файл сертификата не найден"
  fi
}

cmd_start() {
  echo -e "\${CYAN}========================================================================\${NC}"
  echo -e "\${BOLD}   ЗАПУСК SELFSTEAL (\${WEB_SERVER^^} · \${DOMAIN} · \${TARGET})\${NC}"
  echo -e "\${CYAN}========================================================================\${NC}"
  systemctl enable "\${WEB_SERVER}" >/dev/null 2>&1 || true
  systemctl start "\${WEB_SERVER}"
  sleep 0.5
  if systemctl is-active --quiet "\${WEB_SERVER}"; then
    echo -e "   • Состояние:      \${GREEN}ACTIVE (Запущен)\${NC}"
    echo -e "   • Uptime:         \${GREEN}\$(get_service_uptime)\${NC}"
    echo -e "   • Target сокет:   \${CYAN}\${TARGET}\${NC}"
    echo -e "   • Директория SSL: \${CYAN}\${SSL_DIR}\${NC}"
    echo -e "   • Директория HTML:\${CYAN}\${HTML_DIR}\${NC}"
    echo -e "   • Конфигурация:   \${CYAN}\${CONF_FILE}\${NC}"
  else
    echo -e "   • Состояние:      \${RED}ОШИБКА ЗАПУСКА (проверьте journalctl -u \${WEB_SERVER})\${NC}"
    exit 1
  fi
  echo -e "\${CYAN}========================================================================\${NC}"
}

cmd_status() {
  local is_running="false"
  if systemctl is-active --quiet "\${WEB_SERVER}"; then
    is_running="true"
  fi

  echo -e "\${CYAN}========================================================================\${NC}"
  echo -e "\${BOLD}   СТАТУС SELFSTEAL (VLESS \${TRANSPORT^^} REALITY)\${NC}"
  echo -e "\${CYAN}========================================================================\${NC}"
  if [[ "\${is_running}" == "true" ]]; then
    echo -e "   • Статус сервиса:    \${GREEN}● ACTIVE (running) — \${WEB_SERVER^^}\${NC}"
  else
    echo -e "   • Статус сервиса:    \${RED}○ INACTIVE (stopped) — \${WEB_SERVER^^}\${NC}"
  fi
  echo -e "   • Время работы (Uptime): \${GREEN}\$(get_service_uptime)\${NC}"
  echo -e "   • Домен (SNI):       \${CYAN}\${DOMAIN}\${NC}"
  echo -e "   • Протокол / Путь:   \${CYAN}\${TRANSPORT^^}\$( [[ "\${TRANSPORT}" == "xhttp" ]] && echo " (\${DOMAIN}\${XHTTP_PATH})" || echo " (xtls-rprx-vision)" )\${NC}"
  echo -e "   • Target (Dest):     \${GREEN}\${TARGET}\${NC}"
  echo -e "   • Срок действия SSL: \${YELLOW}\$(get_ssl_expiry)\${NC}"
  echo ""
  echo -e "\${BOLD}   ДИРЕКТОРИИ И ФАЙЛЫ (\${BASE_DIR}):\${NC}"
  echo -e "   • Директория SSL:    \${CYAN}\${SSL_DIR}\${NC}"
  echo -e "     ├─ Сертификат:     \${SSL_DIR}/fullchain.pem"
  echo -e "     ├─ Приватный ключ: \${SSL_DIR}/privkey.pem"
  echo -e "     └─ Автообновление: \${SSL_DIR}/renew-hook.sh"
  echo -e "   • Директория HTML:   \${CYAN}\${HTML_DIR}\${NC}"
  echo -e "     └─ Главная стр.:   \${HTML_DIR}/index.html"
  echo -e "   • Конфиг сервера:    \${CYAN}\${CONF_FILE}\${NC}"
  echo -e "   • Директория логов:  \${CYAN}\${LOGS_DIR}\${NC} (access.log, error.log)"
  echo -e "\${CYAN}========================================================================\${NC}"
}

cmd_remove() {
  echo -e "\${YELLOW}========================================================================\${NC}"
  echo -e "\${BOLD}   УДАЛЕНИЕ SELFSTEAL (\${BASE_DIR})\${NC}"
  echo -e "\${YELLOW}========================================================================\${NC}"
  read -r -p "Вы уверены, что хотите остановить SelfSteal и удалить \${BASE_DIR}? [y/N]: " CONFIRM
  if [[ "\${CONFIRM,,}" != "y" ]]; then
    echo -e "\${CYAN}Отмена удаления.\${NC}"
    exit 0
  fi

  echo -e "[1/4] Остановка сервиса \${WEB_SERVER}..."
  systemctl stop "\${WEB_SERVER}" >/dev/null 2>&1 || true

  echo -e "[2/4] Удаление задачи автообновления SSL из Cron и ротации логов..."
  (crontab -l 2>/dev/null | grep -v "renew-hook.sh" || true) | crontab -
  rm -f "/etc/logrotate.d/selfsteal-\${WEB_SERVER}"

  echo -e "[3/4] Удаление рабочей директории \${BASE_DIR} (conf, ssl, html, logs)..."
  rm -rf "\${BASE_DIR}"

  echo -e "[4/4] Удаление CLI команды /usr/local/bin/selfssteal..."
  rm -f /usr/local/bin/selfssteal /usr/local/bin/selfsteal

  echo -e "\${GREEN}✓ SelfSteal полностью удален с сервера.\${NC}"
}

ACTION="\${1:-start}"
case "\${ACTION}" in
  start|"")
    cmd_start
    ;;
  status)
    cmd_status
    ;;
  remove|uninstall|delete)
    cmd_remove
    ;;
  restart|reload)
    systemctl restart "\${WEB_SERVER}"
    echo -e "\${GREEN}✓ Сервис \${WEB_SERVER} перезапущен.\${NC}"
    cmd_status
    ;;
  logs|log)
    tail -n 50 -f "\${LOGS_DIR}/access.log"
    ;;
  *)
    echo -e "\${BOLD}Использование команды selfssteal:\${NC}"
    echo -e "  \${CYAN}selfssteal\${NC}          — запустить SelfSteal"
    echo -e "  \${CYAN}selfssteal status\${NC}   — показать статус, Uptime и директории SSL / HTML / конфигов"
    echo -e "  \${CYAN}selfssteal remove\${NC}   — полностью удалить SelfSteal и директории"
    echo -e "  \${CYAN}selfssteal restart\${NC}  — перезапустить веб-сервер (\${WEB_SERVER})"
    echo -e "  \${CYAN}selfssteal logs\${NC}     — открыть логи запросов в реальном времени"
    ;;
esac
`;
}

/**
 * Generates realistic terminal output for `selfssteal`, `selfssteal status`, and `selfssteal remove`
 */
export function generateCliCommandPreview(
  config: SelfStealConfig,
  command: 'start' | 'status' | 'remove'
): string {
  const baseDir = getBaseDirectory(config.webServer);
  const { fullTarget } = normalizeTargetAddress(config.target);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const confFile = config.webServer === 'caddy' ? 'Caddyfile' : 'nginx.conf';

  if (command === 'start') {
    return `root@vps:~# selfssteal
========================================================================
   ЗАПУСК SELFSTEAL (${config.webServer.toUpperCase()} · ${config.domain} · ${fullTarget})
========================================================================
   • Состояние:      ACTIVE (Запущен)
   • Uptime:         14d 06:42:19 (с момента запуска: Sun 2026-10-18 05:12:00 UTC)
   • Target сокет:   ${fullTarget}
   • Директория SSL: ${baseDir}/ssl
   • Директория HTML:${baseDir}/html
   • Конфигурация:   ${baseDir}/conf/${confFile}
========================================================================`;
  }

  if (command === 'remove') {
    return `root@vps:~# selfssteal remove
========================================================================
   УДАЛЕНИЕ SELFSTEAL (${baseDir})
========================================================================
Вы уверены, что хотите остановить SelfSteal и удалить ${baseDir}? [y/N]: y
[1/4] Остановка сервиса ${config.webServer}...
[2/4] Удаление задачи автообновления SSL из Cron и ротации логов...
[3/4] Удаление рабочей директории ${baseDir} (conf, ssl, html, logs)...
[4/4] Удаление CLI команды /usr/local/bin/selfssteal...
✓ SelfSteal полностью удален с сервера.`;
  }

  return `root@vps:~# selfssteal status
========================================================================
   СТАТУС SELFSTEAL (VLESS ${config.transport.toUpperCase()} REALITY)
========================================================================
   • Статус сервиса:        ● ACTIVE (running) — ${config.webServer.toUpperCase()}
   • Время работы (Uptime): 14d 06:42:19 (с момента запуска: Sun 2026-10-18 05:12:00 UTC)
   • Домен (SNI):           ${config.domain}
   • Протокол / Путь:       ${config.transport.toUpperCase()} ${
    config.transport === 'xhttp' ? `(${config.domain}${normPath})` : '(xtls-rprx-vision)'
  }
   • Target (Dest):         ${fullTarget}
   • Срок действия SSL:     Jan 30 11:54:00 2027 GMT (Let's Encrypt EC-256)

   ДИРЕКТОРИИ И ФАЙЛЫ (${baseDir}):
   • Директория SSL:        ${baseDir}/ssl
     ├─ Сертификат:         ${baseDir}/ssl/fullchain.pem
     ├─ Приватный ключ:     ${baseDir}/ssl/privkey.pem
     └─ Автообновление:     ${baseDir}/ssl/renew-hook.sh
   • Директория HTML:       ${baseDir}/html
     └─ Главная стр.:       ${baseDir}/html/index.html
   • Конфиг сервера:        ${baseDir}/conf/${confFile}
   • Директория логов:      ${baseDir}/logs (access.log, error.log)
========================================================================`;
}

/**
 * Returns structured list of files in /opt/ss-caddy or /opt/nginx
 */
export function getDirectoryStructure(config: SelfStealConfig): DirectoryFileItem[] {
  const baseDir = getBaseDirectory(config.webServer);
  const confFileName = config.webServer === 'caddy' ? 'Caddyfile' : 'nginx.conf';

  return [
    {
      path: `/usr/local/bin/selfssteal`,
      name: `bin/selfssteal`,
      type: 'file',
      category: 'scripts',
      description: `Глобальная CLI команда управления: selfssteal (запуск), selfssteal status (Uptime + пути SSL/HTML), selfssteal remove (удаление)`,
      content: generateSelfstealCliScript(config),
    },
    {
      path: `${baseDir}/conf/${confFileName}`,
      name: `conf/${confFileName}`,
      type: 'file',
      category: 'config',
      description: `Основной конфигурационный файл ${config.webServer === 'caddy' ? 'Caddy' : 'Nginx'} (слушает ${config.target})`,
      content: generateWebServerConfig(config),
    },
    {
      path: `${baseDir}/ssl/fullchain.pem`,
      name: 'ssl/fullchain.pem',
      type: 'file',
      category: 'ssl',
      description: `Публичная цепочка сертификатов Let's Encrypt (ECC EC-256) для ${config.domain}`,
      content: `-----BEGIN CERTIFICATE-----
# Сертификат Let's Encrypt (ECDSA P-256) для домена: ${config.domain}
# Выпускается автоматически при запуске install-selfsteal.sh через acme.sh / certbot
# Путь хранения: ${baseDir}/ssl/fullchain.pem
MIIBvTCCAWOgAwIBAgISA8f9x... (${config.domain})
-----END CERTIFICATE-----`,
    },
    {
      path: `${baseDir}/ssl/privkey.pem`,
      name: 'ssl/privkey.pem',
      type: 'file',
      category: 'ssl',
      description: `Приватный ключ TLS сертификата (права доступа 0600)`,
      content: `-----BEGIN EC PRIVATE KEY-----
# Приватный ключ TLS для ${config.domain} (chmod 600)
# Путь хранения: ${baseDir}/ssl/privkey.pem
MHcCAQEEIN7v9xK2...
-----END EC PRIVATE KEY-----`,
    },
    {
      path: `${baseDir}/ssl/renew-hook.sh`,
      name: 'ssl/renew-hook.sh',
      type: 'file',
      category: 'scripts',
      description: `Скрипт автообновления сертификатов Let's Encrypt и мягкой перезагрузки ${config.webServer}`,
      content: generateSslRenewalScript(config),
    },
    {
      path: `${baseDir}/html/index.html`,
      name: 'html/index.html',
      type: 'file',
      category: 'html',
      description: 'Маскировочная HTML-страница (SelfSteal статика, отдаваемая при проверках DPI/active probing)',
      content: generateCamouflageHtml(config),
    },
    {
      path: `${baseDir}/logs/access.log`,
      name: 'logs/access.log',
      type: 'file',
      category: 'logs',
      description: `Журнал входящих HTTP/HTTPS запросов (формат: ${config.logFormat.toUpperCase()}, ротация: ${config.logRetentionDays} дн.)`,
      content:
        config.logFormat === 'json'
          ? `{"time_local":"01/Nov/2026:11:54:02 +0000","remote_addr":"127.0.0.1","request":"GET ${config.transport === 'xhttp' ? normalizeXhttpPath(config.xhttpPath, config.domain) : '/'} HTTP/2.0","status":"200","body_bytes_sent":"1428","request_time":"0.002","ssl_protocol":"TLSv1.3","ssl_cipher":"TLS_AES_128_GCM_SHA256"}`
          : `127.0.0.1 - - [01/Nov/2026:11:54:02 +0000] "GET ${config.transport === 'xhttp' ? normalizeXhttpPath(config.xhttpPath, config.domain) : '/'} HTTP/2.0" 200 1428 "-" "Mozilla/5.0" "TLSv1.3/TLS_AES_128_GCM_SHA256"`,
    },
    {
      path: `${baseDir}/logs/error.log`,
      name: 'logs/error.log',
      type: 'file',
      category: 'logs',
      description: 'Журнал ошибок веб-сервера и предупреждений рукопожатий TLS',
      content: `2026/11/01 11:50:00 [notice] ${config.webServer} selfsteal worker started on ${config.target} for ${config.domain}`,
    },
    {
      path: `${baseDir}/xray-reality-reference.json`,
      name: 'xray-reality-reference.json',
      type: 'file',
      category: 'config',
      description: 'Сохраненная копия эталонного конфига Xray Inbound + параметров Reality после установки',
      content: generateXrayConfig(config),
    },
  ];
}

/**
 * Generates the complete interactive Bash script (`install-selfsteal.sh`)
 * matching all 4 sequential prompts and all post-install requirements.
 */
export function generateBashInstallScript(config: SelfStealConfig): string {
  const { fullTarget } = normalizeTargetAddress(config.target);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const defaultServerChoice = config.webServer === 'caddy' ? '1' : '2';
  const defaultTransportChoice = config.transport === 'xhttp' ? '1' : '2';

  return `#!/usr/bin/env bash
# ==============================================================================
# SelfSteal Installer for VLESS XHTTP / TCP Reality (Caddy / Nginx)
# Поддержка: Ubuntu 20.04/22.04/24.04, Debian 11/12
# Автообновление Let's Encrypt (acme.sh / certbot) + Логирование запросов
# Директории управления: /opt/ss-caddy или /opt/nginx
# CLI команда управления: selfssteal (start | status | remove | restart | logs)
# ==============================================================================

set -euo pipefail

# Цветовая палитра вывода
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
CYAN='\\033[0;36m'
BLUE='\\033[0;34m'
BOLD='\\033[1m'
NC='\\033[0m'

if [[ "\${EUID}" -ne 0 ]]; then
  echo -e "\${RED}[ОШИБКА] Запустите скрипт с правами root (sudo bash install-selfsteal.sh)\${NC}"
  exit 1
fi

clear
echo -e "\${CYAN}========================================================================\${NC}"
echo -e "\${BOLD}   УСТАНОВЩИК SELFSTEAL ДЛЯ VLESS XHTTP / TCP REALITY (CADDY / NGINX)   \${NC}"
echo -e "\${CYAN}========================================================================\${NC}"
echo ""

# ------------------------------------------------------------------------------
# ШАГ 1: Выбор веб-сервера (Caddy или Nginx)
# ------------------------------------------------------------------------------
echo -e "\${BOLD}1) Выберите веб-сервер для SelfSteal:\${NC}"
echo -e "   [1] Caddy  (директория: /opt/ss-caddy)"
echo -e "   [2] Nginx  (директория: /opt/nginx)"
read -r -p "Ваш выбор [1/2, по умолчанию ${defaultServerChoice} (${config.webServer})]: " SERVER_CHOICE
SERVER_CHOICE="\${SERVER_CHOICE:-${defaultServerChoice}}"

if [[ "\${SERVER_CHOICE}" == "2" ]] || [[ "\${SERVER_CHOICE,,}" == "nginx" ]]; then
  WEB_SERVER="nginx"
  BASE_DIR="/opt/nginx"
else
  WEB_SERVER="caddy"
  BASE_DIR="/opt/ss-caddy"
fi
echo -e "   \${GREEN}-> Выбран веб-сервер: \${WEB_SERVER^^} (\${BASE_DIR})\${NC}"
echo ""

# ------------------------------------------------------------------------------
# ШАГ 2: Запрос домена
# ------------------------------------------------------------------------------
echo -e "\${BOLD}2) Укажите ваш домен для SelfSteal и сертификата Let's Encrypt:\${NC}"
read -r -p "Домен [по умолчанию ${config.domain}]: " RAW_DOMAIN
RAW_DOMAIN="\${RAW_DOMAIN:-${config.domain}}"

# Очистка от http:// или https:// и возможного пути, если ввели вместе с доменом
CLEAN_INPUT="\${RAW_DOMAIN#http://}"
CLEAN_INPUT="\${CLEAN_INPUT#https://}"
EXTRACTED_PATH=""
if [[ "\${CLEAN_INPUT}" == */* ]]; then
  DOMAIN="\${CLEAN_INPUT%%/*}"
  EXTRACTED_PATH="/\${CLEAN_INPUT#*/}"
else
  DOMAIN="\${CLEAN_INPUT}"
fi
echo -e "   \${GREEN}-> Домен: \${DOMAIN}\${NC}"
echo ""

# ------------------------------------------------------------------------------
# ШАГ 3: Выбор транспорта (XHTTP или TCP) и пути для XHTTP
# ------------------------------------------------------------------------------
echo -e "\${BOLD}3) Выберите тип транспорта для VLESS Reality:\${NC}"
echo -e "   [1] XHTTP (SplitHTTP) — с указанием пути чанков"
echo -e "   [2] TCP               — классический VLESS TCP Reality (xtls-rprx-vision)"
read -r -p "Ваш выбор [1/2, по умолчанию ${defaultTransportChoice} (${config.transport})]: " TRANSPORT_CHOICE
TRANSPORT_CHOICE="\${TRANSPORT_CHOICE:-${defaultTransportChoice}}"

XHTTP_PATH="${normPath}"
XHTTP_INTERNAL_PORT="${config.xhttpInternalPort}"

if [[ "\${TRANSPORT_CHOICE}" == "2" ]] || [[ "\${TRANSPORT_CHOICE,,}" == "tcp" ]]; then
  TRANSPORT="tcp"
  echo -e "   \${GREEN}-> Выбран транспорт: TCP Reality\${NC}"
else
  TRANSPORT="xhttp"
  DEFAULT_PATH="\${EXTRACTED_PATH:-${normPath}}"
  echo ""
  echo -e "\${BOLD}   Укажите путь (path) для XHTTP SelfSteal:\${NC}"
  echo -e "   (Можно ввести как \${DOMAIN}/media/v3/chunk/ так и /media/v3/chunk/)"
  read -r -p "Путь XHTTP [по умолчанию \${DOMAIN}\${DEFAULT_PATH}]: " RAW_XHTTP_PATH
  RAW_XHTTP_PATH="\${RAW_XHTTP_PATH:-\${DEFAULT_PATH}}"

  # Нормализация пути (удаляем домен, если пользователь ввел poland.example.xyz/media/v3/chunk/)
  RAW_XHTTP_PATH="\${RAW_XHTTP_PATH#http://}"
  RAW_XHTTP_PATH="\${RAW_XHTTP_PATH#https://}"
  if [[ "\${RAW_XHTTP_PATH}" == "\${DOMAIN}"* ]]; then
    RAW_XHTTP_PATH="\${RAW_XHTTP_PATH#\${DOMAIN}}"
  elif [[ "\${RAW_XHTTP_PATH}" != /* ]] && [[ "\${RAW_XHTTP_PATH}" == */* ]]; then
    RAW_XHTTP_PATH="/\${RAW_XHTTP_PATH#*/}"
  fi
  [[ "\${RAW_XHTTP_PATH}" != /* ]] && RAW_XHTTP_PATH="/\${RAW_XHTTP_PATH}"
  [[ "\${RAW_XHTTP_PATH}" != */ ]] && RAW_XHTTP_PATH="\${RAW_XHTTP_PATH}/"
  XHTTP_PATH="\${RAW_XHTTP_PATH}"
  echo -e "   \${GREEN}-> Выбран транспорт: XHTTP | Полный URL: \${DOMAIN}\${XHTTP_PATH}\${NC}"
fi
echo ""

# ------------------------------------------------------------------------------
# ШАГ 4: Порт и адрес Target (по умолчанию 127.0.0.1:9443)
# ------------------------------------------------------------------------------
echo -e "\${BOLD}4) На каком адресе:порту будет работать Target (SelfSteal)?\${NC}"
read -r -p "Target [по умолчанию ${fullTarget}]: " RAW_TARGET
RAW_TARGET="\${RAW_TARGET:-${fullTarget}}"

if [[ "\${RAW_TARGET}" =~ ^[0-9]+$ ]]; then
  TARGET_HOST="127.0.0.1"
  TARGET_PORT="\${RAW_TARGET}"
  TARGET="127.0.0.1:\${RAW_TARGET}"
elif [[ "\${RAW_TARGET}" == *:* ]]; then
  TARGET_HOST="\${RAW_TARGET%:*}"
  TARGET_PORT="\${RAW_TARGET##*:}"
  TARGET="\${TARGET_HOST}:\${TARGET_PORT}"
else
  TARGET_HOST="\${RAW_TARGET}"
  TARGET_PORT="9443"
  TARGET="\${TARGET_HOST}:9443"
fi
echo -e "   \${GREEN}-> Target установлен: \${TARGET}\${NC}"
echo ""

# ------------------------------------------------------------------------------
# Дополнительные параметры: Let's Encrypt автообновление и логирование запросов
# ------------------------------------------------------------------------------
echo -e "\${BOLD}5) Настройки сертификатов Let's Encrypt и логирования запросов:\${NC}"
read -r -p "Email для уведомлений Let's Encrypt [по умолчанию ${config.acmeEmail}]: " ACME_EMAIL
ACME_EMAIL="\${ACME_EMAIL:-${config.acmeEmail}}"

read -r -p "Включить подробное логирование запросов в \${BASE_DIR}/logs? [Y/n]: " ENABLE_LOGS_CHOICE
ENABLE_LOGS_CHOICE="\${ENABLE_LOGS_CHOICE:-Y}"
if [[ "\${ENABLE_LOGS_CHOICE,,}" == "n" ]]; then
  ENABLE_ACCESS_LOG="false"
else
  ENABLE_ACCESS_LOG="true"
fi
echo ""

# ------------------------------------------------------------------------------
# Создание структуры директорий (/opt/ss-caddy или /opt/nginx)
# ------------------------------------------------------------------------------
echo -e "\${CYAN}[1/6] Создание рабочей иерархии директорий в \${BASE_DIR}...\${NC}"
mkdir -p "\${BASE_DIR}/conf"
mkdir -p "\${BASE_DIR}/html"
mkdir -p "\${BASE_DIR}/ssl"
mkdir -p "\${BASE_DIR}/logs"

# ------------------------------------------------------------------------------
# Установка системных пакетов, dnsutils и веб-сервера
# ------------------------------------------------------------------------------
echo -e "\${CYAN}[2/7] Установка зависимостей (dnsutils, socat, cron, openssl) и веб-сервера (\${WEB_SERVER})...\${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq curl socat cron openssl logrotate dnsutils ca-certificates lsb-release gnupg2

if [[ "\${WEB_SERVER}" == "caddy" ]]; then
  if ! command -v caddy >/dev/null 2>&1; then
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    apt-get update -y -qq
    apt-get install -y -qq caddy
  fi
else
  if ! command -v nginx >/dev/null 2>&1; then
    apt-get install -y -qq nginx
  fi
fi

# ------------------------------------------------------------------------------
# Автоматическая проверка DNS A-записи через 1.1.1.1, 8.8.8.8 и 9.9.9.9
# ------------------------------------------------------------------------------
echo -e "\${CYAN}[3/7] Проверка DNS A-записи домена \${DOMAIN} через 1.1.1.1, 8.8.8.8 и 9.9.9.9...\${NC}"
SERVER_IPV4=\$(curl -4 -fsSL --max-time 5 https://icanhazip.com 2>/dev/null || curl -4 -fsSL --max-time 5 https://ifconfig.me 2>/dev/null || echo "${config.serverIp}")
SERVER_IPV4="\${SERVER_IPV4//[[:space:]]/}"
echo -e "   • Внешний IPv4 этого сервера: \${BOLD}\${SERVER_IPV4}\${NC}"

DNS_MISMATCH=0
for RESOLVER in "1.1.1.1" "8.8.8.8" "9.9.9.9"; do
  RESOLVED_IP=""
  if command -v dig >/dev/null 2>&1; then
    RESOLVED_IP=\$(dig +short +time=2 +tries=1 @"\${RESOLVER}" "\${DOMAIN}" A 2>/dev/null | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' | head -n1 || true)
  elif command -v nslookup >/dev/null 2>&1; then
    RESOLVED_IP=\$(nslookup "\${DOMAIN}" "\${RESOLVER}" 2>/dev/null | awk '/^Address: / { print \$2 }' | tail -n1 || true)
  fi

  if [[ -z "\${RESOLVED_IP}" ]]; then
    echo -e "   • DNS \${RESOLVER}: \${RED}✗ НЕ НАЙДЕНА A-ЗАПИСЬ (NXDOMAIN / Timeout)\${NC} (ожидался \${SERVER_IPV4})"
    DNS_MISMATCH=1
  elif [[ "\${RESOLVED_IP}" == "\${SERVER_IPV4}" ]]; then
    echo -e "   • DNS \${RESOLVER}: \${GREEN}✓ \${RESOLVED_IP} (СОВПАДАЕТ)\${NC}"
  else
    echo -e "   • DNS \${RESOLVER}: \${YELLOW}✗ \${RESOLVED_IP} (НЕ СОВПАДАЕТ, ожидался \${SERVER_IPV4})\${NC}"
    DNS_MISMATCH=1
  fi
done

if [[ "\${DNS_MISMATCH}" -ne 0 ]]; then
  echo ""
  echo -e "\${YELLOW}[ВНИМАНИЕ] IP домена \${DOMAIN} у одного или нескольких DNS (1.1.1.1 / 8.8.8.8 / 9.9.9.9) не совпадает с IP сервера (\${SERVER_IPV4}).\${NC}"
  echo -e "\${YELLOW}Убедитесь, что A-запись указывает на \${SERVER_IPV4} и проксирование Cloudflare (оранжевое облако) отключено (DNS Only).\${NC}"
  read -r -p "Продолжить установку несмотря на несовпадение DNS? [y/N]: " DNS_CONTINUE_CHOICE
  DNS_CONTINUE_CHOICE="\${DNS_CONTINUE_CHOICE:-N}"
  if [[ "\${DNS_CONTINUE_CHOICE,,}" != "y" ]]; then
    echo -e "\${RED}Установка прервана пользователем. Проверьте настройки DNS для \${DOMAIN} и запустите скрипт снова.\${NC}"
    exit 1
  fi
  echo -e "   \${YELLOW}-> Продолжаем установку по подтверждению пользователя...\${NC}"
fi

# ------------------------------------------------------------------------------
# Генерация маскировочного HTML-сайта в /opt/.../html/index.html
# ------------------------------------------------------------------------------
echo -e "\${CYAN}[4/7] Развертывание маскировочного HTML шаблона в \${BASE_DIR}/html...\${NC}"
cat > "\${BASE_DIR}/html/index.html" <<EOF
${generateCamouflageHtml(config)}
EOF

# ------------------------------------------------------------------------------
# Выпуск сертификата Let's Encrypt и настройка автообновления
# ------------------------------------------------------------------------------
echo -e "\${CYAN}[5/7] Выпуск SSL сертификата Let's Encrypt и настройка автообновления...\${NC}"
if [[ ! -f ~/.acme.sh/acme.sh ]]; then
  curl -fsSL https://get.acme.sh | sh -s email="\${ACME_EMAIL}"
fi

systemctl stop caddy >/dev/null 2>&1 || true
systemctl stop nginx >/dev/null 2>&1 || true

~/.acme.sh/acme.sh --set-default-ca --server letsencrypt
~/.acme.sh/acme.sh --issue -d "\${DOMAIN}" --standalone --keylength ec-256 --force || {
  echo -e "\${YELLOW}[ВНИМАНИЕ] Не удалось выпустить боевой сертификат (проверьте A-запись DNS и порт 80). Генерируется временный ECDSA-сертификат для запуска сервиса...\${NC}"
  openssl ecparam -genkey -name prime256v1 -out "\${BASE_DIR}/ssl/privkey.pem"
  openssl req -new -x509 -key "\${BASE_DIR}/ssl/privkey.pem" -out "\${BASE_DIR}/ssl/fullchain.pem" -days 365 -subj "/CN=\${DOMAIN}"
}

if [[ -f ~/.acme.sh/"\${DOMAIN}"_ecc/fullchain.cer ]]; then
  ~/.acme.sh/acme.sh --install-cert -d "\${DOMAIN}" --ecc \\
    --fullchain-file "\${BASE_DIR}/ssl/fullchain.pem" \\
    --key-file "\${BASE_DIR}/ssl/privkey.pem"
fi

chmod 644 "\${BASE_DIR}/ssl/fullchain.pem"
chmod 600 "\${BASE_DIR}/ssl/privkey.pem"

# Создание хука автообновления сертификатов Let's Encrypt
cat > "\${BASE_DIR}/ssl/renew-hook.sh" <<'RENEW_EOF'
${generateSslRenewalScript(config)}
RENEW_EOF
chmod +x "\${BASE_DIR}/ssl/renew-hook.sh"

# Регистрация задания в Cron для регулярной проверки и обновления сертификатов
CRON_JOB="15 3 * * * \${BASE_DIR}/ssl/renew-hook.sh >/dev/null 2>&1"
(crontab -l 2>/dev/null | grep -v "renew-hook.sh" || true; echo "\${CRON_JOB}") | crontab -

# ------------------------------------------------------------------------------
# Запись конфигурации Caddy / Nginx и настройка ротации логов
# ------------------------------------------------------------------------------
echo -e "\${CYAN}[6/7] Формирование конфигураций в \${BASE_DIR}/conf и запуск сервиса...\${NC}"

if [[ "\${WEB_SERVER}" == "caddy" ]]; then
  cat > "\${BASE_DIR}/conf/Caddyfile" <<EOF
{
  https_port \${TARGET_PORT}
  default_bind \${TARGET_HOST}
  auto_https disable_redirects
  storage file_system {
    root \${BASE_DIR}/ssl
  }
  email \${ACME_EMAIL}
  log default {
    output file \${BASE_DIR}/logs/error.log
    level WARN
  }
}

https://\${DOMAIN}:\${TARGET_PORT} {
  bind \${TARGET_HOST}
  tls \${BASE_DIR}/ssl/fullchain.pem \${BASE_DIR}/ssl/privkey.pem {
    protocols tls1.2 tls1.3
    alpn h2 http/1.1
  }
  log {
    output file \${BASE_DIR}/logs/access.log {
      roll_size 50MiB
      roll_keep 5
      roll_keep_for ${config.logRetentionDays * 24}h
    }
    format ${config.logFormat === 'json' ? 'json' : 'console'}
  }
EOF

  if [[ "\${TRANSPORT}" == "xhttp" ]]; then
    cat >> "\${BASE_DIR}/conf/Caddyfile" <<EOF
  handle \${XHTTP_PATH}* {
    reverse_proxy 127.0.0.1:\${XHTTP_INTERNAL_PORT} {
      transport http {
        versions h2c 1.1
      }
      header_up Host {host}
      header_up X-Forwarded-For {remote_host}
    }
  }
EOF
  fi

  cat >> "\${BASE_DIR}/conf/Caddyfile" <<EOF
  handle {
    root * \${BASE_DIR}/html
    try_files {path} {path}/ /index.html
    file_server
  }
}

http://\${DOMAIN}:80 {
  bind 0.0.0.0
  handle /.well-known/acme-challenge/* {
    root * \${BASE_DIR}/html
    file_server
  }
  handle {
    redir https://\${DOMAIN}{uri} permanent
  }
}
EOF

  ln -sf "\${BASE_DIR}/conf/Caddyfile" /etc/caddy/Caddyfile
  systemctl enable caddy
  systemctl restart caddy
else
  # Запись /opt/nginx/conf/nginx.conf
  cat > "\${BASE_DIR}/conf/nginx.conf" <<EOF
${generateWebServerConfig({ ...config, webServer: 'nginx' })}
EOF
  ln -sf "\${BASE_DIR}/conf/nginx.conf" /etc/nginx/nginx.conf
  nginx -t
  systemctl enable nginx
  systemctl restart nginx
fi

# Настройка logrotate для логов запросов
cat > "/etc/logrotate.d/selfsteal-\${WEB_SERVER}" <<EOF
${generateLogrotateConfig(config)}
EOF

# ------------------------------------------------------------------------------
# Установка CLI-утилиты /usr/local/bin/selfssteal (и симлинка selfsteal)
# ------------------------------------------------------------------------------
echo -e "\${CYAN}[7/7] Установка CLI команды selfssteal и подготовка конфига Xray Reality...\${NC}"
cat > /usr/local/bin/selfssteal <<'CLI_EOF'
${generateSelfstealCliScript(config)}
CLI_EOF
chmod +x /usr/local/bin/selfssteal
ln -sf /usr/local/bin/selfssteal /usr/local/bin/selfsteal

SHORT_ID=\$(openssl rand -hex 8 2>/dev/null || echo "${config.shortId}")

if command -v xray >/dev/null 2>&1; then
  X25519_OUT=\$(xray x25519)
  PRIVATE_KEY=\$(echo "\${X25519_OUT}" | awk '/Private key:/ {print \$3}')
  PUBLIC_KEY=\$(echo "\${X25519_OUT}" | awk '/Public key:/ {print \$3}')
else
  PRIVATE_KEY="${config.privateKey}"
  PUBLIC_KEY="${config.publicKey}"
fi

echo ""
echo -e "\${GREEN}========================================================================\${NC}"
echo -e "\${BOLD}   УСТАНОВКА SELFSTEAL УСПЕШНО ЗАВЕРШЕНА! СВОДКА КОНФИГУРАЦИИ           \${NC}"
echo -e "\${GREEN}========================================================================\${NC}"
echo ""
echo -e "\${BOLD}0. УПРАВЛЕНИЕ ЧЕРЕЗ ТЕРМИНАЛ (КОМАНДА SELFSSTEAL):\${NC}"
echo -e "   • Запустить сервис:    \${GREEN}selfssteal\${NC}"
echo -e "   • Статус и Uptime:     \${GREEN}selfssteal status\${NC} (показывает Uptime + пути SSL и HTML)"
echo -e "   • Удалить SelfSteal:   \${RED}selfssteal remove\${NC}"
echo -e "   • Онлайн логи:         \${CYAN}selfssteal logs\${NC}"
echo ""
echo -e "\${BOLD}1. ДИРЕКТОРИИ УПРАВЛЕНИЯ (\${BASE_DIR}):\${NC}"
echo -e "   • Корневая папка:      \${CYAN}\${BASE_DIR}\${NC}"
echo -e "   • Конфиг веб-сервера:  \${CYAN}\${BASE_DIR}/conf/\$( [[ "\${WEB_SERVER}" == "caddy" ]] && echo "Caddyfile" || echo "nginx.conf" )\${NC}"
echo -e "   • Файлы сайта (HTML):  \${CYAN}\${BASE_DIR}/html/index.html\${NC}"
echo -e "   • SSL сертификаты:     \${CYAN}\${BASE_DIR}/ssl/fullchain.pem\${NC}"
echo -e "   • Приватный ключ SSL:  \${CYAN}\${BASE_DIR}/ssl/privkey.pem\${NC}"
echo -e "   • Автообновление SSL:  \${CYAN}\${BASE_DIR}/ssl/renew-hook.sh (Cron: ежедневно в 03:15)\${NC}"
echo -e "   • Логи запросов:       \${CYAN}\${BASE_DIR}/logs/access.log и \${BASE_DIR}/logs/error.log\${NC}"
echo ""
echo -e "\${BOLD}2. НЕОБХОДИМЫЕ ДОМЕННЫЕ ЗАПИСИ (DNS):\${NC}"
echo -e "   • Тип: \${YELLOW}A\${NC}    | Имя: \${YELLOW}\${DOMAIN}\${NC} | Значение: \${GREEN}\${SERVER_IPV4}\${NC} | Proxy: \${RED}DNS Only (БЕЗ облачка Cloudflare)\${NC}"
echo -e "   • Тип: \${YELLOW}CAA\${NC}  | Имя: \${YELLOW}@\${NC}        | Значение: \${GREEN}0 issue \"letsencrypt.org\"\${NC}"
echo ""
echo -e "\${BOLD}3. ПАРАМЕТРЫ REALITY ДЛЯ ПАНЕЛИ (3X-UI / Marzban / Remnawave / Xray):\${NC}"
echo -e "   • Протокол / Сеть:     \${CYAN}VLESS / \${TRANSPORT^^} + Reality\${NC}"
echo -e "   • Target (Dest):       \${GREEN}\${TARGET}\${NC}"
echo -e "   • ServerNames (SNI):   \${GREEN}\${DOMAIN}\${NC}"
if [[ "\${TRANSPORT}" == "xhttp" ]]; then
  echo -e "   • XHTTP Host:          \${GREEN}\${DOMAIN}\${NC}"
  echo -e "   • XHTTP Path:          \${GREEN}\${XHTTP_PATH}\${NC} (полный: \${DOMAIN}\${XHTTP_PATH})"
fi
echo -e "   • Private Key:         \${YELLOW}\${PRIVATE_KEY}\${NC}"
echo -e "   • Public Key (Клиент): \${YELLOW}\${PUBLIC_KEY}\${NC}"
echo -e "   • ShortId:             \${YELLOW}\${SHORT_ID}\${NC}"
echo ""
echo -e "\${BOLD}4. ЧТО ПРОПИСАТЬ В КОНФИГ XRAY (streamSettings):\${NC}"
cat <<XRAY_EOF
${generateXrayConfig(config)}
XRAY_EOF
echo ""
echo -e "\${CYAN}========================================================================\${NC}"
`;
}

/**
 * Generates the realistic post-install terminal output preview for the simulator
 */
export function generateTerminalSummaryOutput(
  config: SelfStealConfig,
  simulateDnsMismatch = false
): string {
  const baseDir = getBaseDirectory(config.webServer);
  const { fullTarget } = normalizeTargetAddress(config.target);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const confFile = config.webServer === 'caddy' ? 'Caddyfile' : 'nginx.conf';

  const dnsCheckOutput = simulateDnsMismatch
    ? `[3/7] Проверка DNS A-записи домена ${config.domain} через 1.1.1.1, 8.8.8.8 и 9.9.9.9...
   • Внешний IPv4 этого сервера: ${config.serverIp}
   • DNS 1.1.1.1: ✓ ${config.serverIp} (СОВПАДАЕТ)
   • DNS 8.8.8.8: ✓ ${config.serverIp} (СОВПАДАЕТ)
   • DNS 9.9.9.9: ✗ 104.21.48.210 (НЕ СОВПАДАЕТ, ожидался ${config.serverIp})

[ВНИМАНИЕ] IP домена ${config.domain} у одного или нескольких DNS (1.1.1.1 / 8.8.8.8 / 9.9.9.9) не совпадает с IP сервера (${config.serverIp}).
Убедитесь, что A-запись указывает на ${config.serverIp} и проксирование Cloudflare (оранжевое облако) отключено (DNS Only).
Продолжить установку несмотря на несовпадение DNS? [y/N]: y
   -> Продолжаем установку по подтверждению пользователя...`
    : `[3/7] Проверка DNS A-записи домена ${config.domain} через 1.1.1.1, 8.8.8.8 и 9.9.9.9...
   • Внешний IPv4 этого сервера: ${config.serverIp}
   • DNS 1.1.1.1: ✓ ${config.serverIp} (СОВПАДАЕТ)
   • DNS 8.8.8.8: ✓ ${config.serverIp} (СОВПАДАЕТ)
   • DNS 9.9.9.9: ✓ ${config.serverIp} (СОВПАДАЕТ)`;

  return `========================================================================
   УСТАНОВЩИК SELFSTEAL ДЛЯ VLESS XHTTP / TCP REALITY (CADDY / NGINX)
========================================================================

1) Выберите веб-сервер для SelfSteal:
   [1] Caddy  (директория: /opt/ss-caddy)
   [2] Nginx  (директория: /opt/nginx)
Ваш выбор: ${config.webServer === 'caddy' ? '1 (Caddy)' : '2 (Nginx)'}
   -> Выбран веб-сервер: ${config.webServer.toUpperCase()} (${baseDir})

2) Укажите ваш домен для SelfSteal и сертификата Let's Encrypt:
Домен: ${config.domain}
   -> Домен: ${config.domain}

3) Выберите тип транспорта для VLESS Reality:
   [1] XHTTP (SplitHTTP) — с указанием пути чанков
   [2] TCP               — классический VLESS TCP Reality (xtls-rprx-vision)
Ваш выбор: ${config.transport === 'xhttp' ? '1 (XHTTP)' : '2 (TCP)'}${
    config.transport === 'xhttp'
      ? `\nУкажите путь (path) для XHTTP SelfSteal:\nПуть XHTTP: ${config.domain}${normPath}\n   -> Выбран транспорт: XHTTP | Полный URL: ${config.domain}${normPath}`
      : `\n   -> Выбран транспорт: TCP Reality`
  }

4) На каком адресе:порту будет работать Target (SelfSteal)?
Target [по умолчанию 127.0.0.1:9443]: ${fullTarget}
   -> Target установлен: ${fullTarget}

[1/7] Создание рабочей иерархии директорий в ${baseDir}... ОК
[2/7] Установка зависимостей (dnsutils, socat, cron, openssl) и ${config.webServer}... ОК
${dnsCheckOutput}
[4/7] Развертывание маскировочного HTML шаблона в ${baseDir}/html... ОК
[5/7] Выпуск SSL сертификата Let's Encrypt и настройка Cron автообновления... ОК
[6/7] Формирование конфигураций в ${baseDir}/conf/${confFile} и запуск... ОК
[7/7] Установка CLI команды /usr/local/bin/selfssteal и подготовка Xray... ОК

========================================================================
   УСТАНОВКА SELFSTEAL УСПЕШНО ЗАВЕРШЕНА! СВОДКА КОНФИГУРАЦИИ
========================================================================

0. КОМАНДЫ УПРАВЛЕНИЯ (CLI УТИЛИТА SELFSSTEAL):
   • selfssteal          — запустить сервис SelfSteal
   • selfssteal status   — статус, сколько Uptime и директории SSL / HTML / конфигов
   • selfssteal remove   — полностью удалить SelfSteal и очистить директории
   • selfssteal logs     — просмотр логов запросов в реальном времени

1. ДИРЕКТОРИИ УПРАВЛЕНИЯ (${baseDir}):
   • Корневая папка:      ${baseDir}
   • Конфиг веб-сервера:  ${baseDir}/conf/${confFile}
   • Файлы сайта (HTML):  ${baseDir}/html/index.html
   • SSL сертификаты:     ${baseDir}/ssl/fullchain.pem
   • Приватный ключ SSL:  ${baseDir}/ssl/privkey.pem
   • Автообновление SSL:  ${baseDir}/ssl/renew-hook.sh (Cron: ежедневно в 03:15)
   • Логи запросов:       ${baseDir}/logs/access.log и ${baseDir}/logs/error.log

2. НЕОБХОДИМЫЕ ДОМЕННЫЕ ЗАПИСИ (DNS):
   • Тип: A    | Имя: ${config.domain} | Значение: ${config.serverIp} | Proxy: DNS Only (БЕЗ Cloudflare Proxy)
   • Тип: CAA  | Имя: @ | Значение: 0 issue "letsencrypt.org"

3. ПАРАМЕТРЫ REALITY ДЛЯ ПАНЕЛИ (3X-UI / Marzban / Remnawave / Xray):
   • Протокол / Сеть:     VLESS / ${config.transport.toUpperCase()} + Reality
   • Target (Dest):       ${fullTarget}
   • ServerNames (SNI):   ${config.domain}${
    config.transport === 'xhttp'
      ? `\n   • XHTTP Host:          ${config.domain}\n   • XHTTP Path:          ${normPath} (${config.domain}${normPath})`
      : ''
  }
   • Private Key:         ${config.privateKey}
   • Public Key (Клиент): ${config.publicKey}
   • ShortId:             ${config.shortId}

4. ЧТО ПРОПИСАТЬ В КОНФИГ XRAY (streamSettings):
${generateXrayConfig(config)}`;
}

/**
 * Generates a customized GitHub README.md based on the current configuration
 */
export function generateGithubReadme(config: SelfStealConfig): string {
  const baseDir = getBaseDirectory(config.webServer);
  const { fullTarget } = normalizeTargetAddress(config.target);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const confFile = config.webServer === 'caddy' ? 'Caddyfile' : 'nginx.conf';

  return `# SelfSteal Bash Architect — VLESS ${config.transport.toUpperCase()} Reality (${
    config.webServer === 'caddy' ? 'Caddy' : 'Nginx'
  })

![OS](https://img.shields.io/badge/OS-Ubuntu%2020.04%2B%20%7C%20Debian%2011%2B-0ea5e9?style=flat-square)
![Transport](https://img.shields.io/badge/VLESS-${config.transport.toUpperCase()}%20Reality-10b981?style=flat-square)
![WebServer](https://img.shields.io/badge/Server-${
    config.webServer === 'caddy' ? 'Caddy' : 'Nginx'
  }-38bdf8?style=flat-square)
![SSL](https://img.shields.io/badge/SSL-Let's%20Encrypt%20EC--256%20Auto--Renew-f59e0b?style=flat-square)

Автоматизированный Bash-скрипт **\`install-selfsteal.sh\`** для развертывания маскировочного узла **SelfSteal** под **VLESS + XHTTP / TCP + Reality** с поддержкой **Caddy** (\`/opt/ss-caddy\`) и **Nginx** (\`/opt/nginx\`), глобальной CLI-командой **\`selfssteal\`**, автоматической проверкой DNS через **\`1.1.1.1\` / \`8.8.8.8\` / \`9.9.9.9\`**, автообновлением сертификатов **Let's Encrypt** и ротацией логов запросов.

---

## Быстрая установка на VPS

\`\`\`bash
nano install-selfsteal.sh && chmod +x install-selfsteal.sh && sudo ./install-selfsteal.sh
\`\`\`

### 4 шага интерактивного опроса + Автоматическая сверка DNS

1. **Веб-сервер**: \`Caddy\` (\`/opt/ss-caddy\`) или \`Nginx\` (\`/opt/nginx\`) — выбран **${config.webServer.toUpperCase()}**.
2. **Домен**: \`${config.domain}\` (используется для SNI и выпуска сертификата Let's Encrypt).
3. **Транспорт**: \`XHTTP\` или \`TCP\` — выбран **${config.transport.toUpperCase()}**${
    config.transport === 'xhttp'
      ? ` с путем чанков \`${config.domain}${normPath}\` (\`${normPath}\`).`
      : ' (`xtls-rprx-vision`).'
  }
4. **Target (Dest)**: локальный адрес и порт — **\`${fullTarget}\`** (по умолчанию \`127.0.0.1:9443\`).

> **Автоматическая проверка DNS при установке**: перед выпуском сертификата скрипт определяет внешний IPv4 сервера и опрашивает публичные резолверы **\`1.1.1.1\`**, **\`8.8.8.8\`** и **\`9.9.9.9\`**. Если IP домена еще не обновился или не совпадает с IP сервера, скрипт выводит предупреждение и спрашивает подтверждение на продолжение установки.

---

## Управление через CLI команду \`selfssteal\`

После установки в систему добавляется глобальная утилита \`/usr/local/bin/selfssteal\` (также доступен алиас \`selfsteal\`):

| Команда | Описание |
| :--- | :--- |
| \`selfssteal\` | Запустить сервис SelfSteal (${config.webServer}) и вывести краткую сводку |
| \`selfssteal status\` | Показать статус работы, **точный Uptime**, срок действия SSL и пути к директориям **SSL / HTML / Конфигов** |
| \`selfssteal remove\` | Полностью остановить и удалить SelfSteal, очистить Cron и директорию \`${baseDir}\` |
| \`selfssteal restart\` | Перезапустить веб-сервер без разрыва соединений |
| \`selfssteal logs\` | Открыть поток логов запросов (\`${baseDir}/logs/access.log\`) в реальном времени |

### Пример вывода \`selfssteal status\`:

\`\`\`text
${generateCliCommandPreview(config, 'status')}
\`\`\`

---

## Архитектура и схема работы

\`\`\`text
Входящее подключение (443/tcp) ──► Xray Core (VLESS + Reality)
                                      │
          ┌───────────────────────────┴───────────────────────────┐
          ▼ Авторизованный клиент                                 ▼ Чужой запрос / Active Probing
   Туннель VLESS ${config.transport.toUpperCase()}                              Target (Dest): ${fullTarget}
   ${
     config.transport === 'xhttp'
       ? `Path: ${normPath}`
       : 'Flow: xtls-rprx-vision'
   }                             ${config.webServer.toUpperCase()} в директории ${baseDir}
                                                           • Сертификат Let's Encrypt (${baseDir}/ssl)
                                                           • Маскировочный HTML (${baseDir}/html)
                                                           • Журнал запросов (${baseDir}/logs)
\`\`\`

---

## Структура директории \`${baseDir}\`

\`\`\`text
${baseDir}/
├── conf/
│   └── ${confFile}                  # Конфигурация ${config.webServer === 'caddy' ? 'Caddy' : 'Nginx'} (слушает ${fullTarget})
├── html/
│   └── index.html                  # Статика маскировочного сайта SelfSteal
├── ssl/
│   ├── fullchain.pem               # Сертификат Let's Encrypt (ECC P-256)
│   ├── privkey.pem                 # Приватный ключ TLS (chmod 600)
│   └── renew-hook.sh               # Скрипт автообновления по Cron (ежедневно в 03:15)
└── logs/
    ├── access.log                  # Логи входящих запросов (${config.logFormat.toUpperCase()}, ротация ${config.logRetentionDays} дн.)
    └── error.log                   # Логи ошибок и предупреждений TLS
\`\`\`

---

## Доменные записи (DNS) для \`${config.domain}\`

| Тип | Имя | Значение | TTL | Режим проксирования |
| :--- | :--- | :--- | :--- | :--- |
| **A** | \`${config.domain}\` | \`${config.serverIp}\` | \`300 (Auto)\` | **DNS Only (Без облачка Cloudflare)** |
| **CAA** | \`@\` | \`0 issue "letsencrypt.org"\` | \`3600\` | **DNS Only** |

---

## Настройки для Xray / 3X-UI / Marzban

- **Target (Dest)**: \`${fullTarget}\`
- **ServerNames (SNI)**: \`${config.domain}\`${
    config.transport === 'xhttp' ? `\n- **XHTTP Path**: \`${normPath}\` (\`${config.domain}${normPath}\`)` : `\n- **Flow**: \`xtls-rprx-vision\``
  }
- **Private Key**: \`${config.privateKey}\`
- **Public Key**: \`${config.publicKey}\`
- **ShortId**: \`${config.shortId}\`

\`\`\`json
${generateXrayConfig(config)}
\`\`\`
`;
}



