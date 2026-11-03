import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeIncomingDeployConfig,
  normalizeTargetAddress,
  normalizeXhttpPath,
  generateXrayConfig,
} from './generator';

test('normalizeTargetAddress handles bare port and host:port', () => {
  assert.deepEqual(normalizeTargetAddress('9443'), {
    host: '127.0.0.1',
    port: 9443,
    fullTarget: '127.0.0.1:9443',
  });
  assert.deepEqual(normalizeTargetAddress('127.0.0.1:8443'), {
    host: '127.0.0.1',
    port: 8443,
    fullTarget: '127.0.0.1:8443',
  });
});

test('normalizeXhttpPath strips domain prefix and ensures slashes', () => {
  assert.equal(normalizeXhttpPath('media/v3/chunk', 'example.com'), '/media/v3/chunk/');
  assert.equal(
    normalizeXhttpPath('https://example.com/api/stream', 'example.com'),
    '/api/stream/'
  );
});

test('normalizeIncomingDeployConfig populates defaults for wizard payload', () => {
  const cfg = normalizeIncomingDeployConfig({
    domain: 'https://node.example.com/path',
    webServer: 'nginx',
    transport: 'xhttp',
    xhttpPath: 'custom/chunk',
    targetPort: '9443',
  });

  assert.equal(cfg.domain, 'node.example.com');
  assert.equal(cfg.webServer, 'nginx');
  assert.equal(cfg.transport, 'xhttp');
  assert.equal(cfg.xhttpPath, '/custom/chunk/');
  assert.equal(cfg.target, '127.0.0.1:9443');
  assert.ok(cfg.privateKey.length > 10);
  assert.ok(cfg.publicKey.length > 10);
  assert.ok(cfg.shortId.length >= 8);

  const xrayJson = JSON.parse(generateXrayConfig(cfg));
  assert.equal(xrayJson.streamSettings.network, 'xhttp');
  assert.equal(xrayJson.streamSettings.realitySettings.serverNames[0], 'node.example.com');
  assert.equal(xrayJson.streamSettings.xhttpSettings.path, '/custom/chunk/');
});
