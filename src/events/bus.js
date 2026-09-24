const { EventEmitter } = require('events');

// In-process event bus. Services emit AFTER the DB transaction commits.
const bus = new EventEmitter();
bus.setMaxListeners(50);

/**
 * emit(event, payload)
 * payload shape: { actor: { id, role } | null, resourceType, resourceId, data, req: { ip, userAgent } }
 */
function emit(event, payload) {
  // setImmediate so listeners never block or break the HTTP response
  setImmediate(() => bus.emit(event, { event, ...payload }));
}

module.exports = { bus, emit };
