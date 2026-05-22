/**
 * AgentRuntime / lib/happy smoke tests
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function test(name, fn) {
    try {
        fn();
        console.log(`  ok ${name}`);
    } catch (error) {
        console.error(`  fail ${name}:`, error.message);
        process.exitCode = 1;
    }
}

async function testAsync(name, fn) {
    try {
        await fn();
        console.log(`  ok ${name}`);
    } catch (error) {
        console.error(`  fail ${name}:`, error.message);
        process.exitCode = 1;
    }
}

console.log('lib/happy smoke tests');

test('paths resolves npm happy CLI', () => {
    const { getHappyCliPath } = require('../paths');
    const cliPath = getHappyCliPath();
    assert.ok(cliPath.endsWith('happy.mjs'), cliPath);
    assert.ok(fs.existsSync(cliPath), `missing ${cliPath}`);
});

test('happy/lib exports ApiSessionClient', () => {
    const lib = require('happy/lib');
    assert.strictEqual(typeof lib.ApiClient, 'function');
    assert.strictEqual(typeof lib.ApiSessionClient, 'function');
});

test('AgentRuntime singleton loads', () => {
    const AgentRuntime = require('../index');
    assert.strictEqual(typeof AgentRuntime.initialize, 'function');
    assert.strictEqual(typeof AgentRuntime.connectToSession, 'function');
    assert.strictEqual(typeof AgentRuntime.sendMessage, 'function');
    assert.ok(AgentRuntime.credentials);
});

test('message-mapper passthrough', () => {
    const { mapToUiMessage } = require('../message-mapper');
    const mapped = mapToUiMessage({
        id: '1',
        createdAt: 1,
        raw: { role: 'user', content: { type: 'text', text: 'hi' } }
    });
    assert.strictEqual(mapped.role, 'user');
    assert.strictEqual(mapped.text, 'hi');
});

test('happy-wire resolves from npm registry', () => {
    const lock = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package-lock.json'), 'utf8');
    assert.ok(!lock.includes('"lib/happy-wire"'), 'package-lock must not reference vendored lib/happy-wire');
    const wirePkg = path.join(__dirname, '..', '..', '..', 'node_modules', '@slopus', 'happy-wire', 'package.json');
    assert.ok(fs.existsSync(wirePkg), wirePkg);
});

test('channel-bridge accepts agentRuntime', () => {
    const { EventEmitter } = require('events');
    const bridge = require('../../channel-bridge');

    class MockRuntime extends EventEmitter {
        getStatus() { return { connected: false }; }
    }

    const runtime = new MockRuntime();
    bridge.init({ agentRuntime: runtime });
    assert.strictEqual(bridge.isInitialized(), true);
    bridge.destroy();
});

(async () => {
    await testAsync('initialize without secret returns needsLogin', async () => {
        const credentials = require('../credentials');
        const originalHasSecret = credentials.hasSecret;
        credentials.hasSecret = () => false;

        const AgentRuntimeClass = require('../index').AgentRuntimeClass;
        const runtime = new AgentRuntimeClass();
        const result = await runtime.initialize({ stateDir: path.join(__dirname, '.tmp-state') });

        credentials.hasSecret = originalHasSecret;
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.needsLogin, true);
    });
})();
