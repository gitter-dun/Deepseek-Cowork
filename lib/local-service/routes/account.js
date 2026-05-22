/**
 * 账户相关 API 路由
 *
 * 对应 Electron IPC: happy:hasSecret, happy:saveSecret, happy:logout 等
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const AgentRuntime = require('../../happy');
const credentials = require('../../happy/credentials');
const secureSettings = require('../secure-settings-cli');
const userSettings = require('../user-settings-cli');

const { syncToHappyHomeDir } = credentials;

function accountRoutes(app) {
    app.get('/api/account', async (req, res) => {
        try {
            const hasSecret = secureSettings.hasSecret('happy.secret');
            const serverUrl = userSettings.get('happy.serverUrl') || credentials.DEFAULT_SERVER_URL;
            const serviceStatus = AgentRuntime.getStatus();
            let anonId = null;

            if (hasSecret) {
                try {
                    const secret = secureSettings.getSecret('happy.secret');
                    if (secret) {
                        anonId = await credentials.deriveAnonId(secret);
                    }
                } catch (e) {
                    console.error('Failed to derive anon ID:', e);
                }
            }

            res.json({
                success: true,
                hasSecret,
                isConnected: serviceStatus.clientConnected || false,
                anonId,
                serverUrl,
                sessionId: serviceStatus.currentSessionId || null,
                eventStatus: serviceStatus.eventStatus || 'idle'
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/account/hasSecret', (req, res) => {
        try {
            res.json({ success: true, hasSecret: secureSettings.hasSecret('happy.secret') });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/account/generateSecret', (req, res) => {
        try {
            const result = credentials.generateSecret();
            res.json({ success: true, formatted: result.formatted, base64url: result.base64url });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/account/validateSecret', (req, res) => {
        try {
            res.json(credentials.validateSecret(req.body.secret));
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/account/verifySecret', async (req, res) => {
        try {
            const validation = credentials.validateSecret(req.body.secret);
            if (!validation.valid) {
                return res.json({ success: false, error: validation.error });
            }
            const token = await credentials.getToken(
                validation.normalized,
                userSettings.get('happy.serverUrl') || credentials.DEFAULT_SERVER_URL
            );
            if (token) {
                return res.json({ success: true, normalized: validation.normalized, token });
            }
            res.json({ success: false, error: '无法获取 Token，请检查 Secret 是否正确' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/account/secret', async (req, res) => {
        try {
            const { secret, token } = req.body;
            const validation = credentials.validateSecret(secret);
            if (!validation.valid) {
                return res.json({ success: false, error: validation.error });
            }

            let isAccountSwitching = false;
            const hasExistingSecret = secureSettings.hasSecret('happy.secret');
            if (hasExistingSecret) {
                const existingSecret = secureSettings.getSecret('happy.secret');
                if (existingSecret !== validation.normalized) {
                    isAccountSwitching = true;
                    if (AgentRuntime.isInitialized()) {
                        await AgentRuntime.disconnectClient();
                    }
                    if (AgentRuntime.sessionManager) {
                        AgentRuntime.sessionManager._accountChanged = true;
                        AgentRuntime.sessionManager.removeStateFile();
                        AgentRuntime.sessionManager.clearSessions();
                    }
                    AgentRuntime.clearMessages();
                }
            }

            secureSettings.setSecret('happy.secret', validation.normalized);

            let tokenToSync = token;
            if (!tokenToSync) {
                try {
                    tokenToSync = await credentials.getToken(
                        validation.normalized,
                        userSettings.get('happy.serverUrl') || credentials.DEFAULT_SERVER_URL
                    );
                } catch (e) {
                    console.warn('Failed to get token for sync:', e.message);
                }
            }

            if (tokenToSync) {
                syncToHappyHomeDir(
                    validation.normalized,
                    tokenToSync,
                    userSettings.get('happy.serverUrl'),
                    isAccountSwitching
                );
            }

            const newAnonId = await credentials.deriveAnonId(validation.normalized);

            if (AgentRuntime.isInitialized()) {
                if (isAccountSwitching) {
                    await AgentRuntime.reinitialize({
                        stateDir: path.join(require('../config').getDataDir(), 'happy-state'),
                        workDirs: [{ name: 'main', path: userSettings.get('happy.workspaceDir') || userSettings.getDefaultWorkspaceDir() }],
                        baseDir: userSettings.get('happy.workspaceDir') || userSettings.getDefaultWorkspaceDir(),
                        happySecret: validation.normalized,
                        serverUrl: userSettings.get('happy.serverUrl') || undefined,
                        permissionMode: userSettings.get('happy.permissionMode') || 'default'
                    });
                } else {
                    await AgentRuntime.connectToSession('main', { anonId: newAnonId });
                }
            }

            res.json({ success: true, anonId: newAnonId, reinitialized: isAccountSwitching });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/account/logout', async (req, res) => {
        try {
            if (AgentRuntime.isInitialized()) {
                await AgentRuntime.disconnectClient();
                if (AgentRuntime.sessionManager) {
                    AgentRuntime.sessionManager.removeStateFile();
                    AgentRuntime.sessionManager.clearSessions();
                }
                AgentRuntime.clearMessages();
            }

            credentials.deleteSecret();

            if (AgentRuntime.daemonManager) {
                await AgentRuntime.daemonManager.stopDaemon();
            }

            const accessKeyPath = path.join(os.homedir(), '.happy', 'access.key');
            if (fs.existsSync(accessKeyPath)) {
                fs.unlinkSync(accessKeyPath);
            }

            AgentRuntime.reset();
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/account/server', async (req, res) => {
        try {
            const { serverUrl } = req.body;

            if (AgentRuntime.isInitialized()) {
                await AgentRuntime.disconnectClient();
                if (AgentRuntime.sessionManager) {
                    AgentRuntime.sessionManager.removeStateFile();
                    AgentRuntime.sessionManager.clearSessions();
                }
                AgentRuntime.clearMessages();
            }

            credentials.deleteSecret();

            if (AgentRuntime.daemonManager) {
                await AgentRuntime.daemonManager.stopDaemon();
            }

            const accessKeyPath = path.join(os.homedir(), '.happy', 'access.key');
            if (fs.existsSync(accessKeyPath)) {
                fs.unlinkSync(accessKeyPath);
            }

            const settingsPath = path.join(os.homedir(), '.happy', 'settings.json');
            if (fs.existsSync(settingsPath)) {
                try {
                    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                    if (settings.machineId) {
                        delete settings.machineId;
                        delete settings.machineIdConfirmedByServer;
                        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
                    }
                } catch (_) {}
            }

            AgentRuntime.reset();
            userSettings.set('happy.serverUrl', serverUrl || null);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/account/formattedSecret', (req, res) => {
        try {
            if (!secureSettings.hasSecret('happy.secret')) {
                return res.json({ success: false, error: '未配置 Secret' });
            }
            const secret = secureSettings.getSecret('happy.secret');
            if (!secret) {
                return res.json({ success: false, error: '无法读取 Secret' });
            }
            const formatted = credentials.formatSecretForBackup(secret);
            res.json({ success: true, formatted });
        } catch (error) {
            res.json({ success: false, error: error.message || 'Secret 格式无效，请重新配置账户' });
        }
    });
}

module.exports = accountRoutes;
module.exports.syncCredentialsToHappyDir = syncToHappyHomeDir;
