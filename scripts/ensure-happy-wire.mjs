#!/usr/bin/env node
/**
 * @slopus/happy-wire@0.1.0 的 npm 包偶发缺少 dist/，从 tarball 补全。
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const wireDir = path.join(root, 'node_modules', '@slopus', 'happy-wire');
const distIndex = path.join(wireDir, 'dist', 'index.cjs');

if (fs.existsSync(distIndex)) {
    process.exit(0);
}

if (!fs.existsSync(wireDir)) {
    console.warn('[ensure-happy-wire] @slopus/happy-wire not installed, skipping');
    process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(path.join(wireDir, 'package.json'), 'utf8'));
const version = pkg.version || '0.1.0';

console.log(`[ensure-happy-wire] dist missing, restoring @slopus/happy-wire@${version} from npm tarball...`);
execSync(`npm pack @slopus/happy-wire@${version} --pack-destination .`, {
    cwd: root,
    stdio: 'inherit'
});

const packed = fs.readdirSync(root).find((name) => name.startsWith('slopus-happy-wire-') && name.endsWith('.tgz'));
if (!packed) {
    console.error('[ensure-happy-wire] npm pack did not produce a tarball');
    process.exit(1);
}

execSync(`tar -xzf "${path.join(root, packed)}" -C "${wireDir}" --strip-components=1`, { stdio: 'inherit' });
fs.rmSync(path.join(root, packed), { force: true });
console.log('[ensure-happy-wire] restored dist/');
