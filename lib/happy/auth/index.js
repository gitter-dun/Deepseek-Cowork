/**
 * Happy auth/crypto primitives shared by credentials and session-client.
 * Kept separate from session-client so Cowork boundary code does not depend on WebSocket stack.
 */

module.exports = {
    Auth: require('../session-client/core/Auth'),
    CryptoUtils: require('../session-client/utils/CryptoUtils'),
    KeyUtils: require('../session-client/utils/KeyUtils'),
    SecretGenerator: require('../session-client/utils/SecretGenerator')
};
