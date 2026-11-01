import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDomainAndPathInput,
  normalizeXhttpPath,
  normalizeTargetAddress,
  getBaseDirectory,
  validateConfig,
  generateWebServerConfig,
  generateXrayConfig,
  generateBashInstallScript,
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

test('generateXrayConfig produces valid JSON with XHTTP or TCP Reality settings', () => {
  const xhttpJson = JSON.parse(generateXrayConfig(sampleConfig));
  assert.equal(xhttpJson.inbounds[0].streamSettings.network, 'xhttp');
  assert.equal(xhttpJson.inbounds[0].streamSettings.realitySettings.dest, '127.0.0.1:9443');
  assert.equal(xhttpJson.inbounds[0].streamSettings.xhttpSettings.path, '/media/v3/chunk/');

  const tcpJson = JSON.parse(generateXrayConfig({ ...sampleConfig, transport: 'tcp' }));
  assert.equal(tcpJson.inbounds[0].streamSettings.network, 'tcp');
  assert.equal(tcpJson.inbounds[0].settings.clients[0].flow, 'xtls-rprx-vision');
});

test('generateWebServerConfig and getDirectoryStructure include SSL, HTML, logs, and config paths', () => {
  const caddyConf = generateWebServerConfig(sampleConfig);
  assert.ok(caddyConf.includes('/opt/ss-caddy/ssl/fullchain.pem'));
  assert.ok(caddyConf.includes('/opt/ss-caddy/logs/access.log'));
  assert.ok(caddyConf.includes('handle /media/v3/chunk/*'));

  const nginxConf = generateWebServerConfig({ ...sampleConfig, webServer: 'nginx' });
  assert.ok(nginxConf.includes('/opt/nginx/ssl/fullchain.pem'));
  assert.ok(nginxConf.includes('listen 127.0.0.1:9443 ssl http2;'));

  const files = getDirectoryStructure(sampleConfig);
  assert.ok(files.some((f) => f.path === '/opt/ss-caddy/conf/Caddyfile'));
  assert.ok(files.some((f) => f.path === '/opt/ss-caddy/ssl/fullchain.pem'));
  assert.ok(files.some((f) => f.path === '/opt/ss-caddy/html/index.html'));
  assert.ok(files.some((f) => f.path === '/opt/ss-caddy/logs/access.log'));
});

test('generateBashInstallScript includes all 4 sequential prompts and post-install summary', () => {
  const script = generateBashInstallScript(sampleConfig);
  assert.ok(script.includes('1) Выберите веб-сервер для SelfSteal:'));
  assert.ok(script.includes('2) Укажите ваш домен для SelfSteal'));
  assert.ok(script.includes('3) Выберите тип транспорта для VLESS Reality:'));
  assert.ok(script.includes('4) На каком адресе:порту будет работать Target'));
  assert.ok(script.includes('/opt/ss-caddy'));
  assert.ok(script.includes('/opt/nginx'));
});

test('generateGithubReadme includes 4 steps, directory tree, DNS table, and Xray config', () => {
  const readme = generateGithubReadme(sampleConfig);
  assert.ok(readme.includes('install-selfsteal.sh'));
  assert.ok(readme.includes('/opt/ss-caddy'));
  assert.ok(readme.includes('poland.example.xyz/media/v3/chunk/'));
  assert.ok(readme.includes('127.0.0.1:9443'));
});

