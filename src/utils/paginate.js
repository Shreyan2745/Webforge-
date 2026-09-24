// Parses ?page & ?limit and builds the meta block for list responses.
// TODO(build: workshops): implement parsePagination + buildMeta and use in list services.

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function parsePagination(query) {
  // TODO
}

function buildMeta({ page, limit, total }) {
  // TODO
}

module.exports = { parsePagination, buildMeta, DEFAULT_LIMIT, MAX_LIMIT };
