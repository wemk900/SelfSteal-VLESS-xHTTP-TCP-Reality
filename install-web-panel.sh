#!/usr/bin/env bash
# ==============================================================================
# 🚀 Автоматический установщик веб-панели SelfSteal Bash Architect + SSH Deploy
# 👨‍💻 Author: t.me/wemkz
# 📦 Репозиторий: https://github.com/wemkk1/SelfSteal-VLESS-xHTTP-TCP-Reality
# 📂 Директория установки: /opt/selfsteal-web
# 🌐 Порт по умолчанию: 3000 (меняется через переменную PORT=3000)
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

REPO_URL="https://github.com/wemkk1/SelfSteal-VLESS-xHTTP-TCP-Reality.git"
INSTALL_DIR="/opt/selfsteal-web"
APP_PORT="${PORT:-3000}"
PM2_NAME="selfsteal-web"

echo -e "${WHITE}🚀 Установка веб-панели SelfSteal Bash Architect (SSH 1-Click Deploy)${NC}"
echo -e "${CYAN}Репозиторий: ${REPO_URL}${NC}"
echo -e "${CYAN}Директория:  ${INSTALL_DIR} | Порт: ${APP_PORT}${NC}"
echo "──────────────────────────────────────────────────────────────────────"

if [[ "${EUID}" -ne 0 ]]; then
  echo -e "❌ ${RED}[ОШИБКА] Запустите скрипт от имени root (sudo bash)${NC}"
  exit 1
fi

# 1. Установка базовых пакетов и Node.js 20 LTS
echo -e "📦 ${CYAN}[1/5] Установка системных пакетов и проверка Node.js 20...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git build-essential ca-certificates gnupg

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 18 ]]; then
  echo -e "   ⬇️  Установка Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo -e "   ✅ Node.js: $(node -v) | NPM: $(npm -v)"

# 2. Установка менеджера процессов PM2
echo -e "⚙️  ${CYAN}[2/5] Проверка / установка PM2...${NC}"
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
echo -e "   ✅ PM2 готов"

# 3. Клонирование или обновление репозитория с сохранением stats.json
echo -e "📥 ${CYAN}[3/5] Загрузка файлов сайта из ${REPO_URL}...${NC}"
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  echo -e "   🔄 Обновление существующей директории ${INSTALL_DIR}..."
  if [[ -f "${INSTALL_DIR}/stats.json" ]]; then
    cp -f "${INSTALL_DIR}/stats.json" /tmp/selfsteal_stats_backup.json
  fi
  git -C "${INSTALL_DIR}" remote set-url origin "${REPO_URL}"
  git -C "${INSTALL_DIR}" fetch --all
  git -C "${INSTALL_DIR}" reset --hard origin/main
  if [[ -f /tmp/selfsteal_stats_backup.json ]]; then
    mv -f /tmp/selfsteal_stats_backup.json "${INSTALL_DIR}/stats.json"
  fi
else
  rm -rf "${INSTALL_DIR}"
  git clone "${REPO_URL}" "${INSTALL_DIR}"
fi

# 4. Установка зависимостей и сборка фронтенда
echo -e "🔨 ${CYAN}[4/5] Установка npm-пакетов и сборка Production фронтенда (npm run build)...${NC}"
cd "${INSTALL_DIR}"
npm install --legacy-peer-deps
npm run build

# 5. Запуск Express + SSH2 сервера через PM2 и автозапуск
echo -e "🚀 ${CYAN}[5/5] Запуск сервера на порту ${APP_PORT} через PM2...${NC}"
pm2 delete "${PM2_NAME}" >/dev/null 2>&1 || true
PORT="${APP_PORT}" NODE_ENV=production pm2 start "npx tsx server.ts" --name "${PM2_NAME}" --cwd "${INSTALL_DIR}"
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

SERVER_IP=$(curl -4 -fsSL --max-time 5 https://icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "──────────────────────────────────────────────────────────────────────"
echo -e "✅ ${GREEN}Веб-панель SelfSteal успешно установлена и запущена!${NC}"
echo -e "🌐 ${WHITE}Адрес панели:${NC}     ${GREEN}http://${SERVER_IP}:${APP_PORT}${NC}"
echo -e "📂 ${WHITE}Папка проекта:${NC}    ${CYAN}${INSTALL_DIR}${NC}"
echo -e "📊 ${WHITE}Файл счетчика:${NC}    ${CYAN}${INSTALL_DIR}/stats.json${NC}"
echo ""
echo -e "🛠️  ${WHITE}Команды управления панелью:${NC}"
echo -e "   • Статус и нагрузка:  ${CYAN}pm2 status${NC}"
echo -e "   • Логи работы сайта:  ${CYAN}pm2 logs ${PM2_NAME}${NC}"
echo -e "   • Перезапуск сайта:   ${CYAN}pm2 restart ${PM2_NAME}${NC}"
echo "──────────────────────────────────────────────────────────────────────"
