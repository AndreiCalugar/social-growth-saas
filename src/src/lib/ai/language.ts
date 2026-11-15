// Romanian or English? Shared by the AI assistant (server) and the editor
// (browser), so it must not import the Anthropic SDK.

// Common words, so short messages without diacritics are still recognised
// ("cat costa?", "unde e?").
const RO_WORDS = /\b(și|si|sunt|este|unde|cât|cat|costa|costă|când|cand|pret|preț|prețul|pretul|mersi|multumesc|mulțumesc|bună|buna|salut|vreau|pot|cum|locatie|locație|adresa|adresă|ziua|ora|da|nu|și|daca|dacă|aveti|aveți|ceva|bine|merci)\b/gi
const EN_WORDS = /\b(what|where|when|how|much|price|cost|is|are|the|can|do|does|you|thanks|thank|hi|hello|please|there|will|which|time|address|yes)\b/gi

/** The language of a text, or null if it's too short to tell. */
export function guessLanguage(text: string): "ro" | "en" | null {
  if (/[ăâîșşțţ]/i.test(text)) return "ro"
  const ro = text.match(RO_WORDS)?.length ?? 0
  const en = text.match(EN_WORDS)?.length ?? 0
  if (ro === 0 && en === 0) return null
  return ro >= en ? "ro" : "en"
}

