// Env access for the Meta/Instagram integration.
// Adapted from OpenReply's lib/env.ts (MIT, github.com/diwenne/openreply).

const HEX_32_BYTE = /^[a-f0-9]{64}$/i

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} environment variable is required`)
  }
  return value
}

export function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000"
}

export function getEncryptionKeyHex(): string {
  const value = requireEnv("ENCRYPTION_KEY")
  if (!HEX_32_BYTE.test(value)) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)")
  }
  return value
}

export function getMetaGraphApiVersion(): string {
  return process.env.META_GRAPH_API_VERSION ?? "v25.0"
}

// Env vars that must be present before an Instagram OAuth round trip can even
// start. Checked up front so a half-filled .env yields the variable names
// instead of an unhandled throw mid-flow.
const INSTAGRAM_OAUTH_ENV = [
  "INSTAGRAM_APP_ID",
  "INSTAGRAM_APP_SECRET",
  "ENCRYPTION_KEY",
  "NEXTAUTH_SECRET",
] as const

export function getMissingInstagramOAuthEnv(): string[] {
  return INSTAGRAM_OAUTH_ENV.filter((name) => {
    const value = process.env[name]
    if (!value) return true
    // A malformed key would otherwise fail inside encryptToken, after the
    // user already round-tripped through Meta — catch the bad format here.
    return name === "ENCRYPTION_KEY" && !HEX_32_BYTE.test(value)
  })
}
