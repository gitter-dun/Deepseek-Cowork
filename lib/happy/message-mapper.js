/**
 * Map Happy session message payloads to Cowork UI event shape.
 */

function mapToUiMessage(msg) {
    if (!msg) return null;

    if (msg.role && (msg.text || msg.content)) {
        return msg;
    }

    const raw = msg.raw || msg.content || msg;
    if (!raw || !raw.role) {
        return null;
    }

    return {
        id: msg.id,
        localId: msg.localId ?? null,
        createdAt: msg.createdAt ?? Date.now(),
        role: raw.role === 'user' ? 'user' : raw.role === 'agent' ? 'agent' : 'system',
        raw,
        text: extractText(raw),
        meta: raw.meta || msg.meta || {},
        timestamp: msg.timestamp || new Date(msg.createdAt || Date.now()).toISOString()
    };
}

function extractText(raw) {
    if (!raw) return '';
    if (typeof raw.content === 'string') return raw.content;
    if (raw.content?.type === 'text' && raw.content.text) return raw.content.text;
    if (raw.content?.text) return raw.content.text;
    if (raw.text) return raw.text;
    return '';
}

module.exports = {
    mapToUiMessage
};
