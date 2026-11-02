import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDomainAndPathInput,
  normalizeXhttpPath,
  normalizeTargetAddress,
  getBaseDirectory,
  validateConfig,
  generateDockerComposeConfig,
  generateWebServerConfig,
  generateXrayConfig,
  generateBashInstallScript,
  generateSelfstealCliScript,
  generateCliCommandPreview,
  generateGithubReadme,
  getDirectoryStructure,
  type SelfStealConfig,
} from './generator';

const sampleConfig: SelfStealConfig = {
  webServer: 'caddy',
  domain: 'poland.example.xyz',
  transport: 'xhttp',
  xhttpPath: '/media/v3/chunk/',
  target: '127.0.0.1:9443',
  xhttpInternalPort: 8080,
  xrayInboundPort: 443,
  serverIp: '185.212.140.42',
  ipv6Address: '2a01:4f8:c012:3456::1',
  acmeEmail: 'admin@example.xyz',
  autoRenewCert: true,
  renewIntervalDays: 1,
  enableAccessLog: true,
  enableErrorLog: true,
  logFormat: 'json',
  logRetentionDays: 14,
  camouflageTheme: 'cdn-edge',
  uuid: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  privateKey: 'cO7rV8pW9zL1mK3nJ5bH7vG9fC2dX4sA6qW8eR0tY2u',
  publicKey: 'pU8bL2kM4nJ6vH8xG0cF3dZ5sA7qW9eR1tY3uI5oP7a',
  shortId: 'a1b2c3d4e5f60718',
};

test('normalizeXhttpPath handles full domain+path and bare paths', () => {
  assert.equal(
    normalizeXhttpPath('poland.example.xyz/media/v3/chunk/', 'poland.example.xyz'),
    '/media/v3/chunk/'
  );
  assert.equal(normalizeXhttpPath('media/v3/chunk'), '/media/v3/chunk/');
  assert.equal(normalizeXhttpPath('/media/v3/chunk/'), '/media/v3/chunk/');
});

test('parseDomainAndPathInput extracts domain and path if combined', () => {
  const res = parseDomainAndPathInput('https://poland.example.xyz/media/v3/chunk/', '/default/');
  assert.equal(res.domain, 'poland.example.xyz');
  assert.equal(res.extractedPath, '/media/v3/chunk/');
});

test('normalizeTargetAddress defaults to 127.0.0.1:9443 and parses port-only inputs', () => {
  assert.deepEqual(normalizeTargetAddress(''), {
    fullTarget: '127.0.0.1:9443',
    host: '127.0.0.1',
    port: 9443,
  });
  assert.deepEqual(normalizeTargetAddress('9443'), {
    fullTarget: '127.0.0.1:9443',
    host: '127.0.0.1',
    port: 9443,
  });
  assert.deepEqual(normalizeTargetAddress('127.0.0.1:8443'), {
    fullTarget: '127.0.0.1:8443',
    host: '127.0.0.1',
    port: 8443,
  });
});

test('getBaseDirectory returns /opt/ss-caddy for caddy and /opt/nginx for nginx', () => {
  assert.equal(getBaseDirectory('caddy'), '/opt/ss-caddy');
  assert.equal(getBaseDirectory('nginx'), '/opt/nginx');
});

test('validateConfig validates domain, xhttpPath, and target properly', () => {
  assert.equal(validateConfig(sampleConfig).valid, true);
  assert.equal(validateConfig({ ...sampleConfig, domain: 'invalid_domain' }).valid, false);
  assert.equal(validateConfig({ ...sampleConfig, target: 'invalid-target' }).valid, false);
});

test('generateXrayConfig produces valid streamSettings JSON without dest/target/xver/spiderX and with xhttpSettings', () => {
  const xhttpRaw = generateXrayConfig(sampleConfig);
  const xhttpJson = JSON.parse(xhttpRaw);
  assert.equal(xhttpJson.streamSettings.network, 'xhttp');
  assert.equal(xhttpJson.streamSettings.security, 'reality');
  assert.equal('dest' in xhttpJson.streamSettings.realitySettings, false);
  assert.equal('target' in xhttpJson.streamSettings.realitySettings, false);
  assert.equal('xver' in xhttpJson.streamSettings.realitySettings, false);
  assert.equal('spiderX' in xhttpJson.streamSettings.realitySettings, false);
  assert.deepEqual(xhttpJson.streamSettings.realitySettings.serverNames, ['poland.example.xyz']);
  assert.equal(xhttpJson.streamSettings.realitySettings.privateKey, sampleConfig.privateKey);
  assert.equal(xhttpJson.streamSettings.realitySettings.publicKey, sampleConfig.publicKey);
  assert.deepEqual(xhttpJson.streamSettings.realitySettings.shortIds, [sampleConfig.shortId]);
  assert.equal(xhttpJson.streamSettings.xhttpSettings.path, '/media/v3/chunk/');
  assert.equal(xhttpJson.streamSettings.xhttpSettings.host, 'poland.example.xyz');
  assert.equal(xhttpJson.streamSettings.xhttpSettings.mode, 'auto');
  assert.equal(xhttpRaw.includes('clients'), false);
  assert.equal(xhttpRaw.includes(sampleConfig.uuid), false);

  const tcpJson = JSON.parse(generateXrayConfig({ ...sampleConfig, transport: 'tcp' }));
  assert.equal(tcpJson.streamSettings.network, 'tcp');
  assert.equal('dest' in tcpJson.streamSettings.realitySettings, false);
});

test('generateDockerComposeConfig, generateWebServerConfig and getDirectoryStructure include Docker, SSL, HTML, logs, CLI and config paths', () => {
  const caddyCompose = generateDockerComposeConfig(sampleConfig);
  assert.ok(caddyCompose.includes('image: caddy:2-alpine'));
  assert.ok(caddyCompose.includes('container_name: selfsteal-caddy'));
  assert.ok(caddyCompose.includes('network_mode: "host"'));

  const nginxCompose = generateDockerComposeConfig({ ...sampleConfig, webServer: 'nginx' });
  assert.ok(nginxCompose.includes('image: nginx:stable-alpine'));
  assert.ok(nginxCompose.includes('container_name: selfsteal-nginx'));

  const caddyConf = generateWebServerConfig(sampleConfig);
  assert.ok(caddyConf.includes('/opt/ss-caddy/ssl/fullchain.pem'));
  assert.ok(caddyConf.includes('/opt/ss-caddy/logs/access.log'));
  assert.ok(caddyConf.includes('handle /media/v3/chunk/*'));

  const nginxConf = generateWebServerConfig({ ...sampleConfig, webServer: 'nginx' });
  assert.ok(nginxConf.includes('/opt/nginx/ssl/fullchain.pem'));
  assert.ok(nginxConf.includes('listen 127.0.0.1:9443 ssl http2;'));

  const files = getDirectoryStructure(sampleConfig);
  assert.ok(files.some((f) => f.path === '/usr/local/bin/selfssteal'));
  assert.ok(files.some((f) => f.path === '/opt/ss-caddy/docker-compose.yml'));
  assert.ok(files.some((f) => f.path === '/opt/ss-caddy/conf/Caddyfile'));
  assert.ok(files.some((f) => f.path === '/opt/ss-caddy/ssl/fullchain.pem'));
  assert.ok(files.some((f) => f.path === '/opt/ss-caddy/html/index.html'));
  assert.ok(files.some((f) => f.path === '/opt/ss-caddy/logs/access.log'));
});

test('generateBashInstallScript includes language selection, real output in [2/7] and [5/7], example hints instead of [по умолчанию], dynamic $DOMAIN/$XHTTP_PATH/$PRIVATE_KEY/$PUBLIC_KEY/$SHORT_ID in streamSettings, and DNS check', () => {
  const script = generateBashInstallScript({ ...sampleConfig, camouflageTheme: 'random' });
  assert.ok(script.includes('Author: t.me/wemkz'));
  assert.ok(script.includes('Select language / Выберите язык:'));
  assert.ok(script.includes('1) English'));
  assert.ok(script.includes('2) Русский'));
  assert.ok(script.includes('Домен (например: example.com):'));
  assert.ok(script.includes('Domain (e.g. example.com):'));
  assert.ok(script.includes('Путь XHTTP (например: /media/v3/chunk/):'));
  assert.ok(script.includes('Target (например: 127.0.0.1:9443):'));
  assert.equal(script.includes('[по умолчанию'), false);
  assert.equal(script.includes('(скрытый режим)'), false);
  assert.ok(script.includes('< /dev/tty'));
  assert.ok(script.includes('for RESOLVER in "1.1.1.1" "8.8.8.8" "9.9.9.9"; do'));
  assert.ok(script.includes('if ! command -v docker >/dev/null 2>&1; then'));
  assert.ok(script.includes('curl -fsSL https://get.docker.com | sh'));
  assert.equal(script.includes('curl -fsSL https://get.docker.com | sh >/dev/null 2>&1'), false);
  assert.ok(script.includes('cat > "${BASE_DIR}/docker-compose.yml" <<EOF'));
  assert.ok(script.includes('if ~/.acme.sh/acme.sh --issue -d "${DOMAIN}" --standalone --keylength ec-256 --force; then'));
  assert.ok(script.includes('1-speedtest.html'));
  assert.ok(script.includes('6-gitpage.html'));
  assert.ok(script.includes('RANDOM %'));
  assert.ok(script.includes('ln -sf "${BASE_DIR}/selfssteal.sh" /usr/local/bin/selfssteal'));
  // Assert dynamic bash variables in streamSettings output
  assert.ok(script.includes('"path": "${XHTTP_PATH}"'));
  assert.ok(script.includes('"host": "${DOMAIN}"'));
  assert.ok(script.includes('"privateKey": "${PRIVATE_KEY}"'));
  assert.ok(script.includes('"publicKey": "${PUBLIC_KEY}"'));
  assert.ok(script.includes('"${SHORT_ID}"'));
  assert.equal(script.includes('"dest":'), false);
  assert.equal(script.includes('"spiderX":'), false);
});

test('generateSelfstealCliScript and generateCliCommandPreview support 0-14 interactive menu, start, stop, restart, status, template, domain, switch, logs, ssl, and remove', () => {
  const cliScript = generateSelfstealCliScript(sampleConfig);
  assert.ok(cliScript.includes('Author: t.me/wemkz'));
  assert.ok(cliScript.includes('CONTAINER_NAME="selfsteal-caddy"'));
  assert.ok(cliScript.includes('compose_cmd up -d'));
  assert.ok(cliScript.includes('Install / Reinstall'));
  assert.ok(cliScript.includes('Change HTML template (1-6 или Random)'));
  assert.ok(cliScript.includes('Change domain'));
  assert.ok(cliScript.includes('Switch web server (Caddy ↔ Nginx)'));
  assert.ok(cliScript.includes('View logs (tail -f)'));
  assert.ok(cliScript.includes('Log sizes'));
  assert.ok(cliScript.includes('Clean logs'));
  assert.ok(cliScript.includes('Renew SSL certificate'));
  assert.ok(cliScript.includes('Edit web server config'));
  assert.ok(cliScript.includes('Uninstall SelfSteal'));
  assert.ok(cliScript.includes('Exit'));
  assert.ok(cliScript.includes('Select option [0-14]:'));

  const statusPreview = generateCliCommandPreview(sampleConfig, 'status');
  assert.ok(statusPreview.includes('Author: t.me/wemkz'));
  assert.ok(statusPreview.includes('Status: Running'));
  assert.ok(statusPreview.includes('Service Management:'));
  assert.ok(statusPreview.includes('8) Switch web server (Caddy ↔ Nginx)'));
  assert.ok(statusPreview.includes('14) Uninstall SelfSteal'));
  assert.ok(statusPreview.includes('Select option [0-14]:'));

  const startPreview = generateCliCommandPreview(sampleConfig, 'start');
  assert.ok(startPreview.includes('/opt/ss-caddy/ssl'));
  assert.ok(startPreview.includes('/opt/ss-caddy/html'));
});

test('generateGithubReadme includes one-liner bash <(curl ...), Docker Compose, Author: t.me/wemkz, 6 HTML templates, DNS check, and selfssteal CLI', () => {
  const readme = generateGithubReadme(sampleConfig);
  assert.ok(
    readme.includes(
      'https://raw.githubusercontent.com/wemk900/SelfSteal-VLESS-xHTTP-TCP-Reality/refs/heads/main/install-selfsteal.sh'
    )
  );
  assert.ok(readme.includes('t.me/wemkz'));
  assert.ok(readme.includes('docker-compose.yml'));
  assert.ok(readme.includes('1-speedtest.html'));
  assert.ok(readme.includes('6-gitpage.html'));
  assert.ok(readme.includes('Select option [0-14]:'));
});

