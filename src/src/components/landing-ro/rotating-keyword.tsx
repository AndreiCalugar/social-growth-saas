"use client"

import { useEffect, useState } from "react"

// Cycles through example keywords so it's obvious the trigger word can be
// anything, not just "LINK". Shows the first word only with reduced motion.
const WORDS = ["LINK", "PREȚ", "GHID", "CURS", "MĂRIME"]

export function RotatingKeyword({ className = "" }: { className?: string }) {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const t = setInterval(() => setI((n) => (n + 1) % WORDS.length), 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <span className={className} aria-label="un cuvânt-cheie, de exemplu LINK sau PREȚ">
      <span key={WORDS[i]} className="demo-in inline-block" aria-hidden>
        {WORDS[i]}
      </span>
    </span>
  )
}
