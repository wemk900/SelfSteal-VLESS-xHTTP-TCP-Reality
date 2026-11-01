#!/usr/bin/env bash
# ==============================================================================
# SelfSteal Installer for VLESS XHTTP / TCP Reality (Caddy / Nginx)
# Поддержка: Ubuntu 20.04/22.04/24.04, Debian 11/12
# Автообновление Let's Encrypt (acme.sh / certbot) + Логирование запросов
# Директории управления: /opt/ss-caddy или /opt/nginx
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

if [[ "${EUID}" -ne 0 ]]; then
  echo -e "${RED}[ОШИБКА] Запустите скрипт с правами root (sudo bash install-selfsteal.sh)${NC}"
  exit 1
fi

clear
echo -e "${CYAN}========================================================================${NC}"
echo -e "${BOLD}   УСТАНОВЩИК SELFSTEAL ДЛЯ VLESS XHTTP / TCP REALITY (CADDY / NGINX)   ${NC}"
echo -e "${CYAN}========================================================================${NC}"
echo ""

# ------------------------------------------------------------------------------
# ШАГ 1: Выбор веб-сервера (Caddy или Nginx)
# ------------------------------------------------------------------------------
echo -e "${BOLD}1) Выберите веб-сервер для SelfSteal:${NC}"
echo -e "   [1] Caddy  (директория: /opt/ss-caddy)"
echo -e "   [2] Nginx  (директория: /opt/nginx)"
read -r -p "Ваш выбор [1/2, по умолчанию 1 (Caddy)]: " SERVER_CHOICE
SERVER_CHOICE="${SERVER_CHOICE:-1}"

if [[ "${SERVER_CHOICE}" == "2" ]] || [[ "${SERVER_CHOICE,,}" == "nginx" ]]; then
  WEB_SERVER="nginx"
  BASE_DIR="/opt/nginx"
else
  WEB_SERVER="caddy"
  BASE_DIR="/opt/ss-caddy"
fi
echo -e "   ${GREEN}-> Выбран веб-сервер: ${WEB_SERVER^^} (${BASE_DIR})${NC}"
echo ""

# ------------------------------------------------------------------------------
# ШАГ 2: Запрос домена
# ------------------------------------------------------------------------------
echo -e "${BOLD}2) Укажите ваш домен для SelfSteal и сертификата Let's Encrypt:${NC}"
read -r -p "Домен [например, poland.example.xyz]: " RAW_DOMAIN
RAW_DOMAIN="${RAW_DOMAIN:-poland.example.xyz}"

CLEAN_INPUT="${RAW_DOMAIN#http://}"
CLEAN_INPUT="${CLEAN_INPUT#https://}"
EXTRACTED_PATH=""
if [[ "${CLEAN_INPUT}" == */* ]]; then
  DOMAIN="${CLEAN_INPUT%%/*}"
  EXTRACTED_PATH="/${CLEAN_INPUT#*/}"
else
  DOMAIN="${CLEAN_INPUT}"
fi
echo -e "   ${GREEN}-> Домен: ${DOMAIN}${NC}"
echo ""

# ------------------------------------------------------------------------------
# ШАГ 3: Выбор транспорта (XHTTP или TCP) и пути для XHTTP
# ------------------------------------------------------------------------------
echo -e "${BOLD}3) Выберите тип транспорта для VLESS Reality:${NC}"
echo -e "   [1] XHTTP (SplitHTTP) — с указанием пути чанков"
echo -e "   [2] TCP               — классический VLESS TCP Reality (xtls-rprx-vision)"
read -r -p "Ваш выбор [1/2, по умолчанию 1 (XHTTP)]: " TRANSPORT_CHOICE
TRANSPORT_CHOICE="${TRANSPORT_CHOICE:-1}"

XHTTP_PATH="/media/v3/chunk/"
XHTTP_INTERNAL_PORT="8080"

if [[ "${TRANSPORT_CHOICE}" == "2" ]] || [[ "${TRANSPORT_CHOICE,,}" == "tcp" ]]; then
  TRANSPORT="tcp"
  echo -e "   ${GREEN}-> Выбран транспорт: TCP Reality${NC}"
else
  TRANSPORT="xhttp"
  DEFAULT_PATH="${EXTRACTED_PATH:-/media/v3/chunk/}"
  echo ""
  echo -e "${BOLD}   Укажите путь (path) для XHTTP SelfSteal:${NC}"
  echo -e "   (Можно ввести как ${DOMAIN}/media/v3/chunk/ так и /media/v3/chunk/)"
  read -r -p "Путь XHTTP [по умолчанию ${DOMAIN}${DEFAULT_PATH}]: " RAW_XHTTP_PATH
  RAW_XHTTP_PATH="${RAW_XHTTP_PATH:-${DEFAULT_PATH}}"

  RAW_XHTTP_PATH="${RAW_XHTTP_PATH#http://}"
  RAW_XHTTP_PATH="${RAW_XHTTP_PATH#https://}"
  if [[ "${RAW_XHTTP_PATH}" == "${DOMAIN}"* ]]; then
    RAW_XHTTP_PATH="${RAW_XHTTP_PATH#${DOMAIN}}"
  elif [[ "${RAW_XHTTP_PATH}" != /* ]] && [[ "${RAW_XHTTP_PATH}" == */* ]]; then
    RAW_XHTTP_PATH="/${RAW_XHTTP_PATH#*/}"
  fi
  [[ "${RAW_XHTTP_PATH}" != /* ]] && RAW_XHTTP_PATH="/${RAW_XHTTP_PATH}"
  [[ "${RAW_XHTTP_PATH}" != */ ]] && RAW_XHTTP_PATH="${RAW_XHTTP_PATH}/"
  XHTTP_PATH="${RAW_XHTTP_PATH}"
  echo -e "   ${GREEN}-> Выбран транспорт: XHTTP | Полный URL: ${DOMAIN}${XHTTP_PATH}${NC}"
fi
echo ""

# ------------------------------------------------------------------------------
# ШАГ 4: Порт и адрес Target (по умолчанию 127.0.0.1:9443)
# ------------------------------------------------------------------------------
echo -e "${BOLD}4) На каком адресе:порту будет работать Target (SelfSteal)?${NC}"
read -r -p "Target [по умолчанию 127.0.0.1:9443]: " RAW_TARGET
RAW_TARGET="${RAW_TARGET:-127.0.0.1:9443}"

if [[ "${RAW_TARGET}" =~ ^[0-9]+$ ]]; then
  TARGET_HOST="127.0.0.1"
  TARGET_PORT="${RAW_TARGET}"
  TARGET="127.0.0.1:${RAW_TARGET}"
elif [[ "${RAW_TARGET}" == *:* ]]; then
  TARGET_HOST="${RAW_TARGET%:*}"
  TARGET_PORT="${RAW_TARGET##*:}"
  TARGET="${TARGET_HOST}:${TARGET_PORT}"
else
  TARGET_HOST="${RAW_TARGET}"
  TARGET_PORT="9443"
  TARGET="${TARGET_HOST}:9443"
fi
echo -e "   ${GREEN}-> Target установлен: ${TARGET}${NC}"
echo ""

# ------------------------------------------------------------------------------
# Дополнительные параметры: Let's Encrypt автообновление и логирование запросов
# ------------------------------------------------------------------------------
read -r -p "Email для уведомлений Let's Encrypt [по умолчанию admin@${DOMAIN}]: " ACME_EMAIL
ACME_EMAIL="${ACME_EMAIL:-admin@${DOMAIN}}"

mkdir -p "${BASE_DIR}/conf" "${BASE_DIR}/html" "${BASE_DIR}/ssl" "${BASE_DIR}/logs"

echo -e "${CYAN}[1/5] Установка пакетов и ${WEB_SERVER}...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq curl socat cron openssl logrotate ca-certificates

if [[ "${WEB_SERVER}" == "caddy" ]]; then
  if ! command -v caddy >/dev/null 2>&1; then
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https gnupg2
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    apt-get update -y -qq && apt-get install -y -qq caddy
  fi
else
  if ! command -v nginx >/dev/null 2>&1; then
    apt-get install -y -qq nginx
  fi
fi

echo -e "${CYAN}[2/5] Создание маскировочного сайта в ${BASE_DIR}/html/index.html...${NC}"
cat > "${BASE_DIR}/html/index.html" <<EOF
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${DOMAIN} — Edge Gateway</title></head>
<body style="background:#0b0f17;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div><h1>${DOMAIN}</h1><p>Static Content Delivery Node · TLS 1.3 Active</p></div>
</body>
</html>
EOF

echo -e "${CYAN}[3/5] Выпуск сертификата Let's Encrypt и настройка автообновления в ${BASE_DIR}/ssl...${NC}"
if [[ ! -f ~/.acme.sh/acme.sh ]]; then
  curl -fsSL https://get.acme.sh | sh -s email="${ACME_EMAIL}"
fi

systemctl stop caddy >/dev/null 2>&1 || true
systemctl stop nginx >/dev/null 2>&1 || true

~/.acme.sh/acme.sh --set-default-ca --server letsencrypt
~/.acme.sh/acme.sh --issue -d "${DOMAIN}" --standalone --keylength ec-256 --force || {
  openssl ecparam -genkey -name prime256v1 -out "${BASE_DIR}/ssl/privkey.pem"
  openssl req -new -x509 -key "${BASE_DIR}/ssl/privkey.pem" -out "${BASE_DIR}/ssl/fullchain.pem" -days 365 -subj "/CN=${DOMAIN}"
}

if [[ -f ~/.acme.sh/"${DOMAIN}"_ecc/fullchain.cer ]]; then
  ~/.acme.sh/acme.sh --install-cert -d "${DOMAIN}" --ecc \
    --fullchain-file "${BASE_DIR}/ssl/fullchain.pem" \
    --key-file "${BASE_DIR}/ssl/privkey.pem"
fi

chmod 644 "${BASE_DIR}/ssl/fullchain.pem"
chmod 600 "${BASE_DIR}/ssl/privkey.pem"

cat > "${BASE_DIR}/ssl/renew-hook.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
~/.acme.sh/acme.sh --cron --home ~/.acme.sh >> "${BASE_DIR}/logs/ssl-renew.log" 2>&1
systemctl reload ${WEB_SERVER} || true
EOF
chmod +x "${BASE_DIR}/ssl/renew-hook.sh"
(crontab -l 2>/dev/null | grep -v "renew-hook.sh" || true; echo "15 3 * * * ${BASE_DIR}/ssl/renew-hook.sh >/dev/null 2>&1") | crontab -

echo -e "${CYAN}[4/5] Запись конфигурации веб-сервера и логирования запросов в ${BASE_DIR}...${NC}"
if [[ "${WEB_SERVER}" == "caddy" ]]; then
  cat > "${BASE_DIR}/conf/Caddyfile" <<EOF
{
  https_port ${TARGET_PORT}
  default_bind ${TARGET_HOST}
  auto_https disable_redirects
  storage file_system {
    root ${BASE_DIR}/ssl
  }
  email ${ACME_EMAIL}
}

https://${DOMAIN}:${TARGET_PORT} {
  bind ${TARGET_HOST}
  tls ${BASE_DIR}/ssl/fullchain.pem ${BASE_DIR}/ssl/privkey.pem {
    protocols tls1.2 tls1.3
    alpn h2 http/1.1
  }
  log {
    output file ${BASE_DIR}/logs/access.log {
      roll_size 50MiB
      roll_keep 5
    }
    format json
  }
  handle {
    root * ${BASE_DIR}/html
    try_files {path} {path}/ /index.html
    file_server
  }
}
EOF
  ln -sf "${BASE_DIR}/conf/Caddyfile" /etc/caddy/Caddyfile
  systemctl enable caddy && systemctl restart caddy
else
  cat > "${BASE_DIR}/conf/nginx.conf" <<EOF
user www-data;
worker_processes auto;
pid /run/nginx.pid;
error_log ${BASE_DIR}/logs/error.log warn;
events { worker_connections 2048; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    access_log ${BASE_DIR}/logs/access.log;
    server {
        listen ${TARGET_HOST}:${TARGET_PORT} ssl http2;
        server_name ${DOMAIN};
        root ${BASE_DIR}/html;
        index index.html;
        ssl_certificate ${BASE_DIR}/ssl/fullchain.pem;
        ssl_certificate_key ${BASE_DIR}/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        location / {
            try_files \$uri \$uri/ /index.html =404;
        }
    }
}
EOF
  ln -sf "${BASE_DIR}/conf/nginx.conf" /etc/nginx/nginx.conf
  nginx -t && systemctl enable nginx && systemctl restart nginx
fi

SERVER_IPV4=$(curl -4 -fsSL https://icanhazip.com 2>/dev/null || echo "YOUR_SERVER_IP")
UUID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d")
SHORT_ID=$(openssl rand -hex 8 2>/dev/null || echo "a1b2c3d4e5f60718")

echo ""
echo -e "${GREEN}========================================================================${NC}"
echo -e "${BOLD}   УСТАНОВКА SELFSTEAL ЗАВЕРШЕНА! ДИРЕКТОРИЯ: ${BASE_DIR}${NC}"
echo -e "${GREEN}========================================================================${NC}"
echo -e " • Конфиги веб-сервера: ${BASE_DIR}/conf/"
echo -e " • Маскировочный HTML:  ${BASE_DIR}/html/index.html"
echo -e " • Сертификаты SSL:     ${BASE_DIR}/ssl/fullchain.pem и privkey.pem"
echo -e " • Логи запросов:       ${BASE_DIR}/logs/access.log и error.log"
echo -e " • DNS запись A:        ${DOMAIN} -> ${SERVER_IPV4} (DNS Only)"
echo -e " • Xray Reality Dest:   ${TARGET} | ServerNames: [\"${DOMAIN}\"]"
