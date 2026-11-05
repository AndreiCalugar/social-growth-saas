// Public comment replies can have several variations; one is picked at random
// per comment so dozens of identical replies under a reel don't look like
// spam. They're stored one per line in dm_automations.public_reply_message
// (a reply is a single line — the editor input can't contain a newline), so
// existing single-reply automations are simply one variation.

export const MAX_REPLY_VARIANTS = 5

export function parseReplyVariants(stored: string | null | undefined): string[] {
  return (stored ?? "")
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean)
}

export function joinReplyVariants(variants: string[]): string {
  const clean = variants
    .map((v) => v.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
  return Array.from(new Set(clean)).slice(0, MAX_REPLY_VARIANTS).join("\n")
}

export function pickReplyVariant(
  stored: string | null | undefined,
  random: () => number = Math.random
): string | null {
  const variants = parseReplyVariants(stored)
  if (variants.length === 0) return null
  return variants[Math.floor(random() * variants.length)]
}
