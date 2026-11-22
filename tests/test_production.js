/**
 * TT_TRACKER Test Suite: production readiness (no MongoDB needed)
 *
 *  1. Health endpoint: 503 while the database is disconnected, 200 once connected.
 *  2. Safe headers; no X-Powered-By; JSON errors for unknown API paths and bad JSON.
 *  3. Frontend serving: 503 with a clear message when frontend/dist is missing.
 *  4. Import endpoint authentication (checked before any database work).
 *  5. secretsMatch, productionWarnings and the shutdown sequence.
 *  6. Deployment files: scripts, engines, render.yaml.
 *
 * Run: npm run test:unit
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const mongoose = require('mongoose');

const root = path.join(__dirname, '..');
const { app } = require('../server');
const { secretsMatch, productionWarnings, runShutdown, WEAK_SECRETS } = require('../config/runtime');

let passed = 0;
async function test(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  [PASS] ${name}`);
    } catch (err) {
        console.error(`  [FAIL] ${name}\n         ${err.message}`);
        process.exitCode = 1;
        throw err;
    }
}

function request(port, method, urlPath, { headers = {}, body = null } = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port, path: urlPath, method, headers }, res => {
            let out = '';
            res.on('data', c => (out += c));
            res.on('end', () => {
                let json = null;
                try { json = JSON.parse(out); } catch (e) { /* not JSON */ }
                resolve({ status: res.statusCode, headers: res.headers, text: out, json });
            });
        });
        req.on('error', reject);
        if (body !== null) req.write(body);
        req.end();
    });
}

async function main() {
    console.log('===============================================================');
    console.log('            TT_TRACKER PRODUCTION READINESS TESTS              ');
    console.log('===============================================================');

    const srv = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const port = srv.address().port;
    const savedSecret = process.env.TT_TRACKER_IMPORT_SECRET;

    try {
        console.log('\n--- 1. HEALTH ENDPOINT ---');
        await test('503 "degraded" while MongoDB is not connected', async () => {
            assert.notStrictEqual(mongoose.connection.readyState, 1);
            const r = await request(port, 'GET', '/api/health');
            assert.strictEqual(r.status, 503);
            assert.strictEqual(r.json.status, 'degraded');
            assert.strictEqual(r.json.database, 'disconnected');
            assert.strictEqual(r.json.service, 'TT_TRACKER');
            assert.strictEqual(r.headers['cache-control'], 'no-store');
        });
        await test('200 "ok" once the database reports connected', async () => {
            // readyState is a getter on the connection; shadow it on the instance, then remove the shadow
            Object.defineProperty(mongoose.connection, 'readyState', { get: () => 1, configurable: true });
            try {
                const r = await request(port, 'GET', '/api/health');
                assert.strictEqual(r.status, 200);
                assert.strictEqual(r.json.status, 'ok');
                assert.strictEqual(r.json.database, 'connected');
                assert.ok(Number.isInteger(r.json.uptimeSeconds));
            } finally {
                delete mongoose.connection.readyState;
            }
        });

        console.log('\n--- 2. HEADERS AND ERRORS ---');
        await test('no X-Powered-By; nosniff and referrer policy are set', async () => {
            const r = await request(port, 'GET', '/api/health');
            assert.strictEqual(r.headers['x-powered-by'], undefined);
            assert.strictEqual(r.headers['x-content-type-options'], 'nosniff');
            assert.strictEqual(r.headers['referrer-policy'], 'strict-origin-when-cross-origin');
        });
        await test('an unknown API path is a JSON 404', async () => {
            const r = await request(port, 'GET', '/api/does-not-exist');
            assert.strictEqual(r.status, 404);
            assert.strictEqual(r.json.success, false);
            assert.match(r.json.error, /Endpoint not found/);
        });
        await test('malformed JSON is a JSON 400 without a stack trace', async () => {
            const r = await request(port, 'POST', '/api/timetable/validate-drop', { headers: { 'Content-Type': 'application/json' }, body: '{bad json' });
            assert.strictEqual(r.status, 400);
            assert.strictEqual(r.json.success, false);
            assert.ok(!/\n\s+at /.test(r.text), 'no stack trace in the response');
        });

        console.log('\n--- 3. FRONTEND SERVING ---');
        await test('without frontend/dist the page answers 503 and says how to fix it; with it, 200 HTML', async () => {
            const built = fs.existsSync(path.join(root, 'frontend/dist/index.html'));
            const r = await request(port, 'GET', '/timetable');
            if (built) {
                assert.strictEqual(r.status, 200);
                assert.match(r.headers['content-type'], /text\/html/);
                assert.match(r.headers['cache-control'] || '', /no-cache/);
            } else {
                assert.strictEqual(r.status, 503);
                assert.match(r.text, /npm run build/);
            }
        });

        console.log('\n--- 4. IMPORT AUTHENTICATION ---');
        await test('500 when the import secret is not configured on the server', async () => {
            delete process.env.TT_TRACKER_IMPORT_SECRET;
            const r = await request(port, 'POST', '/api/timetable/import', { headers: { 'Content-Type': 'application/json', 'x-import-secret': 'anything' }, body: '{}' });
            assert.strictEqual(r.status, 500);
        });
        process.env.TT_TRACKER_IMPORT_SECRET = 'correct-horse-battery-staple-123';
        await test('401 for a missing or wrong secret, on every accepted header', async () => {
            const body = '{}';
            const json = { 'Content-Type': 'application/json' };
            assert.strictEqual((await request(port, 'POST', '/api/timetable/import', { headers: json, body })).status, 401);
            assert.strictEqual((await request(port, 'POST', '/api/timetable/import', { headers: { ...json, 'x-import-secret': 'wrong' }, body })).status, 401);
            assert.strictEqual((await request(port, 'POST', '/api/timetable/import', { headers: { ...json, Authorization: 'Bearer wrong' }, body })).status, 401);
            assert.strictEqual((await request(port, 'POST', '/api/import', { headers: { ...json, 'x-api-key': 'wrong' }, body })).status, 401);
            assert.strictEqual((await request(port, 'POST', '/api/timetable/import', { headers: { ...json, 'x-import-secret': 'correct-horse-battery-staple-12' }, body })).status, 401, 'a prefix of the secret is not enough');
        });
        await test('the correct secret passes authentication (it is then rejected for the empty payload, not for auth)', async () => {
            const json = { 'Content-Type': 'application/json' };
            for (const headers of [{ ...json, 'x-import-secret': process.env.TT_TRACKER_IMPORT_SECRET }, { ...json, Authorization: `Bearer ${process.env.TT_TRACKER_IMPORT_SECRET}` }]) {
                const r = await request(port, 'POST', '/api/timetable/import', { headers, body: '{}' });
                assert.notStrictEqual(r.status, 401);
                assert.notStrictEqual(r.status, 500);
            }
        });
    } finally {
        if (savedSecret === undefined) delete process.env.TT_TRACKER_IMPORT_SECRET;
        else process.env.TT_TRACKER_IMPORT_SECRET = savedSecret;
        await new Promise(r => srv.close(r));
    }

    console.log('\n--- 5. HELPERS ---');
    await test('secretsMatch: equal strings match; different, prefix, empty and non-strings do not', () => {
        assert.strictEqual(secretsMatch('abc123', 'abc123'), true);
        assert.strictEqual(secretsMatch('abc123', 'abc124'), false);
        assert.strictEqual(secretsMatch('abc', 'abc123'), false);
        assert.strictEqual(secretsMatch('', ''), false);
        assert.strictEqual(secretsMatch(undefined, 'abc'), false);
        assert.strictEqual(secretsMatch('abc', undefined), false);
        assert.strictEqual(secretsMatch(123, 123), false);
    });
    const strong = { NODE_ENV: 'production', TT_TRACKER_IMPORT_SECRET: 'a-very-long-random-secret-value-123', DEV_MODE: 'false' };
    await test('productionWarnings: none outside production or when well configured', () => {
        assert.deepStrictEqual(productionWarnings({}), []);
        assert.deepStrictEqual(productionWarnings({ NODE_ENV: 'development', DEV_MODE: 'true' }), []);
        assert.deepStrictEqual(productionWarnings(strong), []);
    });
    await test('productionWarnings: missing, sample and short secrets, and DEV_MODE=true', () => {
        assert.strictEqual(productionWarnings({ NODE_ENV: 'production' }).length, 1);
        for (const secret of ['your-secure-import-secret', 'replace-with-a-long-random-secret', 'short']) {
            const w = productionWarnings({ ...strong, TT_TRACKER_IMPORT_SECRET: secret });
            assert.strictEqual(w.length, 1, secret);
            assert.match(w[0], /weak/);
        }
        const w = productionWarnings({ ...strong, DEV_MODE: 'true' });
        assert.strictEqual(w.length, 1);
        assert.match(w[0], /DEV_MODE/);
    });
    await test('the sample secret in .env.example is one that production flags as weak', () => {
        const line = fs.readFileSync(path.join(root, '.env.example'), 'utf8').split('\n').find(l => l.startsWith('TT_TRACKER_IMPORT_SECRET='));
        assert.ok(WEAK_SECRETS.has(line.split('=')[1].trim()));
    });
    await test('runShutdown: stops accepting requests, saves pending changes, then disconnects, in that order', async () => {
        const order = [];
        const r = await runShutdown({
            closeServer: async () => order.push('close'),
            flushPending: async () => { order.push('flush'); return 3; },
            disconnectDb: async () => order.push('disconnect'),
            log: { log() {}, error() {} }
        });
        assert.deepStrictEqual(order, ['close', 'flush', 'disconnect']);
        assert.strictEqual(r.flushed, 3);
        assert.deepStrictEqual(r.errors, []);
    });
    await test('runShutdown: a failing step is reported and never skips the later steps', async () => {
        const order = [];
        const r = await runShutdown({
            closeServer: async () => { order.push('close'); throw new Error('boom'); },
            flushPending: async () => { order.push('flush'); throw new Error('db down'); },
            disconnectDb: async () => order.push('disconnect'),
            log: { log() {}, error() {} }
        });
        assert.deepStrictEqual(order, ['close', 'flush', 'disconnect']);
        assert.strictEqual(r.flushed, 0);
        assert.strictEqual(r.errors.length, 2);
    });
    await test('the route module exposes flushPendingChanges for the shutdown step', () => {
        assert.strictEqual(typeof require('../routes/timetableroutes').flushPendingChanges, 'function');
    });

    console.log('\n--- 6. DEPLOYMENT FILES ---');
    await test('package.json: start, build, dev tool in devDependencies, node engine matches the driver', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        assert.strictEqual(pkg.scripts.start, 'node server.js');
        assert.match(pkg.scripts.build, /frontend ci --include=dev/);
        assert.ok(!('nodemon' in pkg.dependencies), 'nodemon must not be a runtime dependency');
        assert.ok(pkg.devDependencies && pkg.devDependencies.nodemon);
        assert.ok(pkg.engines && /20\.19/.test(pkg.engines.node), 'mongoose needs Node 20.19+');
    });
    await test('render.yaml: health check, build with frontend, and no secret values in git', () => {
        const y = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
        assert.match(y, /healthCheckPath: \/api\/health/);
        assert.match(y, /buildCommand: npm ci && npm run build/);
        assert.match(y, /startCommand: node server\.js/);
        assert.match(y, /key: DEV_MODE\n\s+value: "false"/);
        for (const key of ['MONGO_URI', 'TT_TRACKER_IMPORT_SECRET']) {
            const m = y.match(new RegExp(`- key: ${key}\\n\\s+(\\w+): ([^\\n]*)`));
            assert.ok(m && m[1] === 'sync' && m[2] === 'false', `${key} must be sync: false`);
        }
    });

    console.log('\n===============================================================');
    console.log(`FINAL RESULT: ALL ${passed} PRODUCTION READINESS TESTS PASSED!`);
    console.log('===============================================================');
    process.exit(process.exitCode || 0);
}

main().catch(err => {
    console.error('\nProduction readiness test suite failed:', err.message);
    process.exit(1);
});
