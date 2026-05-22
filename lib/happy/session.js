/**
 * Session client entry for AgentRuntime.
 *
 * Uses internal HappyClient (session-client/) for full Cowork features:
 * permissions, multi-session, daemon spawn, usage tracking.
 *
 * happy/lib ApiSessionClient is validated in smoke tests; migration is deferred
 * until upstream API covers the same event surface.
 */

const { HappyClient } = require('./session-client');

module.exports = {
    HappyClient,
    createSessionClient(options) {
        return new HappyClient(options);
    }
};
