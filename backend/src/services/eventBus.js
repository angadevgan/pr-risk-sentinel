import { EventEmitter } from 'events';

// Decouples the Probot webhook handler (app.js) from the Socket.io server
// (index.js) — app.js emits, index.js listens and broadcasts. Avoids a
// circular import since both files would otherwise need to import each other.
export const events = new EventEmitter();

export const PR_SCORED_EVENT = 'pr:scored';
