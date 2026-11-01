# 🔗 SelfSteal Management System — VLESS XHTTP Reality (Caddy)

**Author:** [t.me/wemkz](https://t.me/wemkz)

![OS](https://img.shields.io/badge/OS-Ubuntu%2020.04%2B%20%7C%20Debian%2011%2B-0ea5e9?style=flat-square)
![Transport](https://img.shields.io/badge/VLESS-XHTTP%20Reality-10b981?style=flat-square)
![WebServer](https://img.shields.io/badge/Server-Caddy-38bdf8?style=flat-square)
![Author](https://img.shields.io/badge/Author-t.me%2Fwemkz-8b5cf6?style=flat-square)

Красивый цветной Bash-установщик **`install-selfsteal.sh`** с эмодзи-интерфейсом для развертывания маскировочного узла **SelfSteal** под **VLESS + XHTTP / TCP + Reality** с поддержкой **Caddy** (`/opt/ss-caddy`) и **Nginx** (`/opt/nginx`), **6 встроенными HTML-заглушками (с автоматическим случайным выбором)**, глобальной CLI-командой **`selfssteal`**, проверкой DNS через **`1.1.1.1` / `8.8.8.8` / `9.9.9.9`**, автообновлением сертификатов **Let's Encrypt** и ротацией логов.

---

## 🚀 Быстрая установка на VPS (одной командой из GitHub без скачивания)

Запустите установщик напрямую через `bash <(curl ...)` (интерактивный ввод работает через `/dev/tty`):

```bash
bash <(curl -fsSL "https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh")
```

Или через пайп `curl | bash`:

```bash
curl -fsSL "https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh" | bash
```

---

## 🎨 6 встроенных HTML-заглушек (Рандомный выбор при установке)

Во время установки скрипт сохраняет все 6 реалистичных HTML-шаблонов в `/opt/ss-caddy/html/templates/` и **автоматически выбирает случайный шаблон (`RANDOM % 6`)** в `/opt/ss-caddy/html/index.html`. Вы также можете переключить шаблон в любой момент командой `selfssteal template`:

| № | Файл шаблона | Описание маскировочной страницы |
| :--- | :--- | :--- |
| **1** | 🚀 `1-speedtest.html` | Спидтест с анимированным SVG-гейджем, пингом и цифрами скорости |
| **2** | ☁️ `2-cloud.html` | Облачное хранилище файлов с сайдбаром, квотой диска и сеткой документов |
| **3** | 😂 `3-memes.html` | Лента с мемами (**MemeDump**) в тёмной теме с карточками и лайками |
| **4** | ⚠️ `4-overloaded.html` | Страница «Сервис временно перегружен» (`HTTP 503`) с живым прогресс-баром |
| **5** | 💻 `5-tech.html` | Технический лендинг инфраструктурной компании (**Nexora Systems**) |
| **6** | 🐙 `6-gitpage.html` | Страница репозитория в стиле GitHub (**GitPage** — `wemk / core-infra`) |

---

## 🛠️ Управление через CLI команду `selfssteal`

При установке автоматически создается глобальный symlink **`/usr/local/bin/selfssteal -> /opt/ss-caddy/selfssteal.sh`**:

| Команда | Описание |
| :--- | :--- |
| `selfssteal start` | ▶️ Запустить сервис SelfSteal (caddy) и показать статус |
| `selfssteal status` | 📊 Показать статус процесса, **Uptime сервера и процесса**, срок SSL, активный HTML-шаблон и пути к **SSL / HTML** |
| `selfssteal template` | 🎨 Выбрать один из 6 шаблонов заглушки (`1-speedtest.html` .. `6-gitpage.html`) или случайный |
| `selfssteal menu` | 📋 Открыть интерактивное меню управления (опции 1–14) |
| `selfssteal remove` | 🗑️ Полностью остановить и удалить SelfSteal, очистить Cron, директорию `/opt/ss-caddy` и symlink |
| `selfssteal restart` | 🔄 Перезапустить веб-сервер без обрыва соединений |
| `selfssteal logs` | 📝 Открыть поток логов запросов (`/opt/ss-caddy/logs/access.log`) в реальном времени |

### Пример вывода `selfssteal status`:

```text
root@vps:~# selfssteal status
🔗 Caddy for Reality SelfSteal
Management System v2.5.0
Project: VLESS XHTTP Reality | Author: t.me/wemkz
──────────────────────────────────────────

✅ Status: Running (PID: 1842)
   Server:          Caddy
   Domain:          poland.example.xyz
   Transport:       VLESS XHTTP Reality (poland.example.xyz/media/v3/chunk/)
   Port:            9443 (Target: 127.0.0.1:9443)
   Uptime сервера:  ⏱️  42 days, 11 hours, 28 minutes
   Uptime процесса: ⚡ 14d 06:42:19 (с момента запуска: Sun 2026-10-18 05:12:00 UTC)
   SSL:             ✅ Valid, 73 days left (Let's Encrypt)
   Template:        🎨 🚀 1-speedtest.html (Спидтест с анимированным гейджем и цифрами)

📂 Директории и пути (/opt/ss-caddy):
   ├─ 🔒 Путь к SSL:      /opt/ss-caddy/ssl (fullchain.pem, privkey.pem, renew-hook.sh)
   ├─ 🎨 Путь к HTML:     /opt/ss-caddy/html (index.html + 6 шаблонов в /templates)
   ├─ ⚙️  Конфигурация:    /opt/ss-caddy/conf/Caddyfile
   ├─ 📝 Логи запросов:   /opt/ss-caddy/logs (access.log, error.log)
   └─ 🔗 Глобальный CLI:  /usr/local/bin/selfssteal -> /opt/ss-caddy/selfssteal.sh

📋 Available Operations:

🔧 Service Management:
   1) 🚀 Reconfigure Caddy
   2) ▶️  Start services          (selfssteal start)
   3) ⏹️  Stop services
   4) 🔄 Restart services        (selfssteal restart)
   5) 📊 Service status & Uptime (selfssteal status)

🎨 Website Management:
   6) 🎨 Website templates       (selfssteal template — Random 1-6)
   7) 📖 Setup guide & streamSettings

📝 Logs & Monitoring:
   8) 📝 View logs               (selfssteal logs)
   9) 📊 Log sizes
   10) 🧹 Clean logs
   11) ✏️  Edit configuration
   12) 🔒 Renew SSL certificate

🗑️  Maintenance:
   13) 🗑️  Uninstall Caddy      (selfssteal remove)
   14) 🌐 Check DNS (1.1.1.1 / 8.8.8.8 / 9.9.9.9)

   0) ⬅️  Exit

💡 Tip: Use 'selfssteal template' or option 6 to customize website templates
```

---

## 📂 Структура директории `/opt/ss-caddy`

```text
/usr/local/bin/selfssteal ─────────► symlink на /opt/ss-caddy/selfssteal.sh
/opt/ss-caddy/
├── selfssteal.sh                   # Цветная CLI утилита управления (Author: t.me/wemkz)
├── conf/
│   └── Caddyfile                  # Конфигурация Caddy (слушает 127.0.0.1:9443)
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
│   └── renew-hook.sh               # Скрипт автообновления по Cron (ежедневно в 03:15)
└── logs/
    ├── access.log                  # Логи входящих запросов (JSON, ротация 14 дн.)
    └── error.log                   # Логи ошибок и предупреждений TLS
```

---

## 🌐 Доменные записи (DNS) для `poland.example.xyz`

| Тип | Имя | Значение | TTL | Режим проксирования |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `poland.example.xyz` | `185.212.140.42` | `300 (Auto)` | **DNS Only (Без облачка Cloudflare)** |
| **CAA** | `@` | `0 issue "letsencrypt.org"` | `3600` | **DNS Only** |

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
      "dest": "127.0.0.1:9443",
      "target": "127.0.0.1:9443",
      "xver": 0,
      "serverNames": [
        "poland.example.xyz"
      ],
      "privateKey": "YOUR_X25519_PRIVATE_KEY",
      "shortIds": [
        "a1b2c3d4e5f60718"
      ],
      "spiderX": "/"
    },
    "xhttpSettings": {
      "path": "/media/v3/chunk/",
      "host": "poland.example.xyz",
      "mode": "auto"
    }
  }
}
```
