// Ready-made DM automations. Picking one fills the editor with a name,
// keyword, DM and public replies, so a creator's first automation takes a
// minute instead of a blank form. The app UI is English, but most of our
// creators write to their audience in Romanian, so every template's
// message text exists in both languages.

export type TemplateLanguage = "ro" | "en"

export type TemplateId = "link" | "event" | "freebie" | "discount"

/** Where the creator's link goes in the DM text. */
export const LINK_PLACEHOLDER = "{link}"

type Copy = {
  name: string
  keyword: string
  dm: string
  publicReplies: string[]
}

export type DmTemplate = {
  id: TemplateId
  title: string
  description: string
  /** Label for the link field in the picker, e.g. "Sign-up link". */
  linkLabel: string
  copy: Record<TemplateLanguage, Copy>
}

export const DM_TEMPLATES: DmTemplate[] = [
  {
    id: "link",
    title: "Link in DM",
    description: "Send a link to anyone who comments a keyword. Works for any product, page or video.",
    linkLabel: "Your link",
    copy: {
      ro: {
        name: "Link în DM",
        keyword: "LINK",
        dm: `Salut! 👋 Uite link-ul promis:\n${LINK_PLACEHOLDER}\n\nSpune-mi ce părere ai!`,
        publicReplies: ["Ți-am trimis în DM 📩", "Verifică-ți mesajele! 🙌", "Gata, ți-am trimis link-ul ✨"],
      },
      en: {
        name: "Link in DM",
        keyword: "LINK",
        dm: `Hey! 👋 Here's the link you asked for:\n${LINK_PLACEHOLDER}\n\nLet me know what you think!`,
        publicReplies: ["Sent you a DM 📩", "Check your messages! 🙌", "Just sent you the link ✨"],
      },
    },
  },
  {
    id: "event",
    title: "Event sign-ups",
    description: "Send event details and the sign-up link to everyone who's interested.",
    linkLabel: "Sign-up link",
    copy: {
      ro: {
        name: "Înscrieri eveniment",
        keyword: "VREAU",
        dm: `Mă bucur că vrei să vii! 🎉 Aici găsești toate detaliile și înscrierea:\n${LINK_PLACEHOLDER}\n\nLocurile sunt limitate, așa că nu amâna. Dacă ai întrebări, scrie-mi aici.`,
        publicReplies: ["Ți-am trimis detaliile în DM 📩", "Verifică-ți mesajele, ai acolo înscrierea 🎉", "Gata, ai toate detaliile în privat ✨"],
      },
      en: {
        name: "Event sign-ups",
        keyword: "IN",
        dm: `So glad you want to join! 🎉 Here are all the details and the sign-up link:\n${LINK_PLACEHOLDER}\n\nSpots are limited, so don't wait too long. Any questions, just reply here.`,
        publicReplies: ["Sent you the details in DM 📩", "Check your messages for the sign-up link 🎉", "All the details are in your DMs ✨"],
      },
    },
  },
  {
    id: "freebie",
    title: "Free guide",
    description: "Give away a free guide, checklist or resource and grow your audience.",
    linkLabel: "Link to the guide",
    copy: {
      ro: {
        name: "Ghid gratuit",
        keyword: "GHID",
        dm: `Uite ghidul gratuit, cum am promis 🎁\n${LINK_PLACEHOLDER}\n\nSper să-ți fie de folos! Scrie-mi ce sfat încerci primul.`,
        publicReplies: ["Ți-am trimis ghidul în DM 🎁", "Verifică-ți mesajele! 📩", "Gata, ghidul e la tine în privat ✨"],
      },
      en: {
        name: "Free guide",
        keyword: "GUIDE",
        dm: `Here's your free guide, as promised 🎁\n${LINK_PLACEHOLDER}\n\nHope it helps! Tell me which tip you try first.`,
        publicReplies: ["Sent the guide to your DMs 🎁", "Check your messages! 📩", "The guide is in your inbox ✨"],
      },
    },
  },
  {
    id: "discount",
    title: "Discount offer",
    description: "Share an exclusive discount with people who comment. Great for launches and sales.",
    linkLabel: "Link to the offer",
    copy: {
      ro: {
        name: "Ofertă cu reducere",
        keyword: "COD",
        dm: `Uite reducerea ta exclusivă 🔥\n${LINK_PLACEHOLDER}\n\nOferta e valabilă doar câteva zile, așa că profită acum!`,
        publicReplies: ["Ți-am trimis reducerea în DM 🔥", "Verifică-ți mesajele! 📩", "Gata, ai oferta în privat ✨"],
      },
      en: {
        name: "Discount offer",
        keyword: "CODE",
        dm: `Here's your exclusive discount 🔥\n${LINK_PLACEHOLDER}\n\nThe offer is only valid for a few days, so grab it now!`,
        publicReplies: ["Sent your discount to your DMs 🔥", "Check your messages! 📩", "Your offer is in your inbox ✨"],
      },
    },
  },
]

export type TemplateDraft = {
  templateId: TemplateId
  name: string
  keywords: string[]
  dmMessage: string
  publicReplyEnabled: boolean
  publicReplyMessages: string[]
}

/** The link as a full http(s) URL (adds https:// if missing), or null if it isn't one. */
export function normalizeLink(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (!url.hostname.includes(".")) return null
    return url.toString()
  } catch {
    return null
  }
}

export function buildTemplateDraft(
  template: DmTemplate,
  language: TemplateLanguage,
  link: string
): TemplateDraft {
  const copy = template.copy[language]
  return {
    templateId: template.id,
    name: copy.name,
    keywords: [copy.keyword],
    dmMessage: copy.dm.replace(LINK_PLACEHOLDER, link),
    publicReplyEnabled: true,
    publicReplyMessages: [...copy.publicReplies],
  }
}
