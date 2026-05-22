/**
 * Happy credentials - single entry for auth/crypto (Cowork boundary).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_SERVER_URL = 'https://api.deepseek-cowork.com';

const {
    Auth,
    CryptoUtils,
    KeyUtils,
    SecretGenerator
} = require('./auth');

function getSecureSettings() {
    try {
        return require('../secure-settings');
    } catch (_) {
        return require('../local-service/secure-settings-cli');
    }
}

function getUserSettings() {
    try {
        return require('../local-service/user-settings-cli');
    } catch (_) {
        return require('../user-settings');
    }
}

function hasSecret() {
    const secureSettings = getSecureSettings();
    return secureSettings.hasSecret('happy.secret');
}

function getSecret() {
    const secureSettings = getSecureSettings();
    return secureSettings.hasSecret('happy.secret') ? secureSettings.getSecret('happy.secret') : null;
}

function saveSecret(secret, token = null) {
    const secureSettings = getSecureSettings();
    secureSettings.setSecret('happy.secret', secret);
    if (token) {
        secureSettings.setSecret('happy.token', token);
    }
}

function deleteSecret() {
    const secureSettings = getSecureSettings();
    secureSettings.deleteSecret('happy.secret');
    secureSettings.deleteSecret('happy.token');
}

function generateSecret() {
    return SecretGenerator.generateSecretWithFormats();
}

function validateSecret(input) {
    return SecretGenerator.validateSecretFormat(input);
}

async function verifySecret(secret) {
    const userSettings = getUserSettings();
    const serverUrl = userSettings.get('happy.serverUrl') || DEFAULT_SERVER_URL;
    const auth = new Auth();
    const masterSecret = decodeSecretBytes(secret);
    const token = await auth.getToken(masterSecret, serverUrl);
    return { valid: true, token };
}

function decodeSecretBytes(secret) {
    try {
        return Buffer.from(CryptoUtils.decodeBase64(secret, 'base64url'));
    } catch (_) {
        const normalized = KeyUtils.normalizeSecretKey(secret);
        return Buffer.from(CryptoUtils.decodeBase64(normalized, 'base64url'));
    }
}

async function deriveAnonId(secret) {
    const secretBytes = decodeSecretBytes(secret);
    const derivedKey = await CryptoUtils.deriveKey(secretBytes, 'Happy Coder', ['analytics', 'id']);
    return derivedKey.toString('hex').slice(0, 16).toLowerCase();
}

async function getToken(secret, serverUrl) {
    const auth = new Auth();
    const masterSecret = decodeSecretBytes(secret);
    return auth.getToken(masterSecret, serverUrl || DEFAULT_SERVER_URL);
}

function syncToHappyHomeDir(secretBase64url, token, serverUrl, clearMachineId = false) {
    const happyHomeDir = path.join(os.homedir(), '.happy');
    const accessKeyPath = path.join(happyHomeDir, 'access.key');
    const settingsPath = path.join(happyHomeDir, 'settings.json');

    if (!fs.existsSync(happyHomeDir)) {
        fs.mkdirSync(happyHomeDir, { recursive: true });
    }

    const secretBytes = Buffer.from(secretBase64url, 'base64url');
    const secretBase64 = secretBytes.toString('base64');

    fs.writeFileSync(
        accessKeyPath,
        JSON.stringify({ secret: secretBase64, token }, null, 2),
        'utf8'
    );

    try {
        let settings = {};
        if (fs.existsSync(settingsPath)) {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
        settings.serverUrl = serverUrl || DEFAULT_SERVER_URL;
        if (clearMachineId && settings.machineId) {
            delete settings.machineId;
            delete settings.machineIdConfirmedByServer;
        }
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    } catch (e) {
        console.warn('[credentials] Failed to update settings.json:', e.message);
    }
}

function clearOnLogout() {
    deleteSecret();
    const accessKeyPath = path.join(os.homedir(), '.happy', 'access.key');
    if (fs.existsSync(accessKeyPath)) {
        fs.unlinkSync(accessKeyPath);
    }
}

function formatSecretForBackup(secret) {
    const bytes = decodeSecretBytes(secret);
    return SecretGenerator.formatSecretForBackup(bytes);
}

module.exports = {
    DEFAULT_SERVER_URL,
    CryptoUtils,
    KeyUtils,
    SecretGenerator,
    Auth,
    hasSecret,
    getSecret,
    saveSecret,
    deleteSecret,
    generateSecret,
    validateSecret,
    verifySecret,
    deriveAnonId,
    getToken,
    syncToHappyHomeDir,
    clearOnLogout,
    formatSecretForBackup,
    decodeSecretBytes
};
