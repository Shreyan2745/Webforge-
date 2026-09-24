// Temporary handler used by the skeleton. Remove once every controller is built.
module.exports = (name) => (req, res) =>
  res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: `${name} is not built yet`, details: [] } });
