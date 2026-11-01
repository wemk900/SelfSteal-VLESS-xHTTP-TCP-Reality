# SelfSteal Bash Architect — VLESS XHTTP / TCP Reality (Caddy & Nginx)

![Platform](https://img.shields.io/badge/OS-Ubuntu%2020.04%2B%20%7C%20Debian%2011%2B-0ea5e9?style=flat-square)
![Protocols](https://img.shields.io/badge/VLESS-XHTTP%20%7C%20TCP%20Reality-10b981?style=flat-square)
![WebServer](https://img.shields.io/badge/Server-Caddy%20%7C%20Nginx-38bdf8?style=flat-square)
![SSL](https://img.shields.io/badge/SSL-Let's%20Encrypt%20EC--256%20Auto--Renew-f59e0b?style=flat-square)

Автоматизированный Bash-установщик **`install-selfsteal.sh`** и интерактивный веб-конфигуратор для настройки **SelfSteal** (собственного маскировочного узла) под протоколы **VLESS + XHTTP (SplitHTTP) + Reality** и **VLESS + TCP + Reality (`xtls-rprx-vision`)**.

---

## Содержание

- [Возможности](#возможности)
- [Архитектура работы SelfSteal](#архитектура-работы-selfsteal)
- [Быстрый старт (Установка на VPS)](#быстрый-старт-установка-на-vps)
- [Пошаговый диалог скрипта (4 шага)](#пошаговый-диалог-скрипта-4-шага)
- [Структура директорий `/opt/ss-caddy` и `/opt/nginx`](#структура-директорий-optss-caddy-и-optnginx)
- [Настройка доменных записей (DNS)](#настройка-доменных-записей-dns)
- [Конфигурация Xray / 3X-UI / Marzban](#конфигурация-xray--3x-ui--marzban)
- [Автообновление Let's Encrypt и логирование](#автообновление-lets-encrypt-и-логирование)
- [Веб-конфигуратор (Локальный запуск)](#веб-конфигуратор-локальный-запуск)

---

## Возможности

- **Два веб-сервера на выбор**:
  - **Caddy** — изолированная конфигурация в `/opt/ss-caddy` с поддержкой HTTP/2, H2C и TLS 1.3.
  - **Nginx** — высокопроизводительная конфигурация в `/opt/nginx` с поддержкой `ssl http2`, gRPC/XHTTP проксирования и кастомных форматов логов.
- **Поддержка VLESS XHTTP и VLESS TCP Reality**:
  - Для **XHTTP (SplitHTTP)** скрипт запрашивает кастомный путь чанков (например, `poland.example.xyz/media/v3/chunk/` или `/media/v3/chunk/`) и настраивает маршрутизацию.
  - Для **TCP Reality** настраивается классический локальный сокет под `xtls-rprx-vision`.
- **Гибкий Target (Dest)**: по умолчанию локальный сокет **`127.0.0.1:9443`** с возможностью указать любой порт при установке.
- **Автоматический SSL Let's Encrypt (ECC EC-256)**:
  - Выпуск сертификата через `acme.sh` (или `certbot`) и сохранение ключей напрямую в `/opt/ss-caddy/ssl/` или `/opt/nginx/ssl/`.
  - Автоматическое продление по Cron (`15 3 * * *`) через хук `ssl/renew-hook.sh` с бесшовной перезагрузкой сервиса.
- **Структурированное логирование и ротация (`logrotate`)**:
  - Запись входящих запросов в `logs/access.log` (форматы `JSON` или `Combined`) и ошибок в `logs/error.log`.
  - Автоматическая ежедневная ротация и сжатие логов через `/etc/logrotate.d/selfsteal-*`.
- **Готовый отчет после установки**: скрипт сразу выводит JSON-блок `inbounds` для Xray, сгенерированные ключи `X25519` (`Private Key` / `Public Key`), `ShortId`, список DNS-записей и пути ко всем файлам.

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

Подключитесь к вашему серверу (Ubuntu 20.04 / 22.04 / 24.04 или Debian 11 / 12) под пользователем `root` и выполните:

```bash
curl -fsSL https://raw.githubusercontent.com/your-username/selfsteal-reality/main/public/install-selfsteal.sh -o install-selfsteal.sh
chmod +x install-selfsteal.sh
sudo ./install-selfsteal.sh
```

Либо скачайте готовый преднастроенный скрипт **`install-selfsteal.sh`** прямо из веб-интерфейса этого проекта и запустите его на сервере:

```bash
nano install-selfsteal.sh && chmod +x install-selfsteal.sh && sudo ./install-selfsteal.sh
```

---

## Пошаговый диалог скрипта (4 шага)

При запуске `install-selfsteal.sh` последовательно запрашивает 4 основных параметра:

| Шаг | Вопрос скрипта | Пример ввода | Значение по умолчанию |
| :-- | :--- | :--- | :--- |
| **1** | **Веб-сервер**: `Caddy` или `Nginx` | `1` (Caddy) или `2` (Nginx) | `1` (`/opt/ss-caddy`) |
| **2** | **Домен** для SelfSteal и сертификата Let's Encrypt | `poland.example.xyz` | `poland.example.xyz` |
| **3** | **Протокол**: `XHTTP` или `TCP` *(если выбран XHTTP — запрашивает путь чанков)* | `1` -> `poland.example.xyz/media/v3/chunk/` | `XHTTP` (`/media/v3/chunk/`) |
| **4** | **Порт и адрес Target (Dest)** для Xray Reality | `127.0.0.1:9443` (или просто `9443`) | `127.0.0.1:9443` |

---

## Структура директорий `/opt/ss-caddy` и `/opt/nginx`

После завершения установки все файлы управления находятся в единой директории в зависимости от выбранного веб-сервера:

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

Перед запуском скрипта убедитесь, что для вашего домена настроены следующие записи у DNS-провайдера:

| Тип | Имя (Host) | Значение (Value) | TTL | Проксирование (Cloudflare) | Назначение |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | `poland` *(или `@`)* | `IPv4 вашего VPS` | `Auto / 300` | **DNS Only (Серое облако)** | Прямое подключение к VPS для Reality и валидации Let's Encrypt |
| **AAAA** | `poland` *(опц.)* | `IPv6 вашего VPS` | `Auto / 300` | **DNS Only (Серое облако)** | Поддержка IPv6 маршрутизации |
| **CAA** | `@` | `0 issue "letsencrypt.org"` | `3600` | **DNS Only** | Разрешает выпуск сертификатов Let's Encrypt |

> **Важно**: Проксирование Cloudflare (оранжевое облако) **обязательно должно быть выключено (DNS Only)**, иначе Xray Reality не сможет выполнять прямое TLS-рукопожатие с вашим сервером.

---

## Конфигурация Xray / 3X-UI / Marzban

После установки скрипт выводит готовые настройки для вставки в `/usr/local/etc/xray/config.json` или веб-панель (**3X-UI**, **Marzban**):

### Параметры Reality для панели

- **Protocol**: `vless`
- **Network (Транспорт)**: `xhttp` (SplitHTTP) или `tcp`
- **Security**: `reality`
- **Target (Dest)**: `127.0.0.1:9443`
- **ServerNames (SNI)**: `poland.example.xyz`
- **XHTTP Path** *(только для XHTTP)*: `/media/v3/chunk/`
- **Flow** *(только для TCP)*: `xtls-rprx-vision`
- **Fingerprint (uTLS)**: `chrome`

### Пример блока `inbounds` (VLESS + XHTTP + Reality)

```json
{
  "tag": "VLESS-XHTTP-REALITY-SELFSTEAL",
  "listen": "0.0.0.0",
  "port": 443,
  "protocol": "vless",
  "settings": {
    "clients": [
      {
        "id": "YOUR_GENERATED_UUID",
        "email": "user@poland.example.xyz",
        "flow": ""
      }
    ],
    "decryption": "none"
  },
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

---

## Автообновление Let's Encrypt и логирование

### Управление SSL сертификатами

Сертификаты автоматически проверяются и обновляются ежедневно в `03:15` через `crontab`.

```bash
# Проверить статус задачи автообновления в Cron
crontab -l | grep renew-hook.sh

# Запустить принудительное обновление сертификата вручную
sudo bash /opt/ss-caddy/ssl/renew-hook.sh
# или для Nginx:
sudo bash /opt/nginx/ssl/renew-hook.sh
```

### Просмотр логов запросов и диагностика

```bash
# Просмотр входящих запросов к SelfSteal в реальном времени (Caddy)
tail -f /opt/ss-caddy/logs/access.log

# Просмотр входящих запросов к SelfSteal в реальном времени (Nginx)
tail -f /opt/nginx/logs/access.log

# Проверка ротации логов
sudo logrotate -d /etc/logrotate.d/selfsteal-caddy
```

---

## Веб-конфигуратор (Локальный запуск)

В репозитории также доступен интерактивный веб-интерфейс для визуальной сборки скрипта, генерации ключей `X25519`, просмотра дерева файлов `/opt/...` и симуляции терминала:

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера на http://localhost:3000
npm run dev

# Запуск модульных тестов генератора
npx tsx --test src/utils/generator.test.ts

# Сборка production-версии
npm run build
```

---

## Лицензия

Распространяется под лицензией **Apache-2.0**.
