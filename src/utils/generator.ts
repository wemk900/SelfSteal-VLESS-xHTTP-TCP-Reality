import {
  STUB_TEMPLATES,
  getStubTemplateById,
  generateBashTemplatesInstaller,
  type StubTemplateId,
} from './htmlTemplates';

export { STUB_TEMPLATES, getStubTemplateById, type StubTemplateId };
export type WebServerType = 'caddy' | 'nginx';
export type TransportType = 'xhttp' | 'tcp';
export type LogFormatType = 'json' | 'combined';
export type CamouflageTheme = StubTemplateId | 'cdn-edge' | 'cloud-storage' | 'corporate-node';

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
# Конфигурация Nginx (Docker nginx:stable-alpine) для VLESS ${config.transport.toUpperCase()} Reality (SelfSteal)
# Путь файла: ${baseDir}/conf/nginx.conf -> /etc/nginx/nginx.conf
# Домен: ${config.domain} | Target: ${host}:${port}
# ============================================================================
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;
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
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);

  if (config.transport === 'xhttp') {
    const xrayObj = {
      streamSettings: {
        network: 'xhttp',
        security: 'reality',
        realitySettings: {
          show: false,
          serverNames: [config.domain],
          privateKey: config.privateKey,
          publicKey: config.publicKey,
          shortIds: [config.shortId],
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
        serverNames: [config.domain],
        privateKey: config.privateKey,
        publicKey: config.publicKey,
        shortIds: [config.shortId],
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
 * Uses one of the 6 templates from stubs.zip (1-speedtest.html .. 6-gitpage.html)
 */
export function generateCamouflageHtml(config: SelfStealConfig): string {
  const themeId = (
    STUB_TEMPLATES.some((t) => t.id === config.camouflageTheme)
      ? config.camouflageTheme
      : '1-speedtest.html'
  ) as StubTemplateId;
  return getStubTemplateById(themeId).html;
}

/**
 * Generates Docker Compose file (${baseDir}/docker-compose.yml) for Dockerized Caddy or Nginx
 */
export function generateDockerComposeConfig(config: SelfStealConfig): string {
  const baseDir = getBaseDirectory(config.webServer);
  const { fullTarget } = normalizeTargetAddress(config.target);

  if (config.webServer === 'caddy') {
    return `# ============================================================================
# Docker Compose для SelfSteal Caddy (VLESS ${config.transport.toUpperCase()} Reality)
# Путь файла: ${baseDir}/docker-compose.yml
# Контейнер: selfsteal-caddy | Сеть: host (${fullTarget})
# ============================================================================
services:
  caddy:
    image: caddy:2-alpine
    container_name: selfsteal-caddy
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./conf/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./html:${baseDir}/html:ro
      - ./ssl:${baseDir}/ssl
      - ./logs:${baseDir}/logs
`;
  }

  return `# ============================================================================
# Docker Compose для SelfSteal Nginx (VLESS ${config.transport.toUpperCase()} Reality)
# Путь файла: ${baseDir}/docker-compose.yml
# Контейнер: selfsteal-nginx | Сеть: host (${fullTarget})
# ============================================================================
services:
  nginx:
    image: nginx:stable-alpine
    container_name: selfsteal-nginx
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./conf/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./html:${baseDir}/html:ro
      - ./ssl:${baseDir}/ssl:ro
      - ./logs:${baseDir}/logs
`;
}

/**
 * Generates Let's Encrypt auto-renewal script & cron configuration for Dockerized Caddy/Nginx
 */
export function generateSslRenewalScript(config: SelfStealConfig): string {
  const baseDir = getBaseDirectory(config.webServer);
  const containerName = `selfsteal-${config.webServer}`;
  const reloadCmd =
    config.webServer === 'caddy'
      ? `docker exec ${containerName} caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || docker restart ${containerName} >/dev/null 2>&1`
      : `docker exec ${containerName} nginx -s reload >/dev/null 2>&1 || docker restart ${containerName} >/dev/null 2>&1`;

  return `#!/usr/bin/env bash
# ============================================================================
# Скрипт автоматического обновления SSL сертификатов Let's Encrypt (Docker)
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
echo "[\$(timestamp)] Сертификаты в \${SSL_DIR} актуальны, Docker-контейнер ${containerName} перезагружен." >> "\${LOG_FILE}"
`;
}

/**
 * Generates Logrotate config for request logs (Docker container signal)
 */
export function generateLogrotateConfig(config: SelfStealConfig): string {
  const baseDir = getBaseDirectory(config.webServer);
  const containerName = `selfsteal-${config.webServer}`;
  const postRotateCmd =
    config.webServer === 'caddy'
      ? `docker exec ${containerName} caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true`
      : `docker exec ${containerName} nginx -s reopen >/dev/null 2>&1 || true`;

  return `# Ротация логов запросов SelfSteal (Docker ${config.webServer.toUpperCase()})
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
 * Generates the \${BASE_DIR}/selfssteal.sh CLI management script linked via global symlink /usr/local/bin/selfssteal
 */
export function generateSelfstealCliScript(config: SelfStealConfig): string {
  const baseDir = getBaseDirectory(config.webServer);
  const { fullTarget, port } = normalizeTargetAddress(config.target);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const confFile = config.webServer === 'caddy' ? 'Caddyfile' : 'nginx.conf';
  const serverDisplayName = config.webServer === 'caddy' ? 'Caddy' : 'Nginx';
  const dockerImage = config.webServer === 'caddy' ? 'caddy:2-alpine' : 'nginx:stable-alpine';

  return `#!/usr/bin/env bash
# ==============================================================================
# 🔗 Docker ${serverDisplayName} for Reality SelfSteal — Management System v2.6.0
# Author: t.me/wemkz
# Путь скрипта: ${baseDir}/selfssteal.sh
# Глобальный symlink: /usr/local/bin/selfssteal -> ${baseDir}/selfssteal.sh
# Поддерживаемые команды:
#   selfssteal           — 📋 открыть интерактивное меню управления (0-14)
#   selfssteal start     — ▶️ запустить Docker-контейнер SelfSteal
#   selfssteal stop      — ⏹️ остановить Docker-контейнер SelfSteal
#   selfssteal restart   — 🔄 перезапуск Docker-контейнера
#   selfssteal status    — 📊 статус контейнера, Uptime сервера/контейнера, пути к SSL и HTML
#   selfssteal template  — 🎨 выбор или рандомная смена HTML-заглушки (1-6 или Random)
#   selfssteal logs      — 📝 просмотр логов запросов (tail -f)
#   selfssteal remove    — 🗑️ полное удаление контейнера SelfSteal, Cron, директорий и symlink
# ==============================================================================
set -euo pipefail

LANG_CODE="ru"
WEB_SERVER="${config.webServer}"
SERVER_TITLE="${serverDisplayName}"
DOCKER_IMAGE="${dockerImage}"
CONTAINER_NAME="selfsteal-${config.webServer}"
BASE_DIR="${baseDir}"
COMPOSE_FILE="\${BASE_DIR}/docker-compose.yml"
DOMAIN="${config.domain}"
TRANSPORT="${config.transport}"
XHTTP_PATH="${normPath}"
XHTTP_INTERNAL_PORT="${config.xhttpInternalPort}"
TARGET="${fullTarget}"
TARGET_HOST="${fullTarget.split(':')[0]}"
TARGET_PORT="${port}"
ACME_EMAIL="${config.acmeEmail}"
CONF_FILE="\${BASE_DIR}/conf/${confFile}"
SSL_DIR="\${BASE_DIR}/ssl"
HTML_DIR="\${BASE_DIR}/html"
LOGS_DIR="\${BASE_DIR}/logs"

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
MAGENTA='\\033[0;35m'
CYAN='\\033[0;36m'
WHITE='\\033[1;37m'
BOLD='\\033[1m'
NC='\\033[0m'

msg() {
  if [[ "\${LANG_CODE}" == "en" ]]; then
    echo -e "\$1"
  else
    echo -e "\$2"
  fi
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "\${COMPOSE_FILE}" "\$@"
  else
    docker-compose -f "\${COMPOSE_FILE}" "\$@"
  fi
}

get_server_uptime() {
  uptime -p 2>/dev/null | sed 's/^up //' || uptime | awk -F'( |,|:)+' '{print \$6" "\$7", "\$8" hours"}' 2>/dev/null || echo "N/A"
}

get_container_pid() {
  docker inspect -f '{{.State.Pid}}' "\${CONTAINER_NAME}" 2>/dev/null || echo "0"
}

is_container_running() {
  local running
  running=\$(docker inspect -f '{{.State.Running}}' "\${CONTAINER_NAME}" 2>/dev/null || echo "false")
  [[ "\${running}" == "true" ]]
}

get_service_uptime() {
  if is_container_running; then
    local pid started_at etime
    pid=\$(get_container_pid)
    started_at=\$(docker inspect -f '{{.State.StartedAt}}' "\${CONTAINER_NAME}" 2>/dev/null | cut -d. -f1 | sed 's/T/ /' || echo "")
    if [[ -n "\${pid}" && "\${pid}" != "0" ]] && ps -p "\${pid}" >/dev/null 2>&1; then
      etime=\$(ps -o etime= -p "\${pid}" 2>/dev/null | xargs || echo "running")
      if [[ "\${LANG_CODE}" == "en" ]]; then
        echo "\${etime} (started: \${started_at} UTC)"
      else
        echo "\${etime} (запущен: \${started_at} UTC)"
      fi
    else
      if [[ "\${LANG_CODE}" == "en" ]]; then
        echo "Active (started: \${started_at} UTC)"
      else
        echo "Активен (запущен: \${started_at} UTC)"
      fi
    fi
  else
    if [[ "\${LANG_CODE}" == "en" ]]; then
      echo "Stopped (0s)"
    else
      echo "Остановлен (0s)"
    fi
  fi
}

get_ssl_expiry() {
  if [[ -f "\${SSL_DIR}/fullchain.pem" ]]; then
    local end_date
    end_date=\$(openssl x509 -enddate -noout -in "\${SSL_DIR}/fullchain.pem" 2>/dev/null | cut -d= -f2 || echo "")
    if [[ -n "\${end_date}" ]]; then
      local end_epoch now_epoch days_left
      end_epoch=\$(date -d "\${end_date}" +%s 2>/dev/null || echo "0")
      now_epoch=\$(date +%s)
      if [[ "\${end_epoch}" -gt "\${now_epoch}" ]]; then
        days_left=\$(( (end_epoch - now_epoch) / 86400 ))
        echo "✅ Valid, \${days_left} days left (Let's Encrypt)"
        return
      fi
    fi
    echo "✅ Valid (Let's Encrypt)"
  else
    echo "❌ Certificate not found"
  fi
}

get_current_template() {
  if [[ -f "\${HTML_DIR}/.current_template" ]]; then
    cat "\${HTML_DIR}/.current_template"
  else
    echo "1-speedtest.html"
  fi
}

print_header() {
  echo -e "\${WHITE}🔗 Docker \${SERVER_TITLE} for Reality SelfSteal\${NC}"
  echo -e "\${CYAN}Management System v2.6.0 (Docker Compose)\${NC}"
  echo -e "\${BLUE}Project: VLESS \${TRANSPORT^^} Reality | Author: t.me/wemkz\${NC}"
  echo -e "\${BLUE}──────────────────────────────────────────\${NC}"
  echo ""
}

print_top_status() {
  if is_container_running; then
    echo -e "✅ \${GREEN}Status: Running\${NC}"
  else
    echo -e "❌ \${RED}Status: Stopped\${NC}"
  fi
  echo -e "   \${WHITE}Server:\${NC}  \${SERVER_TITLE} (\${DOCKER_IMAGE})"
  echo -e "   \${WHITE}Domain:\${NC}  \${DOMAIN}"
  echo -e "   \${WHITE}Port:\${NC}    \${TARGET_PORT} (\${TARGET})"
  echo -e "   \${WHITE}SSL:\${NC}     \${GREEN}\$(get_ssl_expiry)\${NC}"
}

write_webserver_files() {
  local ws="\$1"
  local bdir="\$2"
  mkdir -p "\${bdir}/conf" "\${bdir}/html/templates" "\${bdir}/ssl" "\${bdir}/logs"
  if [[ "\${ws}" == "caddy" ]]; then
    cat > "\${bdir}/conf/Caddyfile" <<EOF
{
  https_port \${TARGET_PORT}
  default_bind \${TARGET_HOST}
  auto_https disable_redirects
  storage file_system {
    root \${bdir}/ssl
  }
  email \${ACME_EMAIL}
  log default {
    output file \${bdir}/logs/error.log
    level WARN
  }
}

https://\${DOMAIN}:\${TARGET_PORT} {
  bind \${TARGET_HOST}
  tls \${bdir}/ssl/fullchain.pem \${bdir}/ssl/privkey.pem {
    protocols tls1.2 tls1.3
    alpn h2 http/1.1
  }
  log {
    output file \${bdir}/logs/access.log {
      roll_size 50MiB
      roll_keep 5
      roll_keep_for 336h
    }
    format json
  }
EOF
    if [[ "\${TRANSPORT}" == "xhttp" ]]; then
      cat >> "\${bdir}/conf/Caddyfile" <<EOF
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
    cat >> "\${bdir}/conf/Caddyfile" <<EOF
  handle {
    root * \${bdir}/html
    try_files {path} {path}/ /index.html
    file_server
  }
}

http://\${DOMAIN}:80 {
  bind 0.0.0.0
  handle /.well-known/acme-challenge/* {
    root * \${bdir}/html
    file_server
  }
  handle {
    redir https://\${DOMAIN}{uri} permanent
  }
}
EOF
    cat > "\${bdir}/docker-compose.yml" <<EOF
services:
  caddy:
    image: caddy:2-alpine
    container_name: selfsteal-caddy
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./conf/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./html:\${bdir}/html:ro
      - ./ssl:\${bdir}/ssl
      - ./logs:\${bdir}/logs
EOF
  else
    cat > "\${bdir}/conf/nginx.conf" <<EOF
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;
error_log \${bdir}/logs/error.log warn;

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

    access_log \${bdir}/logs/access.log;

    server {
        listen 80;
        listen [::]:80;
        server_name \${DOMAIN};

        location ^~ /.well-known/acme-challenge/ {
            root \${bdir}/html;
            allow all;
        }

        location / {
            return 301 https://\\\$host\\\$request_uri;
        }
    }

    server {
        listen \${TARGET} ssl http2;
        server_name \${DOMAIN};

        root \${bdir}/html;
        index index.html;

        ssl_certificate     \${bdir}/ssl/fullchain.pem;
        ssl_certificate_key \${bdir}/ssl/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
        ssl_prefer_server_ciphers on;
EOF
    if [[ "\${TRANSPORT}" == "xhttp" ]]; then
      cat >> "\${bdir}/conf/nginx.conf" <<EOF

        location \${XHTTP_PATH} {
            grpc_pass grpc://127.0.0.1:\${XHTTP_INTERNAL_PORT};
            proxy_pass http://127.0.0.1:\${XHTTP_INTERNAL_PORT};
            proxy_http_version 1.1;
            proxy_set_header Host \\\$host;
            proxy_set_header X-Real-IP \\\$remote_addr;
            proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
            proxy_buffering off;
            client_max_body_size 0;
        }
EOF
    fi
    cat >> "\${bdir}/conf/nginx.conf" <<EOF

        location / {
            try_files \\\$uri \\\$uri/ /index.html =404;
        }
    }
}
EOF
    cat > "\${bdir}/docker-compose.yml" <<EOF
services:
  nginx:
    image: nginx:stable-alpine
    container_name: selfsteal-nginx
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./conf/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./html:\${bdir}/html:ro
      - ./ssl:\${bdir}/ssl:ro
      - ./logs:\${bdir}/logs
EOF
  fi
}

cmd_reinstall() {
  print_header
  msg "🚀 \${CYAN}Running SelfSteal Installer / Reinstaller...\${NC}" "🚀 \${CYAN}Запуск установки / переустановки SelfSteal...\${NC}"
  bash <(curl -fsSL "https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh")
}

cmd_start() {
  print_header
  msg "\${CYAN}🐳 Starting Docker container \${CONTAINER_NAME} (\${DOCKER_IMAGE} · \${DOMAIN} · \${TARGET})...\${NC}" "\${CYAN}🐳 Запуск Docker-контейнера \${CONTAINER_NAME} (\${DOCKER_IMAGE} · \${DOMAIN} · \${TARGET})...\${NC}"
  compose_cmd up -d
  sleep 0.4
  local pid
  pid=\$(get_container_pid)
  if is_container_running; then
    echo -e "✅ \${GREEN}Status: Running (Container: \${CONTAINER_NAME}, PID: \${pid})\${NC}"
    echo -e "   \${WHITE}Server:\${NC}             Docker \${SERVER_TITLE} (\${DOCKER_IMAGE})"
    echo -e "   \${WHITE}Domain:\${NC}             \${DOMAIN}"
    echo -e "   \${WHITE}Port (Target):\${NC}      \${TARGET}"
    echo -e "   \${WHITE}Uptime сервера:\${NC}     \${GREEN}⏱️  \$(get_server_uptime)\${NC}"
    echo -e "   \${WHITE}Uptime контейнера:\${NC}  \${GREEN}🐳 \$(get_service_uptime)\${NC}"
    echo -e "   \${WHITE}SSL Directory:\${NC}      \${CYAN}🔒 \${SSL_DIR}\${NC}"
    echo -e "   \${WHITE}HTML Directory:\${NC}     \${CYAN}🎨 \${HTML_DIR} (\$(get_current_template))\${NC}"
    echo -e "   \${WHITE}Docker Compose:\${NC}     \${CYAN}🐳 \${COMPOSE_FILE}\${NC}"
    echo -e "   \${WHITE}Config File:\${NC}        \${CYAN}⚙️  \${CONF_FILE}\${NC}"
  else
    msg "❌ \${RED}Status: Failed to start (check docker logs \${CONTAINER_NAME})\${NC}" "❌ \${RED}Status: Ошибка запуска (проверьте docker logs \${CONTAINER_NAME})\${NC}"
    exit 1
  fi
}

cmd_stop() {
  print_header
  msg "⏹️  \${YELLOW}Stopping Docker container \${CONTAINER_NAME}...\${NC}" "⏹️  \${YELLOW}Остановка Docker-контейнера \${CONTAINER_NAME}...\${NC}"
  compose_cmd stop
  msg "✅ \${GREEN}Service stopped.\${NC}" "✅ \${GREEN}Сервис остановлен.\${NC}"
}

cmd_restart() {
  print_header
  msg "🔄 \${CYAN}Restarting Docker container \${CONTAINER_NAME}...\${NC}" "🔄 \${CYAN}Перезапуск Docker-контейнера \${CONTAINER_NAME}...\${NC}"
  compose_cmd restart
  msg "✅ \${GREEN}Service restarted.\${NC}" "✅ \${GREEN}Сервис перезапущен.\${NC}"
  cmd_status
}

cmd_status() {
  print_header
  local pid
  pid=\$(get_container_pid)
  if is_container_running; then
    echo -e "✅ \${GREEN}Status: Running (Container: \${CONTAINER_NAME}, PID: \${pid})\${NC}"
  else
    echo -e "❌ \${RED}Status: Stopped (Container: \${CONTAINER_NAME})\${NC}"
  fi
  echo -e "   \${WHITE}Server:\${NC}             Docker \${SERVER_TITLE} (\${DOCKER_IMAGE})"
  echo -e "   \${WHITE}Domain:\${NC}             \${DOMAIN}"
  echo -e "   \${WHITE}Transport:\${NC}          VLESS \${TRANSPORT^^} Reality \$( [[ "\${TRANSPORT}" == "xhttp" ]] && echo "(\${DOMAIN}\${XHTTP_PATH})" || echo "(xtls-rprx-vision)" )"
  echo -e "   \${WHITE}Port (Target):\${NC}      \${TARGET}"
  echo -e "   \${WHITE}Uptime сервера:\${NC}     \${GREEN}⏱️  \$(get_server_uptime)\${NC}"
  echo -e "   \${WHITE}Uptime контейнера:\${NC}  \${GREEN}🐳 \$(get_service_uptime)\${NC}"
  echo -e "   \${WHITE}SSL:\${NC}                \${GREEN}\$(get_ssl_expiry)\${NC}"
  echo -e "   \${WHITE}Template:\${NC}           \${MAGENTA}🎨 \$(get_current_template)\${NC}"
  echo ""
  msg "📂 \${WHITE}Directories & Paths (\${BASE_DIR}):\${NC}" "📂 \${WHITE}Директории и пути (\${BASE_DIR}):\${NC}"
  echo -e "   ├─ 🔒 \${WHITE}SSL Path:\${NC}        \${CYAN}\${SSL_DIR}\${NC} (fullchain.pem, privkey.pem, renew-hook.sh)"
  echo -e "   ├─ 🎨 \${WHITE}HTML Path:\${NC}       \${CYAN}\${HTML_DIR}\${NC} (index.html + 6 templates in /templates)"
  echo -e "   ├─ 🐳 \${WHITE}Docker Compose:\${NC}  \${CYAN}\${COMPOSE_FILE}\${NC}"
  echo -e "   ├─ ⚙️  \${WHITE}Configuration:\${NC}   \${CYAN}\${CONF_FILE}\${NC}"
  echo -e "   ├─ 📝 \${WHITE}Access Logs:\${NC}     \${CYAN}\${LOGS_DIR}\${NC} (access.log, error.log)"
  echo -e "   └─ 🔗 \${WHITE}Global CLI:\${NC}      \${CYAN}/usr/local/bin/selfssteal -> \${BASE_DIR}/selfssteal.sh\${NC}"
}

cmd_template() {
  print_header
  msg "🎨 \${WHITE}Select HTML template for SelfSteal (\${HTML_DIR}/index.html):\${NC}" "🎨 \${WHITE}Выберите HTML-заглушку для маскировки SelfSteal (\${HTML_DIR}/index.html):\${NC}"
  echo -e "   \${WHITE}1)\${NC} 🚀 \${GREEN}1-speedtest.html\${NC}  — Speedtest / Спидтест с анимированным гейджем"
  echo -e "   \${WHITE}2)\${NC} ☁️  \${GREEN}2-cloud.html\${NC}      — Cloud Storage / Облачное хранилище"
  echo -e "   \${WHITE}3)\${NC} 😂 \${GREEN}3-memes.html\${NC}      — MemeDump / Лента с мемами (тёмная тема)"
  echo -e "   \${WHITE}4)\${NC} ⚠️  \${GREEN}4-overloaded.html\${NC} — 503 Overloaded / «Сервис перегружен» (503)"
  echo -e "   \${WHITE}5)\${NC} 💻 \${GREEN}5-tech.html\${NC}       — Nexora Systems / Технический лендинг"
  echo -e "   \${WHITE}6)\${NC} 🐙 \${GREEN}6-gitpage.html\${NC}    — GitPage / Репозиторий в стиле GitHub"
  echo -e "   \${WHITE}7)\${NC} 🎲 \${CYAN}Random (1-6) / Случайный выбор\${NC}"
  echo ""
  if [[ "\${LANG_CODE}" == "en" ]]; then
    read -r -p "👉 Select template (e.g. 7 for Random): " TPL_CHOICE < /dev/tty
  else
    read -r -p "👉 Выберите шаблон (например: 7 для Random): " TPL_CHOICE < /dev/tty
  fi
  TPL_CHOICE="\${TPL_CHOICE:-7}"
  local files=("1-speedtest.html" "2-cloud.html" "3-memes.html" "4-overloaded.html" "5-tech.html" "6-gitpage.html")
  local chosen=""
  if [[ "\${TPL_CHOICE}" =~ ^[1-6]$ ]]; then
    chosen="\${files[\$((TPL_CHOICE - 1))]}"
  else
    chosen="\${files[\$((RANDOM % 6))]}"
  fi
  if [[ -f "\${HTML_DIR}/templates/\${chosen}" ]]; then
    cp -f "\${HTML_DIR}/templates/\${chosen}" "\${HTML_DIR}/index.html"
    echo "\${chosen}" > "\${HTML_DIR}/.current_template"
    msg "✅ \${GREEN}Active HTML template updated to: \${chosen}\${NC}" "✅ \${GREEN}Активная HTML-заглушка обновлена на: \${chosen}\${NC}"
  else
    msg "⚠️  \${YELLOW}Template \${chosen} not found in \${HTML_DIR}/templates\${NC}" "⚠️  \${YELLOW}Шаблон \${chosen} не найден в \${HTML_DIR}/templates\${NC}"
  fi
}

cmd_change_domain() {
  print_header
  msg "🌐 \${WHITE}Change domain (current: \${DOMAIN})\${NC}" "🌐 \${WHITE}Смена домена (текущий: \${DOMAIN})\${NC}"
  local new_domain
  if [[ "\${LANG_CODE}" == "en" ]]; then
    read -r -p "👉 Domain (e.g. example.com): " new_domain < /dev/tty
  else
    read -r -p "👉 Домен (например: example.com): " new_domain < /dev/tty
  fi
  new_domain="\${new_domain#http://}"
  new_domain="\${new_domain#https://}"
  new_domain="\${new_domain%%/*}"
  if [[ -z "\${new_domain}" ]]; then
    msg "⚠️  \${YELLOW}Domain not entered. Cancelled.\${NC}" "⚠️  \${YELLOW}Домен не введён. Отмена.\${NC}"
    return
  fi

  local old_domain="\${DOMAIN}"
  DOMAIN="\${new_domain}"

  msg "⚙️  \${CYAN}Updating configuration files for \${DOMAIN}...\${NC}" "⚙️  \${CYAN}Обновление конфигурационных файлов для \${DOMAIN}...\${NC}"
  write_webserver_files "\${WEB_SERVER}" "\${BASE_DIR}"

  if [[ -f "\${SSL_DIR}/renew-hook.sh" ]]; then
    sed -i "s|^DOMAIN=.*|DOMAIN=\"\${DOMAIN}\"|" "\${SSL_DIR}/renew-hook.sh"
  fi
  if [[ -f "\${BASE_DIR}/xray-reality-reference.json" ]]; then
    sed -i "s|\${old_domain}|\${DOMAIN}|g" "\${BASE_DIR}/xray-reality-reference.json"
  fi
  sed -i "s|^DOMAIN=.*|DOMAIN=\"\${DOMAIN}\"|" "\${BASE_DIR}/selfssteal.sh"

  msg "🔒 \${CYAN}Issuing Let's Encrypt SSL certificate for \${DOMAIN}...\${NC}" "🔒 \${CYAN}Выпуск SSL сертификата Let's Encrypt для \${DOMAIN}...\${NC}"
  compose_cmd stop || true
  if [[ -f ~/.acme.sh/acme.sh ]]; then
    if ~/.acme.sh/acme.sh --issue -d "\${DOMAIN}" --standalone --keylength ec-256 --force; then
      ~/.acme.sh/acme.sh --install-cert -d "\${DOMAIN}" --ecc \\
        --fullchain-file "\${SSL_DIR}/fullchain.pem" \\
        --key-file "\${SSL_DIR}/privkey.pem"
    else
      openssl ecparam -genkey -name prime256v1 -out "\${SSL_DIR}/privkey.pem"
      openssl req -new -x509 -key "\${SSL_DIR}/privkey.pem" -out "\${SSL_DIR}/fullchain.pem" -days 365 -subj "/CN=\${DOMAIN}"
    fi
  else
    openssl ecparam -genkey -name prime256v1 -out "\${SSL_DIR}/privkey.pem"
    openssl req -new -x509 -key "\${SSL_DIR}/privkey.pem" -out "\${SSL_DIR}/fullchain.pem" -days 365 -subj "/CN=\${DOMAIN}"
  fi
  chmod 644 "\${SSL_DIR}/fullchain.pem"
  chmod 600 "\${SSL_DIR}/privkey.pem"

  compose_cmd up -d
  msg "✅ \${GREEN}Domain changed to \${DOMAIN} and service restarted.\${NC}" "✅ \${GREEN}Домен изменён на \${DOMAIN}, сервис перезапущен.\${NC}"
}

cmd_switch_server() {
  print_header
  local new_ws new_title new_img new_cname new_bdir new_cfile
  if [[ "\${WEB_SERVER}" == "caddy" ]]; then
    new_ws="nginx"
    new_title="Nginx"
    new_img="nginx:stable-alpine"
    new_cname="selfsteal-nginx"
    new_bdir="/opt/nginx"
    new_cfile="\${new_bdir}/conf/nginx.conf"
  else
    new_ws="caddy"
    new_title="Caddy"
    new_img="caddy:2-alpine"
    new_cname="selfsteal-caddy"
    new_bdir="/opt/ss-caddy"
    new_cfile="\${new_bdir}/conf/Caddyfile"
  fi

  msg "🔄 \${CYAN}Switching web server: \${SERVER_TITLE} (\${BASE_DIR}) -> \${new_title} (\${new_bdir})...\${NC}" "🔄 \${CYAN}Переключение веб-сервера: \${SERVER_TITLE} (\${BASE_DIR}) -> \${new_title} (\${new_bdir})...\${NC}"
  compose_cmd down || docker rm -f "\${CONTAINER_NAME}" 2>/dev/null || true

  mkdir -p "\${new_bdir}/conf" "\${new_bdir}/html/templates" "\${new_bdir}/ssl" "\${new_bdir}/logs"
  cp -rf "\${HTML_DIR}/." "\${new_bdir}/html/" 2>/dev/null || true
  cp -rf "\${SSL_DIR}/." "\${new_bdir}/ssl/" 2>/dev/null || true
  if [[ -f "\${BASE_DIR}/xray-reality-reference.json" ]]; then
    cp -f "\${BASE_DIR}/xray-reality-reference.json" "\${new_bdir}/xray-reality-reference.json" 2>/dev/null || true
  fi

  write_webserver_files "\${new_ws}" "\${new_bdir}"

  cp -f "\${BASE_DIR}/selfssteal.sh" "\${new_bdir}/selfssteal.sh"
  sed -i \\
    -e "s|^WEB_SERVER=.*|WEB_SERVER=\"\${new_ws}\"|" \\
    -e "s|^SERVER_TITLE=.*|SERVER_TITLE=\"\${new_title}\"|" \\
    -e "s|^DOCKER_IMAGE=.*|DOCKER_IMAGE=\"\${new_img}\"|" \\
    -e "s|^CONTAINER_NAME=.*|CONTAINER_NAME=\"\${new_cname}\"|" \\
    -e "s|^BASE_DIR=.*|BASE_DIR=\"\${new_bdir}\"|" \\
    -e "s|^CONF_FILE=.*|CONF_FILE=\"\${new_cfile}\"|" \\
    "\${new_bdir}/selfssteal.sh"
  chmod +x "\${new_bdir}/selfssteal.sh"
  ln -sf "\${new_bdir}/selfssteal.sh" /usr/local/bin/selfssteal
  ln -sf "\${new_bdir}/selfssteal.sh" /usr/local/bin/selfsteal

  WEB_SERVER="\${new_ws}"
  SERVER_TITLE="\${new_title}"
  DOCKER_IMAGE="\${new_img}"
  CONTAINER_NAME="\${new_cname}"
  BASE_DIR="\${new_bdir}"
  COMPOSE_FILE="\${BASE_DIR}/docker-compose.yml"
  CONF_FILE="\${new_cfile}"
  SSL_DIR="\${BASE_DIR}/ssl"
  HTML_DIR="\${BASE_DIR}/html"
  LOGS_DIR="\${BASE_DIR}/logs"

  compose_cmd up -d
  msg "✅ \${GREEN}Switched to Docker \${SERVER_TITLE} (\${DOCKER_IMAGE}) in \${BASE_DIR}!\${NC}" "✅ \${GREEN}Успешно переключено на Docker \${SERVER_TITLE} (\${DOCKER_IMAGE}) в \${BASE_DIR}!\${NC}"
}

cmd_logs() {
  print_header
  msg "📝 \${CYAN}Streaming logs (Ctrl+C to exit)...\${NC}" "📝 \${CYAN}Просмотр логов в реальном времени (Ctrl+C для выхода)...\${NC}"
  touch "\${LOGS_DIR}/access.log" "\${LOGS_DIR}/error.log"
  tail -n 50 -f "\${LOGS_DIR}/access.log" "\${LOGS_DIR}/error.log"
}

cmd_log_sizes() {
  print_header
  msg "📊 \${WHITE}Log directory usage (\${LOGS_DIR}):\${NC}" "📊 \${WHITE}Размер логов в директории (\${LOGS_DIR}):\${NC}"
  du -sh "\${LOGS_DIR}" 2>/dev/null || true
  echo ""
  for lf in "\${LOGS_DIR}/access.log" "\${LOGS_DIR}/error.log"; do
    if [[ -f "\${lf}" ]]; then
      local sz lines
      sz=\$(du -h "\${lf}" | awk '{print \$1}')
      lines=\$(wc -l < "\${lf}" || echo "0")
      echo -e "   • \${CYAN}\$(basename "\${lf}")\${NC}: \${GREEN}\${sz}\${NC} (\${lines} lines)"
    else
      echo -e "   • \${CYAN}\$(basename "\${lf}")\${NC}: 0B (0 lines)"
    fi
  done
}

cmd_clean_logs() {
  print_header
  truncate -s 0 "\${LOGS_DIR}/access.log" "\${LOGS_DIR}/error.log" 2>/dev/null || true
  msg "🧹 \${GREEN}Logs cleaned (access.log & error.log truncated to 0B).\${NC}" "🧹 \${GREEN}Логи очищены (access.log и error.log обнулены).\${NC}"
}

cmd_renew_ssl() {
  print_header
  msg "🔒 \${CYAN}Renewing SSL certificate for \${DOMAIN}...\${NC}" "🔒 \${CYAN}Обновление SSL сертификата для \${DOMAIN}...\${NC}"
  if [[ -x "\${SSL_DIR}/renew-hook.sh" ]]; then
    "\${SSL_DIR}/renew-hook.sh"
  elif [[ -f ~/.acme.sh/acme.sh ]]; then
    ~/.acme.sh/acme.sh --renew -d "\${DOMAIN}" --ecc --force || true
    ~/.acme.sh/acme.sh --install-cert -d "\${DOMAIN}" --ecc \\
      --fullchain-file "\${SSL_DIR}/fullchain.pem" \\
      --key-file "\${SSL_DIR}/privkey.pem"
    compose_cmd restart
  fi
  msg "✅ \${GREEN}SSL status: \$(get_ssl_expiry)\${NC}" "✅ \${GREEN}Статус SSL: \$(get_ssl_expiry)\${NC}"
}

cmd_edit_config() {
  print_header
  msg "✏️  \${CYAN}Opening \${CONF_FILE}...\${NC}" "✏️  \${CYAN}Открытие конфигурации \${CONF_FILE}...\${NC}"
  if command -v nano >/dev/null 2>&1; then
    nano "\${CONF_FILE}" < /dev/tty > /dev/tty
  else
    \${EDITOR:-vi} "\${CONF_FILE}" < /dev/tty > /dev/tty
  fi
  msg "🔄 \${CYAN}Restarting container to apply changes...\${NC}" "🔄 \${CYAN}Перезапуск контейнера для применения изменений...\${NC}"
  compose_cmd restart
  msg "✅ \${GREEN}Configuration applied.\${NC}" "✅ \${GREEN}Конфигурация применена.\${NC}"
}

cmd_remove() {
  print_header
  msg "🗑️  \${RED}\${BOLD}UNINSTALL DOCKER SELFSTEAL (\${BASE_DIR})\${NC}" "🗑️  \${RED}\${BOLD}УДАЛЕНИЕ DOCKER SELFSTEAL (\${BASE_DIR})\${NC}"
  if [[ "\${LANG_CODE}" == "en" ]]; then
    read -r -p "Are you sure you want to remove container \${CONTAINER_NAME} and directory \${BASE_DIR}? (y/N): " CONFIRM < /dev/tty
  else
    read -r -p "Вы уверены, что хотите удалить контейнер \${CONTAINER_NAME} и директорию \${BASE_DIR}? (y/N): " CONFIRM < /dev/tty
  fi
  if [[ "\${CONFIRM,,}" != "y" ]]; then
    msg "ℹ️  \${CYAN}Uninstall cancelled.\${NC}" "ℹ️  \${CYAN}Отмена удаления.\${NC}"
    exit 0
  fi

  msg "⏹️  [1/4] Stopping and removing Docker container \${CONTAINER_NAME}..." "⏹️  [1/4] Остановка и удаление Docker-контейнера \${CONTAINER_NAME}..."
  compose_cmd down || docker rm -f "\${CONTAINER_NAME}" 2>/dev/null || true

  msg "🧹 [2/4] Removing SSL cron job and logrotate config..." "🧹 [2/4] Удаление задачи автообновления SSL из Cron и ротации логов..."
  (crontab -l 2>/dev/null | grep -v "renew-hook.sh" || true) | crontab -
  rm -f "/etc/logrotate.d/selfsteal-\${WEB_SERVER}"

  msg "🗑️  [3/4] Removing directory \${BASE_DIR}..." "🗑️  [3/4] Удаление рабочей директории \${BASE_DIR}..."
  rm -rf "\${BASE_DIR}"

  msg "🔗 [4/4] Removing global symlink /usr/local/bin/selfssteal..." "🔗 [4/4] Удаление глобального symlink /usr/local/bin/selfssteal..."
  rm -f /usr/local/bin/selfssteal /usr/local/bin/selfsteal

  msg "✅ \${GREEN}SelfSteal completely uninstalled.\${NC}" "✅ \${GREEN}SelfSteal полностью удален с сервера.\${NC}"
}

cmd_menu() {
  clear 2>/dev/null || true
  print_header
  print_top_status
  echo ""
  echo -e "\${WHITE}Service Management:\${NC}"
  echo -e "   \${WHITE}1)\${NC} \${GREEN}Install / Reinstall\${NC}"
  echo -e "   \${WHITE}2)\${NC} \${GREEN}Start service\${NC}"
  echo -e "   \${WHITE}3)\${NC} \${GREEN}Stop service\${NC}"
  echo -e "   \${WHITE}4)\${NC} \${GREEN}Restart service\${NC}"
  echo -e "   \${WHITE}5)\${NC} \${GREEN}Service status\${NC}"
  echo ""
  echo -e "\${WHITE}Website Management:\${NC}"
  echo -e "   \${WHITE}6)\${NC} \${GREEN}Change HTML template (1-6 или Random)\${NC}"
  echo -e "   \${WHITE}7)\${NC} \${GREEN}Change domain\${NC}"
  echo -e "   \${WHITE}8)\${NC} \${GREEN}Switch web server (Caddy ↔ Nginx)\${NC}"
  echo ""
  echo -e "\${WHITE}Logs & Monitoring:\${NC}"
  echo -e "   \${WHITE}9)\${NC}  \${GREEN}View logs (tail -f)\${NC}"
  echo -e "   \${WHITE}10)\${NC} \${GREEN}Log sizes\${NC}"
  echo -e "   \${WHITE}11)\${NC} \${GREEN}Clean logs\${NC}"
  echo ""
  echo -e "\${WHITE}SSL:\${NC}"
  echo -e "   \${WHITE}12)\${NC} \${GREEN}Renew SSL certificate\${NC}"
  echo -e "   \${WHITE}13)\${NC} \${GREEN}Edit web server config\${NC}"
  echo ""
  echo -e "\${WHITE}Maintenance:\${NC}"
  echo -e "   \${WHITE}14)\${NC} \${RED}Uninstall SelfSteal\${NC}"
  echo ""
  echo -e "   \${WHITE}0)\${NC} \${GREEN}Exit\${NC}"
  echo ""
  read -r -p "Select option [0-14]: " MENU_OPT < /dev/tty
  case "\${MENU_OPT}" in
    1) cmd_reinstall ;;
    2) cmd_start ;;
    3) cmd_stop ;;
    4) cmd_restart ;;
    5) cmd_status ;;
    6) cmd_template ;;
    7) cmd_change_domain ;;
    8) cmd_switch_server ;;
    9) cmd_logs ;;
    10) cmd_log_sizes ;;
    11) cmd_clean_logs ;;
    12) cmd_renew_ssl ;;
    13) cmd_edit_config ;;
    14) cmd_remove ;;
    0|"") exit 0 ;;
    *) msg "⚠️  \${YELLOW}Invalid option: \${MENU_OPT}\${NC}" "⚠️  \${YELLOW}Неверный пункт меню: \${MENU_OPT}\${NC}" ;;
  esac
}

ACTION="\${1:-menu}"
case "\${ACTION}" in
  menu|"")
    cmd_menu
    ;;
  start)
    cmd_start
    ;;
  stop)
    cmd_stop
    ;;
  restart|reload)
    cmd_restart
    ;;
  status)
    cmd_status
    ;;
  template|templates|stub)
    cmd_template
    ;;
  domain)
    cmd_change_domain
    ;;
  switch)
    cmd_switch_server
    ;;
  logs|log)
    cmd_logs
    ;;
  remove|uninstall|delete)
    cmd_remove
    ;;
  *)
    print_header
    echo -e "\${BOLD}Usage / Использование: selfssteal {menu|start|stop|restart|status|template|domain|switch|logs|remove}\${NC}"
    ;;
esac
`;
}

/**
 * Generates realistic terminal output for `selfssteal start`, `selfssteal status`, and `selfssteal remove`
 */
export function generateCliCommandPreview(
  config: SelfStealConfig,
  command: 'start' | 'status' | 'remove'
): string {
  const baseDir = getBaseDirectory(config.webServer);
  const { fullTarget, port } = normalizeTargetAddress(config.target);
  const confFile = config.webServer === 'caddy' ? 'Caddyfile' : 'nginx.conf';
  const serverDisplayName = config.webServer === 'caddy' ? 'Caddy' : 'Nginx';
  const dockerImage = config.webServer === 'caddy' ? 'caddy:2-alpine' : 'nginx:stable-alpine';
  const containerName = `selfsteal-${config.webServer}`;
  const tpl = getStubTemplateById(
    (STUB_TEMPLATES.some((t) => t.id === config.camouflageTheme)
      ? config.camouflageTheme
      : 'random') as StubTemplateId
  );

  if (command === 'start') {
    return `root@vps:~# selfssteal start
🔗 Docker ${serverDisplayName} for Reality SelfSteal
Management System v2.6.0 (Docker Compose)
Project: VLESS ${config.transport.toUpperCase()} Reality | Author: t.me/wemkz
──────────────────────────────────────────

🐳 Запуск Docker-контейнера ${containerName} (${dockerImage} · ${config.domain} · ${fullTarget})...
✅ Status: Running (Container: ${containerName}, PID: 2418)
   Server:             Docker ${serverDisplayName} (${dockerImage})
   Domain:             ${config.domain}
   Port (Target):      ${fullTarget}
   Uptime сервера:     ⏱️  42 days, 11 hours, 28 minutes
   Uptime контейнера:  🐳 14d 06:42:19 (запущен: 2026-10-18 05:12:00 UTC)
   SSL Directory:      🔒 ${baseDir}/ssl
   HTML Directory:     🎨 ${baseDir}/html (${tpl.emoji} ${tpl.id})
   Docker Compose:     🐳 ${baseDir}/docker-compose.yml
   Config File:        ⚙️  ${baseDir}/conf/${confFile}`;
  }

  if (command === 'remove') {
    return `root@vps:~# selfssteal remove
🔗 Docker ${serverDisplayName} for Reality SelfSteal
Management System v2.6.0 (Docker Compose)
Project: VLESS ${config.transport.toUpperCase()} Reality | Author: t.me/wemkz
──────────────────────────────────────────

🗑️  УДАЛЕНИЕ DOCKER SELFSTEAL (${baseDir})
Вы уверены, что хотите удалить контейнер ${containerName} и директорию ${baseDir}? (y/N): y
⏹️  [1/4] Остановка и удаление Docker-контейнера ${containerName}...
🧹 [2/4] Удаление задачи автообновления SSL из Cron и ротации логов...
🗑️  [3/4] Удаление рабочей директории ${baseDir}...
🔗 [4/4] Удаление глобального symlink /usr/local/bin/selfssteal...
✅ SelfSteal полностью удален с сервера.`;
  }

  return `root@vps:~# selfssteal
🔗 Docker ${serverDisplayName} for Reality SelfSteal
Management System v2.6.0 (Docker Compose)
Project: VLESS ${config.transport.toUpperCase()} Reality | Author: t.me/wemkz
──────────────────────────────────────────

✅ Status: Running
   Server:  ${serverDisplayName} (${dockerImage})
   Domain:  ${config.domain}
   Port:    ${port} (${fullTarget})
   SSL:     ✅ Valid, 73 days left (Let's Encrypt)

Service Management:
   1) Install / Reinstall
   2) Start service
   3) Stop service
   4) Restart service
   5) Service status

Website Management:
   6) Change HTML template (1-6 или Random)
   7) Change domain
   8) Switch web server (Caddy ↔ Nginx)

Logs & Monitoring:
   9)  View logs (tail -f)
   10) Log sizes
   11) Clean logs

SSL:
   12) Renew SSL certificate
   13) Edit web server config

Maintenance:
   14) Uninstall SelfSteal

   0) Exit

Select option [0-14]: `;
}

/**
 * Returns structured list of files in /opt/ss-caddy or /opt/nginx
 */
export function getDirectoryStructure(config: SelfStealConfig): DirectoryFileItem[] {
  const baseDir = getBaseDirectory(config.webServer);
  const confFileName = config.webServer === 'caddy' ? 'Caddyfile' : 'nginx.conf';
  const activeStub = getStubTemplateById(
    (STUB_TEMPLATES.some((t) => t.id === config.camouflageTheme)
      ? config.camouflageTheme
      : 'random') as StubTemplateId
  );

  const templateFiles: DirectoryFileItem[] = STUB_TEMPLATES.map((tpl) => ({
    path: `${baseDir}/html/templates/${tpl.id}`,
    name: `html/templates/${tpl.id}`,
    type: 'file',
    category: 'html',
    description: `${tpl.emoji} Шаблон #${tpl.index}: ${tpl.description}`,
    content: tpl.html,
  }));

  return [
    {
      path: `/usr/local/bin/selfssteal`,
      name: `symlink /usr/local/bin/selfssteal -> ${baseDir}/selfssteal.sh`,
      type: 'file',
      category: 'scripts',
      description: `Глобальный symlink на ${baseDir}/selfssteal.sh (Author: t.me/wemkz): управление Docker-контейнером (start, status, template, remove)`,
      content: generateSelfstealCliScript(config),
    },
    {
      path: `${baseDir}/docker-compose.yml`,
      name: 'docker-compose.yml',
      type: 'file',
      category: 'config',
      description: `Docker Compose манифест для контейнера selfsteal-${config.webServer} (network_mode: host, монтирование conf, html, ssl, logs)`,
      content: generateDockerComposeConfig(config),
    },
    {
      path: `${baseDir}/conf/${confFileName}`,
      name: `conf/${confFileName}`,
      type: 'file',
      category: 'config',
      description: `Основной конфигурационный файл Docker ${config.webServer === 'caddy' ? 'Caddy' : 'Nginx'} (слушает ${config.target})`,
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
# Выпускается автоматически в скрытом режиме при запуске install-selfsteal.sh
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
      description: `Скрипт автообновления сертификатов Let's Encrypt и мягкой перезагрузки Docker-контейнера selfsteal-${config.webServer}`,
      content: generateSslRenewalScript(config),
    },
    {
      path: `${baseDir}/html/index.html`,
      name: `html/index.html (${activeStub.emoji} ${activeStub.id})`,
      type: 'file',
      category: 'html',
      description: `Активная HTML-заглушка (выбирается случайно при установке из 6 шаблонов или вручную: сейчас ${activeStub.emoji} ${activeStub.id} — ${activeStub.description})`,
      content: generateCamouflageHtml(config),
    },
    ...templateFiles,
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
      content: `2026/11/01 11:50:00 [notice] selfsteal-${config.webServer} container worker started on ${config.target} for ${config.domain}`,
    },
    {
      path: `${baseDir}/xray-reality-reference.json`,
      name: 'xray-reality-reference.json',
      type: 'file',
      category: 'config',
      description: 'Сохраненная копия блока streamSettings для Xray Reality после установки',
      content: generateXrayConfig(config),
    },
  ];
}

/**
 * Generates the complete interactive Bash script (`install-selfsteal.sh`)
 * with Dockerized Caddy/Nginx, auto-installation of Docker if missing,
 * and hidden/silent output for component installation and SSL certificate acquisition.
 */
export function generateBashInstallScript(config: SelfStealConfig): string {
  const { fullTarget } = normalizeTargetAddress(config.target);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const defaultServerChoice = config.webServer === 'caddy' ? '1' : '2';
  const defaultTransportChoice = config.transport === 'xhttp' ? '1' : '2';
  const stubId: StubTemplateId = STUB_TEMPLATES.some((t) => t.id === config.camouflageTheme)
    ? (config.camouflageTheme as StubTemplateId)
    : 'random';

  return `#!/usr/bin/env bash
# ==============================================================================
# 🔗 Docker SelfSteal Management System v2.6.0 — VLESS XHTTP / TCP Reality (Caddy / Nginx)
# 👨‍💻 Author: t.me/wemkz
# 🚀 Запуск одной командой (без ручного скачивания):
#   bash <(curl -fsSL "https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh")
#   или:
#   curl -fsSL "https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh" | bash
# 🌍 Языки интерфейса: 1) English | 2) Русский
# 🐳 Docker-режим: Caddy (caddy:2-alpine) или Nginx (nginx:stable-alpine) через Docker Compose
# 🎲 Автоматический рандомный выбор HTML-заглушки из 6 шаблонов (1-speedtest .. 6-gitpage)
# 🌐 Автопроверка DNS A-записи через 1.1.1.1, 8.8.8.8, 9.9.9.9
# 📂 Директории управления: /opt/ss-caddy или /opt/nginx
# 🛠️ CLI меню управления (0-14): selfssteal
# ==============================================================================

set -euo pipefail

# Цветовая палитра вывода
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
MAGENTA='\\033[0;35m'
CYAN='\\033[0;36m'
WHITE='\\033[1;37m'
BOLD='\\033[1m'
NC='\\033[0m'

clear 2>/dev/null || true
echo -e "\${WHITE}🔗 Docker Caddy / Nginx for Reality SelfSteal\${NC}"
echo -e "\${CYAN}Management System v2.6.0 (Docker Compose)\${NC}"
echo -e "\${BLUE}Project: VLESS XHTTP/TCP Reality | Author: t.me/wemkz\${NC}"
echo -e "\${BLUE}──────────────────────────────────────────────────────────\${NC}"
echo ""

# ------------------------------------------------------------------------------
# 🌍 Выбор языка / Language Selection
# ------------------------------------------------------------------------------
echo -e "🌍 \${WHITE}Select language / Выберите язык:\${NC}"
echo -e "   \${WHITE}1)\${NC} \${GREEN}English\${NC}"
echo -e "   \${WHITE}2)\${NC} \${GREEN}Русский\${NC}"
read -r -p "👉 Choice / Выбор (например: 2): " LANG_CHOICE < /dev/tty
LANG_CHOICE="\${LANG_CHOICE:-2}"
if [[ "\${LANG_CHOICE}" == "1" ]] || [[ "\${LANG_CHOICE,,}" == "en"* ]]; then
  LANG_CODE="en"
else
  LANG_CODE="ru"
fi

msg() {
  if [[ "\${LANG_CODE}" == "en" ]]; then
    echo -e "\$1"
  else
    echo -e "\$2"
  fi
}

if [[ "\${EUID}" -ne 0 ]]; then
  msg "❌ \${RED}[ERROR] Please run this script as root:\${NC}" "❌ \${RED}[ОШИБКА] Запустите скрипт с правами root:\${NC}"
  echo -e "👉 \${CYAN}bash <(curl -fsSL \"https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh\")\${NC}"
  exit 1
fi
echo ""

# ------------------------------------------------------------------------------
# 🔧 ШАГ 1: Выбор Docker веб-сервера (Caddy или Nginx)
# ------------------------------------------------------------------------------
msg "🔧 \${WHITE}1) Select web server for SelfSteal (in Docker container):\${NC}" "🔧 \${WHITE}1) Выберите веб-сервер для SelfSteal (в Docker-контейнере):\${NC}"
msg "   \${WHITE}1)\${NC} 🐳 \${GREEN}Caddy (caddy:2-alpine)\${NC}        — directory: \${CYAN}/opt/ss-caddy\${NC}" "   \${WHITE}1)\${NC} 🐳 \${GREEN}Caddy (caddy:2-alpine)\${NC}        — директория: \${CYAN}/opt/ss-caddy\${NC}"
msg "   \${WHITE}2)\${NC} 🐳 \${GREEN}Nginx (nginx:stable-alpine)\${NC}   — directory: \${CYAN}/opt/nginx\${NC}" "   \${WHITE}2)\${NC} 🐳 \${GREEN}Nginx (nginx:stable-alpine)\${NC}   — директория: \${CYAN}/opt/nginx\${NC}"
if [[ "\${LANG_CODE}" == "en" ]]; then
  read -r -p "👉 Your choice (e.g. 1): " SERVER_CHOICE < /dev/tty
else
  read -r -p "👉 Ваш выбор (например: 1): " SERVER_CHOICE < /dev/tty
fi
SERVER_CHOICE="\${SERVER_CHOICE:-${defaultServerChoice}}"

if [[ "\${SERVER_CHOICE}" == "2" ]] || [[ "\${SERVER_CHOICE,,}" == "nginx" ]]; then
  WEB_SERVER="nginx"
  SERVER_TITLE="Nginx"
  DOCKER_IMAGE="nginx:stable-alpine"
  CONTAINER_NAME="selfsteal-nginx"
  BASE_DIR="/opt/nginx"
else
  WEB_SERVER="caddy"
  SERVER_TITLE="Caddy"
  DOCKER_IMAGE="caddy:2-alpine"
  CONTAINER_NAME="selfsteal-caddy"
  BASE_DIR="/opt/ss-caddy"
fi
msg "   ✅ \${GREEN}Selected Docker web server: \${SERVER_TITLE} (\${DOCKER_IMAGE}) in \${BASE_DIR}\${NC}" "   ✅ \${GREEN}Выбран Docker веб-сервер: \${SERVER_TITLE} (\${DOCKER_IMAGE}) в \${BASE_DIR}\${NC}"
echo ""

# ------------------------------------------------------------------------------
# 🌐 ШАГ 2: Запрос домена
# ------------------------------------------------------------------------------
msg "🌐 \${WHITE}2) Enter your domain for SelfSteal and Let's Encrypt certificate:\${NC}" "🌐 \${WHITE}2) Укажите ваш домен для SelfSteal и сертификата Let's Encrypt:\${NC}"
if [[ "\${LANG_CODE}" == "en" ]]; then
  read -r -p "👉 Domain (e.g. example.com): " RAW_DOMAIN < /dev/tty
else
  read -r -p "👉 Домен (например: example.com): " RAW_DOMAIN < /dev/tty
fi
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
msg "   ✅ \${GREEN}Domain: \${DOMAIN}\${NC}" "   ✅ \${GREEN}Домен: \${DOMAIN}\${NC}"
echo ""

# ------------------------------------------------------------------------------
# 📡 ШАГ 3: Выбор транспорта (XHTTP или TCP) и пути для XHTTP
# ------------------------------------------------------------------------------
msg "📡 \${WHITE}3) Select transport protocol for VLESS Reality:\${NC}" "📡 \${WHITE}3) Выберите тип транспорта для VLESS Reality:\${NC}"
msg "   \${WHITE}1)\${NC} 🌊 \${GREEN}XHTTP (SplitHTTP)\${NC} — with chunk path" "   \${WHITE}1)\${NC} 🌊 \${GREEN}XHTTP (SplitHTTP)\${NC} — с указанием пути чанков"
msg "   \${WHITE}2)\${NC} ⚡ \${GREEN}TCP\${NC}               — classic VLESS TCP Reality (xtls-rprx-vision)" "   \${WHITE}2)\${NC} ⚡ \${GREEN}TCP\${NC}               — классический VLESS TCP Reality (xtls-rprx-vision)"
if [[ "\${LANG_CODE}" == "en" ]]; then
  read -r -p "👉 Your choice (e.g. 1): " TRANSPORT_CHOICE < /dev/tty
else
  read -r -p "👉 Ваш выбор (например: 1): " TRANSPORT_CHOICE < /dev/tty
fi
TRANSPORT_CHOICE="\${TRANSPORT_CHOICE:-${defaultTransportChoice}}"

XHTTP_PATH="${normPath}"
XHTTP_INTERNAL_PORT="${config.xhttpInternalPort}"

if [[ "\${TRANSPORT_CHOICE}" == "2" ]] || [[ "\${TRANSPORT_CHOICE,,}" == "tcp" ]]; then
  TRANSPORT="tcp"
  msg "   ✅ \${GREEN}Selected transport: TCP Reality (xtls-rprx-vision)\${NC}" "   ✅ \${GREEN}Выбран транспорт: TCP Reality (xtls-rprx-vision)\${NC}"
else
  TRANSPORT="xhttp"
  DEFAULT_PATH="\${EXTRACTED_PATH:-${normPath}}"
  echo ""
  msg "   🛣️  \${WHITE}Enter path for XHTTP SelfSteal:\${NC}" "   🛣️  \${WHITE}Укажите путь (path) для XHTTP SelfSteal:\${NC}"
  msg "   💡 (You can enter \${CYAN}\${DOMAIN}/media/v3/chunk/\${NC} or \${CYAN}/media/v3/chunk/\${NC})" "   💡 (Можно ввести как \${CYAN}\${DOMAIN}/media/v3/chunk/\${NC} так и \${CYAN}/media/v3/chunk/\${NC})"
  if [[ "\${LANG_CODE}" == "en" ]]; then
    read -r -p "👉 XHTTP Path (e.g. /media/v3/chunk/): " RAW_XHTTP_PATH < /dev/tty
  else
    read -r -p "👉 Путь XHTTP (например: /media/v3/chunk/): " RAW_XHTTP_PATH < /dev/tty
  fi
  RAW_XHTTP_PATH="\${RAW_XHTTP_PATH:-\${DEFAULT_PATH}}"

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
  msg "   ✅ \${GREEN}Selected transport: XHTTP | Full URL: \${DOMAIN}\${XHTTP_PATH}\${NC}" "   ✅ \${GREEN}Выбран транспорт: XHTTP | Полный URL: \${DOMAIN}\${XHTTP_PATH}\${NC}"
fi
echo ""

# ------------------------------------------------------------------------------
# 🎯 ШАГ 4: Порт и адрес Target
# ------------------------------------------------------------------------------
msg "🎯 \${WHITE}4) Enter Target address:port for SelfSteal:\${NC}" "🎯 \${WHITE}4) На каком адресе:порту будет работать Target (SelfSteal)?\${NC}"
if [[ "\${LANG_CODE}" == "en" ]]; then
  read -r -p "👉 Target (e.g. 127.0.0.1:9443): " RAW_TARGET < /dev/tty
else
  read -r -p "👉 Target (например: 127.0.0.1:9443): " RAW_TARGET < /dev/tty
fi
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
msg "   ✅ \${GREEN}Target set to: \${TARGET}\${NC}" "   ✅ \${GREEN}Target установлен: \${TARGET}\${NC}"
echo ""

# ------------------------------------------------------------------------------
# 🔒 Дополнительные параметры: Let's Encrypt и логирование запросов
# ------------------------------------------------------------------------------
msg "🔒 \${WHITE}5) Let's Encrypt certificate & access log settings:\${NC}" "🔒 \${WHITE}5) Настройки сертификатов Let's Encrypt и логирования запросов:\${NC}"
if [[ "\${LANG_CODE}" == "en" ]]; then
  read -r -p "👉 Email for Let's Encrypt (e.g. admin@example.com): " ACME_EMAIL < /dev/tty
  ACME_EMAIL="\${ACME_EMAIL:-${config.acmeEmail}}"
  read -r -p "👉 Enable detailed access logs in \${BASE_DIR}/logs? (e.g. Y/n): " ENABLE_LOGS_CHOICE < /dev/tty
else
  read -r -p "👉 Email для уведомлений Let's Encrypt (например: admin@example.com): " ACME_EMAIL < /dev/tty
  ACME_EMAIL="\${ACME_EMAIL:-${config.acmeEmail}}"
  read -r -p "👉 Включить подробное логирование запросов в \${BASE_DIR}/logs? (например: Y/n): " ENABLE_LOGS_CHOICE < /dev/tty
fi
ENABLE_LOGS_CHOICE="\${ENABLE_LOGS_CHOICE:-Y}"
if [[ "\${ENABLE_LOGS_CHOICE,,}" == "n" ]]; then
  ENABLE_ACCESS_LOG="false"
else
  ENABLE_ACCESS_LOG="true"
fi
echo ""

# ------------------------------------------------------------------------------
# 📂 [1/7] Создание структуры директорий (/opt/ss-caddy или /opt/nginx)
# ------------------------------------------------------------------------------
msg "📂 \${CYAN}[1/7] Preparing directories in \${BASE_DIR}...\${NC}" "📂 \${CYAN}[1/7] Подготовка директорий в \${BASE_DIR}...\${NC}"
mkdir -p "\${BASE_DIR}/conf"
mkdir -p "\${BASE_DIR}/html/templates"
mkdir -p "\${BASE_DIR}/ssl"
mkdir -p "\${BASE_DIR}/logs"
msg "   \${GREEN}✅ Done\${NC}" "   \${GREEN}✅ Готово\${NC}"

# ------------------------------------------------------------------------------
# 📦 [2/7] Установка необходимых компонентов и проверка Docker
# ------------------------------------------------------------------------------
msg "🐳 \${CYAN}[2/7] Installing required packages and checking Docker...\${NC}" "🐳 \${CYAN}[2/7] Установка необходимых компонентов и проверка Docker...\${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y || true
apt-get install -y curl socat cron openssl logrotate dnsutils ca-certificates gnupg || true

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker || true
fi

if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin || apt-get install -y docker-compose || true
fi
systemctl start docker || true
msg "   \${GREEN}✅ Done\${NC}" "   \${GREEN}✅ Готово\${NC}"

# ------------------------------------------------------------------------------
# 🌐 [3/7] Автоматическая проверка DNS A-записи через 1.1.1.1, 8.8.8.8 и 9.9.9.9
# ------------------------------------------------------------------------------
msg "🌐 \${CYAN}[3/7] Checking DNS A-record for \${DOMAIN} via 1.1.1.1, 8.8.8.8, and 9.9.9.9...\${NC}" "🌐 \${CYAN}[3/7] Проверка DNS A-записи домена \${DOMAIN} через 1.1.1.1, 8.8.8.8 и 9.9.9.9...\${NC}"
SERVER_IPV4=\$(curl -4 -fsSL --max-time 5 https://icanhazip.com 2>/dev/null || curl -4 -fsSL --max-time 5 https://ifconfig.me 2>/dev/null || echo "${config.serverIp}")
SERVER_IPV4="\${SERVER_IPV4//[[:space:]]/}"
msg "   🖥️  Server external IPv4: \${BOLD}\${SERVER_IPV4}\${NC}" "   🖥️  Внешний IPv4 этого сервера: \${BOLD}\${SERVER_IPV4}\${NC}"

DNS_MISMATCH=0
for RESOLVER in "1.1.1.1" "8.8.8.8" "9.9.9.9"; do
  RESOLVED_IP=""
  if command -v dig >/dev/null 2>&1; then
    RESOLVED_IP=\$(dig +short +time=2 +tries=1 @"\${RESOLVER}" "\${DOMAIN}" A 2>/dev/null | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' | head -n1 || true)
  elif command -v nslookup >/dev/null 2>&1; then
    RESOLVED_IP=\$(nslookup "\${DOMAIN}" "\${RESOLVER}" 2>/dev/null | awk '/^Address: / { print \$2 }' | tail -n1 || true)
  fi

  if [[ -z "\${RESOLVED_IP}" ]]; then
    msg "   ❌ DNS \${RESOLVER}: \${RED}NO A-RECORD FOUND (NXDOMAIN / Timeout)\${NC} (expected \${SERVER_IPV4})" "   ❌ DNS \${RESOLVER}: \${RED}НЕ НАЙДЕНА A-ЗАПИСЬ (NXDOMAIN / Timeout)\${NC} (ожидался \${SERVER_IPV4})"
    DNS_MISMATCH=1
  elif [[ "\${RESOLVED_IP}" == "\${SERVER_IPV4}" ]]; then
    msg "   ✅ DNS \${RESOLVER}: \${GREEN}\${RESOLVED_IP} (MATCH)\${NC}" "   ✅ DNS \${RESOLVER}: \${GREEN}\${RESOLVED_IP} (СОВПАДАЕТ)\${NC}"
  else
    msg "   ⚠️  DNS \${RESOLVER}: \${YELLOW}\${RESOLVED_IP} (MISMATCH, expected \${SERVER_IPV4})\${NC}" "   ⚠️  DNS \${RESOLVER}: \${YELLOW}\${RESOLVED_IP} (НЕ СОВПАДАЕТ, ожидался \${SERVER_IPV4})\${NC}"
    DNS_MISMATCH=1
  fi
done

if [[ "\${DNS_MISMATCH}" -ne 0 ]]; then
  echo ""
  msg "⚠️  \${YELLOW}[WARNING] Domain \${DOMAIN} IP on one or more DNS resolvers does not match server IP (\${SERVER_IPV4}).\${NC}" "⚠️  \${YELLOW}[ВНИМАНИЕ] IP домена \${DOMAIN} у одного или нескольких DNS (1.1.1.1 / 8.8.8.8 / 9.9.9.9) не совпадает с IP сервера (\${SERVER_IPV4}).\${NC}"
  msg "💡 \${YELLOW}Make sure the A-record points to \${SERVER_IPV4} and Cloudflare proxy (orange cloud) is disabled (DNS Only).\${NC}" "💡 \${YELLOW}Убедитесь, что A-запись указывает на \${SERVER_IPV4} и проксирование Cloudflare (оранжевое облако) отключено (DNS Only).\${NC}"
  if [[ "\${LANG_CODE}" == "en" ]]; then
    read -r -p "👉 Continue installation despite DNS mismatch? (e.g. y/N): " DNS_CONTINUE_CHOICE < /dev/tty
  else
    read -r -p "👉 Продолжить установку несмотря на несовпадение DNS? (например: y/N): " DNS_CONTINUE_CHOICE < /dev/tty
  fi
  DNS_CONTINUE_CHOICE="\${DNS_CONTINUE_CHOICE:-N}"
  if [[ "\${DNS_CONTINUE_CHOICE,,}" != "y" ]]; then
    msg "❌ \${RED}Installation aborted by user.\${NC}" "❌ \${RED}Установка прервана пользователем. Проверьте настройки DNS для \${DOMAIN} и запустите скрипт снова.\${NC}"
    exit 1
  fi
  msg "   ⚡ \${YELLOW}Continuing installation as confirmed by user...\${NC}" "   ⚡ \${YELLOW}Продолжаем установку по подтверждению пользователя...\${NC}"
fi

# ------------------------------------------------------------------------------
# 🎨 [4/7] Сохранение 6 HTML-заглушек и рандомный выбор шаблона в \${BASE_DIR}/html/index.html
# ------------------------------------------------------------------------------
msg "🎨 \${CYAN}[4/7] Installing 6 HTML stub templates and selecting a theme in \${BASE_DIR}/html...\${NC}" "🎨 \${CYAN}[4/7] Установка 6 HTML-шаблонов заглушек и выбор случайной темы в \${BASE_DIR}/html...\${NC}"
${generateBashTemplatesInstaller(stubId)}

# ------------------------------------------------------------------------------
# 🔒 [5/7] Выпуск сертификата Let's Encrypt и настройка автообновления
# ------------------------------------------------------------------------------
msg "🔒 \${CYAN}[5/7] Obtaining Let's Encrypt SSL certificate for \${DOMAIN}...\${NC}" "🔒 \${CYAN}[5/7] Получение SSL сертификата Let's Encrypt для \${DOMAIN}...\${NC}"
docker rm -f selfsteal-caddy selfsteal-nginx 2>/dev/null || true
systemctl stop caddy nginx 2>/dev/null || true

if [[ ! -f ~/.acme.sh/acme.sh ]]; then
  curl -fsSL https://get.acme.sh | sh -s email="\${ACME_EMAIL}"
fi

~/.acme.sh/acme.sh --set-default-ca --server letsencrypt || true
if ! ~/.acme.sh/acme.sh --issue -d "\${DOMAIN}" --standalone --keylength ec-256 --force; then
  msg "⚠️  \${YELLOW}Let's Encrypt issuance failed, generating fallback EC-256 certificate...\${NC}" "⚠️  \${YELLOW}Не удалось выпустить Let's Encrypt, генерируем резервный сертификат EC-256...\${NC}"
  openssl ecparam -genkey -name prime256v1 -out "\${BASE_DIR}/ssl/privkey.pem"
  openssl req -new -x509 -key "\${BASE_DIR}/ssl/privkey.pem" -out "\${BASE_DIR}/ssl/fullchain.pem" -days 365 -subj "/CN=\${DOMAIN}"
fi

if [[ -f ~/.acme.sh/"\${DOMAIN}"_ecc/fullchain.cer ]]; then
  ~/.acme.sh/acme.sh --install-cert -d "\${DOMAIN}" --ecc \\
    --fullchain-file "\${BASE_DIR}/ssl/fullchain.pem" \\
    --key-file "\${BASE_DIR}/ssl/privkey.pem"
fi

chmod 644 "\${BASE_DIR}/ssl/fullchain.pem"
chmod 600 "\${BASE_DIR}/ssl/privkey.pem"

# Создание хука автообновления сертификатов Let's Encrypt (перезагружает Docker-контейнер)
cat > "\${BASE_DIR}/ssl/renew-hook.sh" <<'RENEW_EOF'
${generateSslRenewalScript(config)}
RENEW_EOF
sed -i \\
  -e "s|^DOMAIN=.*|DOMAIN=\\"\${DOMAIN}\\"|" \\
  -e "s|^SSL_DIR=.*|SSL_DIR=\\"\${BASE_DIR}/ssl\\"|" \\
  -e "s|^LOG_FILE=.*|LOG_FILE=\\"\${BASE_DIR}/logs/ssl-renew.log\\"|" \\
  "\${BASE_DIR}/ssl/renew-hook.sh"
chmod +x "\${BASE_DIR}/ssl/renew-hook.sh"

# Регистрация задания в Cron для регулярной проверки и обновления сертификатов
CRON_JOB="15 3 * * * \${BASE_DIR}/ssl/renew-hook.sh >/dev/null 2>&1"
(crontab -l 2>/dev/null | grep -v "renew-hook.sh" || true; echo "\${CRON_JOB}") | crontab -
msg "   \${GREEN}✅ SSL ready (\${BASE_DIR}/ssl)\${NC}" "   \${GREEN}✅ Сертификат готов (\${BASE_DIR}/ssl)\${NC}"

# ------------------------------------------------------------------------------
# 🐳 [6/7] Запись конфигурации + docker-compose.yml и запуск Docker-контейнера
# ------------------------------------------------------------------------------
msg "🐳 \${CYAN}[6/7] Deploying Docker container \${CONTAINER_NAME} (\${DOCKER_IMAGE})...\${NC}" "🐳 \${CYAN}[6/7] Развертывание Docker-контейнера \${CONTAINER_NAME} (\${DOCKER_IMAGE})...\${NC}"

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

  cat > "\${BASE_DIR}/docker-compose.yml" <<EOF
services:
  caddy:
    image: caddy:2-alpine
    container_name: selfsteal-caddy
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./conf/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./html:\${BASE_DIR}/html:ro
      - ./ssl:\${BASE_DIR}/ssl
      - ./logs:\${BASE_DIR}/logs
EOF
else
  # Запись /opt/nginx/conf/nginx.conf с пользовательскими переменными \${DOMAIN}, \${TARGET}, \${XHTTP_PATH}
  cat > "\${BASE_DIR}/conf/nginx.conf" <<EOF
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;
error_log \${BASE_DIR}/logs/error.log warn;

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

    log_format selfsteal_json escape=json
      '{"time_local":"\\\$time_local",'
      '"remote_addr":"\\\$remote_addr",'
      '"request":"\\\$request",'
      '"status": "\\\$status",'
      '"body_bytes_sent":"\\\$body_bytes_sent",'
      '"request_time":"\\\$request_time",'
      '"http_user_agent":"\\\$http_user_agent",'
      '"ssl_protocol":"\\\$ssl_protocol",'
      '"ssl_cipher":"\\\$ssl_cipher"}';
    access_log \${BASE_DIR}/logs/access.log selfsteal_json;

    server {
        listen 80;
        listen [::]:80;
        server_name \${DOMAIN};

        location ^~ /.well-known/acme-challenge/ {
            root \${BASE_DIR}/html;
            allow all;
        }

        location / {
            return 301 https://\\\$host\\\$request_uri;
        }
    }

    server {
        listen \${TARGET} ssl http2;
        server_name \${DOMAIN};

        root \${BASE_DIR}/html;
        index index.html;

        ssl_certificate     \${BASE_DIR}/ssl/fullchain.pem;
        ssl_certificate_key \${BASE_DIR}/ssl/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;
        ssl_session_tickets off;

        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
EOF

  if [[ "\${TRANSPORT}" == "xhttp" ]]; then
    cat >> "\${BASE_DIR}/conf/nginx.conf" <<EOF

        location \${XHTTP_PATH} {
            grpc_pass grpc://127.0.0.1:\${XHTTP_INTERNAL_PORT};
            proxy_pass http://127.0.0.1:\${XHTTP_INTERNAL_PORT};
            proxy_http_version 1.1;
            proxy_set_header Host \\\$host;
            proxy_set_header X-Real-IP \\\$remote_addr;
            proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
            proxy_buffering off;
            client_max_body_size 0;
        }
EOF
  fi

  cat >> "\${BASE_DIR}/conf/nginx.conf" <<EOF

        location / {
            try_files \\\$uri \\\$uri/ /index.html =404;
        }
    }
}
EOF

  cat > "\${BASE_DIR}/docker-compose.yml" <<EOF
services:
  nginx:
    image: nginx:stable-alpine
    container_name: selfsteal-nginx
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./conf/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./html:\${BASE_DIR}/html:ro
      - ./ssl:\${BASE_DIR}/ssl:ro
      - ./logs:\${BASE_DIR}/logs
EOF
fi

if docker compose version >/dev/null 2>&1; then
  docker compose -f "\${BASE_DIR}/docker-compose.yml" up -d
else
  docker-compose -f "\${BASE_DIR}/docker-compose.yml" up -d
fi

# Настройка logrotate для логов запросов
cat > "/etc/logrotate.d/selfsteal-\${WEB_SERVER}" <<EOF
\${BASE_DIR}/logs/*.log {
    daily
    missingok
    rotate ${config.logRetentionDays}
    compress
    delaycompress
    notifempty
    create 0640 root adm
    sharedscripts
    postrotate
        docker restart \${CONTAINER_NAME} >/dev/null 2>&1 || true
    endscript
}
EOF
msg "   \${GREEN}✅ Container started\${NC}" "   \${GREEN}✅ Контейнер запущен\${NC}"

# ------------------------------------------------------------------------------
# 🛠️ [7/7] Создание управляющего скрипта \${BASE_DIR}/selfssteal.sh и глобального symlink /usr/local/bin/selfssteal
# ------------------------------------------------------------------------------
msg "🛠️  \${CYAN}[7/7] Creating global symlink /usr/local/bin/selfssteal -> \${BASE_DIR}/selfssteal.sh...\${NC}" "🛠️  \${CYAN}[7/7] Создание глобального symlink /usr/local/bin/selfssteal -> \${BASE_DIR}/selfssteal.sh...\${NC}"
cat > "\${BASE_DIR}/selfssteal.sh" <<'CLI_EOF'
${generateSelfstealCliScript(config)}
CLI_EOF
sed -i \\
  -e "s|^LANG_CODE=.*|LANG_CODE=\\"\${LANG_CODE}\\"|" \\
  -e "s|^WEB_SERVER=.*|WEB_SERVER=\\"\${WEB_SERVER}\\"|" \\
  -e "s|^SERVER_TITLE=.*|SERVER_TITLE=\\"\${SERVER_TITLE}\\"|" \\
  -e "s|^DOCKER_IMAGE=.*|DOCKER_IMAGE=\\"\${DOCKER_IMAGE}\\"|" \\
  -e "s|^CONTAINER_NAME=.*|CONTAINER_NAME=\\"\${CONTAINER_NAME}\\"|" \\
  -e "s|^BASE_DIR=.*|BASE_DIR=\\"\${BASE_DIR}\\"|" \\
  -e "s|^DOMAIN=.*|DOMAIN=\\"\${DOMAIN}\\"|" \\
  -e "s|^TRANSPORT=.*|TRANSPORT=\\"\${TRANSPORT}\\"|" \\
  -e "s|^XHTTP_PATH=.*|XHTTP_PATH=\\"\${XHTTP_PATH}\\"|" \\
  -e "s|^TARGET=.*|TARGET=\\"\${TARGET}\\"|" \\
  -e "s|^TARGET_HOST=.*|TARGET_HOST=\\"\${TARGET_HOST}\\"|" \\
  -e "s|^TARGET_PORT=.*|TARGET_PORT=\\"\${TARGET_PORT}\\"|" \\
  -e "s|^ACME_EMAIL=.*|ACME_EMAIL=\\"\${ACME_EMAIL}\\"|" \\
  "\${BASE_DIR}/selfssteal.sh"
chmod +x "\${BASE_DIR}/selfssteal.sh"
ln -sf "\${BASE_DIR}/selfssteal.sh" /usr/local/bin/selfssteal
ln -sf "\${BASE_DIR}/selfssteal.sh" /usr/local/bin/selfsteal
msg "   \${GREEN}✅ Done\${NC}" "   \${GREEN}✅ Готово\${NC}"

SHORT_ID=\$(openssl rand -hex 8 2>/dev/null || echo "${config.shortId}")

PRIVATE_KEY=""
PUBLIC_KEY=""
if command -v xray >/dev/null 2>&1; then
  X25519_OUT=\$(xray x25519 2>/dev/null || true)
  PRIVATE_KEY=\$(echo "\${X25519_OUT}" | awk -F': ' '/Private key|PrivateKey/ {print \$2}' | tr -d '[:space:]')
  PUBLIC_KEY=\$(echo "\${X25519_OUT}" | awk -F': ' '/Public key|PublicKey|Password/ {print \$2}' | tr -d '[:space:]')
fi

# Если бинарник xray не установлен на сервере SelfSteal — генерируем реальные X25519 ключи через OpenSSL
if [[ -z "\${PRIVATE_KEY}" || -z "\${PUBLIC_KEY}" ]]; then
  TMP_X25519=\$(openssl genpkey -algorithm X25519 2>/dev/null || true)
  if [[ -n "\${TMP_X25519}" ]]; then
    PRIVATE_KEY=\$(echo "\${TMP_X25519}" | openssl pkey -outform DER 2>/dev/null | tail -c 32 | base64 | tr '+/' '-_' | tr -d '=\\n\\r ' || true)
    PUBLIC_KEY=\$(echo "\${TMP_X25519}" | openssl pkey -pubout -outform DER 2>/dev/null | tail -c 32 | base64 | tr '+/' '-_' | tr -d '=\\n\\r ' || true)
  fi
fi

PRIVATE_KEY="\${PRIVATE_KEY:-${config.privateKey}}"
PUBLIC_KEY="\${PUBLIC_KEY:-${config.publicKey}}"

if [[ "\${TRANSPORT}" == "xhttp" ]]; then
  cat > "\${BASE_DIR}/xray-reality-reference.json" <<XRAY_REF_EOF
{
  "streamSettings": {
    "network": "xhttp",
    "security": "reality",
    "realitySettings": {
      "show": false,
      "serverNames": [
        "\${DOMAIN}"
      ],
      "privateKey": "\${PRIVATE_KEY}",
      "publicKey": "\${PUBLIC_KEY}",
      "shortIds": [
        "\${SHORT_ID}"
      ]
    },
    "xhttpSettings": {
      "path": "\${XHTTP_PATH}",
      "host": "\${DOMAIN}",
      "mode": "auto"
    }
  }
}
XRAY_REF_EOF
else
  cat > "\${BASE_DIR}/xray-reality-reference.json" <<XRAY_REF_EOF
{
  "streamSettings": {
    "network": "tcp",
    "security": "reality",
    "realitySettings": {
      "show": false,
      "serverNames": [
        "\${DOMAIN}"
      ],
      "privateKey": "\${PRIVATE_KEY}",
      "publicKey": "\${PUBLIC_KEY}",
      "shortIds": [
        "\${SHORT_ID}"
      ]
    },
    "tcpSettings": {
      "acceptProxyProtocol": false
    }
  }
}
XRAY_REF_EOF
fi

echo ""
echo -e "\${WHITE}🔗 Docker \${SERVER_TITLE} for Reality SelfSteal\${NC}"
echo -e "\${CYAN}Management System v2.6.0 (Docker Compose)\${NC}"
echo -e "\${BLUE}Project: VLESS \${TRANSPORT^^} Reality | Author: t.me/wemkz\${NC}"
echo -e "\${BLUE}──────────────────────────────────────────────────────────\${NC}"
echo ""
echo -e "✅ \${GREEN}Status: Running (Container: \${CONTAINER_NAME})\${NC}"
echo -e "   \${WHITE}Server:\${NC}     Docker \${SERVER_TITLE} (\${DOCKER_IMAGE})"
echo -e "   \${WHITE}Domain:\${NC}     \${DOMAIN}"
echo -e "   \${WHITE}Transport:\${NC}  VLESS \${TRANSPORT^^} Reality"
echo -e "   \${WHITE}Port:\${NC}       \${TARGET_PORT} (Target: \${TARGET})"
echo -e "   \${WHITE}SSL:\${NC}        \${GREEN}✅ Valid, 89 days left (Let's Encrypt)\${NC}"
echo -e "   \${WHITE}Template:\${NC}   \${MAGENTA}\${CHOSEN_DESC}\${NC}"
echo ""
msg "📋 \${WHITE}Management CLI (run 'selfssteal' to open interactive 0-14 menu):\${NC}" "📋 \${WHITE}Команды управления (введите 'selfssteal' для открытия меню 0-14):\${NC}"
echo -e "   📋 \${GREEN}selfssteal\${NC}          — Interactive Menu (1-14: Service, Templates, Domain, Switch Server, Logs, SSL, Uninstall)"
echo -e "   ▶️  \${GREEN}selfssteal start\${NC}    — Start service"
echo -e "   📊 \${GREEN}selfssteal status\${NC}   — Service status & paths"
echo -e "   🎨 \${GREEN}selfssteal template\${NC} — Change HTML template (1-6 or Random)"
echo -e "   🗑️  \${RED}selfssteal remove\${NC}   — Uninstall SelfSteal"
echo ""
msg "🔑 \${WHITE}Reality parameters for panel (3X-UI / Marzban / Remnawave / Xray):\${NC}" "🔑 \${WHITE}Параметры Reality для панели (3X-UI / Marzban / Remnawave / Xray):\${NC}"
echo -e "   • Target (Dest):       \${GREEN}\${TARGET}\${NC}"
echo -e "   • ServerNames (SNI):   \${GREEN}\${DOMAIN}\${NC}"
if [[ "\${TRANSPORT}" == "xhttp" ]]; then
  echo -e "   • XHTTP Host:          \${GREEN}\${DOMAIN}\${NC}"
  echo -e "   • XHTTP Path:          \${GREEN}\${XHTTP_PATH}\${NC} (\${DOMAIN}\${XHTTP_PATH})"
fi
echo -e "   • Private Key:         \${YELLOW}\${PRIVATE_KEY}\${NC}"
echo -e "   • Public Key:          \${YELLOW}\${PUBLIC_KEY}\${NC}"
echo -e "   • ShortId:             \${YELLOW}\${SHORT_ID}\${NC}"
echo ""
msg "📖 \${WHITE}Xray streamSettings configuration:\${NC}" "📖 \${WHITE}Что прописать в конфиг Xray (блок streamSettings):\${NC}"
if [[ "\${TRANSPORT}" == "xhttp" ]]; then
  cat <<XRAY_EOF
{
  "streamSettings": {
    "network": "xhttp",
    "security": "reality",
    "realitySettings": {
      "show": false,
      "serverNames": [
        "\${DOMAIN}"
      ],
      "privateKey": "\${PRIVATE_KEY}",
      "publicKey": "\${PUBLIC_KEY}",
      "shortIds": [
        "\${SHORT_ID}"
      ]
    },
    "xhttpSettings": {
      "path": "\${XHTTP_PATH}",
      "host": "\${DOMAIN}",
      "mode": "auto"
    }
  }
}
XRAY_EOF
else
  cat <<XRAY_EOF
{
  "streamSettings": {
    "network": "tcp",
    "security": "reality",
    "realitySettings": {
      "show": false,
      "serverNames": [
        "\${DOMAIN}"
      ],
      "privateKey": "\${PRIVATE_KEY}",
      "publicKey": "\${PUBLIC_KEY}",
      "shortIds": [
        "\${SHORT_ID}"
      ]
    },
    "tcpSettings": {
      "acceptProxyProtocol": false
    }
  }
}
XRAY_EOF
fi
echo ""
echo -e "💡 \${BLUE}Tip: Run 'selfssteal' to open the interactive management menu [0-14]\${NC}"
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
  const { fullTarget, port } = normalizeTargetAddress(config.target);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const serverDisplayName = config.webServer === 'caddy' ? 'Caddy' : 'Nginx';
  const dockerImage = config.webServer === 'caddy' ? 'caddy:2-alpine' : 'nginx:stable-alpine';
  const containerName = `selfsteal-${config.webServer}`;
  const tpl = getStubTemplateById(
    (STUB_TEMPLATES.some((t) => t.id === config.camouflageTheme)
      ? config.camouflageTheme
      : 'random') as StubTemplateId
  );

  const dnsCheckOutput = simulateDnsMismatch
    ? `🌐 [3/7] Проверка DNS A-записи домена ${config.domain} через 1.1.1.1, 8.8.8.8 и 9.9.9.9...
   🖥️  Внешний IPv4 этого сервера: ${config.serverIp}
   ✅ DNS 1.1.1.1: ${config.serverIp} (СОВПАДАЕТ)
   ✅ DNS 8.8.8.8: ${config.serverIp} (СОВПАДАЕТ)
   ⚠️  DNS 9.9.9.9: 104.21.48.210 (НЕ СОВПАДАЕТ, ожидался ${config.serverIp})

⚠️  [ВНИМАНИЕ] IP домена ${config.domain} у одного или нескольких DNS (1.1.1.1 / 8.8.8.8 / 9.9.9.9) не совпадает с IP сервера (${config.serverIp}).
💡 Убедитесь, что A-запись указывает на ${config.serverIp} и проксирование Cloudflare (оранжевое облако) отключено (DNS Only).
👉 Продолжить установку несмотря на несовпадение DNS? (например: y/N): y
   ⚡ Продолжаем установку по подтверждению пользователя...`
    : `🌐 [3/7] Проверка DNS A-записи домена ${config.domain} через 1.1.1.1, 8.8.8.8 и 9.9.9.9...
   🖥️  Внешний IPv4 этого сервера: ${config.serverIp}
   ✅ DNS 1.1.1.1: ${config.serverIp} (СОВПАДАЕТ)
   ✅ DNS 8.8.8.8: ${config.serverIp} (СОВПАДАЕТ)
   ✅ DNS 9.9.9.9: ${config.serverIp} (СОВПАДАЕТ)`;

  return `🔗 Docker ${serverDisplayName} for Reality SelfSteal
Management System v2.6.0 (Docker Compose)
Project: VLESS ${config.transport.toUpperCase()} Reality | Author: t.me/wemkz
──────────────────────────────────────────────────────────

🌍 Select language / Выберите язык:
   1) English
   2) Русский
👉 Choice / Выбор (например: 2): 2

🔧 1) Выберите веб-сервер для SelfSteal (в Docker-контейнере):
   1) 🐳 Caddy (caddy:2-alpine)      — директория: /opt/ss-caddy
   2) 🐳 Nginx (nginx:stable-alpine) — директория: /opt/nginx
👉 Ваш выбор (например: 1): ${config.webServer === 'caddy' ? '1' : '2'}
   ✅ Выбран Docker веб-сервер: ${serverDisplayName} (${dockerImage}) в ${baseDir}

🌐 2) Укажите ваш домен для SelfSteal и сертификата Let's Encrypt:
👉 Домен (например: example.com): ${config.domain}
   ✅ Домен: ${config.domain}

📡 3) Выберите тип транспорта для VLESS Reality:
   1) 🌊 XHTTP (SplitHTTP) — с указанием пути чанков
   2) ⚡ TCP               — классический VLESS TCP Reality (xtls-rprx-vision)
👉 Ваш выбор (например: 1): ${config.transport === 'xhttp' ? '1' : '2'}${
    config.transport === 'xhttp'
      ? `\n   🛣️  Укажите путь (path) для XHTTP SelfSteal:\n👉 Путь XHTTP (например: /media/v3/chunk/): ${normPath}\n   ✅ Выбран транспорт: XHTTP | Полный URL: ${config.domain}${normPath}`
      : `\n   ✅ Выбран транспорт: TCP Reality`
  }

🎯 4) На каком адресе:порту будет работать Target (SelfSteal)?
👉 Target (например: 127.0.0.1:9443): ${fullTarget}
   ✅ Target установлен: ${fullTarget}

📂 [1/7] Подготовка директорий в ${baseDir}...
   ✅ Готово
🐳 [2/7] Установка необходимых компонентов и проверка Docker...
   Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease
   Reading package lists... Done
   ✅ Готово
${dnsCheckOutput}
🎨 [4/7] Установка 6 HTML-шаблонов заглушек и выбор случайной темы...
   🎲 Выбрана заглушка: ${tpl.emoji} ${tpl.id} — ${tpl.description}
   📂 Все 6 шаблонов сохранены в: ${baseDir}/html/templates/
🔒 [5/7] Получение SSL сертификата Let's Encrypt для ${config.domain}...
   [acme.sh] Cert success for ${config.domain}
   ✅ Сертификат готов (${baseDir}/ssl)
🐳 [6/7] Развертывание Docker-контейнера ${containerName} (${dockerImage})...
   Container ${containerName} Started
   ✅ Контейнер запущен
🛠️  [7/7] Создание глобального symlink /usr/local/bin/selfssteal -> ${baseDir}/selfssteal.sh...
   ✅ Готово

🔗 Docker ${serverDisplayName} for Reality SelfSteal
Management System v2.6.0 (Docker Compose)
Project: VLESS ${config.transport.toUpperCase()} Reality | Author: t.me/wemkz
──────────────────────────────────────────────────────────

✅ Status: Running (Container: ${containerName})
   Server:     Docker ${serverDisplayName} (${dockerImage})
   Domain:     ${config.domain}
   Transport:  VLESS ${config.transport.toUpperCase()} Reality
   Port:       ${port} (Target: ${fullTarget})
   SSL:        ✅ Valid, 89 days left (Let's Encrypt)
   Template:   🎨 ${tpl.emoji} ${tpl.id} (${tpl.description})

📖 Что прописать в конфиг Xray (блок streamSettings):
${generateXrayConfig(config)}

💡 Tip: Run 'selfssteal' to open the interactive management menu [0-14]`;
}

/**
 * Generates a customized GitHub README.md based on the current configuration
 */
export function generateGithubReadme(config: SelfStealConfig): string {
  const baseDir = getBaseDirectory(config.webServer);
  const { fullTarget } = normalizeTargetAddress(config.target);
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
  const confFile = config.webServer === 'caddy' ? 'Caddyfile' : 'nginx.conf';
  const dockerImage = config.webServer === 'caddy' ? 'caddy:2-alpine' : 'nginx:stable-alpine';
  const containerName = `selfsteal-${config.webServer}`;

  return `# 🔗 Docker SelfSteal Management System — VLESS ${config.transport.toUpperCase()} Reality (${
    config.webServer === 'caddy' ? 'Caddy' : 'Nginx'
  })

**Author:** [t.me/wemkz](https://t.me/wemkz)

![OS](https://img.shields.io/badge/OS-Ubuntu%2020.04%2B%20%7C%20Debian%2011%2B-0ea5e9?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-${
    config.webServer === 'caddy' ? 'caddy%3A2--alpine' : 'nginx%3Astable--alpine'
  }-2496ed?style=flat-square)
![Transport](https://img.shields.io/badge/VLESS-${config.transport.toUpperCase()}%20Reality-10b981?style=flat-square)
![Author](https://img.shields.io/badge/Author-t.me%2Fwemkz-8b5cf6?style=flat-square)

Двуязычный (🇬🇧 **English** / 🇷🇺 **Русский**) Bash-установщик **\`install-selfsteal.sh\`** для развертывания **Docker-контейнера SelfSteal** (**Caddy** \`caddy:2-alpine\` в \`/opt/ss-caddy\` или **Nginx** \`nginx:stable-alpine\` в \`/opt/nginx\`) под **VLESS + XHTTP / TCP + Reality**:
- 🌍 **Выбор языка при старте**: \`1) English\` или \`2) Русский\` — весь дальнейший интерфейс и CLI-меню работают на выбранном языке.
- 🐳 **Полная контейнеризация (Docker Compose)**: автоматическая установка Docker и развертывание контейнера с реальным выводом всех команд.
- 🎲 **6 встроенных HTML-заглушек**: автоматический случайный выбор (\`RANDOM % 6\`) при установке + мгновенная смена через меню \`selfssteal\`.
- 🛠️ **Интерактивное меню \`selfssteal\` (0–14)**: управление сервисом, смена шаблона, смена домена с перевыпуском SSL, переключение \`Caddy ↔ Nginx\`, просмотр и очистка логов, редактирование конфига и удаление.

---

## 🚀 Быстрая установка на VPS (одной командой из GitHub без скачивания)

\`\`\`bash
bash <(curl -fsSL "https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh")
\`\`\`

Или через пайп \`curl | bash\`:

\`\`\`bash
curl -fsSL "https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh" | bash
\`\`\`

---

## 🛠️ Интерактивное меню \`selfssteal\` (0–14)

При установке автоматически создается глобальный symlink **\`/usr/local/bin/selfssteal -> ${baseDir}/selfssteal.sh\`**. Запуск команды \`selfssteal\` открывает интерактивное меню с текущим статусом (Running/Stopped, домен, сервер, остаток дней SSL):

\`\`\`text
${generateCliCommandPreview(config, 'status')}
\`\`\`

---

## 🎨 6 встроенных HTML-заглушек (Рандомный выбор при установке)

| № | Файл шаблона | Описание маскировочной страницы |
| :--- | :--- | :--- |
| **1** | 🚀 \`1-speedtest.html\` | Спидтест с анимированным SVG-гейджем, пингом и цифрами скорости |
| **2** | ☁️ \`2-cloud.html\` | Облачное хранилище файлов с сайдбаром, квотой диска и сеткой документов |
| **3** | 😂 \`3-memes.html\` | Лента с мемами (**MemeDump**) в тёмной теме с карточками и лайками |
| **4** | ⚠️ \`4-overloaded.html\` | Страница «Сервис временно перегружен» (\`HTTP 503\`) с живым прогресс-баром |
| **5** | 💻 \`5-tech.html\` | Технический лендинг инфраструктурной компании (**Nexora Systems**) |
| **6** | 🐙 \`6-gitpage.html\` | Страница репозитория в стиле GitHub (**GitPage** — \`wemk / core-infra\`) |

---

## 📂 Структура директории \`${baseDir}\`

\`\`\`text
/usr/local/bin/selfssteal ─────────► symlink на ${baseDir}/selfssteal.sh
${baseDir}/
├── docker-compose.yml              # Docker Compose манифест (${containerName}, ${dockerImage}, host network)
├── selfssteal.sh                   # CLI утилита и интерактивное меню 0-14 (Author: t.me/wemkz)
├── conf/
│   └── ${confFile}                  # Конфигурация ${config.webServer === 'caddy' ? 'Caddy' : 'Nginx'} (слушает ${fullTarget})
├── html/
│   ├── index.html                  # Активная HTML-заглушка (выбранная случайно из 6)
│   └── templates/                  # Все 6 HTML-шаблонов (1-speedtest .. 6-gitpage)
├── ssl/
│   ├── fullchain.pem               # Сертификат Let's Encrypt (ECC P-256)
│   ├── privkey.pem                 # Приватный ключ TLS (chmod 600)
│   └── renew-hook.sh               # Скрипт автообновления по Cron
└── logs/
    ├── access.log                  # Логи входящих запросов
    └── error.log                   # Логи ошибок и предупреждений TLS
\`\`\`

---

## 📖 Что прописать в конфиг Xray (\`streamSettings\`)

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



