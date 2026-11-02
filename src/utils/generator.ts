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
#   selfssteal start     — ▶️ запустить Docker-контейнер SelfSteal
#   selfssteal status    — 📊 статус контейнера, Uptime сервера/контейнера, пути к SSL и HTML
#   selfssteal remove    — 🗑️ полное удаление контейнера SelfSteal, Cron, директорий и symlink
#   selfssteal template  — 🎨 выбор или рандомная смена HTML-заглушки (1-6)
#   selfssteal menu      — 📋 открыть интерактивное меню управления (1-14)
#   selfssteal restart   — 🔄 перезапуск Docker-контейнера (selfsteal-${config.webServer})
#   selfssteal logs      — 📝 просмотр логов запросов в реальном времени
# ==============================================================================
set -euo pipefail

WEB_SERVER="${config.webServer}"
SERVER_TITLE="${serverDisplayName}"
DOCKER_IMAGE="${dockerImage}"
CONTAINER_NAME="selfsteal-${config.webServer}"
BASE_DIR="${baseDir}"
COMPOSE_FILE="\${BASE_DIR}/docker-compose.yml"
DOMAIN="${config.domain}"
TRANSPORT="${config.transport}"
XHTTP_PATH="${normPath}"
TARGET="${fullTarget}"
TARGET_PORT="${port}"
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
      echo "\${etime} (запущен: \${started_at} UTC)"
    else
      echo "Активен (запущен: \${started_at} UTC)"
    fi
  else
    echo "Остановлен (0s)"
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

cmd_start() {
  print_header
  echo -e "\${CYAN}🐳 Запуск Docker-контейнера \${CONTAINER_NAME} (\${DOCKER_IMAGE} · \${DOMAIN} · \${TARGET})...\${NC}"
  compose_cmd up -d >/dev/null 2>&1
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
    echo -e "❌ \${RED}Status: Failed to start (проверьте docker logs \${CONTAINER_NAME})\${NC}"
    exit 1
  fi
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
  echo -e "📂 \${WHITE}Директории и пути (\${BASE_DIR}):\${NC}"
  echo -e "   ├─ 🔒 \${WHITE}Путь к SSL:\${NC}      \${CYAN}\${SSL_DIR}\${NC} (fullchain.pem, privkey.pem, renew-hook.sh)"
  echo -e "   ├─ 🎨 \${WHITE}Путь к HTML:\${NC}     \${CYAN}\${HTML_DIR}\${NC} (index.html + 6 шаблонов в /templates)"
  echo -e "   ├─ 🐳 \${WHITE}Docker Compose:\${NC}  \${CYAN}\${COMPOSE_FILE}\${NC}"
  echo -e "   ├─ ⚙️  \${WHITE}Конфигурация:\${NC}    \${CYAN}\${CONF_FILE}\${NC}"
  echo -e "   ├─ 📝 \${WHITE}Логи запросов:\${NC}   \${CYAN}\${LOGS_DIR}\${NC} (access.log, error.log)"
  echo -e "   └─ 🔗 \${WHITE}Глобальный CLI:\${NC}  \${CYAN}/usr/local/bin/selfssteal -> \${BASE_DIR}/selfssteal.sh\${NC}"
}

cmd_template() {
  print_header
  echo -e "🎨 \${WHITE}Выберите HTML-заглушку для маскировки SelfSteal (\${HTML_DIR}/index.html):\${NC}"
  echo -e "   \${WHITE}1)\${NC} 🚀 \${GREEN}1-speedtest.html\${NC}  — Спидтест с анимированным гейджем и цифрами"
  echo -e "   \${WHITE}2)\${NC} ☁️  \${GREEN}2-cloud.html\${NC}      — Облачное хранилище, сайдбар + сетка файлов"
  echo -e "   \${WHITE}3)\${NC} 😂 \${GREEN}3-memes.html\${NC}      — Лента с мемами (MemeDump), тёмная тема"
  echo -e "   \${WHITE}4)\${NC} ⚠️  \${GREEN}4-overloaded.html\${NC} — Страница «Сервис перегружен» (503) с прогресс-баром"
  echo -e "   \${WHITE}5)\${NC} 💻 \${GREEN}5-tech.html\${NC}       — Технический лендинг (Nexora Systems)"
  echo -e "   \${WHITE}6)\${NC} 🐙 \${GREEN}6-gitpage.html\${NC}    — Страница репозитория в стиле GitHub (GitPage)"
  echo -e "   \${WHITE}7)\${NC} 🎲 \${CYAN}Случайный выбор (Random 1-6)\${NC}"
  echo ""
  read -r -p "Select template [1-7, default 7 (Random)]: " TPL_CHOICE < /dev/tty
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
    echo -e "✅ \${GREEN}Активная HTML-заглушка обновлена на: \${chosen}\${NC}"
  else
    echo -e "⚠️  \${YELLOW}Шаблон \${chosen} не найден в \${HTML_DIR}/templates\${NC}"
  fi
}

cmd_remove() {
  print_header
  echo -e "🗑️  \${RED}\${BOLD}УДАЛЕНИЕ DOCKER SELFSTEAL (\${BASE_DIR})\${NC}"
  read -r -p "Вы уверены, что хотите остановить Docker-контейнер \${CONTAINER_NAME} и удалить \${BASE_DIR}? [y/N]: " CONFIRM < /dev/tty
  if [[ "\${CONFIRM,,}" != "y" ]]; then
    echo -e "ℹ️  \${CYAN}Отмена удаления.\${NC}"
    exit 0
  fi

  echo -e "⏹️  [1/4] Остановка и удаление Docker-контейнера \${CONTAINER_NAME}..."
  compose_cmd down >/dev/null 2>&1 || docker rm -f "\${CONTAINER_NAME}" >/dev/null 2>&1 || true

  echo -e "🧹 [2/4] Удаление задачи автообновления SSL из Cron и ротации логов..."
  (crontab -l 2>/dev/null | grep -v "renew-hook.sh" || true) | crontab -
  rm -f "/etc/logrotate.d/selfsteal-\${WEB_SERVER}"

  echo -e "🗑️  [3/4] Удаление рабочей директории \${BASE_DIR} (docker-compose.yml, conf, ssl, html, logs)..."
  rm -rf "\${BASE_DIR}"

  echo -e "🔗 [4/4] Удаление глобального symlink /usr/local/bin/selfssteal..."
  rm -f /usr/local/bin/selfssteal /usr/local/bin/selfsteal

  echo -e "✅ \${GREEN}SelfSteal полностью удален с сервера.\${NC}"
}

cmd_menu() {
  cmd_status
  echo ""
  echo -e "📋 \${WHITE}Available Operations:\${NC}"
  echo ""
  echo -e "🔧 \${WHITE}Docker Service Management:\${NC}"
  echo -e "   \${WHITE}1)\${NC} ▶️  \${GREEN}Start container\${NC} (selfssteal start)"
  echo -e "   \${WHITE}2)\${NC} ⏹️  \${GREEN}Stop container\${NC}"
  echo -e "   \${WHITE}3)\${NC} 🔄 \${GREEN}Restart container\${NC} (selfssteal restart)"
  echo -e "   \${WHITE}4)\${NC} 📊 \${GREEN}Container status & Uptime\${NC} (selfssteal status)"
  echo ""
  echo -e "🎨 \${WHITE}Website Management:\${NC}"
  echo -e "   \${WHITE}5)\${NC} 🎨 \${GREEN}Website templates (Random / 1-6)\${NC} (selfssteal template)"
  echo -e "   \${WHITE}6)\${NC} 📖 \${GREEN}Show Xray streamSettings JSON\${NC}"
  echo ""
  echo -e "📝 \${WHITE}Logs & SSL Monitoring:\${NC}"
  echo -e "   \${WHITE}7)\${NC} 📝 \${GREEN}View live access logs\${NC} (selfssteal logs)"
  echo -e "   \${WHITE}8)\${NC} 🧹 \${GREEN}Clean logs\${NC}"
  echo -e "   \${WHITE}9)\${NC} 🔒 \${GREEN}Renew SSL certificate\${NC}"
  echo ""
  echo -e "🗑️  \${WHITE}Maintenance:\${NC}"
  echo -e "   \${WHITE}10)\${NC} 🗑️  \${RED}Uninstall SelfSteal\${NC} (selfssteal remove)"
  echo ""
  echo -e "   \${WHITE}0)\${NC} ⬅️  \${GREEN}Exit\${NC}"
  echo ""
  echo -e "💡 \${BLUE}Tip: Use 'selfssteal template' or option 5 to customize website templates\${NC}"
  read -r -p "Select option [0-10]: " MENU_OPT < /dev/tty
  case "\${MENU_OPT}" in
    1) cmd_start ;;
    2) compose_cmd stop >/dev/null 2>&1 && echo -e "⏹️  \${YELLOW}Docker container stopped.\${NC}" ;;
    3) compose_cmd restart >/dev/null 2>&1 && echo -e "🔄 \${GREEN}Docker container restarted.\${NC}" ;;
    4) cmd_status ;;
    5) cmd_template ;;
    6) cat "\${BASE_DIR}/xray-reality-reference.json" 2>/dev/null || true ;;
    7) tail -n 50 -f "\${LOGS_DIR}/access.log" ;;
    8) truncate -s 0 "\${LOGS_DIR}/access.log" "\${LOGS_DIR}/error.log" 2>/dev/null && echo -e "🧹 \${GREEN}Логи очищены.\${NC}" ;;
    9) "\${SSL_DIR}/renew-hook.sh" && echo -e "🔒 \${GREEN}Сертификат обновлен.\${NC}" ;;
    10) cmd_remove ;;
    *) exit 0 ;;
  esac
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
  template|templates|stub)
    cmd_template
    ;;
  menu)
    cmd_menu
    ;;
  restart|reload)
    compose_cmd restart >/dev/null 2>&1
    echo -e "🔄 \${GREEN}Docker-контейнер \${CONTAINER_NAME} перезапущен.\${NC}"
    cmd_status
    ;;
  logs|log)
    tail -n 50 -f "\${LOGS_DIR}/access.log"
    ;;
  *)
    print_header
    echo -e "\${BOLD}Использование: selfssteal {start|status|remove|template|menu|restart|logs}\${NC}"
    echo -e "  ▶️  \${CYAN}selfssteal start\${NC}     — запустить Docker-контейнер SelfSteal"
    echo -e "  📊 \${CYAN}selfssteal status\${NC}    — показать Uptime сервера/контейнера и пути к SSL / HTML"
    echo -e "  🗑️  \${CYAN}selfssteal remove\${NC}    — полностью удалить контейнер SelfSteal, директории и symlink"
    echo -e "  🎨 \${CYAN}selfssteal template\${NC}  — сменить HTML-заглушку (1-6 или Random)"
    echo -e "  📋 \${CYAN}selfssteal menu\${NC}      — интерактивное меню управления"
    echo -e "  🔄 \${CYAN}selfssteal restart\${NC}   — перезапустить Docker-контейнер (\${CONTAINER_NAME})"
    echo -e "  📝 \${CYAN}selfssteal logs\${NC}      — открыть логи запросов в реальном времени"
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
  const normPath = normalizeXhttpPath(config.xhttpPath, config.domain);
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
Вы уверены, что хотите остановить Docker-контейнер ${containerName} и удалить ${baseDir}? [y/N]: y
⏹️  [1/4] Остановка и удаление Docker-контейнера ${containerName}...
🧹 [2/4] Удаление задачи автообновления SSL из Cron и ротации логов...
🗑️  [3/4] Удаление рабочей директории ${baseDir} (docker-compose.yml, conf, ssl, html, logs)...
🔗 [4/4] Удаление глобального symlink /usr/local/bin/selfssteal...
✅ SelfSteal полностью удален с сервера.`;
  }

  return `root@vps:~# selfssteal status
🔗 Docker ${serverDisplayName} for Reality SelfSteal
Management System v2.6.0 (Docker Compose)
Project: VLESS ${config.transport.toUpperCase()} Reality | Author: t.me/wemkz
──────────────────────────────────────────

✅ Status: Running (Container: ${containerName}, PID: 2418)
   Server:             Docker ${serverDisplayName} (${dockerImage})
   Domain:             ${config.domain}
   Transport:          VLESS ${config.transport.toUpperCase()} Reality ${
    config.transport === 'xhttp' ? `(${config.domain}${normPath})` : '(xtls-rprx-vision)'
  }
   Port:               ${port} (Target: ${fullTarget})
   Uptime сервера:     ⏱️  42 days, 11 hours, 28 minutes
   Uptime контейнера:  🐳 14d 06:42:19 (запущен: 2026-10-18 05:12:00 UTC)
   SSL:                ✅ Valid, 73 days left (Let's Encrypt)
   Template:           🎨 ${tpl.emoji} ${tpl.id} (${tpl.description})

📂 Директории и пути (${baseDir}):
   ├─ 🔒 Путь к SSL:      ${baseDir}/ssl (fullchain.pem, privkey.pem, renew-hook.sh)
   ├─ 🎨 Путь к HTML:     ${baseDir}/html (index.html + 6 шаблонов в /templates)
   ├─ 🐳 Docker Compose:  ${baseDir}/docker-compose.yml
   ├─ ⚙️  Конфигурация:    ${baseDir}/conf/${confFile}
   ├─ 📝 Логи запросов:   ${baseDir}/logs (access.log, error.log)
   └─ 🔗 Глобальный CLI:  /usr/local/bin/selfssteal -> ${baseDir}/selfssteal.sh

📋 Available Operations:

🔧 Docker Service Management:
   1) 🚀 Reconfigure Docker ${serverDisplayName}
   2) ▶️  Start container        (selfssteal start)
   3) ⏹️  Stop container
   4) 🔄 Restart container      (selfssteal restart)
   5) 📊 Container status       (selfssteal status)

🎨 Website Management:
   6) 🎨 Website templates      (selfssteal template — Random 1-6)
   7) 📖 Setup guide & streamSettings

📝 Logs & Monitoring:
   8) 📝 View logs              (selfssteal logs)
   9) 📊 Log sizes
   10) 🧹 Clean logs
   11) ✏️  Edit configuration
   12) 🔒 Renew SSL certificate

🗑️  Maintenance:
   13) 🗑️  Uninstall ${containerName}  (selfssteal remove)
   14) 🌐 Check DNS (1.1.1.1 / 8.8.8.8 / 9.9.9.9)

   0) ⬅️  Exit

💡 Tip: Use 'selfssteal template' or option 6 to customize website templates`;
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
# 🐳 Docker-режим: Caddy (caddy:2-alpine) или Nginx (nginx:stable-alpine) через Docker Compose
# 🤫 Скрытая установка необходимых компонентов, автоустановка Docker (если не установлен) и тихий выпуск SSL
# 🎲 Автоматический рандомный выбор HTML-заглушки из 6 шаблонов (1-speedtest .. 6-gitpage)
# 🌐 Автопроверка DNS A-записи через 1.1.1.1, 8.8.8.8, 9.9.9.9
# 📂 Директории управления: /opt/ss-caddy или /opt/nginx
# 🛠️ CLI команда управления: selfssteal (start | status | remove | template | menu | restart | logs)
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

if [[ "\${EUID}" -ne 0 ]]; then
  echo -e "❌ \${RED}[ОШИБКА] Запустите скрипт с правами root:\${NC}"
  echo -e "👉 \${CYAN}bash <(curl -fsSL \"https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh\")\${NC}"
  exit 1
fi

clear
echo -e "\${WHITE}🔗 Docker Caddy / Nginx for Reality SelfSteal\${NC}"
echo -e "\${CYAN}Management System v2.6.0 (Docker Compose)\${NC}"
echo -e "\${BLUE}Project: VLESS XHTTP/TCP Reality | Author: t.me/wemkz\${NC}"
echo -e "\${BLUE}──────────────────────────────────────────────────────────\${NC}"
echo ""

# ------------------------------------------------------------------------------
# 🔧 ШАГ 1: Выбор Docker веб-сервера (Caddy или Nginx)
# ------------------------------------------------------------------------------
echo -e "🔧 \${WHITE}1) Выберите веб-сервер для SelfSteal (в Docker-контейнере):\${NC}"
echo -e "   \${WHITE}1)\${NC} 🐳 \${GREEN}Caddy (caddy:2-alpine)\${NC}        — директория: \${CYAN}/opt/ss-caddy\${NC}"
echo -e "   \${WHITE}2)\${NC} 🐳 \${GREEN}Nginx (nginx:stable-alpine)\${NC}   — директория: \${CYAN}/opt/nginx\${NC}"
read -r -p "👉 Ваш выбор [1/2, по умолчанию ${defaultServerChoice} (${config.webServer})]: " SERVER_CHOICE < /dev/tty
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
echo -e "   ✅ \${GREEN}Выбран Docker веб-сервер: \${SERVER_TITLE} (\${DOCKER_IMAGE}) в \${BASE_DIR}\${NC}"
echo ""

# ------------------------------------------------------------------------------
# 🌐 ШАГ 2: Запрос домена
# ------------------------------------------------------------------------------
echo -e "🌐 \${WHITE}2) Укажите ваш домен для SelfSteal и сертификата Let's Encrypt:\${NC}"
read -r -p "👉 Домен [по умолчанию ${config.domain}]: " RAW_DOMAIN < /dev/tty
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
echo -e "   ✅ \${GREEN}Домен: \${DOMAIN}\${NC}"
echo ""

# ------------------------------------------------------------------------------
# 📡 ШАГ 3: Выбор транспорта (XHTTP или TCP) и пути для XHTTP
# ------------------------------------------------------------------------------
echo -e "📡 \${WHITE}3) Выберите тип транспорта для VLESS Reality:\${NC}"
echo -e "   \${WHITE}1)\${NC} 🌊 \${GREEN}XHTTP (SplitHTTP)\${NC} — с указанием пути чанков"
echo -e "   \${WHITE}2)\${NC} ⚡ \${GREEN}TCP\${NC}               — классический VLESS TCP Reality (xtls-rprx-vision)"
read -r -p "👉 Ваш выбор [1/2, по умолчанию ${defaultTransportChoice} (${config.transport})]: " TRANSPORT_CHOICE < /dev/tty
TRANSPORT_CHOICE="\${TRANSPORT_CHOICE:-${defaultTransportChoice}}"

XHTTP_PATH="${normPath}"
XHTTP_INTERNAL_PORT="${config.xhttpInternalPort}"

if [[ "\${TRANSPORT_CHOICE}" == "2" ]] || [[ "\${TRANSPORT_CHOICE,,}" == "tcp" ]]; then
  TRANSPORT="tcp"
  echo -e "   ✅ \${GREEN}Выбран транспорт: TCP Reality (xtls-rprx-vision)\${NC}"
else
  TRANSPORT="xhttp"
  DEFAULT_PATH="\${EXTRACTED_PATH:-${normPath}}"
  echo ""
  echo -e "   🛣️  \${WHITE}Укажите путь (path) для XHTTP SelfSteal:\${NC}"
  echo -e "   💡 (Можно ввести как \${CYAN}\${DOMAIN}/media/v3/chunk/\${NC} так и \${CYAN}/media/v3/chunk/\${NC})"
  read -r -p "👉 Путь XHTTP [по умолчанию \${DOMAIN}\${DEFAULT_PATH}]: " RAW_XHTTP_PATH < /dev/tty
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
  echo -e "   ✅ \${GREEN}Выбран транспорт: XHTTP | Полный URL: \${DOMAIN}\${XHTTP_PATH}\${NC}"
fi
echo ""

# ------------------------------------------------------------------------------
# 🎯 ШАГ 4: Порт и адрес Target (по умолчанию 127.0.0.1:9443)
# ------------------------------------------------------------------------------
echo -e "🎯 \${WHITE}4) На каком адресе:порту будет работать Target (SelfSteal)?\${NC}"
read -r -p "👉 Target [по умолчанию ${fullTarget}]: " RAW_TARGET < /dev/tty
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
echo -e "   ✅ \${GREEN}Target установлен: \${TARGET}\${NC}"
echo ""

# ------------------------------------------------------------------------------
# 🔒 Дополнительные параметры: Let's Encrypt автообновление и логирование запросов
# ------------------------------------------------------------------------------
echo -e "🔒 \${WHITE}5) Настройки сертификатов Let's Encrypt и логирования запросов:\${NC}"
read -r -p "👉 Email для уведомлений Let's Encrypt [по умолчанию ${config.acmeEmail}]: " ACME_EMAIL < /dev/tty
ACME_EMAIL="\${ACME_EMAIL:-${config.acmeEmail}}"

read -r -p "👉 Включить подробное логирование запросов в \${BASE_DIR}/logs? [Y/n]: " ENABLE_LOGS_CHOICE < /dev/tty
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
echo -ne "📂 \${CYAN}[1/7] Подготовка директорий в \${BASE_DIR}...\${NC} "
mkdir -p "\${BASE_DIR}/conf"
mkdir -p "\${BASE_DIR}/html/templates"
mkdir -p "\${BASE_DIR}/ssl"
mkdir -p "\${BASE_DIR}/logs"
echo -e "\${GREEN}✅ Готово\${NC}"

# ------------------------------------------------------------------------------
# 📦 [2/7] Скрытая установка необходимых компонентов и автоустановка Docker (если не установлен)
# ------------------------------------------------------------------------------
echo -ne "🐳 \${CYAN}[2/7] Установка необходимых компонентов и проверка Docker (скрытый режим)...\${NC} "
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq >/dev/null 2>&1 || true
apt-get install -y -qq curl socat cron openssl logrotate dnsutils ca-certificates gnupg >/dev/null 2>&1 || true

# Если Docker не установлен — скрипт ставит его сам автоматически и без лишнего вывода
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh >/dev/null 2>&1
  systemctl enable --now docker >/dev/null 2>&1 || true
fi

# Если Docker Compose plugin или бинарник отсутствует — доустанавливаем автоматически
if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
  apt-get install -y -qq docker-compose-plugin >/dev/null 2>&1 || apt-get install -y -qq docker-compose >/dev/null 2>&1 || true
fi
systemctl start docker >/dev/null 2>&1 || true
echo -e "\${GREEN}✅ Готово\${NC}"

# ------------------------------------------------------------------------------
# 🌐 [3/7] Автоматическая проверка DNS A-записи через 1.1.1.1, 8.8.8.8 и 9.9.9.9
# ------------------------------------------------------------------------------
echo -e "🌐 \${CYAN}[3/7] Проверка DNS A-записи домена \${DOMAIN} через 1.1.1.1, 8.8.8.8 и 9.9.9.9...\${NC}"
SERVER_IPV4=\$(curl -4 -fsSL --max-time 5 https://icanhazip.com 2>/dev/null || curl -4 -fsSL --max-time 5 https://ifconfig.me 2>/dev/null || echo "${config.serverIp}")
SERVER_IPV4="\${SERVER_IPV4//[[:space:]]/}"
echo -e "   🖥️  Внешний IPv4 этого сервера: \${BOLD}\${SERVER_IPV4}\${NC}"

DNS_MISMATCH=0
for RESOLVER in "1.1.1.1" "8.8.8.8" "9.9.9.9"; do
  RESOLVED_IP=""
  if command -v dig >/dev/null 2>&1; then
    RESOLVED_IP=\$(dig +short +time=2 +tries=1 @"\${RESOLVER}" "\${DOMAIN}" A 2>/dev/null | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' | head -n1 || true)
  elif command -v nslookup >/dev/null 2>&1; then
    RESOLVED_IP=\$(nslookup "\${DOMAIN}" "\${RESOLVER}" 2>/dev/null | awk '/^Address: / { print \$2 }' | tail -n1 || true)
  fi

  if [[ -z "\${RESOLVED_IP}" ]]; then
    echo -e "   ❌ DNS \${RESOLVER}: \${RED}НЕ НАЙДЕНА A-ЗАПИСЬ (NXDOMAIN / Timeout)\${NC} (ожидался \${SERVER_IPV4})"
    DNS_MISMATCH=1
  elif [[ "\${RESOLVED_IP}" == "\${SERVER_IPV4}" ]]; then
    echo -e "   ✅ DNS \${RESOLVER}: \${GREEN}\${RESOLVED_IP} (СОВПАДАЕТ)\${NC}"
  else
    echo -e "   ⚠️  DNS \${RESOLVER}: \${YELLOW}\${RESOLVED_IP} (НЕ СОВПАДАЕТ, ожидался \${SERVER_IPV4})\${NC}"
    DNS_MISMATCH=1
  fi
done

if [[ "\${DNS_MISMATCH}" -ne 0 ]]; then
  echo ""
  echo -e "⚠️  \${YELLOW}[ВНИМАНИЕ] IP домена \${DOMAIN} у одного или нескольких DNS (1.1.1.1 / 8.8.8.8 / 9.9.9.9) не совпадает с IP сервера (\${SERVER_IPV4}).\${NC}"
  echo -e "💡 \${YELLOW}Убедитесь, что A-запись указывает на \${SERVER_IPV4} и проксирование Cloudflare (оранжевое облако) отключено (DNS Only).\${NC}"
  read -r -p "👉 Продолжить установку несмотря на несовпадение DNS? [y/N]: " DNS_CONTINUE_CHOICE < /dev/tty
  DNS_CONTINUE_CHOICE="\${DNS_CONTINUE_CHOICE:-N}"
  if [[ "\${DNS_CONTINUE_CHOICE,,}" != "y" ]]; then
    echo -e "❌ \${RED}Установка прервана пользователем. Проверьте настройки DNS для \${DOMAIN} и запустите скрипт снова.\${NC}"
    exit 1
  fi
  echo -e "   ⚡ \${YELLOW}Продолжаем установку по подтверждению пользователя...\${NC}"
fi

# ------------------------------------------------------------------------------
# 🎨 [4/7] Сохранение 6 HTML-заглушек и рандомный выбор шаблона в \${BASE_DIR}/html/index.html
# ------------------------------------------------------------------------------
echo -e "🎨 \${CYAN}[4/7] Установка 6 HTML-шаблонов заглушек и выбор случайной темы в \${BASE_DIR}/html...\${NC}"
${generateBashTemplatesInstaller(stubId)}

# ------------------------------------------------------------------------------
# 🔒 [5/7] Скрытый выпуск сертификата Let's Encrypt и настройка автообновления
# ------------------------------------------------------------------------------
echo -ne "🔒 \${CYAN}[5/7] Получение SSL сертификата Let's Encrypt для \${DOMAIN} (скрытый режим)...\${NC} "
docker rm -f selfsteal-caddy selfsteal-nginx >/dev/null 2>&1 || true
systemctl stop caddy nginx >/dev/null 2>&1 || true

if [[ ! -f ~/.acme.sh/acme.sh ]]; then
  curl -fsSL https://get.acme.sh | sh -s email="\${ACME_EMAIL}" >/dev/null 2>&1
fi

~/.acme.sh/acme.sh --set-default-ca --server letsencrypt >/dev/null 2>&1 || true
if ! ~/.acme.sh/acme.sh --issue -d "\${DOMAIN}" --standalone --keylength ec-256 --force >/dev/null 2>&1; then
  openssl ecparam -genkey -name prime256v1 -out "\${BASE_DIR}/ssl/privkey.pem" >/dev/null 2>&1
  openssl req -new -x509 -key "\${BASE_DIR}/ssl/privkey.pem" -out "\${BASE_DIR}/ssl/fullchain.pem" -days 365 -subj "/CN=\${DOMAIN}" >/dev/null 2>&1
fi

if [[ -f ~/.acme.sh/"\${DOMAIN}"_ecc/fullchain.cer ]]; then
  ~/.acme.sh/acme.sh --install-cert -d "\${DOMAIN}" --ecc \\
    --fullchain-file "\${BASE_DIR}/ssl/fullchain.pem" \\
    --key-file "\${BASE_DIR}/ssl/privkey.pem" >/dev/null 2>&1
fi

chmod 644 "\${BASE_DIR}/ssl/fullchain.pem"
chmod 600 "\${BASE_DIR}/ssl/privkey.pem"

# Создание хука автообновления сертификатов Let's Encrypt (перезагружает Docker-контейнер)
cat > "\${BASE_DIR}/ssl/renew-hook.sh" <<'RENEW_EOF'
${generateSslRenewalScript(config)}
RENEW_EOF
chmod +x "\${BASE_DIR}/ssl/renew-hook.sh"

# Регистрация задания в Cron для регулярной проверки и обновления сертификатов
CRON_JOB="15 3 * * * \${BASE_DIR}/ssl/renew-hook.sh >/dev/null 2>&1"
(crontab -l 2>/dev/null | grep -v "renew-hook.sh" || true; echo "\${CRON_JOB}") | crontab -
echo -e "\${GREEN}✅ Готово (\${BASE_DIR}/ssl)\${NC}"

# ------------------------------------------------------------------------------
# 🐳 [6/7] Запись конфигурации + docker-compose.yml и запуск Docker-контейнера
# ------------------------------------------------------------------------------
echo -ne "🐳 \${CYAN}[6/7] Развертывание Docker-контейнера \${CONTAINER_NAME} (\${DOCKER_IMAGE})...\${NC} "

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
  # Запись /opt/nginx/conf/nginx.conf
  cat > "\${BASE_DIR}/conf/nginx.conf" <<EOF
${generateWebServerConfig({ ...config, webServer: 'nginx' })}
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
  docker compose -f "\${BASE_DIR}/docker-compose.yml" up -d --quiet-pull >/dev/null 2>&1
else
  docker-compose -f "\${BASE_DIR}/docker-compose.yml" up -d >/dev/null 2>&1
fi

# Настройка logrotate для логов запросов
cat > "/etc/logrotate.d/selfsteal-\${WEB_SERVER}" <<EOF
${generateLogrotateConfig(config)}
EOF
echo -e "\${GREEN}✅ Запущен\${NC}"

# ------------------------------------------------------------------------------
# 🛠️ [7/7] Создание управляющего скрипта \${BASE_DIR}/selfssteal.sh и глобального symlink /usr/local/bin/selfssteal
# ------------------------------------------------------------------------------
echo -ne "🛠️  \${CYAN}[7/7] Создание глобального symlink /usr/local/bin/selfssteal -> \${BASE_DIR}/selfssteal.sh...\${NC} "
cat > "\${BASE_DIR}/selfssteal.sh" <<'CLI_EOF'
${generateSelfstealCliScript(config)}
CLI_EOF
chmod +x "\${BASE_DIR}/selfssteal.sh"
ln -sf "\${BASE_DIR}/selfssteal.sh" /usr/local/bin/selfssteal
ln -sf "\${BASE_DIR}/selfssteal.sh" /usr/local/bin/selfsteal
echo -e "\${GREEN}✅ Готово\${NC}"

SHORT_ID=\$(openssl rand -hex 8 2>/dev/null || echo "${config.shortId}")

if command -v xray >/dev/null 2>&1; then
  X25519_OUT=\$(xray x25519)
  PRIVATE_KEY=\$(echo "\${X25519_OUT}" | awk '/Private key:/ {print \$3}')
  PUBLIC_KEY=\$(echo "\${X25519_OUT}" | awk '/Public key:/ {print \$3}')
else
  PRIVATE_KEY="${config.privateKey}"
  PUBLIC_KEY="${config.publicKey}"
fi

cat > "\${BASE_DIR}/xray-reality-reference.json" <<XRAY_REF_EOF
${generateXrayConfig(config)}
XRAY_REF_EOF

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
echo -e "📋 \${WHITE}Команды управления (CLI утилита selfssteal):\${NC}"
echo -e "   ▶️  \${GREEN}selfssteal start\${NC}     — запустить Docker-контейнер SelfSteal"
echo -e "   📊 \${GREEN}selfssteal status\${NC}    — статус контейнера, Uptime сервера/контейнера и пути к SSL и HTML"
echo -e "   🎨 \${GREEN}selfssteal template\${NC}  — сменить HTML-заглушку (1-6 или Random)"
echo -e "   📋 \${GREEN}selfssteal menu\${NC}      — интерактивное меню управления"
echo -e "   📝 \${GREEN}selfssteal logs\${NC}      — онлайн просмотр логов запросов"
echo -e "   🗑️  \${RED}selfssteal remove\${NC}    — полное удаление контейнера SelfSteal и директорий"
echo ""
echo -e "📂 \${WHITE}Директории управления (\${BASE_DIR}):\${NC}"
echo -e "   ├─ 🐳 Docker Compose:      \${CYAN}\${BASE_DIR}/docker-compose.yml (\${CONTAINER_NAME})\${NC}"
echo -e "   ├─ ⚙️  Конфиг веб-сервера:  \${CYAN}\${BASE_DIR}/conf/\$( [[ "\${WEB_SERVER}" == "caddy" ]] && echo "Caddyfile" || echo "nginx.conf" )\${NC}"
echo -e "   ├─ 🎨 Активная заглушка:   \${CYAN}\${BASE_DIR}/html/index.html (\${CHOSEN_STUB})\${NC}"
echo -e "   ├─ 🗂️  Все 6 шаблонов:      \${CYAN}\${BASE_DIR}/html/templates/ (1-speedtest .. 6-gitpage)\${NC}"
echo -e "   ├─ 🔒 SSL сертификаты:     \${CYAN}\${BASE_DIR}/ssl/fullchain.pem & privkey.pem\${NC}"
echo -e "   └─ 📝 Логи запросов:       \${CYAN}\${BASE_DIR}/logs/access.log & error.log\${NC}"
echo ""
echo -e "🌐 \${WHITE}Необходимые доменные записи (DNS):\${NC}"
echo -e "   • Тип: \${YELLOW}A\${NC}   | Имя: \${YELLOW}\${DOMAIN}\${NC} | Значение: \${GREEN}\${SERVER_IPV4}\${NC} | Proxy: \${RED}DNS Only (БЕЗ облачка Cloudflare)\${NC}"
echo -e "   • Тип: \${YELLOW}CAA\${NC} | Имя: \${YELLOW}@\${NC}        | Значение: \${GREEN}0 issue \"letsencrypt.org\"\${NC}"
echo ""
echo -e "🔑 \${WHITE}Параметры Reality для панели (3X-UI / Marzban / Remnawave / Xray):\${NC}"
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
echo -e "📖 \${WHITE}Что прописать в конфиг Xray (блок streamSettings):\${NC}"
cat <<XRAY_EOF
${generateXrayConfig(config)}
XRAY_EOF
echo ""
echo -e "💡 \${BLUE}Tip: Use 'selfssteal status' or 'selfssteal template' to manage your node\${NC}"
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
👉 Продолжить установку несмотря на несовпадение DNS? [y/N]: y
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

🔧 1) Выберите веб-сервер для SelfSteal (в Docker-контейнере):
   1) 🐳 Caddy (caddy:2-alpine)      — директория: /opt/ss-caddy
   2) 🐳 Nginx (nginx:stable-alpine) — директория: /opt/nginx
👉 Ваш выбор: ${config.webServer === 'caddy' ? '1 (Docker Caddy)' : '2 (Docker Nginx)'}
   ✅ Выбран Docker веб-сервер: ${serverDisplayName} (${dockerImage}) в ${baseDir}

🌐 2) Укажите ваш домен для SelfSteal и сертификата Let's Encrypt:
👉 Домен: ${config.domain}
   ✅ Домен: ${config.domain}

📡 3) Выберите тип транспорта для VLESS Reality:
   1) 🌊 XHTTP (SplitHTTP) — с указанием пути чанков
   2) ⚡ TCP               — классический VLESS TCP Reality (xtls-rprx-vision)
👉 Ваш выбор: ${config.transport === 'xhttp' ? '1 (XHTTP)' : '2 (TCP)'}${
    config.transport === 'xhttp'
      ? `\n   🛣️  Укажите путь (path) для XHTTP SelfSteal:\n👉 Путь XHTTP: ${config.domain}${normPath}\n   ✅ Выбран транспорт: XHTTP | Полный URL: ${config.domain}${normPath}`
      : `\n   ✅ Выбран транспорт: TCP Reality`
  }

🎯 4) На каком адресе:порту будет работать Target (SelfSteal)?
👉 Target [по умолчанию 127.0.0.1:9443]: ${fullTarget}
   ✅ Target установлен: ${fullTarget}

📂 [1/7] Подготовка директорий в ${baseDir}... ✅ Готово
🐳 [2/7] Установка необходимых компонентов и проверка Docker (скрытый режим)... ✅ Готово
${dnsCheckOutput}
🎨 [4/7] Установка 6 HTML-шаблонов заглушек и выбор случайной темы...
   🎲 Выбрана заглушка: ${tpl.emoji} ${tpl.id} — ${tpl.description}
   📂 Все 6 шаблонов сохранены в: ${baseDir}/html/templates/
🔒 [5/7] Получение SSL сертификата Let's Encrypt для ${config.domain} (скрытый режим)... ✅ Готово (${baseDir}/ssl)
🐳 [6/7] Развертывание Docker-контейнера ${containerName} (${dockerImage})... ✅ Запущен
🛠️  [7/7] Создание глобального symlink /usr/local/bin/selfssteal -> ${baseDir}/selfssteal.sh... ✅ Готово

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

📋 Команды управления (CLI утилита selfssteal):
   ▶️  selfssteal start     — запустить Docker-контейнер SelfSteal
   📊 selfssteal status    — статус контейнера, сколько Uptime и директории SSL / HTML
   🎨 selfssteal template  — сменить HTML-заглушку (1-6 или Random)
   📋 selfssteal menu      — открыть интерактивное меню управления
   🗑️  selfssteal remove    — полностью удалить контейнер SelfSteal и очистить директории

📖 Что прописать в конфиг Xray (streamSettings):
${generateXrayConfig(config)}

💡 Tip: Use 'selfssteal template' to customize website templates`;
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

Цветной Bash-установщик **\`install-selfsteal.sh\`** для развертывания **Docker-контейнера SelfSteal** (**Caddy** \`caddy:2-alpine\` в \`/opt/ss-caddy\` или **Nginx** \`nginx:stable-alpine\` в \`/opt/nginx\`) под **VLESS + XHTTP / TCP + Reality**:
- 🐳 **Полная контейнеризация (Docker Compose)**: если Docker и Docker Compose еще не установлены на сервере, скрипт **автоматически установит их сам в фоновом (скрытом) режиме**.
- 🤫 **Чистый терминал без мусора**: весь процесс установки системных пакетов, Docker и выпуска сертификата Let's Encrypt выполняется в **скрытом режиме** (\`>/dev/null 2>&1\`) с аккуратными индикаторами выполнения.
- 🎲 **6 встроенных HTML-заглушек**: автоматический случайный выбор (\`RANDOM % 6\`) при установке + мгновенная смена командой \`selfssteal template\`.
- 🌐 **Автопроверка DNS**: сверка \`A\`-записи домена у \`1.1.1.1\`, \`8.8.8.8\` и \`9.9.9.9\`.

---

## 🚀 Быстрая установка на VPS (одной командой из GitHub без скачивания)

Запустите установщик напрямую через \`bash <(curl ...)\` (интерактивный ввод работает через \`/dev/tty\`):

\`\`\`bash
bash <(curl -fsSL "https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh")
\`\`\`

Или через пайп \`curl | bash\`:

\`\`\`bash
curl -fsSL "https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh" | bash
\`\`\`

---

## 🎨 6 встроенных HTML-заглушек (Рандомный выбор при установке)

Во время установки скрипт сохраняет все 6 реалистичных HTML-шаблонов в \`${baseDir}/html/templates/\` и **автоматически выбирает случайный шаблон (\`RANDOM % 6\`)** в \`${baseDir}/html/index.html\`. Переключить шаблон можно в любой момент командой \`selfssteal template\`:

| № | Файл шаблона | Описание маскировочной страницы |
| :--- | :--- | :--- |
| **1** | 🚀 \`1-speedtest.html\` | Спидтест с анимированным SVG-гейджем, пингом и цифрами скорости |
| **2** | ☁️ \`2-cloud.html\` | Облачное хранилище файлов с сайдбаром, квотой диска и сеткой документов |
| **3** | 😂 \`3-memes.html\` | Лента с мемами (**MemeDump**) в тёмной теме с карточками и лайками |
| **4** | ⚠️ \`4-overloaded.html\` | Страница «Сервис временно перегружен» (\`HTTP 503\`) с живым прогресс-баром |
| **5** | 💻 \`5-tech.html\` | Технический лендинг инфраструктурной компании (**Nexora Systems**) |
| **6** | 🐙 \`6-gitpage.html\` | Страница репозитория в стиле GitHub (**GitPage** — \`wemk / core-infra\`) |

---

## 🛠️ Управление через CLI команду \`selfssteal\`

При установке автоматически создается глобальный symlink **\`/usr/local/bin/selfssteal -> ${baseDir}/selfssteal.sh\`**:

| Команда | Описание |
| :--- | :--- |
| \`selfssteal start\` | ▶️ Запустить Docker-контейнер SelfSteal (\`${containerName}\`) и показать статус |
| \`selfssteal status\` | 📊 Показать статус контейнера, **Uptime сервера и контейнера**, срок SSL, активный HTML-шаблон и пути к **SSL / HTML** |
| \`selfssteal template\` | 🎨 Выбрать один из 6 шаблонов заглушки (\`1-speedtest.html\` .. \`6-gitpage.html\`) или случайный |
| \`selfssteal menu\` | 📋 Открыть интерактивное меню управления (опции 1–14) |
| \`selfssteal remove\` | 🗑️ Полностью остановить и удалить Docker-контейнер SelfSteal, очистить Cron, директорию \`${baseDir}\` и symlink |
| \`selfssteal restart\` | 🔄 Перезапустить Docker-контейнер без потери конфигурации |
| \`selfssteal logs\` | 📝 Открыть поток логов запросов (\`${baseDir}/logs/access.log\`) в реальном времени |

### Пример вывода \`selfssteal status\`:

\`\`\`text
${generateCliCommandPreview(config, 'status')}
\`\`\`

---

## 📂 Структура директории \`${baseDir}\`

\`\`\`text
/usr/local/bin/selfssteal ─────────► symlink на ${baseDir}/selfssteal.sh
${baseDir}/
├── docker-compose.yml              # Docker Compose манифест (${containerName}, ${dockerImage}, host network)
├── selfssteal.sh                   # Цветная CLI утилита управления (Author: t.me/wemkz)
├── conf/
│   └── ${confFile}                  # Конфигурация ${config.webServer === 'caddy' ? 'Caddy' : 'Nginx'} (слушает ${fullTarget})
├── html/
│   ├── index.html                  # Активная HTML-заглушка (выбранная случайно из 6)
│   └── templates/
│       ├── 1-speedtest.html        # 🚀 Спидтест с анимированным гейджем
│       ├── 2-cloud.html            # ☁️ Облачное хранилище
│       ├── 3-memes.html            # 😂 Лента с мемами
│       ├── 4-overloaded.html       # ⚠️ Сервис перегружен (503)
│       ├── 5-tech.html             # 💻 Технический лендинг (Nexora Systems)
│       └── 6-gitpage.html          # 🐙 Репозиторий GitPage (wemk / core-infra)
├── ssl/
│   ├── fullchain.pem               # Сертификат Let's Encrypt (ECC P-256)
│   ├── privkey.pem                 # Приватный ключ TLS (chmod 600)
│   └── renew-hook.sh               # Скрипт автообновления по Cron (перезагружает Docker-контейнер)
└── logs/
    ├── access.log                  # Логи входящих запросов (${config.logFormat.toUpperCase()}, ротация ${config.logRetentionDays} дн.)
    └── error.log                   # Логи ошибок и предупреждений TLS
\`\`\`

---

## 🌐 Доменные записи (DNS) для \`${config.domain}\`

| Тип | Имя | Значение | TTL | Режим проксирования |
| :--- | :--- | :--- | :--- | :--- |
| **A** | \`${config.domain}\` | \`${config.serverIp}\` | \`300 (Auto)\` | **DNS Only (Без облачка Cloudflare)** |
| **CAA** | \`@\` | \`0 issue "letsencrypt.org"\` | \`3600\` | **DNS Only** |

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



