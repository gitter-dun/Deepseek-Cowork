/**
 * Resolve happy CLI binary path for dev and packaged Electron builds.
 */

const fs = require('fs');
const path = require('path');

function getAppRoot() {
    try {
        const { app } = require('electron');
        if (app && typeof app.getAppPath === 'function') {
            return app.getAppPath();
        }
    } catch (_) {
        // Not in Electron
    }
    return path.join(__dirname, '..', '..');
}

/**
 * @returns {string} Absolute path to happy.mjs
 */
function getHappyCliPath() {
    const appRoot = getAppRoot();
    const isPackaged = appRoot.includes('app.asar');
    const candidates = [];

    if (isPackaged) {
        const unpackedRoot = appRoot.replace('app.asar', 'app.asar.unpacked');
        candidates.push(
            path.join(unpackedRoot, 'node_modules', 'happy', 'bin', 'happy.mjs'),
            path.join(unpackedRoot, 'node_modules', 'happy-coder', 'bin', 'happy.mjs')
        );
    }

    candidates.push(
        path.join(appRoot, 'node_modules', 'happy', 'bin', 'happy.mjs'),
        path.join(__dirname, '..', '..', 'node_modules', 'happy', 'bin', 'happy.mjs'),
        path.join(appRoot, 'node_modules', 'happy-coder', 'bin', 'happy.mjs'),
        path.join(__dirname, '..', '..', 'node_modules', 'happy-coder', 'bin', 'happy.mjs')
    );

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return path.join(appRoot, 'node_modules', 'happy', 'bin', 'happy.mjs');
}

module.exports = {
    getAppRoot,
    getHappyCliPath
};
