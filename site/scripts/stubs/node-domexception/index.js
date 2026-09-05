// Replacement for the deprecated node-domexception package — see the
// "overrides" entry in site/package.json. Every runtime this project
// targets (Node 24) already has a native DOMException, which is exactly
// what the real package's own deprecation notice recommends using instead.
module.exports = globalThis.DOMException;
