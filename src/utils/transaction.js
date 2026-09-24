const mongoose = require('mongoose');

/**
 * Runs fn(session) inside a MongoDB transaction and returns its result.
 * The driver may retry fn on transient errors, so fn must only touch the DB
 * (emit events AFTER this resolves, never inside fn).
 */
async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { withTransaction };
