# SelfSteal Bash Architect — VLESS XHTTP / TCP Reality (Caddy & Nginx)

![Platform](https://img.shields.io/badge/OS-Ubuntu%2020.04%2B%20%7C%20Debian%2011%2B-0ea5e9?style=flat-square)
![Protocols](https://img.shields.io/badge/VLESS-XHTTP%20%7C%20TCP%20Reality-10b981?style=flat-square)
![WebServer](https://img.shields.io/badge/Server-Caddy%20%7C%20Nginx-38bdf8?style=flat-square)
![SSL](https://img.shields.io/badge/SSL-Let's%20Encrypt%20EC--256%20Auto--Renew-f59e0b?style=flat-square)

Автоматизированный Bash-установщик **`install-selfsteal.sh`** и интерактивный веб-конфигуратор для настройки **SelfSteal** (собственного маскировочного узла) под протоколы **VLESS + XHTTP (SplitHTTP) + Reality** и **VLESS + TCP + Reality (`xtls-rprx-vision`)**.

---

## Содержание

- [Возможности](#возможности)
- [Управление через команду `selfssteal`](#управление-через-команду-selfssteal)
- [Автоматическая сверка DNS (`1.1.1.1`, `8.8.8.8`, `9.9.9.9`)](#автоматическая-сверка-dns-1111-8888-9999)
- [Архитектура работы SelfSteal](#архитектура-работы-selfsteal)
- [Быстрый старт (Установка на VPS)](#быстрый-старт-установка-на-vps)
- [Пошаговый диалог скрипта (4 шага)](#пошаговый-диалог-скрипта-4-шага)
- [Структура директорий `/opt/ss-caddy` и `/opt/nginx`](#структура-директорий-optss-caddy-и-optnginx)
- [Настройка доменных записей (DNS)](#настройка-доменных-записей-dns)
- [Конфигурация Xray / 3X-UI / Marzban](#конфигурация-xray--3x-ui--marzban)

---

## Возможности

- **Два веб-сервера на выбор**:
  - **Caddy** — изолированная конфигурация в `/opt/ss-caddy` с поддержкой HTTP/2, H2C и TLS 1.3.
  - **Nginx** — высокопроизводительная конфигурация в `/opt/nginx` с поддержкой `ssl http2`, gRPC/XHTTP проксирования и кастомных форматов логов.
- **Поддержка VLESS XHTTP и VLESS TCP Reality**:
  - Для **XHTTP (SplitHTTP)** скрипт запрашивает кастомный путь чанков (например, `poland.example.xyz/media/v3/chunk/` или `/media/v3/chunk/`) и настраивает маршрутизацию.
  - Для **TCP Reality** настраивается классический локальный сокет под `xtls-rprx-vision`.
- **Гибкий Target (Dest)**: по умолчанию локальный сокет **`127.0.0.1:9443`** с возможностью указать любой порт при установке.
- **Автоматическая проверка DNS при установке**: сверяет `A`-запись вашего домена через **`1.1.1.1`**, **`8.8.8.8`** и **`9.9.9.9`** с внешним IPv4 сервера и предупреждает при расхождении.
- **Глобальная CLI-команда `selfssteal`**: управление запуском (`selfssteal`), просмотром статуса, аптайма и путей к SSL/HTML (`selfssteal status`) и полным удалением (`selfssteal remove`).
- **Автоматический SSL Let's Encrypt (ECC EC-256)** и **ротация логов (`logrotate`)**.

---

## Управление через команду `selfssteal`

После завершения установки в систему добавляется глобальная команда `/usr/local/bin/selfssteal` (а также симлинк `selfsteal`):

| Команда | Действие |
| :--- | :--- |
| **`selfssteal`** | Запускает сервис SelfSteal (Caddy / Nginx) и выводит краткую сводку |
| **`selfssteal status`** | Показывает статус сервиса (`ACTIVE`), **точный Uptime**, срок действия SSL и пути к директориям **SSL** и **HTML** |
| **`selfssteal remove`** | Останавливает сервис, удаляет задачу Cron автообновления SSL, очищает `/opt/ss-caddy` или `/opt/nginx` и удаляет CLI |
| **`selfssteal restart`** | Перезапускает веб-сервер и выводит обновленный статус |
| **`selfssteal logs`** | Открывает лог запросов `logs/access.log` в реальном времени |

### Пример вывода `selfssteal status`:

```text
root@vps:~# selfssteal status
========================================================================
   СТАТУС SELFSTEAL (VLESS XHTTP REALITY)
========================================================================
   • Статус сервиса:        ● ACTIVE (running) — CADDY
   • Время работы (Uptime): 14d 06:42:19 (с момента запуска: Sun 2026-10-18 05:12:00 UTC)
   • Домен (SNI):           poland.example.xyz
   • Протокол / Путь:       XHTTP (poland.example.xyz/media/v3/chunk/)
   • Target (Dest):         127.0.0.1:9443
   • Срок действия SSL:     Jan 30 11:54:00 2027 GMT (Let's Encrypt EC-256)

   ДИРЕКТОРИИ И ФАЙЛЫ (/opt/ss-caddy):
   • Директория SSL:        /opt/ss-caddy/ssl
     ├─ Сертификат:         /opt/ss-caddy/ssl/fullchain.pem
     ├─ Приватный ключ:     /opt/ss-caddy/ssl/privkey.pem
     └─ Автообновление:     /opt/ss-caddy/ssl/renew-hook.sh
   • Директория HTML:       /opt/ss-caddy/html
     └─ Главная стр.:       /opt/ss-caddy/html/index.html
   • Конфиг сервера:        /opt/ss-caddy/conf/Caddyfile
   • Директория логов:      /opt/ss-caddy/logs (access.log, error.log)
========================================================================
```

---

## Автоматическая сверка DNS (`1.1.1.1`, `8.8.8.8`, `9.9.9.9`)

Один раз во время выполнения `install-selfsteal.sh` (перед выпуском сертификата Let's Encrypt) скрипт определяет внешний IPv4 вашего сервера и проверяет `A`-запись домена через три публичных резолвера:

1. **Cloudflare DNS (`1.1.1.1`)**
2. **Google Public DNS (`8.8.8.8`)**
3. **Quad9 DNS (`9.9.9.9`)**

Если IP-адрес домена хотя бы на одном из резолверов не совпадает с внешним IP сервера (например, запись еще не обновилась или включено оранжевое облако Cloudflare Proxy), скрипт выводит предупреждение и спрашивает:
`Продолжить установку несмотря на несовпадение DNS? [y/N]:`

---

## Архитектура работы SelfSteal

```text
                       Входящее соединение (Порт 443)
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │       Xray Core (VLESS)         │
                    │    Reality TLS Handshake        │
                    └────────────────┬────────────────┘
                                     │
              ┌──────────────────────┴──────────────────────┐
              │ Авторизованный клиент                       │ Неизвестный клиент / Active Probing (DPI)
              │ (Валидный ShortId + X25519)                 │ (Запрос сертификата и статики)
              ▼                                             ▼
  ┌───────────────────────────┐               ┌───────────────────────────────────┐
  │ Прямой туннель VLESS      │               │ Target (Dest): 127.0.0.1:9443     │
  │ • TCP (xtls-rprx-vision)  │               │ Caddy (/opt/ss-caddy) или         │
  │ • XHTTP (/media/v3/chunk/)│               │ Nginx (/opt/nginx)                │
  └───────────────────────────┘               │                                   │
                                              │ • Реальный сертификат Let's Encrypt│
                                              │ • Отдача статики html/index.html  │
                                              │ • Запись в logs/access.log        │
                                              └───────────────────────────────────┘
```

---

## Быстрый старт (Установка на VPS)

```bash
nano install-selfsteal.sh && chmod +x install-selfsteal.sh && sudo ./install-selfsteal.sh
```

---

## Пошаговый диалог скрипта (4 шага)

| Шаг | Вопрос скрипта | Пример ввода | Значение по умолчанию |
| :-- | :--- | :--- | :--- |
| **1** | **Веб-сервер**: `Caddy` или `Nginx` | `1` (Caddy) или `2` (Nginx) | `1` (`/opt/ss-caddy`) |
| **2** | **Домен** для SelfSteal и сертификата Let's Encrypt | `poland.example.xyz` | `poland.example.xyz` |
| **3** | **Протокол**: `XHTTP` или `TCP` *(если выбран XHTTP — запрашивает путь чанков)* | `1` -> `poland.example.xyz/media/v3/chunk/` | `XHTTP` (`/media/v3/chunk/`) |
| **4** | **Порт и адрес Target (Dest)** для Xray Reality | `127.0.0.1:9443` (или просто `9443`) | `127.0.0.1:9443` |

---

## Структура директорий `/opt/ss-caddy` и `/opt/nginx`

```text
/opt/ss-caddy/ (или /opt/nginx/)
├── conf/
│   └── Caddyfile (или nginx.conf)      # Основной конфиг сервера на 127.0.0.1:9443
├── html/
│   └── index.html                      # Маскировочный сайт (SelfSteal статика)
├── ssl/
│   ├── fullchain.pem                   # Публичная цепочка сертификатов Let's Encrypt (chmod 644)
│   ├── privkey.pem                     # Приватный ключ ECDSA P-256 (chmod 600)
│   └── renew-hook.sh                   # Скрипт автоматического обновления SSL и перезагрузки
├── logs/
│   ├── access.log                      # Журнал входящих HTTP/HTTPS запросов (JSON / Combined)
│   ├── error.log                       # Журнал ошибок веб-сервера
│   └── ssl-renew.log                   # Журнал фонового обновления сертификатов Cron
└── xray-reality-reference.json         # Готовый эталонный конфиг для вставки в Xray
```

---

## Настройка доменных записей (DNS)

| Тип | Имя (Host) | Значение (Value) | TTL | Проксирование (Cloudflare) | Назначение |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | `poland` *(или `@`)* | `IPv4 вашего VPS` | `Auto / 300` | **DNS Only (Серое облако)** | Прямое подключение к VPS для Reality и валидации Let's Encrypt |
| **AAAA** | `poland` *(опц.)* | `IPv6 вашего VPS` | `Auto / 300` | **DNS Only (Серое облако)** | Поддержка IPv6 маршрутизации |
| **CAA** | `@` | `0 issue "letsencrypt.org"` | `3600` | **DNS Only** | Разрешает выпуск сертификатов Let's Encrypt |

---

## Конфигурация Xray (`streamSettings`)

Что нужно прописать в блок `streamSettings` конфигурации Xray / Remnawave / Marzban / 3X-UI:

```json
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
```

