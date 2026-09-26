// Authentication is disabled across the RAG endpoints (documents/chat/vector-store/etc).
// Everything that used to be scoped to req.user.id now uses this fixed id instead.
export const DEMO_USER_ID = '000000000000000000000001';

// The frontend demo (system/) works with a single active PDF at a time.
// Every new upload replaces whatever previously lived under this fixed id
// (document row, its chunks, and its vectors in Qdrant).
export const DEMO_DOCUMENT_ID = '000000000000000000000002';
