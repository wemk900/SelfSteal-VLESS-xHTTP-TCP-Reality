# 🔗 Docker SelfSteal Management System — VLESS XHTTP Reality (Caddy)

**Author:** [t.me/wemkz](https://t.me/wemkz)

![OS](https://img.shields.io/badge/OS-Ubuntu%2020.04%2B%20%7C%20Debian%2011%2B-0ea5e9?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-caddy%3A2--alpine-2496ed?style=flat-square)
![Transport](https://img.shields.io/badge/VLESS-XHTTP%20Reality-10b981?style=flat-square)
![Author](https://img.shields.io/badge/Author-t.me%2Fwemkz-8b5cf6?style=flat-square)

Двуязычный (🇬🇧 **English** / 🇷🇺 **Русский**) Bash-установщик **`install-selfsteal.sh`** для развертывания **Docker-контейнера SelfSteal** (**Caddy** `caddy:2-alpine` в `/opt/ss-caddy` или **Nginx** `nginx:stable-alpine` в `/opt/nginx`) под **VLESS + XHTTP / TCP + Reality**:
- 🌍 **Выбор языка при старте**: `1) English` или `2) Русский` — весь дальнейший интерфейс и CLI-меню работают на выбранном языке.
- 🐳 **Полная контейнеризация (Docker Compose)**: автоматическая установка Docker и развертывание контейнера с реальным выводом всех команд.
- 🎲 **6 встроенных HTML-заглушек**: автоматический случайный выбор (`RANDOM % 6`) при установке + мгновенная смена через меню `selfssteal`.
- 🛠️ **Интерактивное меню `selfssteal` (0–14)**: управление сервисом, смена шаблона, смена домена с перевыпуском SSL, переключение `Caddy ↔ Nginx`, просмотр и очистка логов, редактирование конфига и удаление.

---

## 🚀 Быстрая установка на VPS (одной командой из GitHub без скачивания)

```bash
bash <(curl -fsSL "https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh")
```

Или через пайп `curl | bash`:

```bash
curl -fsSL "https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh" | bash
```

---

## 🛠️ Интерактивное меню `selfssteal` (0–14)

При установке автоматически создается глобальный symlink **`/usr/local/bin/selfssteal -> /opt/ss-caddy/selfssteal.sh`**. Запуск команды `selfssteal` открывает интерактивное меню с текущим статусом (Running/Stopped, домен, сервер, остаток дней SSL):

```text
root@vps:~# selfssteal
🔗 Docker Caddy for Reality SelfSteal
Management System v2.6.0 (Docker Compose)
Project: VLESS XHTTP Reality | Author: t.me/wemkz
──────────────────────────────────────────

✅ Status: Running
   Server:  Caddy (caddy:2-alpine)
   Domain:  poland.example.xyz
   Port:    9443 (127.0.0.1:9443)
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

Select option [0-14]: 
```

---

## 🎨 6 встроенных HTML-заглушек (Рандомный выбор при установке)

| № | Файл шаблона | Описание маскировочной страницы |
| :--- | :--- | :--- |
| **1** | 🚀 `1-speedtest.html` | Спидтест с анимированным SVG-гейджем, пингом и цифрами скорости |
| **2** | ☁️ `2-cloud.html` | Облачное хранилище файлов с сайдбаром, квотой диска и сеткой документов |
| **3** | 😂 `3-memes.html` | Лента с мемами (**MemeDump**) в тёмной теме с карточками и лайками |
| **4** | ⚠️ `4-overloaded.html` | Страница «Сервис временно перегружен» (`HTTP 503`) с живым прогресс-баром |
| **5** | 💻 `5-tech.html` | Технический лендинг инфраструктурной компании (**Nexora Systems**) |
| **6** | 🐙 `6-gitpage.html` | Страница репозитория в стиле GitHub (**GitPage** — `wemk / core-infra`) |

---

## 📂 Структура директории `/opt/ss-caddy`

```text
/usr/local/bin/selfssteal ─────────► symlink на /opt/ss-caddy/selfssteal.sh
/opt/ss-caddy/
├── docker-compose.yml              # Docker Compose манифест (selfsteal-caddy, caddy:2-alpine, host network)
├── selfssteal.sh                   # CLI утилита и интерактивное меню 0-14 (Author: t.me/wemkz)
├── conf/
│   └── Caddyfile                  # Конфигурация Caddy (слушает 127.0.0.1:9443)
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
```

---

## 📖 Что прописать в конфиг Xray (`streamSettings`)

- **Target (Dest)**: `127.0.0.1:9443`
- **ServerNames (SNI)**: `poland.example.xyz`
- **XHTTP Path**: `/media/v3/chunk/` (`poland.example.xyz/media/v3/chunk/`)
- **Private Key**: `YOUR_X25519_PRIVATE_KEY`
- **Public Key**: `YOUR_X25519_PUBLIC_KEY`
- **ShortId**: `a1b2c3d4e5f60718`

```json
{
  "streamSettings": {
    "network": "xhttp",
    "security": "reality",
    "realitySettings": {
      "show": false,
      "serverNames": [
        "poland.example.xyz"
      ],
      "privateKey": "YOUR_X25519_PRIVATE_KEY",
      "publicKey": "YOUR_X25519_PUBLIC_KEY",
      "shortIds": [
        "a1b2c3d4e5f60718"
      ]
    },
    "xhttpSettings": {
      "path": "/media/v3/chunk/",
      "host": "poland.example.xyz",
      "mode": "auto"
    }
  }
}
```
