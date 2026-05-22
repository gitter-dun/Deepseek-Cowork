/**
 * AI 相关 API 路由
 * 
 * 对应 Electron IPC: ai:* 和 happy:* 通道
 * 
 * 创建时间: 2026-01-20
 */

const AgentRuntime = require('../../happy');

/**
 * 注册 AI 路由
 * @param {Object} app Express 应用
 * @param {Object} context 上下文对象
 */
function aiRoutes(app, context) {
    
    /**
     * GET /api/ai/status
     * 获取 AI 连接状态
     */
    app.get('/api/ai/status', (req, res) => {
        try {
            const status = AgentRuntime.getStatus();
            res.json({
                success: true,
                state: status.clientConnected ? 'connected' : 'disconnected',
                isConnected: status.clientConnected,
                initialized: status.initialized,
                eventStatus: status.eventStatus
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * POST /api/ai/connect
     * 连接到 AI 会话
     */
    app.post('/api/ai/connect', async (req, res) => {
        try {
            const currentSession = AgentRuntime.sessionManager?.getCurrentSessionName() || 'main';
            const result = await AgentRuntime.connectToSession(currentSession);
            res.json({
                success: result.success,
                status: AgentRuntime.getStatus(),
                error: result.error
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * POST /api/ai/disconnect
     * 断开 AI 连接
     */
    app.post('/api/ai/disconnect', async (req, res) => {
        try {
            await AgentRuntime.disconnectClient();
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * POST /api/ai/message
     * 发送消息到 AI
     */
    app.post('/api/ai/message', async (req, res) => {
        try {
            const { text } = req.body;
            
            console.log('[AI Route] POST /api/ai/message received:', { text: text?.substring(0, 50) });
            
            if (!text || typeof text !== 'string') {
                console.log('[AI Route] Invalid message content');
                return res.status(400).json({
                    success: false,
                    error: 'Invalid message content'
                });
            }
            
            console.log('[AI Route] Calling AgentRuntime.sendMessage...');
            const result = await AgentRuntime.sendMessage(text);
            console.log('[AI Route] AgentRuntime.sendMessage result:', result?.success);
            res.json(result);
        } catch (error) {
            console.error('[AI Route] Error:', error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * GET /api/ai/messages
     * 获取消息历史
     */
    app.get('/api/ai/messages', (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const messages = AgentRuntime.getMessages(limit);
            res.json({
                success: true,
                messages
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * DELETE /api/ai/messages
     * 清空消息历史
     */
    app.delete('/api/ai/messages', (req, res) => {
        try {
            AgentRuntime.clearMessages();
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * POST /api/ai/messages/restore
     * 恢复消息历史
     */
    app.post('/api/ai/messages/restore', (req, res) => {
        try {
            const { messages } = req.body;
            const result = AgentRuntime.restoreMessages(messages);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * GET /api/ai/usage
     * 获取最新的 usage 数据
     */
    app.get('/api/ai/usage', (req, res) => {
        try {
            const usage = AgentRuntime.getLatestUsage();
            res.json({
                success: true,
                usage
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * POST /api/ai/permission/allow
     * 允许权限请求
     */
    app.post('/api/ai/permission/allow', async (req, res) => {
        try {
            const { sessionId, permissionId, mode, allowedTools } = req.body;
            const result = await AgentRuntime.allowPermission(sessionId, permissionId, mode, allowedTools);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * POST /api/ai/permission/deny
     * 拒绝权限请求
     */
    app.post('/api/ai/permission/deny', async (req, res) => {
        try {
            const { sessionId, permissionId } = req.body;
            const result = await AgentRuntime.denyPermission(sessionId, permissionId);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * POST /api/ai/abort
     * 中止当前会话任务
     */
    app.post('/api/ai/abort', async (req, res) => {
        try {
            const { sessionId } = req.body;
            const result = await AgentRuntime.abortSession(sessionId);
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * GET /api/ai/sessions
     * 获取所有会话
     */
    app.get('/api/ai/sessions', (req, res) => {
        try {
            const sessions = AgentRuntime.getAllSessions();
            res.json({
                success: true,
                sessions
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * POST /api/ai/sessions/messages
     * 批量获取多个 session 的消息（供看板预览使用）
     * Body: { sessionIds: string[], limit?: number }
     */
    app.post('/api/ai/sessions/messages', (req, res) => {
        try {
            const { sessionIds, limit = 5 } = req.body;
            const messages = AgentRuntime.getMultiSessionMessages(sessionIds, limit);
            res.json({
                success: true,
                messages
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * GET /api/ai/session/:name
     * 获取指定会话 ID
     */
    app.get('/api/ai/session/:name', (req, res) => {
        try {
            const { name } = req.params;
            const sessionId = AgentRuntime.getSessionId(name || 'main');
            res.json({
                success: true,
                sessionId
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    /**
     * POST /api/ai/session/reconnect
     * 重新连接断开的会话
     */
    app.post('/api/ai/session/reconnect', async (req, res) => {
        try {
            const { name } = req.body;
            const result = await AgentRuntime.reconnectSession(name || 'main');
            res.json({
                success: result,
                error: result ? null : 'Failed to reconnect session'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
}

module.exports = aiRoutes;
