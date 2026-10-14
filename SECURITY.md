# Security Policy

## Supported versions

Only the latest release (the repo root build) receives fixes.

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's private vulnerability reporting
(*Security* tab → *Report a vulnerability*). Include steps to reproduce and the affected version. You will get an
acknowledgement within a few days.

## Scope notes

Courier is a static, client-side game with no accounts, network calls or stored data. The realistic surface is:

- `tools/serve.js`, a development static server. It binds to `127.0.0.1` only, serves files under the repo root
  only, and rejects path traversal. It is **not** meant to be exposed to a network.
- The test hook `window.__smb3`, which is deliberately exposed for testing. It mutates only the in-page game state.
