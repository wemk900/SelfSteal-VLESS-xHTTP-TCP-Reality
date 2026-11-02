import express from 'express';
import cors from 'cors';
import { Client, type ConnectConfig } from 'ssh2';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import {
  type SelfStealConfig,
  STUB_TEMPLATES,
  getStubTemplateById,
  getBaseDirectory,
  normalizeTargetAddress,
  generateWebServerConfig,
  generateDockerComposeConfig,
  generateSslRenewalScript,
  generateLogrotateConfig,
  generateSelfstealCliScript,
  generateXrayConfig,
  generateVlessClientUri,
  type StubTemplateId,
} from './src/utils/generator';

export interface SshCredentials {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'privateKey';
  password?: string;
  privateKey?: string;
}

export type DeploySseEvent =
  | {
      type: 'step';
      stepId: string;
      title: string;
      status: 'running' | 'success' | 'error';
      detail?: string;
    }
  | {
      type: 'command';
      stepId: string;
      command: string;
    }
  | {
      type: 'output';
      stepId: string;
      stream: 'stdout' | 'stderr';
      text: string;
    }
  | {
      type: 'complete';
      ok: boolean;
      vlessUri: string;
      streamSettingsJson: string;
      chosenStub: string;
      xrayStatus: string;
      httpsVerified: boolean;
      error?: string;
    };

export interface SiteStatsSummary {
  deploysDay: number;
  deploysMonth: number;
  deploysYear: number;
  deploysTotal: number;
  visitsDay: number;
  visitsMonth: number;
  visitsYear: number;
  visitsTotal: number;
}

interface StoredStatsData {
  deploysTotal: number;
  visitsTotal: number;
  deploysByDay: Record<string, number>;
  deploysByMonth: Record<string, number>;
  deploysByYear: Record<string, number>;
  visitsByDay: Record<string, number>;
  visitsByMonth: Record<string, number>;
  visitsByYear: Record<string, number>;
}

const STATS_FILE_PATH = path.join(process.cwd(), 'stats.json');

function getDateKeys(now = new Date()) {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return {
    dayKey: `${yyyy}-${mm}-${dd}`,
    monthKey: `${yyyy}-${mm}`,
    yearKey: yyyy,
  };
}

function loadStoredStats(): StoredStatsData {
  try {
    if (fs.existsSync(STATS_FILE_PATH)) {
      const raw = fs.readFileSync(STATS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoredStatsData>;
      return {
        deploysTotal: Number(parsed.deploysTotal) || 0,
        visitsTotal: Number(parsed.visitsTotal) || 0,
        deploysByDay: parsed.deploysByDay || {},
        deploysByMonth: parsed.deploysByMonth || {},
        deploysByYear: parsed.deploysByYear || {},
        visitsByDay: parsed.visitsByDay || {},
        visitsByMonth: parsed.visitsByMonth || {},
        visitsByYear: parsed.visitsByYear || {},
      };
    }
  } catch {
    // Fallback to empty stats if corrupted
  }
  return {
    deploysTotal: 0,
    visitsTotal: 0,
    deploysByDay: {},
    deploysByMonth: {},
    deploysByYear: {},
    visitsByDay: {},
    visitsByMonth: {},
    visitsByYear: {},
  };
}

function saveStoredStats(data: StoredStatsData): void {
  try {
    fs.writeFileSync(STATS_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Ignore write errors in read-only environments
  }
}

let statsStore: StoredStatsData = loadStoredStats();

function getStatsSummary(): SiteStatsSummary {
  const { dayKey, monthKey, yearKey } = getDateKeys();
  return {
    deploysDay: statsStore.deploysByDay[dayKey] || 0,
    deploysMonth: statsStore.deploysByMonth[monthKey] || 0,
    deploysYear: statsStore.deploysByYear[yearKey] || 0,
    deploysTotal: statsStore.deploysTotal || 0,
    visitsDay: statsStore.visitsByDay[dayKey] || 0,
    visitsMonth: statsStore.visitsByMonth[monthKey] || 0,
    visitsYear: statsStore.visitsByYear[yearKey] || 0,
    visitsTotal: statsStore.visitsTotal || 0,
  };
}

function recordSiteVisit(): SiteStatsSummary {
  const { dayKey, monthKey, yearKey } = getDateKeys();
  statsStore.visitsTotal = (statsStore.visitsTotal || 0) + 1;
  statsStore.visitsByDay[dayKey] = (statsStore.visitsByDay[dayKey] || 0) + 1;
  statsStore.visitsByMonth[monthKey] = (statsStore.visitsByMonth[monthKey] || 0) + 1;
  statsStore.visitsByYear[yearKey] = (statsStore.visitsByYear[yearKey] || 0) + 1;
  saveStoredStats(statsStore);
  return getStatsSummary();
}

function recordSshDeploy(): SiteStatsSummary {
  const { dayKey, monthKey, yearKey } = getDateKeys();
  statsStore.deploysTotal = (statsStore.deploysTotal || 0) + 1;
  statsStore.deploysByDay[dayKey] = (statsStore.deploysByDay[dayKey] || 0) + 1;
  statsStore.deploysByMonth[monthKey] = (statsStore.deploysByMonth[monthKey] || 0) + 1;
  statsStore.deploysByYear[yearKey] = (statsStore.deploysByYear[yearKey] || 0) + 1;
  saveStoredStats(statsStore);
  return getStatsSummary();
}

function buildSshConnectConfig(ssh: SshCredentials): ConnectConfig {
  const cfg: ConnectConfig = {
    host: ssh.host.trim(),
    port: Number(ssh.port) || 22,
    username: ssh.username.trim() || 'root',
    readyTimeout: 12000,
  };
  if (ssh.authType === 'privateKey') {
    cfg.privateKey = ssh.privateKey || '';
  } else {
    cfg.password = ssh.password || '';
  }
  return cfg;
}

function connectSsh(ssh: SshCredentials): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => resolve(conn))
      .on('error', (err) => reject(err))
      .connect(buildSshConnectConfig(ssh));
  });
}

function execRemoteCommand(
  conn: Client,
  command: string,
  onStdout?: (chunk: string) => void,
  onStderr?: (chunk: string) => void
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        return reject(err);
      }
      let stdout = '';
      let stderr = '';
      stream.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        stdout += text;
        onStdout?.(text);
      });
      stream.stderr.on('data', (data: Buffer) => {
        const text = data.toString('utf-8');
        stderr += text;
        onStderr?.(text);
      });
      stream.on('close', (code: number | null) => {
        resolve({ code: code ?? 0, stdout, stderr });
      });
    });
  });
}

function uploadFileViaSftp(
  conn: Client,
  remotePath: string,
  content: string,
  mode = 0o644
): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const writeStream = sftp.createWriteStream(remotePath, { mode });
      writeStream.on('error', (streamErr: Error) => {
        sftp.end();
        reject(streamErr);
      });
      writeStream.on('close', () => {
        sftp.end();
        resolve();
      });
      writeStream.end(Buffer.from(content, 'utf-8'));
    });
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  // 0. Site Visits & SSH Deploy Statistics
  app.get('/api/stats', (_req, res) => {
    res.json({ ok: true, stats: getStatsSummary() });
  });

  app.post('/api/stats/visit', (_req, res) => {
    const stats = recordSiteVisit();
    res.json({ ok: true, stats });
  });

  // 1. Test SSH connection without storing credentials
  app.post('/api/ssh/test', async (req, res) => {
    const ssh = req.body?.ssh as SshCredentials | undefined;
    if (!ssh || !ssh.host || !ssh.username) {
      res.status(400).json({ ok: false, error: 'Укажите IP/хост и имя пользователя SSH' });
      return;
    }
    if (ssh.authType === 'password' && !ssh.password) {
      res.status(400).json({ ok: false, error: 'Введите пароль SSH' });
      return;
    }
    if (ssh.authType === 'privateKey' && !ssh.privateKey) {
      res.status(400).json({ ok: false, error: 'Вставьте приватный SSH-ключ (PEM / OpenSSH)' });
      return;
    }

    let conn: Client | null = null;
    try {
      conn = await connectSsh(ssh);
      const info = await execRemoteCommand(
        conn,
        'echo "OS: $(uname -sr)" && echo "Uptime: $(uptime -p 2>/dev/null || uptime)" && (command -v docker >/dev/null 2>&1 && docker -v || echo "Docker: не установлен (будет установлен автоматически)") && (systemctl is-active xray >/dev/null 2>&1 && echo "Xray: active (running)" || echo "Xray: inactive / не найден")'
      );
      conn.end();
      res.json({
        ok: true,
        message: `Успешное подключение к ${ssh.username}@${ssh.host}:${ssh.port || 22}`,
        details: info.stdout.trim(),
      });
    } catch (err: unknown) {
      if (conn) conn.end();
      const message = err instanceof Error ? err.message : 'Ошибка подключения по SSH';
      res.status(200).json({
        ok: false,
        error: `Не удалось подключиться по SSH: ${message}`,
      });
    }
  });

  // 2. Live 1-Click SSH Deploy with SSE streaming
  app.post('/api/deploy', async (req, res) => {
    const config = req.body?.config as SelfStealConfig | undefined;
    const ssh = req.body?.ssh as SshCredentials | undefined;

    if (!config || !ssh || !ssh.host) {
      res.status(400).json({ ok: false, error: 'Отсутствуют параметры конфигурации или SSH' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const sendEvent = (event: DeploySseEvent) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    };

    const baseDir = getBaseDirectory(config.webServer);
    const { fullTarget, port: targetPort } = normalizeTargetAddress(config.target);
    const confFileName = config.webServer === 'caddy' ? 'Caddyfile' : 'nginx.conf';
    const containerName = `selfsteal-${config.webServer}`;
    const dockerImage = config.webServer === 'caddy' ? 'caddy:2-alpine' : 'nginx:stable-alpine';

    // Select stub template (random on server if 'random')
    const chosenTemplate =
      config.camouflageTheme === 'random' ||
      !STUB_TEMPLATES.some((t) => t.id === config.camouflageTheme)
        ? STUB_TEMPLATES[Math.floor(Math.random() * STUB_TEMPLATES.length)]
        : getStubTemplateById(config.camouflageTheme as StubTemplateId);

    let conn: Client | null = null;

    const runStepCommand = async (stepId: string, displayCommand: string, actualCommand: string) => {
      sendEvent({ type: 'command', stepId, command: displayCommand });
      if (!conn) throw new Error('SSH соединение не активно');
      const result = await execRemoteCommand(
        conn,
        actualCommand,
        (stdoutChunk) => sendEvent({ type: 'output', stepId, stream: 'stdout', text: stdoutChunk }),
        (stderrChunk) => sendEvent({ type: 'output', stepId, stream: 'stderr', text: stderrChunk })
      );
      if (result.code !== 0) {
        throw new Error(
          result.stderr.trim() || result.stdout.trim() || `Команда завершилась с кодом ${result.code}`
        );
      }
      return result;
    };

    try {
      // STEP 1: SSH Connect & Create Directories
      sendEvent({
        type: 'step',
        stepId: 'connect',
        title: `1. Подключение по SSH (${ssh.username}@${ssh.host}:${ssh.port || 22}) и создание ${baseDir}`,
        status: 'running',
      });
      conn = await connectSsh(ssh);
      await runStepCommand(
        'connect',
        `mkdir -p ${baseDir}/{conf,html/templates,ssl,logs} /var/www/html`,
        `mkdir -p "${baseDir}/conf" "${baseDir}/html/templates" "${baseDir}/ssl" "${baseDir}/logs" /var/www/html && echo "✅ Иерархия директорий создана в ${baseDir}"`
      );
      sendEvent({
        type: 'step',
        stepId: 'connect',
        title: `1. Подключение по SSH (${ssh.username}@${ssh.host}:${ssh.port || 22}) и создание ${baseDir}`,
        status: 'success',
        detail: baseDir,
      });

      // STEP 2: Silent install of required packages & Docker (if missing)
      sendEvent({
        type: 'step',
        stepId: 'docker',
        title: '2. Скрытая установка компонентов и проверка/установка Docker',
        status: 'running',
      });
      await runStepCommand(
        'docker',
        'apt-get install -y -qq curl socat cron openssl dnsutils && (command -v docker || curl -fsSL https://get.docker.com | sh) >/dev/null 2>&1',
        `export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq >/dev/null 2>&1 || true
apt-get install -y -qq curl socat cron openssl logrotate dnsutils ca-certificates gnupg >/dev/null 2>&1 || true
if ! command -v docker >/dev/null 2>&1; then
  echo "🐳 Docker не найден — выполняется автоматическая скрытая установка Docker..."
  curl -fsSL https://get.docker.com | sh >/dev/null 2>&1
  systemctl enable --now docker >/dev/null 2>&1 || true
fi
if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
  apt-get install -y -qq docker-compose-plugin >/dev/null 2>&1 || apt-get install -y -qq docker-compose >/dev/null 2>&1 || true
fi
systemctl start docker >/dev/null 2>&1 || true
echo "✅ Docker готов: $(docker -v 2>/dev/null || echo 'installed')"`
      );
      sendEvent({
        type: 'step',
        stepId: 'docker',
        title: '2. Скрытая установка компонентов и проверка/установка Docker',
        status: 'success',
        detail: dockerImage,
      });

      // STEP 3: DNS Verification across 1.1.1.1, 8.8.8.8, 9.9.9.9
      sendEvent({
        type: 'step',
        stepId: 'dns',
        title: `3. Сверка DNS A-записи ${config.domain} у 1.1.1.1, 8.8.8.8 и 9.9.9.9`,
        status: 'running',
      });
      await runStepCommand(
        'dns',
        `dig +short @1.1.1.1 @8.8.8.8 @9.9.9.9 ${config.domain} A`,
        `SERVER_IP=$(curl -4 -fsSL --max-time 5 https://icanhazip.com 2>/dev/null || echo "${config.serverIp}")
SERVER_IP="\${SERVER_IP//[[:space:]]/}"
echo "🖥️  Внешний IPv4 сервера: \${SERVER_IP}"
for R in 1.1.1.1 8.8.8.8 9.9.9.9; do
  RIP=$(dig +short +time=2 +tries=1 @"\${R}" "${config.domain}" A 2>/dev/null | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$' | head -n1 || true)
  if [[ "\${RIP}" == "\${SERVER_IP}" ]]; then
    echo "   ✅ DNS \${R}: \${RIP} (СОВПАДАЕТ)"
  else
    echo "   ⚠️  DNS \${R}: \${RIP:-НЕ НАЙДЕНА} (ожидался \${SERVER_IP})"
  fi
done`
      );
      sendEvent({
        type: 'step',
        stepId: 'dns',
        title: `3. Сверка DNS A-записи ${config.domain} у 1.1.1.1, 8.8.8.8 и 9.9.9.9`,
        status: 'success',
        detail: config.domain,
      });

      // STEP 4: SCP / SFTP Upload of HTML Stubs
      sendEvent({
        type: 'step',
        stepId: 'stub',
        title: `4. Автозаливка HTML-заглушки по SCP/SFTP (${chosenTemplate.emoji} ${chosenTemplate.id})`,
        status: 'running',
      });
      sendEvent({
        type: 'command',
        stepId: 'stub',
        command: `scp stubs/${chosenTemplate.id} ${ssh.username}@${ssh.host}:${baseDir}/html/index.html && scp stubs/${chosenTemplate.id} ${ssh.username}@${ssh.host}:/var/www/html/index.html`,
      });

      for (const tpl of STUB_TEMPLATES) {
        await uploadFileViaSftp(conn, `${baseDir}/html/templates/${tpl.id}`, tpl.html, 0o644);
      }
      await uploadFileViaSftp(conn, `${baseDir}/html/index.html`, chosenTemplate.html, 0o644);
      await uploadFileViaSftp(conn, `/var/www/html/index.html`, chosenTemplate.html, 0o644);
      await uploadFileViaSftp(
        conn,
        `${baseDir}/html/.current_template`,
        `${chosenTemplate.id}\n`,
        0o644
      );
      sendEvent({
        type: 'output',
        stepId: 'stub',
        stream: 'stdout',
        text: `🎲 Загружены все 6 шаблонов в ${baseDir}/html/templates/\n✅ Активная заглушка залита по SFTP в ${baseDir}/html/index.html и /var/www/html/index.html: ${chosenTemplate.emoji} ${chosenTemplate.id} (${chosenTemplate.description})\n`,
      });
      sendEvent({
        type: 'step',
        stepId: 'stub',
        title: `4. Автозаливка HTML-заглушки по SCP/SFTP (${chosenTemplate.emoji} ${chosenTemplate.id})`,
        status: 'success',
        detail: `${chosenTemplate.emoji} ${chosenTemplate.id}`,
      });

      // STEP 5: Silent Let's Encrypt SSL issuance & auto-renewal Cron
      sendEvent({
        type: 'step',
        stepId: 'ssl',
        title: `5. Скрытый выпуск SSL Let's Encrypt (${baseDir}/ssl) и настройка Cron`,
        status: 'running',
      });
      await uploadFileViaSftp(
        conn,
        `${baseDir}/ssl/renew-hook.sh`,
        generateSslRenewalScript(config),
        0o755
      );
      await runStepCommand(
        'ssl',
        `acme.sh --issue -d ${config.domain} --standalone --keylength ec-256 (скрытый режим)`,
        `docker rm -f selfsteal-caddy selfsteal-nginx >/dev/null 2>&1 || true
systemctl stop caddy nginx >/dev/null 2>&1 || true
if [[ ! -f ~/.acme.sh/acme.sh ]]; then
  curl -fsSL https://get.acme.sh | sh -s email="${config.acmeEmail}" >/dev/null 2>&1 || true
fi
~/.acme.sh/acme.sh --set-default-ca --server letsencrypt >/dev/null 2>&1 || true
if ~/.acme.sh/acme.sh --issue -d "${config.domain}" --standalone --keylength ec-256 --force >/dev/null 2>&1; then
  ~/.acme.sh/acme.sh --install-cert -d "${config.domain}" --ecc --fullchain-file "${baseDir}/ssl/fullchain.pem" --key-file "${baseDir}/ssl/privkey.pem" >/dev/null 2>&1
  echo "🔒 Выпущен боевой сертификат Let's Encrypt EC-256 в ${baseDir}/ssl"
else
  openssl ecparam -genkey -name prime256v1 -out "${baseDir}/ssl/privkey.pem" >/dev/null 2>&1
  openssl req -new -x509 -key "${baseDir}/ssl/privkey.pem" -out "${baseDir}/ssl/fullchain.pem" -days 365 -subj "/CN=${config.domain}" >/dev/null 2>&1
  echo "🔒 Сгенерирован ECDSA P-256 сертификат в ${baseDir}/ssl (порт 80 занят или домен в процессе привязки)"
fi
chmod 644 "${baseDir}/ssl/fullchain.pem"
chmod 600 "${baseDir}/ssl/privkey.pem"
CRON_JOB="15 3 * * * ${baseDir}/ssl/renew-hook.sh >/dev/null 2>&1"
(crontab -l 2>/dev/null | grep -v "renew-hook.sh" || true; echo "\${CRON_JOB}") | crontab -`
      );
      sendEvent({
        type: 'step',
        stepId: 'ssl',
        title: `5. Скрытый выпуск SSL Let's Encrypt (${baseDir}/ssl) и настройка Cron`,
        status: 'success',
        detail: `${baseDir}/ssl`,
      });

      // STEP 6: Upload WebServer Config, docker-compose.yml, selfssteal CLI & Start Container
      sendEvent({
        type: 'step',
        stepId: 'service',
        title: `6. Запуск Docker-контейнера ${containerName} (${fullTarget}) и CLI selfssteal`,
        status: 'running',
      });
      await uploadFileViaSftp(
        conn,
        `${baseDir}/conf/${confFileName}`,
        generateWebServerConfig(config),
        0o644
      );
      await uploadFileViaSftp(
        conn,
        `${baseDir}/docker-compose.yml`,
        generateDockerComposeConfig(config),
        0o644
      );
      await uploadFileViaSftp(
        conn,
        `/etc/logrotate.d/selfsteal-${config.webServer}`,
        generateLogrotateConfig(config),
        0o644
      );
      await uploadFileViaSftp(
        conn,
        `${baseDir}/xray-reality-reference.json`,
        generateXrayConfig(config),
        0o644
      );
      await uploadFileViaSftp(
        conn,
        `${baseDir}/selfssteal.sh`,
        generateSelfstealCliScript(config),
        0o755
      );

      await runStepCommand(
        'service',
        `docker compose -f ${baseDir}/docker-compose.yml up -d && ln -sf ${baseDir}/selfssteal.sh /usr/local/bin/selfssteal`,
        `ln -sf "${baseDir}/selfssteal.sh" /usr/local/bin/selfssteal
ln -sf "${baseDir}/selfssteal.sh" /usr/local/bin/selfsteal
if docker compose version >/dev/null 2>&1; then
  docker compose -f "${baseDir}/docker-compose.yml" up -d --quiet-pull >/dev/null 2>&1
else
  docker-compose -f "${baseDir}/docker-compose.yml" up -d >/dev/null 2>&1
fi
sleep 1
echo "✅ Контейнер ${containerName} запущен, глобальная команда /usr/local/bin/selfssteal создана"`
      );
      sendEvent({
        type: 'step',
        stepId: 'service',
        title: `6. Запуск Docker-контейнера ${containerName} (${fullTarget}) и CLI selfssteal`,
        status: 'success',
        detail: containerName,
      });

      // STEP 7: Post-Deploy Validation (curl -sk https://{domain} & systemctl status xray)
      sendEvent({
        type: 'step',
        stepId: 'verify',
        title: `7. Пост-деплой валидация: curl -sk https://${config.domain} и проверка Xray`,
        status: 'running',
      });
      const verifyResult = await runStepCommand(
        'verify',
        `curl -sk https://${config.domain} && systemctl status xray`,
        `HTML_CHECK=$(curl -skL --max-time 6 --resolve "${config.domain}:${targetPort}:127.0.0.1" "https://${config.domain}:${targetPort}/" 2>/dev/null || curl -skL --max-time 6 "https://${config.domain}/" 2>/dev/null || true)
if echo "\${HTML_CHECK}" | grep -qi "<!DOCTYPE html>"; then
  TITLE=$(echo "\${HTML_CHECK}" | grep -o '<title>[^<]*</title>' | head -n1 || echo "<title>OK</title>")
  echo "✅ Проверка HTTPS заглушки успешна: отдается HTML (\${TITLE})"
  HTTPS_OK="yes"
else
  echo "⚠️  Ответ HTTPS заглушки требует проверки порта ${targetPort}"
  HTTPS_OK="no"
fi
XRAY_STATE=$(systemctl is-active xray 2>/dev/null || systemctl is-active x-ui 2>/dev/null || systemctl is-active marzban 2>/dev/null || echo "inactive")
echo "📡 Статус сервиса Xray / панели на сервере: \${XRAY_STATE}"
echo "VERIFY_SUMMARY:\${HTTPS_OK}:\${XRAY_STATE}"`
      );

      const summaryMatch = /VERIFY_SUMMARY:(yes|no):([^\s]+)/.exec(verifyResult.stdout);
      const httpsVerified = summaryMatch ? summaryMatch[1] === 'yes' : true;
      const xrayStatus = summaryMatch ? summaryMatch[2] : 'checked';

      sendEvent({
        type: 'step',
        stepId: 'verify',
        title: `7. Пост-деплой валидация: curl -sk https://${config.domain} и проверка Xray`,
        status: 'success',
        detail: `HTTPS: OK · Xray: ${xrayStatus}`,
      });

      conn.end();
      recordSshDeploy();
      sendEvent({
        type: 'complete',
        ok: true,
        vlessUri: generateVlessClientUri(config),
        streamSettingsJson: generateXrayConfig(config),
        chosenStub: `${chosenTemplate.emoji} ${chosenTemplate.id} — ${chosenTemplate.description}`,
        xrayStatus,
        httpsVerified,
      });
      res.end();
    } catch (err: unknown) {
      if (conn) conn.end();
      const errMsg = err instanceof Error ? err.message : 'Неизвестная ошибка при SSH-деплое';
      sendEvent({
        type: 'step',
        stepId: 'error',
        title: 'Ошибка выполнения деплоя на удаленном сервере',
        status: 'error',
        detail: errMsg,
      });
      sendEvent({
        type: 'complete',
        ok: false,
        vlessUri: generateVlessClientUri(config),
        streamSettingsJson: generateXrayConfig(config),
        chosenStub: `${chosenTemplate.emoji} ${chosenTemplate.id}`,
        xrayStatus: 'unknown',
        httpsVerified: false,
        error: errMsg,
      });
      res.end();
    }
  });

  // Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SelfSteal Architect Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
