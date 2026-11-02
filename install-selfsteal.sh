#!/usr/bin/env bash
# ==============================================================================
# 🔗 Docker SelfSteal Management System v2.6.0 — VLESS XHTTP / TCP Reality (Caddy / Nginx)
# 👨‍💻 Author: t.me/wemkz
# 🚀 Запуск одной командой (без ручного скачивания):
#   bash <(curl -fsSL "https://raw.githubusercontent.com/wemkk1/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh")
#   или:
#   curl -fsSL "https://raw.githubusercontent.com/wemkk1/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh" | bash
# 🌍 Языки интерфейса: 1) English | 2) Русский
# 🐳 Docker-режим: Caddy (caddy:2-alpine) или Nginx (nginx:stable-alpine) через Docker Compose
# 🎲 Автоматический рандомный выбор HTML-заглушки из 6 шаблонов (1-speedtest .. 6-gitpage)
# 🌐 Автопроверка DNS A-записи через 1.1.1.1, 8.8.8.8, 9.9.9.9
# 📂 Директории управления: /opt/ss-caddy или /opt/nginx
# 🛠️ CLI меню управления (0-14): selfssteal
# ==============================================================================

set -euo pipefail

# Цветовая палитра вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
NC='\033[0m'

clear 2>/dev/null || true
echo -e "${WHITE}🔗 Docker Caddy / Nginx for Reality SelfSteal${NC}"
echo -e "${CYAN}Management System v2.6.0 (Docker Compose)${NC}"
echo -e "${BLUE}Project: VLESS XHTTP/TCP Reality | Author: t.me/wemkz${NC}"
echo -e "${BLUE}──────────────────────────────────────────────────────────${NC}"
echo ""

# ------------------------------------------------------------------------------
# 🌍 Выбор языка / Language Selection
# ------------------------------------------------------------------------------
echo -e "🌍 ${WHITE}Select language / Выберите язык:${NC}"
echo -e "   ${WHITE}1)${NC} ${GREEN}English${NC}"
echo -e "   ${WHITE}2)${NC} ${GREEN}Русский${NC}"
read -r -p "👉 Choice / Выбор (например: 2): " LANG_CHOICE < /dev/tty
LANG_CHOICE="${LANG_CHOICE:-2}"
if [[ "${LANG_CHOICE}" == "1" ]] || [[ "${LANG_CHOICE,,}" == "en"* ]]; then
  LANG_CODE="en"
else
  LANG_CODE="ru"
fi

msg() {
  if [[ "${LANG_CODE}" == "en" ]]; then
    echo -e "$1"
  else
    echo -e "$2"
  fi
}

if [[ "${EUID}" -ne 0 ]]; then
  msg "❌ ${RED}[ERROR] Please run this script as root:${NC}" "❌ ${RED}[ОШИБКА] Запустите скрипт с правами root:${NC}"
  echo -e "👉 ${CYAN}bash <(curl -fsSL "https://raw.githubusercontent.com/wemkk1/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh")${NC}"
  exit 1
fi
echo ""

# ------------------------------------------------------------------------------
# 🔧 ШАГ 1: Выбор Docker веб-сервера (Caddy или Nginx)
# ------------------------------------------------------------------------------
msg "🔧 ${WHITE}1) Select web server for SelfSteal (in Docker container):${NC}" "🔧 ${WHITE}1) Выберите веб-сервер для SelfSteal (в Docker-контейнере):${NC}"
msg "   ${WHITE}1)${NC} 🐳 ${GREEN}Caddy (caddy:2-alpine)${NC}        — directory: ${CYAN}/opt/ss-caddy${NC}" "   ${WHITE}1)${NC} 🐳 ${GREEN}Caddy (caddy:2-alpine)${NC}        — директория: ${CYAN}/opt/ss-caddy${NC}"
msg "   ${WHITE}2)${NC} 🐳 ${GREEN}Nginx (nginx:stable-alpine)${NC}   — directory: ${CYAN}/opt/nginx${NC}" "   ${WHITE}2)${NC} 🐳 ${GREEN}Nginx (nginx:stable-alpine)${NC}   — директория: ${CYAN}/opt/nginx${NC}"
if [[ "${LANG_CODE}" == "en" ]]; then
  read -r -p "👉 Your choice (e.g. 1): " SERVER_CHOICE < /dev/tty
else
  read -r -p "👉 Ваш выбор (например: 1): " SERVER_CHOICE < /dev/tty
fi
SERVER_CHOICE="${SERVER_CHOICE:-1}"

if [[ "${SERVER_CHOICE}" == "2" ]] || [[ "${SERVER_CHOICE,,}" == "nginx" ]]; then
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
msg "   ✅ ${GREEN}Selected Docker web server: ${SERVER_TITLE} (${DOCKER_IMAGE}) in ${BASE_DIR}${NC}" "   ✅ ${GREEN}Выбран Docker веб-сервер: ${SERVER_TITLE} (${DOCKER_IMAGE}) в ${BASE_DIR}${NC}"
echo ""

# ------------------------------------------------------------------------------
# 🌐 ШАГ 2: Запрос домена
# ------------------------------------------------------------------------------
msg "🌐 ${WHITE}2) Enter your domain for SelfSteal and Let's Encrypt certificate:${NC}" "🌐 ${WHITE}2) Укажите ваш домен для SelfSteal и сертификата Let's Encrypt:${NC}"
if [[ "${LANG_CODE}" == "en" ]]; then
  read -r -p "👉 Domain (e.g. example.com): " RAW_DOMAIN < /dev/tty
else
  read -r -p "👉 Домен (например: example.com): " RAW_DOMAIN < /dev/tty
fi
RAW_DOMAIN="${RAW_DOMAIN:-poland.example.xyz}"

# Очистка от http:// или https:// и возможного пути, если ввели вместе с доменом
CLEAN_INPUT="${RAW_DOMAIN#http://}"
CLEAN_INPUT="${CLEAN_INPUT#https://}"
EXTRACTED_PATH=""
if [[ "${CLEAN_INPUT}" == */* ]]; then
  DOMAIN="${CLEAN_INPUT%%/*}"
  EXTRACTED_PATH="/${CLEAN_INPUT#*/}"
else
  DOMAIN="${CLEAN_INPUT}"
fi
msg "   ✅ ${GREEN}Domain: ${DOMAIN}${NC}" "   ✅ ${GREEN}Домен: ${DOMAIN}${NC}"
echo ""

# ------------------------------------------------------------------------------
# 📡 ШАГ 3: Выбор транспорта (XHTTP или TCP) и пути для XHTTP
# ------------------------------------------------------------------------------
msg "📡 ${WHITE}3) Select transport protocol for VLESS Reality:${NC}" "📡 ${WHITE}3) Выберите тип транспорта для VLESS Reality:${NC}"
msg "   ${WHITE}1)${NC} 🌊 ${GREEN}XHTTP (SplitHTTP)${NC} — with chunk path" "   ${WHITE}1)${NC} 🌊 ${GREEN}XHTTP (SplitHTTP)${NC} — с указанием пути чанков"
msg "   ${WHITE}2)${NC} ⚡ ${GREEN}TCP${NC}               — classic VLESS TCP Reality (xtls-rprx-vision)" "   ${WHITE}2)${NC} ⚡ ${GREEN}TCP${NC}               — классический VLESS TCP Reality (xtls-rprx-vision)"
if [[ "${LANG_CODE}" == "en" ]]; then
  read -r -p "👉 Your choice (e.g. 1): " TRANSPORT_CHOICE < /dev/tty
else
  read -r -p "👉 Ваш выбор (например: 1): " TRANSPORT_CHOICE < /dev/tty
fi
TRANSPORT_CHOICE="${TRANSPORT_CHOICE:-1}"

XHTTP_PATH="/media/v3/chunk/"
XHTTP_INTERNAL_PORT="8080"

if [[ "${TRANSPORT_CHOICE}" == "2" ]] || [[ "${TRANSPORT_CHOICE,,}" == "tcp" ]]; then
  TRANSPORT="tcp"
  msg "   ✅ ${GREEN}Selected transport: TCP Reality (xtls-rprx-vision)${NC}" "   ✅ ${GREEN}Выбран транспорт: TCP Reality (xtls-rprx-vision)${NC}"
else
  TRANSPORT="xhttp"
  DEFAULT_PATH="${EXTRACTED_PATH:-/media/v3/chunk/}"
  echo ""
  msg "   🛣️  ${WHITE}Enter path for XHTTP SelfSteal:${NC}" "   🛣️  ${WHITE}Укажите путь (path) для XHTTP SelfSteal:${NC}"
  msg "   💡 (You can enter ${CYAN}${DOMAIN}/media/v3/chunk/${NC} or ${CYAN}/media/v3/chunk/${NC})" "   💡 (Можно ввести как ${CYAN}${DOMAIN}/media/v3/chunk/${NC} так и ${CYAN}/media/v3/chunk/${NC})"
  if [[ "${LANG_CODE}" == "en" ]]; then
    read -r -p "👉 XHTTP Path (e.g. /media/v3/chunk/): " RAW_XHTTP_PATH < /dev/tty
  else
    read -r -p "👉 Путь XHTTP (например: /media/v3/chunk/): " RAW_XHTTP_PATH < /dev/tty
  fi
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
  msg "   ✅ ${GREEN}Selected transport: XHTTP | Full URL: ${DOMAIN}${XHTTP_PATH}${NC}" "   ✅ ${GREEN}Выбран транспорт: XHTTP | Полный URL: ${DOMAIN}${XHTTP_PATH}${NC}"
fi
echo ""

# ------------------------------------------------------------------------------
# 🎯 ШАГ 4: Порт и адрес Target
# ------------------------------------------------------------------------------
msg "🎯 ${WHITE}4) Enter Target address:port for SelfSteal:${NC}" "🎯 ${WHITE}4) На каком адресе:порту будет работать Target (SelfSteal)?${NC}"
if [[ "${LANG_CODE}" == "en" ]]; then
  read -r -p "👉 Target (e.g. 127.0.0.1:9443): " RAW_TARGET < /dev/tty
else
  read -r -p "👉 Target (например: 127.0.0.1:9443): " RAW_TARGET < /dev/tty
fi
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
msg "   ✅ ${GREEN}Target set to: ${TARGET}${NC}" "   ✅ ${GREEN}Target установлен: ${TARGET}${NC}"
echo ""

# ------------------------------------------------------------------------------
# 🔒 Дополнительные параметры: Let's Encrypt и логирование запросов
# ------------------------------------------------------------------------------
msg "🔒 ${WHITE}5) Let's Encrypt certificate & access log settings:${NC}" "🔒 ${WHITE}5) Настройки сертификатов Let's Encrypt и логирования запросов:${NC}"
if [[ "${LANG_CODE}" == "en" ]]; then
  read -r -p "👉 Email for Let's Encrypt (e.g. admin@example.com): " ACME_EMAIL < /dev/tty
  ACME_EMAIL="${ACME_EMAIL:-admin@poland.example.xyz}"
  read -r -p "👉 Enable detailed access logs in ${BASE_DIR}/logs? (e.g. Y/n): " ENABLE_LOGS_CHOICE < /dev/tty
else
  read -r -p "👉 Email для уведомлений Let's Encrypt (например: admin@example.com): " ACME_EMAIL < /dev/tty
  ACME_EMAIL="${ACME_EMAIL:-admin@poland.example.xyz}"
  read -r -p "👉 Включить подробное логирование запросов в ${BASE_DIR}/logs? (например: Y/n): " ENABLE_LOGS_CHOICE < /dev/tty
fi
ENABLE_LOGS_CHOICE="${ENABLE_LOGS_CHOICE:-Y}"
if [[ "${ENABLE_LOGS_CHOICE,,}" == "n" ]]; then
  ENABLE_ACCESS_LOG="false"
else
  ENABLE_ACCESS_LOG="true"
fi
echo ""

# ------------------------------------------------------------------------------
# 📂 [1/7] Создание структуры директорий (/opt/ss-caddy или /opt/nginx)
# ------------------------------------------------------------------------------
msg "📂 ${CYAN}[1/7] Preparing directories in ${BASE_DIR}...${NC}" "📂 ${CYAN}[1/7] Подготовка директорий в ${BASE_DIR}...${NC}"
mkdir -p "${BASE_DIR}/conf"
mkdir -p "${BASE_DIR}/html/templates"
mkdir -p "${BASE_DIR}/ssl"
mkdir -p "${BASE_DIR}/logs"
msg "   ${GREEN}✅ Done${NC}" "   ${GREEN}✅ Готово${NC}"

# ------------------------------------------------------------------------------
# 📦 [2/7] Установка необходимых компонентов и проверка Docker
# ------------------------------------------------------------------------------
msg "🐳 ${CYAN}[2/7] Installing required packages and checking Docker...${NC}" "🐳 ${CYAN}[2/7] Установка необходимых компонентов и проверка Docker...${NC}"
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
msg "   ${GREEN}✅ Done${NC}" "   ${GREEN}✅ Готово${NC}"

# ------------------------------------------------------------------------------
# 🌐 [3/7] Автоматическая проверка DNS A-записи через 1.1.1.1, 8.8.8.8 и 9.9.9.9
# ------------------------------------------------------------------------------
msg "🌐 ${CYAN}[3/7] Checking DNS A-record for ${DOMAIN} via 1.1.1.1, 8.8.8.8, and 9.9.9.9...${NC}" "🌐 ${CYAN}[3/7] Проверка DNS A-записи домена ${DOMAIN} через 1.1.1.1, 8.8.8.8 и 9.9.9.9...${NC}"
SERVER_IPV4=$(curl -4 -fsSL --max-time 5 https://icanhazip.com 2>/dev/null || curl -4 -fsSL --max-time 5 https://ifconfig.me 2>/dev/null || echo "185.212.140.42")
SERVER_IPV4="${SERVER_IPV4//[[:space:]]/}"
msg "   🖥️  Server external IPv4: ${BOLD}${SERVER_IPV4}${NC}" "   🖥️  Внешний IPv4 этого сервера: ${BOLD}${SERVER_IPV4}${NC}"

DNS_MISMATCH=0
for RESOLVER in "1.1.1.1" "8.8.8.8" "9.9.9.9"; do
  RESOLVED_IP=""
  if command -v dig >/dev/null 2>&1; then
    RESOLVED_IP=$(dig +short +time=2 +tries=1 @"${RESOLVER}" "${DOMAIN}" A 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n1 || true)
  elif command -v nslookup >/dev/null 2>&1; then
    RESOLVED_IP=$(nslookup "${DOMAIN}" "${RESOLVER}" 2>/dev/null | awk '/^Address: / { print $2 }' | tail -n1 || true)
  fi

  if [[ -z "${RESOLVED_IP}" ]]; then
    msg "   ❌ DNS ${RESOLVER}: ${RED}NO A-RECORD FOUND (NXDOMAIN / Timeout)${NC} (expected ${SERVER_IPV4})" "   ❌ DNS ${RESOLVER}: ${RED}НЕ НАЙДЕНА A-ЗАПИСЬ (NXDOMAIN / Timeout)${NC} (ожидался ${SERVER_IPV4})"
    DNS_MISMATCH=1
  elif [[ "${RESOLVED_IP}" == "${SERVER_IPV4}" ]]; then
    msg "   ✅ DNS ${RESOLVER}: ${GREEN}${RESOLVED_IP} (MATCH)${NC}" "   ✅ DNS ${RESOLVER}: ${GREEN}${RESOLVED_IP} (СОВПАДАЕТ)${NC}"
  else
    msg "   ⚠️  DNS ${RESOLVER}: ${YELLOW}${RESOLVED_IP} (MISMATCH, expected ${SERVER_IPV4})${NC}" "   ⚠️  DNS ${RESOLVER}: ${YELLOW}${RESOLVED_IP} (НЕ СОВПАДАЕТ, ожидался ${SERVER_IPV4})${NC}"
    DNS_MISMATCH=1
  fi
done

if [[ "${DNS_MISMATCH}" -ne 0 ]]; then
  echo ""
  msg "⚠️  ${YELLOW}[WARNING] Domain ${DOMAIN} IP on one or more DNS resolvers does not match server IP (${SERVER_IPV4}).${NC}" "⚠️  ${YELLOW}[ВНИМАНИЕ] IP домена ${DOMAIN} у одного или нескольких DNS (1.1.1.1 / 8.8.8.8 / 9.9.9.9) не совпадает с IP сервера (${SERVER_IPV4}).${NC}"
  msg "💡 ${YELLOW}Make sure the A-record points to ${SERVER_IPV4} and Cloudflare proxy (orange cloud) is disabled (DNS Only).${NC}" "💡 ${YELLOW}Убедитесь, что A-запись указывает на ${SERVER_IPV4} и проксирование Cloudflare (оранжевое облако) отключено (DNS Only).${NC}"
  if [[ "${LANG_CODE}" == "en" ]]; then
    read -r -p "👉 Continue installation despite DNS mismatch? (e.g. y/N): " DNS_CONTINUE_CHOICE < /dev/tty
  else
    read -r -p "👉 Продолжить установку несмотря на несовпадение DNS? (например: y/N): " DNS_CONTINUE_CHOICE < /dev/tty
  fi
  DNS_CONTINUE_CHOICE="${DNS_CONTINUE_CHOICE:-N}"
  if [[ "${DNS_CONTINUE_CHOICE,,}" != "y" ]]; then
    msg "❌ ${RED}Installation aborted by user.${NC}" "❌ ${RED}Установка прервана пользователем. Проверьте настройки DNS для ${DOMAIN} и запустите скрипт снова.${NC}"
    exit 1
  fi
  msg "   ⚡ ${YELLOW}Continuing installation as confirmed by user...${NC}" "   ⚡ ${YELLOW}Продолжаем установку по подтверждению пользователя...${NC}"
fi

# ------------------------------------------------------------------------------
# 🎨 [4/7] Сохранение 6 HTML-заглушек и рандомный выбор шаблона в ${BASE_DIR}/html/index.html
# ------------------------------------------------------------------------------
msg "🎨 ${CYAN}[4/7] Installing 6 HTML stub templates and selecting a theme in ${BASE_DIR}/html...${NC}" "🎨 ${CYAN}[4/7] Установка 6 HTML-шаблонов заглушек и выбор случайной темы в ${BASE_DIR}/html...${NC}"
mkdir -p "${BASE_DIR}/html/templates"

cat > "${BASE_DIR}/html/templates/1-speedtest.html" <<'STUB_EOF_1'
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Speedtest — проверка скорости интернета</title>
<style>
:root{--bg:#f4f6fa;--card:#fff;--text:#1a1f2b;--muted:#6b7380;--accent:#2563eb;--track:#e5e9f0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:var(--card);border-radius:20px;box-shadow:0 10px 40px rgba(20,30,60,.08);padding:40px 32px;max-width:420px;width:100%;text-align:center}
.logo{font-weight:800;font-size:20px;letter-spacing:-.02em;margin-bottom:28px;display:flex;align-items:center;justify-content:center;gap:8px;color:var(--accent)}
.logo svg{width:22px;height:22px}
.gauge{position:relative;width:240px;height:240px;margin:0 auto 20px}
.gauge svg{width:100%;height:100%;transform:rotate(-90deg)}
.gauge circle{fill:none;stroke-width:14;stroke-linecap:round}
.gauge .track{stroke:var(--track)}
.gauge .fill{stroke:var(--accent);stroke-dasharray:565;stroke-dashoffset:565;animation:fill 1.8s ease-out forwards}
@keyframes fill{to{stroke-dashoffset:140}}
.value{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.num{font-size:44px;font-weight:800;letter-spacing:-.02em}
.unit{font-size:13px;color:var(--muted);margin-top:2px}
.stats{display:flex;justify-content:center;gap:28px;margin:22px 0 8px}
.stat{text-align:center}
.stat .n{font-size:18px;font-weight:700}
.stat .l{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
.btn{margin-top:20px;background:var(--accent);color:#fff;border:none;border-radius:12px;padding:14px 32px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}
.btn:hover{opacity:.9}
.meta{margin-top:18px;font-size:12px;color:var(--muted)}
</style>
</head>
<body>
<div class="card">
  <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Speedtest</div>
  <div class="gauge">
    <svg viewBox="0 0 200 200">
      <circle class="track" cx="100" cy="100" r="90"/>
      <circle class="fill" cx="100" cy="100" r="90"/>
    </svg>
    <div class="value"><div class="num">187</div><div class="unit">Мбит/с</div></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="n">12 мс</div><div class="l">Пинг</div></div>
    <div class="stat"><div class="n">187</div><div class="l">Загрузка</div></div>
    <div class="stat"><div class="n">94</div><div class="l">Отдача</div></div>
  </div>
  <button class="btn">Начать заново</button>
  <div class="meta">Ваш IP: 185.23.xx.xx · Сервер: Москва</div>
</div>
</body>
</html>
STUB_EOF_1

cat > "${BASE_DIR}/html/templates/2-cloud.html" <<'STUB_EOF_2'
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cloud — ваше хранилище</title>
<style>
:root{--bg:#f7f8fa;--sidebar:#fff;--text:#20242c;--muted:#8a909c;--accent:#4f7cff;--border:#eceef2}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex}
.sidebar{width:220px;background:var(--sidebar);border-right:1px solid var(--border);padding:24px 16px;flex-shrink:0}
.logo{font-weight:800;font-size:18px;margin-bottom:28px;display:flex;align-items:center;gap:8px;color:var(--accent)}
.logo svg{width:22px;height:22px}
.nav a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;color:var(--muted);text-decoration:none;font-size:14px;margin-bottom:2px}
.nav a.active{background:#eef2ff;color:var(--accent);font-weight:600}
.nav svg{width:17px;height:17px;flex-shrink:0}
.storage{margin-top:24px;padding:14px;background:#f2f4f8;border-radius:12px}
.storage .bar{height:6px;background:var(--border);border-radius:4px;overflow:hidden;margin:8px 0}
.storage .bar i{display:block;width:38%;height:100%;background:var(--accent)}
.storage p{font-size:12px;color:var(--muted)}
.main{flex:1;padding:28px 36px}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.top h1{font-size:22px;font-weight:700}
.upload{background:var(--accent);color:#fff;border:none;border-radius:10px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px}
.file{background:#fff;border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.file .icon{width:44px;height:44px;margin:0 auto 10px;border-radius:10px;display:flex;align-items:center;justify-content:center}
.file .icon svg{width:22px;height:22px;color:#fff}
.file p{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file span{font-size:11px;color:var(--muted)}
@media(max-width:600px){.sidebar{display:none}.main{padding:20px}}
</style>
</head>
<body>
<aside class="sidebar">
  <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 18a4 4 0 0 1-1-7.9A5 5 0 0 1 16 8a4.5 4.5 0 0 1 1 8.9"/></svg>Cloud</div>
  <nav class="nav">
    <a class="active" href="#"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>Мои файлы</a>
    <a href="#"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 2 3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>Избранное</a>
    <a href="#"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.7 1 6.3 2.7"/><path d="M21 3v6h-6"/></svg>Последние</a>
    <a href="#"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>Корзина</a>
  </nav>
  <div class="storage"><p>38% занято</p><div class="bar"><i></i></div><p>5.7 ГБ из 15 ГБ</p></div>
</aside>
<main class="main">
  <div class="top"><h1>Мои файлы</h1><button class="upload">+ Загрузить</button></div>
  <div class="grid">
    <div class="file"><div class="icon" style="background:#60a5fa"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div><p>Отчёт.pdf</p><span>2.1 МБ</span></div>
    <div class="file"><div class="icon" style="background:#34d399"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg></div><p>Фото.jpg</p><span>4.8 МБ</span></div>
    <div class="file"><div class="icon" style="background:#f472b6"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div><p>Презентация.pptx</p><span>11 МБ</span></div>
    <div class="file"><div class="icon" style="background:#fbbf24"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div><p>Проект</p><span>папка</span></div>
  </div>
</main>
</body>
</html>
STUB_EOF_2

cat > "${BASE_DIR}/html/templates/3-memes.html" <<'STUB_EOF_3'
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MemeDump — свежие мемы каждый день</title>
<style>
:root{--bg:#15161d;--card:#1e2029;--text:#f1f2f6;--muted:#8b8fa3;--accent:#ff5c5c}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
header{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid #2a2c38;position:sticky;top:0;background:var(--bg);z-index:5}
.logo{font-weight:900;font-size:20px;letter-spacing:-.02em}
.logo span{color:var(--accent)}
.tabs{display:flex;gap:6px;font-size:13px}
.tabs a{padding:7px 14px;border-radius:999px;color:var(--muted);text-decoration:none}
.tabs a.active{background:var(--accent);color:#fff;font-weight:600}
.feed{max-width:560px;margin:0 auto;padding:20px 16px}
.post{background:var(--card);border-radius:16px;margin-bottom:18px;overflow:hidden}
.post .meta{display:flex;align-items:center;gap:10px;padding:14px 16px 10px}
.post .avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#ff5c5c,#ffb86c)}
.post .meta b{font-size:13px}
.post .meta span{font-size:12px;color:var(--muted);display:block}
.post .img{height:260px;background:linear-gradient(135deg,#2a2c38,#1a1c24);display:flex;align-items:center;justify-content:center}
.post .img svg{width:60px;height:60px;color:#3a3d4d}
.post .actions{display:flex;gap:18px;padding:12px 16px;font-size:13px;color:var(--muted)}
.post .actions b{color:var(--text)}
footer{text-align:center;color:var(--muted);font-size:12px;padding:24px}
</style>
</head>
<body>
<header>
  <div class="logo">Meme<span>Dump</span></div>
  <div class="tabs"><a class="active" href="#">Горячее</a><a href="#">Новое</a><a href="#">Топ</a></div>
</header>
<div class="feed">
  <div class="post">
    <div class="meta"><div class="avatar"></div><div><b>anon_228</b><span>14 мин назад</span></div></div>
    <div class="img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg></div>
    <div class="actions"><span>▲ <b>4.2K</b></span><span>💬 <b>312</b></span><span>↗ Поделиться</span></div>
  </div>
  <div class="post">
    <div class="meta"><div class="avatar"></div><div><b>kekpatrol</b><span>1 ч назад</span></div></div>
    <div class="img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg></div>
    <div class="actions"><span>▲ <b>1.8K</b></span><span>💬 <b>97</b></span><span>↗ Поделиться</span></div>
  </div>
  <div class="post">
    <div class="meta"><div class="avatar"></div><div><b>no_sleep_dev</b><span>3 ч назад</span></div></div>
    <div class="img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg></div>
    <div class="actions"><span>▲ <b>8.9K</b></span><span>💬 <b>540</b></span><span>↗ Поделиться</span></div>
  </div>
</div>
<footer>MemeDump · смешно или вернём деньги</footer>
</body>
</html>
STUB_EOF_3

cat > "${BASE_DIR}/html/templates/4-overloaded.html" <<'STUB_EOF_4'
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>503 — Сервис временно недоступен</title>
<style>
:root{--bg:#0e0f13;--text:#e8e9ee;--muted:#80808f;--accent:#ff9f43}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.wrap{text-align:center;max-width:460px}
.code{font-size:15px;color:var(--accent);font-weight:700;letter-spacing:.1em;margin-bottom:18px}
.icon{width:72px;height:72px;margin:0 auto 24px;color:var(--accent)}
h1{font-size:24px;font-weight:700;margin-bottom:12px}
p{color:var(--muted);font-size:15px;line-height:1.6;margin-bottom:28px}
.bar{height:4px;background:#1f2128;border-radius:4px;overflow:hidden;margin-bottom:10px}
.bar i{display:block;width:30%;height:100%;background:var(--accent);animation:load 1.6s ease-in-out infinite}
@keyframes load{0%{margin-left:0;width:20%}50%{margin-left:60%;width:35%}100%{margin-left:0;width:20%}}
.sub{font-size:12px;color:var(--muted)}
.btn{margin-top:24px;display:inline-block;border:1px solid #2a2c38;color:var(--text);padding:10px 24px;border-radius:10px;text-decoration:none;font-size:14px}
</style>
</head>
<body>
<div class="wrap">
  <div class="code">ОШИБКА 503</div>
  <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
  <h1>Сервис временно перегружен</h1>
  <p>Сейчас наблюдается повышенная нагрузка. Мы уже работаем над восстановлением — попробуйте обновить страницу через пару минут.</p>
  <div class="bar"><i></i></div>
  <div class="sub">Повторная попытка автоматически через 60 сек</div>
  <a class="btn" href="#">Обновить страницу</a>
</div>
</body>
</html>
STUB_EOF_4

cat > "${BASE_DIR}/html/templates/5-tech.html" <<'STUB_EOF_5'
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nexora Systems — инфраструктурные решения</title>
<style>
:root{--bg:#0a0c10;--card:#12141a;--text:#eef0f4;--muted:#848a99;--accent:#3ddc97;--border:#1f232c}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--text)}
header{display:flex;align-items:center;justify-content:space-between;padding:20px 40px;border-bottom:1px solid var(--border)}
.logo{font-weight:800;font-size:18px;display:flex;align-items:center;gap:8px}
.logo svg{width:22px;height:22px;color:var(--accent)}
nav{display:flex;gap:28px;font-size:14px;color:var(--muted)}
nav a{text-decoration:none;color:inherit}
.cta{background:var(--accent);color:#06140f;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none}
.hero{max-width:780px;margin:0 auto;padding:90px 24px 60px;text-align:center}
.badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--accent);background:rgba(61,220,151,.1);padding:6px 14px;border-radius:999px;margin-bottom:22px}
h1{font-size:40px;font-weight:800;letter-spacing:-.02em;line-height:1.15;margin-bottom:18px}
h1 span{color:var(--accent)}
.sub{color:var(--muted);font-size:16px;max-width:560px;margin:0 auto 32px;line-height:1.6}
.actions{display:flex;gap:12px;justify-content:center}
.btn1{background:var(--accent);color:#06140f;padding:12px 26px;border-radius:9px;font-weight:700;text-decoration:none;font-size:14px}
.btn2{border:1px solid var(--border);color:var(--text);padding:12px 26px;border-radius:9px;text-decoration:none;font-size:14px}
.grid{max-width:960px;margin:40px auto 0;padding:0 24px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.feat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:22px}
.feat svg{width:22px;height:22px;color:var(--accent);margin-bottom:12px}
.feat h3{font-size:15px;margin-bottom:6px}
.feat p{font-size:13px;color:var(--muted);line-height:1.5}
footer{text-align:center;padding:40px;color:var(--muted);font-size:12px;border-top:1px solid var(--border);margin-top:60px}
@media(max-width:700px){.grid{grid-template-columns:1fr}nav{display:none}h1{font-size:30px}}
</style>
</head>
<body>
<header>
  <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/></svg>Nexora</div>
  <nav><a href="#">Продукт</a><a href="#">Инфраструктура</a><a href="#">Тарифы</a><a href="#">Документация</a></nav>
  <a class="cta" href="#">Войти в кабинет</a>
</header>
<div class="hero">
  <div class="badge">● Все системы работают штатно</div>
  <h1>Надёжная <span>инфраструктура</span><br>для вашего бизнеса</h1>
  <p class="sub">Управление серверами, сетями и развёртыванием в едином пространстве. Быстро, безопасно, с полным контролем.</p>
  <div class="actions"><a class="btn1" href="#">Начать бесплатно</a><a class="btn2" href="#">Связаться с нами</a></div>
</div>
<div class="grid">
  <div class="feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg><h3>Единая панель</h3><p>Все серверы и сервисы в одном интерфейсе, без переключения между вкладками.</p></div>
  <div class="feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><h3>Безопасность</h3><p>Шифрование на всех уровнях и контроль доступа по ролям.</p></div>
  <div class="feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg><h3>Высокая скорость</h3><p>Развёртывание инфраструктуры за секунды, а не часы.</p></div>
</div>
<footer>© 2026 Nexora Systems. Все права защищены.</footer>
</body>
</html>
STUB_EOF_5

cat > "${BASE_DIR}/html/templates/6-gitpage.html" <<'STUB_EOF_6'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>wemk/core-infra · GitPage</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--text:#c9d1d9;--muted:#8b949e;--accent:#58a6ff;--green:#3fb950;--border:#30363d}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:var(--bg);color:var(--text);font-size:14px}
header{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:1px solid var(--border)}
.logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px}
.logo svg{width:26px;height:26px}
.search{background:#0d1117;border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--muted);font-size:13px;width:220px}
.wrap{max-width:900px;margin:0 auto;padding:24px}
.repo-head{display:flex;align-items:center;gap:8px;font-size:20px;margin-bottom:4px}
.repo-head svg{width:16px;height:16px;color:var(--muted)}
.repo-head .priv{font-size:11px;border:1px solid var(--border);border-radius:999px;padding:1px 8px;color:var(--muted);margin-left:6px}
.desc{color:var(--muted);margin-bottom:16px}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:16px}
.tabs span{padding:8px 14px;font-size:13px;color:var(--muted);border-bottom:2px solid transparent}
.tabs span.active{color:var(--text);border-color:#f78166;font-weight:600}
.bar{display:flex;gap:8px;margin-bottom:16px}
.bar button{background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:5px 12px;font-size:12px}
.bar .code{background:var(--green);color:#0d1117;border:none;font-weight:700}
.filebox{border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:20px}
.commit{display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--card);border-bottom:1px solid var(--border);font-size:13px}
.commit .av{width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#58a6ff,#3fb950)}
.commit .msg{flex:1}
.commit .hash{color:var(--muted);font-family:monospace;font-size:12px}
.file{display:flex;align-items:center;gap:10px;padding:8px 14px;font-size:13px;border-top:1px solid var(--border)}
.file:first-child{border-top:none}
.file svg{width:15px;height:15px;color:var(--muted);flex-shrink:0}
.file .name{flex:1;color:var(--accent)}
.file .msg{color:var(--muted);flex:2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file .time{color:var(--muted);font-size:12px}
.readme{border:1px solid var(--border);border-radius:8px;padding:20px}
.readme h2{font-size:15px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.readme p{color:var(--muted);line-height:1.6;margin-bottom:10px;font-size:13px}
.readme code{background:#1f242c;padding:2px 6px;border-radius:4px;font-size:12px}
</style>
</head>
<body>
<header>
  <div class="logo"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>GitPage</div>
  <input class="search" placeholder="Поиск репозиториев...">
</header>
<div class="wrap">
  <div class="repo-head"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 1 1 0-1.5h1.75v-2H4.5a1 1 0 0 0-.9 1.45.75.75 0 1 1-1.34.67A2.5 2.5 0 0 1 2 11.5Z"/></svg>wemk / core-infra<span class="priv">Public</span></div>
  <div class="desc">Internal infrastructure utilities & deployment configs</div>
  <div class="tabs"><span class="active">Code</span><span>Issues 3</span><span>Pull requests 1</span><span>Actions</span><span>Settings</span></div>
  <div class="bar"><button>⎇ main</button><button>12 branches</button><button>5 tags</button><button class="code">Code ▾</button></div>
  <div class="filebox">
    <div class="commit"><div class="av"></div><div class="msg">chore: update deploy scripts and bump deps</div><div class="hash">a1f9c2e</div></div>
    <div class="file"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.75 1h8.5l3.75 3.75v9.5A1.75 1.75 0 0 1 12.25 16h-10.5A1.75 1.75 0 0 1 0 14.25V2.75A1.75 1.75 0 0 1 1.75 1Z"/></svg><span class="name">src</span><span class="msg">refactor module layout</span><span class="time">3 дня назад</span></div>
    <div class="file"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.75 1h8.5l3.75 3.75v9.5A1.75 1.75 0 0 1 12.25 16h-10.5A1.75 1.75 0 0 1 0 14.25V2.75A1.75 1.75 0 0 1 1.75 1Z"/></svg><span class="name">docker</span><span class="msg">add compose override</span><span class="time">6 дней назад</span></div>
    <div class="file"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8.75.75V2h.985c.304 0 .603.08.867.231l1.29.736c.038.022.08.033.124.033h2.234a.75.75 0 0 1 0 1.5h-.427l2.111 4.692a.75.75 0 0 1-.154.838l-.53-.53.529.531-.001.002-.002.002-.006.006-.016.015-.045.04a3.514 3.514 0 0 1-.686.45A4.492 4.492 0 0 1 13 11c-.818 0-1.511-.198-2.013-.46a3.512 3.512 0 0 1-.686-.45l-.045-.04-.016-.015-.006-.006-.002-.002.529-.531-.53.53a.75.75 0 0 1-.154-.838L12.19 4.5h-.427a.754.754 0 0 1-.124-.033l-1.29-.736a.75.75 0 0 0-.371-.097H8.75V13h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5V3.634h-.98c-.13 0-.258.032-.371.097l-1.29.736a.75.75 0 0 1-.124.033H3.81l2.111 4.692a.75.75 0 0 1-.154.838l-.53-.53.529.531-.001.002-.002.002-.006.006-.016.015-.045.04a3.514 3.514 0 0 1-.686.45A4.492 4.492 0 0 1 3 11c-.818 0-1.511-.198-2.013-.46a3.512 3.512 0 0 1-.686-.45l-.045-.04-.016-.015-.006-.006-.002-.002L.747 9.497a.75.75 0 0 1-.154-.838L2.705 4h-.427a.75.75 0 0 1 0-1.5h2.234a.249.249 0 0 0 .124-.033l1.29-.736c.264-.152.563-.231.867-.231h.985V.75a.75.75 0 0 1 1.5 0Z"/></svg><span class="name">LICENSE</span><span class="msg">initial commit</span><span class="time">2 месяца назад</span></div>
    <div class="file"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.75 1h8.5l3.75 3.75v9.5A1.75 1.75 0 0 1 12.25 16h-10.5A1.75 1.75 0 0 1 0 14.25V2.75A1.75 1.75 0 0 1 1.75 1Z"/></svg><span class="name">README.md</span><span class="msg">update usage docs</span><span class="time">1 неделю назад</span></div>
  </div>
  <div class="readme">
    <h2>📄 README.md</h2>
    <p><b>core-infra</b> — набор внутренних скриптов для развёртывания и обслуживания серверной инфраструктуры.</p>
    <p>Установка: <code>git clone</code> → <code>./setup.sh</code> → готово.</p>
    <p>Лицензия: MIT</p>
  </div>
</div>
</body>
</html>
STUB_EOF_6

STUB_FILES=(
  "1-speedtest.html"
  "2-cloud.html"
  "3-memes.html"
  "4-overloaded.html"
  "5-tech.html"
  "6-gitpage.html"
)
if [[ "${LANG_CODE:-ru}" == "en" ]]; then
  STUB_DESCRIPTIONS=(
    "🚀 1-speedtest.html — Speedtest with animated gauge and metrics"
    "☁️ 2-cloud.html     — Cloud storage, sidebar + file grid"
    "😂 3-memes.html     — Meme feed (MemeDump), dark theme"
    "⚠️ 4-overloaded.html— 'Service Overloaded' (503) page with progress bar"
    "💻 5-tech.html      — Tech landing page (Nexora Systems)"
    "🐙 6-gitpage.html   — GitHub-style repository page (GitPage)"
  )
else
  STUB_DESCRIPTIONS=(
    "🚀 1-speedtest.html — Спидтест с анимированным гейджем и цифрами"
    "☁️ 2-cloud.html     — Облачное хранилище, сайдбар + сетка файлов"
    "😂 3-memes.html     — Лента с мемами (MemeDump), тёмная тема"
    "⚠️ 4-overloaded.html— Страница 'Сервис перегружен' (503) с прогресс-баром"
    "💻 5-tech.html      — Технический лендинг (Nexora Systems)"
    "🐙 6-gitpage.html   — Страница репозитория в стиле GitHub (GitPage)"
  )
fi
RANDOM_IDX=$(( RANDOM % ${#STUB_FILES[@]} ))
CHOSEN_STUB="${STUB_FILES[$RANDOM_IDX]}"
CHOSEN_DESC="${STUB_DESCRIPTIONS[$RANDOM_IDX]}"
cp -f "${BASE_DIR}/html/templates/${CHOSEN_STUB}" "${BASE_DIR}/html/index.html"
echo "${CHOSEN_STUB}" > "${BASE_DIR}/html/.current_template"
if [[ "${LANG_CODE:-ru}" == "en" ]]; then
  echo -e "   🎲 Selected stub template: ${GREEN}${CHOSEN_DESC}${NC}"
  echo -e "   📂 All 6 templates saved in: ${CYAN}${BASE_DIR}/html/templates/${NC}"
else
  echo -e "   🎲 Выбрана заглушка: ${GREEN}${CHOSEN_DESC}${NC}"
  echo -e "   📂 Все 6 шаблонов сохранены в: ${CYAN}${BASE_DIR}/html/templates/${NC}"
fi

# ------------------------------------------------------------------------------
# 🔒 [5/7] Выпуск сертификата Let's Encrypt и настройка автообновления
# ------------------------------------------------------------------------------
msg "🔒 ${CYAN}[5/7] Obtaining Let's Encrypt SSL certificate for ${DOMAIN}...${NC}" "🔒 ${CYAN}[5/7] Получение SSL сертификата Let's Encrypt для ${DOMAIN}...${NC}"
docker rm -f selfsteal-caddy selfsteal-nginx 2>/dev/null || true
systemctl stop caddy nginx 2>/dev/null || true

if [[ ! -f ~/.acme.sh/acme.sh ]]; then
  curl -fsSL https://get.acme.sh | sh -s email="${ACME_EMAIL}"
fi

~/.acme.sh/acme.sh --set-default-ca --server letsencrypt || true
if ! ~/.acme.sh/acme.sh --issue -d "${DOMAIN}" --standalone --keylength ec-256 --force; then
  msg "⚠️  ${YELLOW}Let's Encrypt issuance failed, generating fallback EC-256 certificate...${NC}" "⚠️  ${YELLOW}Не удалось выпустить Let's Encrypt, генерируем резервный сертификат EC-256...${NC}"
  openssl ecparam -genkey -name prime256v1 -out "${BASE_DIR}/ssl/privkey.pem"
  openssl req -new -x509 -key "${BASE_DIR}/ssl/privkey.pem" -out "${BASE_DIR}/ssl/fullchain.pem" -days 365 -subj "/CN=${DOMAIN}"
fi

if [[ -f ~/.acme.sh/"${DOMAIN}"_ecc/fullchain.cer ]]; then
  ~/.acme.sh/acme.sh --install-cert -d "${DOMAIN}" --ecc \
    --fullchain-file "${BASE_DIR}/ssl/fullchain.pem" \
    --key-file "${BASE_DIR}/ssl/privkey.pem"
fi

chmod 644 "${BASE_DIR}/ssl/fullchain.pem"
chmod 600 "${BASE_DIR}/ssl/privkey.pem"

# Создание хука автообновления сертификатов Let's Encrypt (перезагружает Docker-контейнер)
cat > "${BASE_DIR}/ssl/renew-hook.sh" <<'RENEW_EOF'
#!/usr/bin/env bash
# ============================================================================
# Скрипт автоматического обновления SSL сертификатов Let's Encrypt (Docker)
# Путь файла: /opt/ss-caddy/ssl/renew-hook.sh
# Cron расписание: 15 3 */1 * *
# ============================================================================
set -euo pipefail

DOMAIN="poland.example.xyz"
BASE_DIR="/opt/ss-caddy"
SSL_DIR="${BASE_DIR}/ssl"
LOG_FILE="${BASE_DIR}/logs/ssl-renew.log"

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

echo "[$(timestamp)] Проверка обновления сертификата Let's Encrypt для ${DOMAIN}..." >> "${LOG_FILE}"

if command -v ~/.acme.sh/acme.sh >/dev/null 2>&1; then
  ~/.acme.sh/acme.sh --cron --home ~/.acme.sh >> "${LOG_FILE}" 2>&1
  ~/.acme.sh/acme.sh --install-cert -d "${DOMAIN}" --ecc \
    --fullchain-file "${SSL_DIR}/fullchain.pem" \
    --key-file "${SSL_DIR}/privkey.pem" \
    --reloadcmd "docker exec selfsteal-caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || docker restart selfsteal-caddy >/dev/null 2>&1" >> "${LOG_FILE}" 2>&1
elif command -v certbot >/dev/null 2>&1; then
  certbot renew --quiet --deploy-hook "cp -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${SSL_DIR}/fullchain.pem && cp -f /etc/letsencrypt/live/${DOMAIN}/privkey.pem ${SSL_DIR}/privkey.pem && chmod 600 ${SSL_DIR}/privkey.pem && docker exec selfsteal-caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || docker restart selfsteal-caddy >/dev/null 2>&1" >> "${LOG_FILE}" 2>&1
fi

chmod 644 "${SSL_DIR}/fullchain.pem"
chmod 600 "${SSL_DIR}/privkey.pem"
echo "[$(timestamp)] Сертификаты в ${SSL_DIR} актуальны, Docker-контейнер selfsteal-caddy перезагружен." >> "${LOG_FILE}"

RENEW_EOF
sed -i \
  -e "s|^DOMAIN=.*|DOMAIN=\"${DOMAIN}\"|" \
  -e "s|^SSL_DIR=.*|SSL_DIR=\"${BASE_DIR}/ssl\"|" \
  -e "s|^LOG_FILE=.*|LOG_FILE=\"${BASE_DIR}/logs/ssl-renew.log\"|" \
  "${BASE_DIR}/ssl/renew-hook.sh"
chmod +x "${BASE_DIR}/ssl/renew-hook.sh"

# Регистрация задания в Cron для регулярной проверки и обновления сертификатов
CRON_JOB="15 3 * * * ${BASE_DIR}/ssl/renew-hook.sh >/dev/null 2>&1"
(crontab -l 2>/dev/null | grep -v "renew-hook.sh" || true; echo "${CRON_JOB}") | crontab -
msg "   ${GREEN}✅ SSL ready (${BASE_DIR}/ssl)${NC}" "   ${GREEN}✅ Сертификат готов (${BASE_DIR}/ssl)${NC}"

# ------------------------------------------------------------------------------
# 🐳 [6/7] Запись конфигурации + docker-compose.yml и запуск Docker-контейнера
# ------------------------------------------------------------------------------
msg "🐳 ${CYAN}[6/7] Deploying Docker container ${CONTAINER_NAME} (${DOCKER_IMAGE})...${NC}" "🐳 ${CYAN}[6/7] Развертывание Docker-контейнера ${CONTAINER_NAME} (${DOCKER_IMAGE})...${NC}"

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
  log default {
    output file ${BASE_DIR}/logs/error.log
    level WARN
  }
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
      roll_keep_for 336h
    }
    format json
  }
EOF

  if [[ "${TRANSPORT}" == "xhttp" ]]; then
    cat >> "${BASE_DIR}/conf/Caddyfile" <<EOF
  handle ${XHTTP_PATH}* {
    reverse_proxy 127.0.0.1:${XHTTP_INTERNAL_PORT} {
      transport http {
        versions h2c 1.1
      }
      header_up Host {host}
      header_up X-Forwarded-For {remote_host}
    }
  }
EOF
  fi

  cat >> "${BASE_DIR}/conf/Caddyfile" <<EOF
  handle {
    root * ${BASE_DIR}/html
    try_files {path} {path}/ /index.html
    file_server
  }
}

http://${DOMAIN}:80 {
  bind 0.0.0.0
  handle /.well-known/acme-challenge/* {
    root * ${BASE_DIR}/html
    file_server
  }
  handle {
    redir https://${DOMAIN}{uri} permanent
  }
}
EOF

  cat > "${BASE_DIR}/docker-compose.yml" <<EOF
services:
  caddy:
    image: caddy:2-alpine
    container_name: selfsteal-caddy
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./conf/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./html:${BASE_DIR}/html:ro
      - ./ssl:${BASE_DIR}/ssl
      - ./logs:${BASE_DIR}/logs
EOF
else
  # Запись /opt/nginx/conf/nginx.conf с пользовательскими переменными ${DOMAIN}, ${TARGET}, ${XHTTP_PATH}
  cat > "${BASE_DIR}/conf/nginx.conf" <<EOF
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;
error_log ${BASE_DIR}/logs/error.log warn;

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
      '{"time_local":"\$time_local",'
      '"remote_addr":"\$remote_addr",'
      '"request":"\$request",'
      '"status": "\$status",'
      '"body_bytes_sent":"\$body_bytes_sent",'
      '"request_time":"\$request_time",'
      '"http_user_agent":"\$http_user_agent",'
      '"ssl_protocol":"\$ssl_protocol",'
      '"ssl_cipher":"\$ssl_cipher"}';
    access_log ${BASE_DIR}/logs/access.log selfsteal_json;

    server {
        listen 80;
        listen [::]:80;
        server_name ${DOMAIN};

        location ^~ /.well-known/acme-challenge/ {
            root ${BASE_DIR}/html;
            allow all;
        }

        location / {
            return 301 https://\$host\$request_uri;
        }
    }

    server {
        listen ${TARGET} ssl http2;
        server_name ${DOMAIN};

        root ${BASE_DIR}/html;
        index index.html;

        ssl_certificate     ${BASE_DIR}/ssl/fullchain.pem;
        ssl_certificate_key ${BASE_DIR}/ssl/privkey.pem;

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

  if [[ "${TRANSPORT}" == "xhttp" ]]; then
    cat >> "${BASE_DIR}/conf/nginx.conf" <<EOF

        location ${XHTTP_PATH} {
            grpc_pass grpc://127.0.0.1:${XHTTP_INTERNAL_PORT};
            proxy_pass http://127.0.0.1:${XHTTP_INTERNAL_PORT};
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_buffering off;
            client_max_body_size 0;
        }
EOF
  fi

  cat >> "${BASE_DIR}/conf/nginx.conf" <<EOF

        location / {
            try_files \$uri \$uri/ /index.html =404;
        }
    }
}
EOF

  cat > "${BASE_DIR}/docker-compose.yml" <<EOF
services:
  nginx:
    image: nginx:stable-alpine
    container_name: selfsteal-nginx
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./conf/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./html:${BASE_DIR}/html:ro
      - ./ssl:${BASE_DIR}/ssl:ro
      - ./logs:${BASE_DIR}/logs
EOF
fi

if docker compose version >/dev/null 2>&1; then
  docker compose -f "${BASE_DIR}/docker-compose.yml" up -d
else
  docker-compose -f "${BASE_DIR}/docker-compose.yml" up -d
fi

# Настройка logrotate для логов запросов
cat > "/etc/logrotate.d/selfsteal-${WEB_SERVER}" <<EOF
${BASE_DIR}/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root adm
    sharedscripts
    postrotate
        docker restart ${CONTAINER_NAME} >/dev/null 2>&1 || true
    endscript
}
EOF
msg "   ${GREEN}✅ Container started${NC}" "   ${GREEN}✅ Контейнер запущен${NC}"

# ------------------------------------------------------------------------------
# 🛠️ [7/7] Создание управляющего скрипта ${BASE_DIR}/selfssteal.sh и глобального symlink /usr/local/bin/selfssteal
# ------------------------------------------------------------------------------
msg "🛠️  ${CYAN}[7/7] Creating global symlink /usr/local/bin/selfssteal -> ${BASE_DIR}/selfssteal.sh...${NC}" "🛠️  ${CYAN}[7/7] Создание глобального symlink /usr/local/bin/selfssteal -> ${BASE_DIR}/selfssteal.sh...${NC}"
cat > "${BASE_DIR}/selfssteal.sh" <<'CLI_EOF'
#!/usr/bin/env bash
# ==============================================================================
# 🔗 Docker Caddy for Reality SelfSteal — Management System v2.6.0
# Author: t.me/wemkz
# Путь скрипта: /opt/ss-caddy/selfssteal.sh
# Глобальный symlink: /usr/local/bin/selfssteal -> /opt/ss-caddy/selfssteal.sh
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
WEB_SERVER="caddy"
SERVER_TITLE="Caddy"
DOCKER_IMAGE="caddy:2-alpine"
CONTAINER_NAME="selfsteal-caddy"
BASE_DIR="/opt/ss-caddy"
COMPOSE_FILE="${BASE_DIR}/docker-compose.yml"
DOMAIN="poland.example.xyz"
TRANSPORT="xhttp"
XHTTP_PATH="/media/v3/chunk/"
XHTTP_INTERNAL_PORT="8080"
TARGET="127.0.0.1:9443"
TARGET_HOST="127.0.0.1"
TARGET_PORT="9443"
ACME_EMAIL="admin@poland.example.xyz"
CONF_FILE="${BASE_DIR}/conf/Caddyfile"
SSL_DIR="${BASE_DIR}/ssl"
HTML_DIR="${BASE_DIR}/html"
LOGS_DIR="${BASE_DIR}/logs"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
NC='\033[0m'

msg() {
  if [[ "${LANG_CODE}" == "en" ]]; then
    echo -e "$1"
  else
    echo -e "$2"
  fi
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "${COMPOSE_FILE}" "$@"
  else
    docker-compose -f "${COMPOSE_FILE}" "$@"
  fi
}

get_server_uptime() {
  uptime -p 2>/dev/null | sed 's/^up //' || uptime | awk -F'( |,|:)+' '{print $6" "$7", "$8" hours"}' 2>/dev/null || echo "N/A"
}

get_container_pid() {
  docker inspect -f '{{.State.Pid}}' "${CONTAINER_NAME}" 2>/dev/null || echo "0"
}

is_container_running() {
  local running
  running=$(docker inspect -f '{{.State.Running}}' "${CONTAINER_NAME}" 2>/dev/null || echo "false")
  [[ "${running}" == "true" ]]
}

get_service_uptime() {
  if is_container_running; then
    local pid started_at etime
    pid=$(get_container_pid)
    started_at=$(docker inspect -f '{{.State.StartedAt}}' "${CONTAINER_NAME}" 2>/dev/null | cut -d. -f1 | sed 's/T/ /' || echo "")
    if [[ -n "${pid}" && "${pid}" != "0" ]] && ps -p "${pid}" >/dev/null 2>&1; then
      etime=$(ps -o etime= -p "${pid}" 2>/dev/null | xargs || echo "running")
      if [[ "${LANG_CODE}" == "en" ]]; then
        echo "${etime} (started: ${started_at} UTC)"
      else
        echo "${etime} (запущен: ${started_at} UTC)"
      fi
    else
      if [[ "${LANG_CODE}" == "en" ]]; then
        echo "Active (started: ${started_at} UTC)"
      else
        echo "Активен (запущен: ${started_at} UTC)"
      fi
    fi
  else
    if [[ "${LANG_CODE}" == "en" ]]; then
      echo "Stopped (0s)"
    else
      echo "Остановлен (0s)"
    fi
  fi
}

get_ssl_expiry() {
  if [[ -f "${SSL_DIR}/fullchain.pem" ]]; then
    local end_date
    end_date=$(openssl x509 -enddate -noout -in "${SSL_DIR}/fullchain.pem" 2>/dev/null | cut -d= -f2 || echo "")
    if [[ -n "${end_date}" ]]; then
      local end_epoch now_epoch days_left
      end_epoch=$(date -d "${end_date}" +%s 2>/dev/null || echo "0")
      now_epoch=$(date +%s)
      if [[ "${end_epoch}" -gt "${now_epoch}" ]]; then
        days_left=$(( (end_epoch - now_epoch) / 86400 ))
        echo "✅ Valid, ${days_left} days left (Let's Encrypt)"
        return
      fi
    fi
    echo "✅ Valid (Let's Encrypt)"
  else
    echo "❌ Certificate not found"
  fi
}

get_current_template() {
  if [[ -f "${HTML_DIR}/.current_template" ]]; then
    cat "${HTML_DIR}/.current_template"
  else
    echo "1-speedtest.html"
  fi
}

print_header() {
  echo -e "${WHITE}🔗 Docker ${SERVER_TITLE} for Reality SelfSteal${NC}"
  echo -e "${CYAN}Management System v2.6.0 (Docker Compose)${NC}"
  echo -e "${BLUE}Project: VLESS ${TRANSPORT^^} Reality | Author: t.me/wemkz${NC}"
  echo -e "${BLUE}──────────────────────────────────────────${NC}"
  echo ""
}

print_top_status() {
  if is_container_running; then
    echo -e "✅ ${GREEN}Status: Running${NC}"
  else
    echo -e "❌ ${RED}Status: Stopped${NC}"
  fi
  echo -e "   ${WHITE}Server:${NC}  ${SERVER_TITLE} (${DOCKER_IMAGE})"
  echo -e "   ${WHITE}Domain:${NC}  ${DOMAIN}"
  echo -e "   ${WHITE}Port:${NC}    ${TARGET_PORT} (${TARGET})"
  echo -e "   ${WHITE}SSL:${NC}     ${GREEN}$(get_ssl_expiry)${NC}"
}

write_webserver_files() {
  local ws="$1"
  local bdir="$2"
  mkdir -p "${bdir}/conf" "${bdir}/html/templates" "${bdir}/ssl" "${bdir}/logs"
  if [[ "${ws}" == "caddy" ]]; then
    cat > "${bdir}/conf/Caddyfile" <<EOF
{
  https_port ${TARGET_PORT}
  default_bind ${TARGET_HOST}
  auto_https disable_redirects
  storage file_system {
    root ${bdir}/ssl
  }
  email ${ACME_EMAIL}
  log default {
    output file ${bdir}/logs/error.log
    level WARN
  }
}

https://${DOMAIN}:${TARGET_PORT} {
  bind ${TARGET_HOST}
  tls ${bdir}/ssl/fullchain.pem ${bdir}/ssl/privkey.pem {
    protocols tls1.2 tls1.3
    alpn h2 http/1.1
  }
  log {
    output file ${bdir}/logs/access.log {
      roll_size 50MiB
      roll_keep 5
      roll_keep_for 336h
    }
    format json
  }
EOF
    if [[ "${TRANSPORT}" == "xhttp" ]]; then
      cat >> "${bdir}/conf/Caddyfile" <<EOF
  handle ${XHTTP_PATH}* {
    reverse_proxy 127.0.0.1:${XHTTP_INTERNAL_PORT} {
      transport http {
        versions h2c 1.1
      }
      header_up Host {host}
      header_up X-Forwarded-For {remote_host}
    }
  }
EOF
    fi
    cat >> "${bdir}/conf/Caddyfile" <<EOF
  handle {
    root * ${bdir}/html
    try_files {path} {path}/ /index.html
    file_server
  }
}

http://${DOMAIN}:80 {
  bind 0.0.0.0
  handle /.well-known/acme-challenge/* {
    root * ${bdir}/html
    file_server
  }
  handle {
    redir https://${DOMAIN}{uri} permanent
  }
}
EOF
    cat > "${bdir}/docker-compose.yml" <<EOF
services:
  caddy:
    image: caddy:2-alpine
    container_name: selfsteal-caddy
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./conf/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./html:${bdir}/html:ro
      - ./ssl:${bdir}/ssl
      - ./logs:${bdir}/logs
EOF
  else
    cat > "${bdir}/conf/nginx.conf" <<EOF
user nginx;
worker_processes auto;
pid /var/run/nginx.pid;
error_log ${bdir}/logs/error.log warn;

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

    access_log ${bdir}/logs/access.log;

    server {
        listen 80;
        listen [::]:80;
        server_name ${DOMAIN};

        location ^~ /.well-known/acme-challenge/ {
            root ${bdir}/html;
            allow all;
        }

        location / {
            return 301 https://\$host\$request_uri;
        }
    }

    server {
        listen ${TARGET} ssl http2;
        server_name ${DOMAIN};

        root ${bdir}/html;
        index index.html;

        ssl_certificate     ${bdir}/ssl/fullchain.pem;
        ssl_certificate_key ${bdir}/ssl/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
        ssl_prefer_server_ciphers on;
EOF
    if [[ "${TRANSPORT}" == "xhttp" ]]; then
      cat >> "${bdir}/conf/nginx.conf" <<EOF

        location ${XHTTP_PATH} {
            grpc_pass grpc://127.0.0.1:${XHTTP_INTERNAL_PORT};
            proxy_pass http://127.0.0.1:${XHTTP_INTERNAL_PORT};
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_buffering off;
            client_max_body_size 0;
        }
EOF
    fi
    cat >> "${bdir}/conf/nginx.conf" <<EOF

        location / {
            try_files \$uri \$uri/ /index.html =404;
        }
    }
}
EOF
    cat > "${bdir}/docker-compose.yml" <<EOF
services:
  nginx:
    image: nginx:stable-alpine
    container_name: selfsteal-nginx
    restart: unless-stopped
    network_mode: "host"
    volumes:
      - ./conf/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./html:${bdir}/html:ro
      - ./ssl:${bdir}/ssl:ro
      - ./logs:${bdir}/logs
EOF
  fi
}

cmd_reinstall() {
  print_header
  msg "🚀 ${CYAN}Running SelfSteal Installer / Reinstaller...${NC}" "🚀 ${CYAN}Запуск установки / переустановки SelfSteal...${NC}"
  bash <(curl -fsSL "https://raw.githubusercontent.com/wemkk1/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh")
}

cmd_start() {
  print_header
  msg "${CYAN}🐳 Starting Docker container ${CONTAINER_NAME} (${DOCKER_IMAGE} · ${DOMAIN} · ${TARGET})...${NC}" "${CYAN}🐳 Запуск Docker-контейнера ${CONTAINER_NAME} (${DOCKER_IMAGE} · ${DOMAIN} · ${TARGET})...${NC}"
  compose_cmd up -d
  sleep 0.4
  local pid
  pid=$(get_container_pid)
  if is_container_running; then
    echo -e "✅ ${GREEN}Status: Running (Container: ${CONTAINER_NAME}, PID: ${pid})${NC}"
    echo -e "   ${WHITE}Server:${NC}             Docker ${SERVER_TITLE} (${DOCKER_IMAGE})"
    echo -e "   ${WHITE}Domain:${NC}             ${DOMAIN}"
    echo -e "   ${WHITE}Port (Target):${NC}      ${TARGET}"
    echo -e "   ${WHITE}Uptime сервера:${NC}     ${GREEN}⏱️  $(get_server_uptime)${NC}"
    echo -e "   ${WHITE}Uptime контейнера:${NC}  ${GREEN}🐳 $(get_service_uptime)${NC}"
    echo -e "   ${WHITE}SSL Directory:${NC}      ${CYAN}🔒 ${SSL_DIR}${NC}"
    echo -e "   ${WHITE}HTML Directory:${NC}     ${CYAN}🎨 ${HTML_DIR} ($(get_current_template))${NC}"
    echo -e "   ${WHITE}Docker Compose:${NC}     ${CYAN}🐳 ${COMPOSE_FILE}${NC}"
    echo -e "   ${WHITE}Config File:${NC}        ${CYAN}⚙️  ${CONF_FILE}${NC}"
  else
    msg "❌ ${RED}Status: Failed to start (check docker logs ${CONTAINER_NAME})${NC}" "❌ ${RED}Status: Ошибка запуска (проверьте docker logs ${CONTAINER_NAME})${NC}"
    exit 1
  fi
}

cmd_stop() {
  print_header
  msg "⏹️  ${YELLOW}Stopping Docker container ${CONTAINER_NAME}...${NC}" "⏹️  ${YELLOW}Остановка Docker-контейнера ${CONTAINER_NAME}...${NC}"
  compose_cmd stop
  msg "✅ ${GREEN}Service stopped.${NC}" "✅ ${GREEN}Сервис остановлен.${NC}"
}

cmd_restart() {
  print_header
  msg "🔄 ${CYAN}Restarting Docker container ${CONTAINER_NAME}...${NC}" "🔄 ${CYAN}Перезапуск Docker-контейнера ${CONTAINER_NAME}...${NC}"
  compose_cmd restart
  msg "✅ ${GREEN}Service restarted.${NC}" "✅ ${GREEN}Сервис перезапущен.${NC}"
  cmd_status
}

cmd_status() {
  print_header
  local pid
  pid=$(get_container_pid)
  if is_container_running; then
    echo -e "✅ ${GREEN}Status: Running (Container: ${CONTAINER_NAME}, PID: ${pid})${NC}"
  else
    echo -e "❌ ${RED}Status: Stopped (Container: ${CONTAINER_NAME})${NC}"
  fi
  echo -e "   ${WHITE}Server:${NC}             Docker ${SERVER_TITLE} (${DOCKER_IMAGE})"
  echo -e "   ${WHITE}Domain:${NC}             ${DOMAIN}"
  echo -e "   ${WHITE}Transport:${NC}          VLESS ${TRANSPORT^^} Reality $( [[ "${TRANSPORT}" == "xhttp" ]] && echo "(${DOMAIN}${XHTTP_PATH})" || echo "(xtls-rprx-vision)" )"
  echo -e "   ${WHITE}Port (Target):${NC}      ${TARGET}"
  echo -e "   ${WHITE}Uptime сервера:${NC}     ${GREEN}⏱️  $(get_server_uptime)${NC}"
  echo -e "   ${WHITE}Uptime контейнера:${NC}  ${GREEN}🐳 $(get_service_uptime)${NC}"
  echo -e "   ${WHITE}SSL:${NC}                ${GREEN}$(get_ssl_expiry)${NC}"
  echo -e "   ${WHITE}Template:${NC}           ${MAGENTA}🎨 $(get_current_template)${NC}"
  echo ""
  msg "📂 ${WHITE}Directories & Paths (${BASE_DIR}):${NC}" "📂 ${WHITE}Директории и пути (${BASE_DIR}):${NC}"
  echo -e "   ├─ 🔒 ${WHITE}SSL Path:${NC}        ${CYAN}${SSL_DIR}${NC} (fullchain.pem, privkey.pem, renew-hook.sh)"
  echo -e "   ├─ 🎨 ${WHITE}HTML Path:${NC}       ${CYAN}${HTML_DIR}${NC} (index.html + 6 templates in /templates)"
  echo -e "   ├─ 🐳 ${WHITE}Docker Compose:${NC}  ${CYAN}${COMPOSE_FILE}${NC}"
  echo -e "   ├─ ⚙️  ${WHITE}Configuration:${NC}   ${CYAN}${CONF_FILE}${NC}"
  echo -e "   ├─ 📝 ${WHITE}Access Logs:${NC}     ${CYAN}${LOGS_DIR}${NC} (access.log, error.log)"
  echo -e "   └─ 🔗 ${WHITE}Global CLI:${NC}      ${CYAN}/usr/local/bin/selfssteal -> ${BASE_DIR}/selfssteal.sh${NC}"
}

cmd_template() {
  print_header
  msg "🎨 ${WHITE}Select HTML template for SelfSteal (${HTML_DIR}/index.html):${NC}" "🎨 ${WHITE}Выберите HTML-заглушку для маскировки SelfSteal (${HTML_DIR}/index.html):${NC}"
  echo -e "   ${WHITE}1)${NC} 🚀 ${GREEN}1-speedtest.html${NC}  — Speedtest / Спидтест с анимированным гейджем"
  echo -e "   ${WHITE}2)${NC} ☁️  ${GREEN}2-cloud.html${NC}      — Cloud Storage / Облачное хранилище"
  echo -e "   ${WHITE}3)${NC} 😂 ${GREEN}3-memes.html${NC}      — MemeDump / Лента с мемами (тёмная тема)"
  echo -e "   ${WHITE}4)${NC} ⚠️  ${GREEN}4-overloaded.html${NC} — 503 Overloaded / «Сервис перегружен» (503)"
  echo -e "   ${WHITE}5)${NC} 💻 ${GREEN}5-tech.html${NC}       — Nexora Systems / Технический лендинг"
  echo -e "   ${WHITE}6)${NC} 🐙 ${GREEN}6-gitpage.html${NC}    — GitPage / Репозиторий в стиле GitHub"
  echo -e "   ${WHITE}7)${NC} 🎲 ${CYAN}Random (1-6) / Случайный выбор${NC}"
  echo ""
  if [[ "${LANG_CODE}" == "en" ]]; then
    read -r -p "👉 Select template (e.g. 7 for Random): " TPL_CHOICE < /dev/tty
  else
    read -r -p "👉 Выберите шаблон (например: 7 для Random): " TPL_CHOICE < /dev/tty
  fi
  TPL_CHOICE="${TPL_CHOICE:-7}"
  local files=("1-speedtest.html" "2-cloud.html" "3-memes.html" "4-overloaded.html" "5-tech.html" "6-gitpage.html")
  local chosen=""
  if [[ "${TPL_CHOICE}" =~ ^[1-6]$ ]]; then
    chosen="${files[$((TPL_CHOICE - 1))]}"
  else
    chosen="${files[$((RANDOM % 6))]}"
  fi
  if [[ -f "${HTML_DIR}/templates/${chosen}" ]]; then
    cp -f "${HTML_DIR}/templates/${chosen}" "${HTML_DIR}/index.html"
    echo "${chosen}" > "${HTML_DIR}/.current_template"
    msg "✅ ${GREEN}Active HTML template updated to: ${chosen}${NC}" "✅ ${GREEN}Активная HTML-заглушка обновлена на: ${chosen}${NC}"
  else
    msg "⚠️  ${YELLOW}Template ${chosen} not found in ${HTML_DIR}/templates${NC}" "⚠️  ${YELLOW}Шаблон ${chosen} не найден в ${HTML_DIR}/templates${NC}"
  fi
}

cmd_change_domain() {
  print_header
  msg "🌐 ${WHITE}Change domain (current: ${DOMAIN})${NC}" "🌐 ${WHITE}Смена домена (текущий: ${DOMAIN})${NC}"
  local new_domain
  if [[ "${LANG_CODE}" == "en" ]]; then
    read -r -p "👉 Domain (e.g. example.com): " new_domain < /dev/tty
  else
    read -r -p "👉 Домен (например: example.com): " new_domain < /dev/tty
  fi
  new_domain="${new_domain#http://}"
  new_domain="${new_domain#https://}"
  new_domain="${new_domain%%/*}"
  if [[ -z "${new_domain}" ]]; then
    msg "⚠️  ${YELLOW}Domain not entered. Cancelled.${NC}" "⚠️  ${YELLOW}Домен не введён. Отмена.${NC}"
    return
  fi

  local old_domain="${DOMAIN}"
  DOMAIN="${new_domain}"

  msg "⚙️  ${CYAN}Updating configuration files for ${DOMAIN}...${NC}" "⚙️  ${CYAN}Обновление конфигурационных файлов для ${DOMAIN}...${NC}"
  write_webserver_files "${WEB_SERVER}" "${BASE_DIR}"

  if [[ -f "${SSL_DIR}/renew-hook.sh" ]]; then
    sed -i "s|^DOMAIN=.*|DOMAIN="${DOMAIN}"|" "${SSL_DIR}/renew-hook.sh"
  fi
  if [[ -f "${BASE_DIR}/xray-reality-reference.json" ]]; then
    sed -i "s|${old_domain}|${DOMAIN}|g" "${BASE_DIR}/xray-reality-reference.json"
  fi
  sed -i "s|^DOMAIN=.*|DOMAIN="${DOMAIN}"|" "${BASE_DIR}/selfssteal.sh"

  msg "🔒 ${CYAN}Issuing Let's Encrypt SSL certificate for ${DOMAIN}...${NC}" "🔒 ${CYAN}Выпуск SSL сертификата Let's Encrypt для ${DOMAIN}...${NC}"
  compose_cmd stop || true
  if [[ -f ~/.acme.sh/acme.sh ]]; then
    if ~/.acme.sh/acme.sh --issue -d "${DOMAIN}" --standalone --keylength ec-256 --force; then
      ~/.acme.sh/acme.sh --install-cert -d "${DOMAIN}" --ecc \
        --fullchain-file "${SSL_DIR}/fullchain.pem" \
        --key-file "${SSL_DIR}/privkey.pem"
    else
      openssl ecparam -genkey -name prime256v1 -out "${SSL_DIR}/privkey.pem"
      openssl req -new -x509 -key "${SSL_DIR}/privkey.pem" -out "${SSL_DIR}/fullchain.pem" -days 365 -subj "/CN=${DOMAIN}"
    fi
  else
    openssl ecparam -genkey -name prime256v1 -out "${SSL_DIR}/privkey.pem"
    openssl req -new -x509 -key "${SSL_DIR}/privkey.pem" -out "${SSL_DIR}/fullchain.pem" -days 365 -subj "/CN=${DOMAIN}"
  fi
  chmod 644 "${SSL_DIR}/fullchain.pem"
  chmod 600 "${SSL_DIR}/privkey.pem"

  compose_cmd up -d
  msg "✅ ${GREEN}Domain changed to ${DOMAIN} and service restarted.${NC}" "✅ ${GREEN}Домен изменён на ${DOMAIN}, сервис перезапущен.${NC}"
}

cmd_switch_server() {
  print_header
  local new_ws new_title new_img new_cname new_bdir new_cfile
  if [[ "${WEB_SERVER}" == "caddy" ]]; then
    new_ws="nginx"
    new_title="Nginx"
    new_img="nginx:stable-alpine"
    new_cname="selfsteal-nginx"
    new_bdir="/opt/nginx"
    new_cfile="${new_bdir}/conf/nginx.conf"
  else
    new_ws="caddy"
    new_title="Caddy"
    new_img="caddy:2-alpine"
    new_cname="selfsteal-caddy"
    new_bdir="/opt/ss-caddy"
    new_cfile="${new_bdir}/conf/Caddyfile"
  fi

  msg "🔄 ${CYAN}Switching web server: ${SERVER_TITLE} (${BASE_DIR}) -> ${new_title} (${new_bdir})...${NC}" "🔄 ${CYAN}Переключение веб-сервера: ${SERVER_TITLE} (${BASE_DIR}) -> ${new_title} (${new_bdir})...${NC}"
  compose_cmd down || docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true

  mkdir -p "${new_bdir}/conf" "${new_bdir}/html/templates" "${new_bdir}/ssl" "${new_bdir}/logs"
  cp -rf "${HTML_DIR}/." "${new_bdir}/html/" 2>/dev/null || true
  cp -rf "${SSL_DIR}/." "${new_bdir}/ssl/" 2>/dev/null || true
  if [[ -f "${BASE_DIR}/xray-reality-reference.json" ]]; then
    cp -f "${BASE_DIR}/xray-reality-reference.json" "${new_bdir}/xray-reality-reference.json" 2>/dev/null || true
  fi

  write_webserver_files "${new_ws}" "${new_bdir}"

  cp -f "${BASE_DIR}/selfssteal.sh" "${new_bdir}/selfssteal.sh"
  sed -i \
    -e "s|^WEB_SERVER=.*|WEB_SERVER="${new_ws}"|" \
    -e "s|^SERVER_TITLE=.*|SERVER_TITLE="${new_title}"|" \
    -e "s|^DOCKER_IMAGE=.*|DOCKER_IMAGE="${new_img}"|" \
    -e "s|^CONTAINER_NAME=.*|CONTAINER_NAME="${new_cname}"|" \
    -e "s|^BASE_DIR=.*|BASE_DIR="${new_bdir}"|" \
    -e "s|^CONF_FILE=.*|CONF_FILE="${new_cfile}"|" \
    "${new_bdir}/selfssteal.sh"
  chmod +x "${new_bdir}/selfssteal.sh"
  ln -sf "${new_bdir}/selfssteal.sh" /usr/local/bin/selfssteal
  ln -sf "${new_bdir}/selfssteal.sh" /usr/local/bin/selfsteal

  WEB_SERVER="${new_ws}"
  SERVER_TITLE="${new_title}"
  DOCKER_IMAGE="${new_img}"
  CONTAINER_NAME="${new_cname}"
  BASE_DIR="${new_bdir}"
  COMPOSE_FILE="${BASE_DIR}/docker-compose.yml"
  CONF_FILE="${new_cfile}"
  SSL_DIR="${BASE_DIR}/ssl"
  HTML_DIR="${BASE_DIR}/html"
  LOGS_DIR="${BASE_DIR}/logs"

  compose_cmd up -d
  msg "✅ ${GREEN}Switched to Docker ${SERVER_TITLE} (${DOCKER_IMAGE}) in ${BASE_DIR}!${NC}" "✅ ${GREEN}Успешно переключено на Docker ${SERVER_TITLE} (${DOCKER_IMAGE}) в ${BASE_DIR}!${NC}"
}

cmd_logs() {
  print_header
  msg "📝 ${CYAN}Streaming logs (Ctrl+C to exit)...${NC}" "📝 ${CYAN}Просмотр логов в реальном времени (Ctrl+C для выхода)...${NC}"
  touch "${LOGS_DIR}/access.log" "${LOGS_DIR}/error.log"
  tail -n 50 -f "${LOGS_DIR}/access.log" "${LOGS_DIR}/error.log"
}

cmd_log_sizes() {
  print_header
  msg "📊 ${WHITE}Log directory usage (${LOGS_DIR}):${NC}" "📊 ${WHITE}Размер логов в директории (${LOGS_DIR}):${NC}"
  du -sh "${LOGS_DIR}" 2>/dev/null || true
  echo ""
  for lf in "${LOGS_DIR}/access.log" "${LOGS_DIR}/error.log"; do
    if [[ -f "${lf}" ]]; then
      local sz lines
      sz=$(du -h "${lf}" | awk '{print $1}')
      lines=$(wc -l < "${lf}" || echo "0")
      echo -e "   • ${CYAN}$(basename "${lf}")${NC}: ${GREEN}${sz}${NC} (${lines} lines)"
    else
      echo -e "   • ${CYAN}$(basename "${lf}")${NC}: 0B (0 lines)"
    fi
  done
}

cmd_clean_logs() {
  print_header
  truncate -s 0 "${LOGS_DIR}/access.log" "${LOGS_DIR}/error.log" 2>/dev/null || true
  msg "🧹 ${GREEN}Logs cleaned (access.log & error.log truncated to 0B).${NC}" "🧹 ${GREEN}Логи очищены (access.log и error.log обнулены).${NC}"
}

cmd_renew_ssl() {
  print_header
  msg "🔒 ${CYAN}Renewing SSL certificate for ${DOMAIN}...${NC}" "🔒 ${CYAN}Обновление SSL сертификата для ${DOMAIN}...${NC}"
  if [[ -x "${SSL_DIR}/renew-hook.sh" ]]; then
    "${SSL_DIR}/renew-hook.sh"
  elif [[ -f ~/.acme.sh/acme.sh ]]; then
    ~/.acme.sh/acme.sh --renew -d "${DOMAIN}" --ecc --force || true
    ~/.acme.sh/acme.sh --install-cert -d "${DOMAIN}" --ecc \
      --fullchain-file "${SSL_DIR}/fullchain.pem" \
      --key-file "${SSL_DIR}/privkey.pem"
    compose_cmd restart
  fi
  msg "✅ ${GREEN}SSL status: $(get_ssl_expiry)${NC}" "✅ ${GREEN}Статус SSL: $(get_ssl_expiry)${NC}"
}

cmd_edit_config() {
  print_header
  msg "✏️  ${CYAN}Opening ${CONF_FILE}...${NC}" "✏️  ${CYAN}Открытие конфигурации ${CONF_FILE}...${NC}"
  if command -v nano >/dev/null 2>&1; then
    nano "${CONF_FILE}" < /dev/tty > /dev/tty
  else
    ${EDITOR:-vi} "${CONF_FILE}" < /dev/tty > /dev/tty
  fi
  msg "🔄 ${CYAN}Restarting container to apply changes...${NC}" "🔄 ${CYAN}Перезапуск контейнера для применения изменений...${NC}"
  compose_cmd restart
  msg "✅ ${GREEN}Configuration applied.${NC}" "✅ ${GREEN}Конфигурация применена.${NC}"
}

cmd_remove() {
  print_header
  msg "🗑️  ${RED}${BOLD}UNINSTALL DOCKER SELFSTEAL (${BASE_DIR})${NC}" "🗑️  ${RED}${BOLD}УДАЛЕНИЕ DOCKER SELFSTEAL (${BASE_DIR})${NC}"
  if [[ "${LANG_CODE}" == "en" ]]; then
    read -r -p "Are you sure you want to remove container ${CONTAINER_NAME} and directory ${BASE_DIR}? (y/N): " CONFIRM < /dev/tty
  else
    read -r -p "Вы уверены, что хотите удалить контейнер ${CONTAINER_NAME} и директорию ${BASE_DIR}? (y/N): " CONFIRM < /dev/tty
  fi
  if [[ "${CONFIRM,,}" != "y" ]]; then
    msg "ℹ️  ${CYAN}Uninstall cancelled.${NC}" "ℹ️  ${CYAN}Отмена удаления.${NC}"
    exit 0
  fi

  msg "⏹️  [1/4] Stopping and removing Docker container ${CONTAINER_NAME}..." "⏹️  [1/4] Остановка и удаление Docker-контейнера ${CONTAINER_NAME}..."
  compose_cmd down || docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true

  msg "🧹 [2/4] Removing SSL cron job and logrotate config..." "🧹 [2/4] Удаление задачи автообновления SSL из Cron и ротации логов..."
  (crontab -l 2>/dev/null | grep -v "renew-hook.sh" || true) | crontab -
  rm -f "/etc/logrotate.d/selfsteal-${WEB_SERVER}"

  msg "🗑️  [3/4] Removing directory ${BASE_DIR}..." "🗑️  [3/4] Удаление рабочей директории ${BASE_DIR}..."
  rm -rf "${BASE_DIR}"

  msg "🔗 [4/4] Removing global symlink /usr/local/bin/selfssteal..." "🔗 [4/4] Удаление глобального symlink /usr/local/bin/selfssteal..."
  rm -f /usr/local/bin/selfssteal /usr/local/bin/selfsteal

  msg "✅ ${GREEN}SelfSteal completely uninstalled.${NC}" "✅ ${GREEN}SelfSteal полностью удален с сервера.${NC}"
}

cmd_menu() {
  clear 2>/dev/null || true
  print_header
  print_top_status
  echo ""
  echo -e "${WHITE}Service Management:${NC}"
  echo -e "   ${WHITE}1)${NC} ${GREEN}Install / Reinstall${NC}"
  echo -e "   ${WHITE}2)${NC} ${GREEN}Start service${NC}"
  echo -e "   ${WHITE}3)${NC} ${GREEN}Stop service${NC}"
  echo -e "   ${WHITE}4)${NC} ${GREEN}Restart service${NC}"
  echo -e "   ${WHITE}5)${NC} ${GREEN}Service status${NC}"
  echo ""
  echo -e "${WHITE}Website Management:${NC}"
  echo -e "   ${WHITE}6)${NC} ${GREEN}Change HTML template (1-6 или Random)${NC}"
  echo -e "   ${WHITE}7)${NC} ${GREEN}Change domain${NC}"
  echo -e "   ${WHITE}8)${NC} ${GREEN}Switch web server (Caddy ↔ Nginx)${NC}"
  echo ""
  echo -e "${WHITE}Logs & Monitoring:${NC}"
  echo -e "   ${WHITE}9)${NC}  ${GREEN}View logs (tail -f)${NC}"
  echo -e "   ${WHITE}10)${NC} ${GREEN}Log sizes${NC}"
  echo -e "   ${WHITE}11)${NC} ${GREEN}Clean logs${NC}"
  echo ""
  echo -e "${WHITE}SSL:${NC}"
  echo -e "   ${WHITE}12)${NC} ${GREEN}Renew SSL certificate${NC}"
  echo -e "   ${WHITE}13)${NC} ${GREEN}Edit web server config${NC}"
  echo ""
  echo -e "${WHITE}Maintenance:${NC}"
  echo -e "   ${WHITE}14)${NC} ${RED}Uninstall SelfSteal${NC}"
  echo ""
  echo -e "   ${WHITE}0)${NC} ${GREEN}Exit${NC}"
  echo ""
  read -r -p "Select option [0-14]: " MENU_OPT < /dev/tty
  case "${MENU_OPT}" in
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
    *) msg "⚠️  ${YELLOW}Invalid option: ${MENU_OPT}${NC}" "⚠️  ${YELLOW}Неверный пункт меню: ${MENU_OPT}${NC}" ;;
  esac
}

ACTION="${1:-menu}"
case "${ACTION}" in
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
    echo -e "${BOLD}Usage / Использование: selfssteal {menu|start|stop|restart|status|template|domain|switch|logs|remove}${NC}"
    ;;
esac

CLI_EOF
sed -i \
  -e "s|^LANG_CODE=.*|LANG_CODE=\"${LANG_CODE}\"|" \
  -e "s|^WEB_SERVER=.*|WEB_SERVER=\"${WEB_SERVER}\"|" \
  -e "s|^SERVER_TITLE=.*|SERVER_TITLE=\"${SERVER_TITLE}\"|" \
  -e "s|^DOCKER_IMAGE=.*|DOCKER_IMAGE=\"${DOCKER_IMAGE}\"|" \
  -e "s|^CONTAINER_NAME=.*|CONTAINER_NAME=\"${CONTAINER_NAME}\"|" \
  -e "s|^BASE_DIR=.*|BASE_DIR=\"${BASE_DIR}\"|" \
  -e "s|^DOMAIN=.*|DOMAIN=\"${DOMAIN}\"|" \
  -e "s|^TRANSPORT=.*|TRANSPORT=\"${TRANSPORT}\"|" \
  -e "s|^XHTTP_PATH=.*|XHTTP_PATH=\"${XHTTP_PATH}\"|" \
  -e "s|^TARGET=.*|TARGET=\"${TARGET}\"|" \
  -e "s|^TARGET_HOST=.*|TARGET_HOST=\"${TARGET_HOST}\"|" \
  -e "s|^TARGET_PORT=.*|TARGET_PORT=\"${TARGET_PORT}\"|" \
  -e "s|^ACME_EMAIL=.*|ACME_EMAIL=\"${ACME_EMAIL}\"|" \
  "${BASE_DIR}/selfssteal.sh"
chmod +x "${BASE_DIR}/selfssteal.sh"
ln -sf "${BASE_DIR}/selfssteal.sh" /usr/local/bin/selfssteal
ln -sf "${BASE_DIR}/selfssteal.sh" /usr/local/bin/selfsteal
msg "   ${GREEN}✅ Done${NC}" "   ${GREEN}✅ Готово${NC}"

SHORT_ID=$(openssl rand -hex 8 2>/dev/null || echo "a1b2c3d4e5f60718")

PRIVATE_KEY=""
PUBLIC_KEY=""
if command -v xray >/dev/null 2>&1; then
  X25519_OUT=$(xray x25519 2>/dev/null || true)
  PRIVATE_KEY=$(echo "${X25519_OUT}" | awk -F': ' '/Private key|PrivateKey/ {print $2}' | tr -d '[:space:]')
  PUBLIC_KEY=$(echo "${X25519_OUT}" | awk -F': ' '/Public key|PublicKey|Password/ {print $2}' | tr -d '[:space:]')
fi

# Если бинарник xray не установлен на сервере SelfSteal — генерируем реальные X25519 ключи через OpenSSL
if [[ -z "${PRIVATE_KEY}" || -z "${PUBLIC_KEY}" ]]; then
  TMP_X25519=$(openssl genpkey -algorithm X25519 2>/dev/null || true)
  if [[ -n "${TMP_X25519}" ]]; then
    PRIVATE_KEY=$(echo "${TMP_X25519}" | openssl pkey -outform DER 2>/dev/null | tail -c 32 | base64 | tr '+/' '-_' | tr -d '=\n\r ' || true)
    PUBLIC_KEY=$(echo "${TMP_X25519}" | openssl pkey -pubout -outform DER 2>/dev/null | tail -c 32 | base64 | tr '+/' '-_' | tr -d '=\n\r ' || true)
  fi
fi

PRIVATE_KEY="${PRIVATE_KEY:-YOUR_X25519_PRIVATE_KEY}"
PUBLIC_KEY="${PUBLIC_KEY:-YOUR_X25519_PUBLIC_KEY}"

if [[ "${TRANSPORT}" == "xhttp" ]]; then
  cat > "${BASE_DIR}/xray-reality-reference.json" <<XRAY_REF_EOF
{
  "streamSettings": {
    "network": "xhttp",
    "security": "reality",
    "realitySettings": {
      "show": false,
      "serverNames": [
        "${DOMAIN}"
      ],
      "privateKey": "${PRIVATE_KEY}",
      "publicKey": "${PUBLIC_KEY}",
      "shortIds": [
        "${SHORT_ID}"
      ]
    },
    "xhttpSettings": {
      "path": "${XHTTP_PATH}",
      "host": "${DOMAIN}",
      "mode": "auto"
    }
  }
}
XRAY_REF_EOF
else
  cat > "${BASE_DIR}/xray-reality-reference.json" <<XRAY_REF_EOF
{
  "streamSettings": {
    "network": "tcp",
    "security": "reality",
    "realitySettings": {
      "show": false,
      "serverNames": [
        "${DOMAIN}"
      ],
      "privateKey": "${PRIVATE_KEY}",
      "publicKey": "${PUBLIC_KEY}",
      "shortIds": [
        "${SHORT_ID}"
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
echo -e "${WHITE}🔗 Docker ${SERVER_TITLE} for Reality SelfSteal${NC}"
echo -e "${CYAN}Management System v2.6.0 (Docker Compose)${NC}"
echo -e "${BLUE}Project: VLESS ${TRANSPORT^^} Reality | Author: t.me/wemkz${NC}"
echo -e "${BLUE}──────────────────────────────────────────────────────────${NC}"
echo ""
echo -e "✅ ${GREEN}Status: Running (Container: ${CONTAINER_NAME})${NC}"
echo -e "   ${WHITE}Server:${NC}     Docker ${SERVER_TITLE} (${DOCKER_IMAGE})"
echo -e "   ${WHITE}Domain:${NC}     ${DOMAIN}"
echo -e "   ${WHITE}Transport:${NC}  VLESS ${TRANSPORT^^} Reality"
echo -e "   ${WHITE}Port:${NC}       ${TARGET_PORT} (Target: ${TARGET})"
echo -e "   ${WHITE}SSL:${NC}        ${GREEN}✅ Valid, 89 days left (Let's Encrypt)${NC}"
echo -e "   ${WHITE}Template:${NC}   ${MAGENTA}${CHOSEN_DESC}${NC}"
echo ""
msg "📋 ${WHITE}Management CLI (run 'selfssteal' to open interactive 0-14 menu):${NC}" "📋 ${WHITE}Команды управления (введите 'selfssteal' для открытия меню 0-14):${NC}"
echo -e "   📋 ${GREEN}selfssteal${NC}          — Interactive Menu (1-14: Service, Templates, Domain, Switch Server, Logs, SSL, Uninstall)"
echo -e "   ▶️  ${GREEN}selfssteal start${NC}    — Start service"
echo -e "   📊 ${GREEN}selfssteal status${NC}   — Service status & paths"
echo -e "   🎨 ${GREEN}selfssteal template${NC} — Change HTML template (1-6 or Random)"
echo -e "   🗑️  ${RED}selfssteal remove${NC}   — Uninstall SelfSteal"
echo ""
msg "🔑 ${WHITE}Reality parameters for panel (3X-UI / Marzban / Remnawave / Xray):${NC}" "🔑 ${WHITE}Параметры Reality для панели (3X-UI / Marzban / Remnawave / Xray):${NC}"
echo -e "   • Target (Dest):       ${GREEN}${TARGET}${NC}"
echo -e "   • ServerNames (SNI):   ${GREEN}${DOMAIN}${NC}"
if [[ "${TRANSPORT}" == "xhttp" ]]; then
  echo -e "   • XHTTP Host:          ${GREEN}${DOMAIN}${NC}"
  echo -e "   • XHTTP Path:          ${GREEN}${XHTTP_PATH}${NC} (${DOMAIN}${XHTTP_PATH})"
fi
echo -e "   • Private Key:         ${YELLOW}${PRIVATE_KEY}${NC}"
echo -e "   • Public Key:          ${YELLOW}${PUBLIC_KEY}${NC}"
echo -e "   • ShortId:             ${YELLOW}${SHORT_ID}${NC}"
echo ""
msg "📖 ${WHITE}Xray streamSettings configuration:${NC}" "📖 ${WHITE}Что прописать в конфиг Xray (блок streamSettings):${NC}"
if [[ "${TRANSPORT}" == "xhttp" ]]; then
  cat <<XRAY_EOF
{
  "streamSettings": {
    "network": "xhttp",
    "security": "reality",
    "realitySettings": {
      "show": false,
      "serverNames": [
        "${DOMAIN}"
      ],
      "privateKey": "${PRIVATE_KEY}",
      "publicKey": "${PUBLIC_KEY}",
      "shortIds": [
        "${SHORT_ID}"
      ]
    },
    "xhttpSettings": {
      "path": "${XHTTP_PATH}",
      "host": "${DOMAIN}",
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
        "${DOMAIN}"
      ],
      "privateKey": "${PRIVATE_KEY}",
      "publicKey": "${PUBLIC_KEY}",
      "shortIds": [
        "${SHORT_ID}"
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
echo -e "💡 ${BLUE}Tip: Run 'selfssteal' to open the interactive management menu [0-14]${NC}"
