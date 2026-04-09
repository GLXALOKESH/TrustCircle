function buildAuthMessage({ nonce, action }) {
  return [
    "TrustCircle Wallet Authentication",
    `Action: ${action}`,
    `Nonce: ${nonce}`,
    "Sign this message to continue.",
  ].join("\n");
}

module.exports = { buildAuthMessage };
