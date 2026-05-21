"use client"

import Image from "next/image"
import { useState } from "react"
import { BadgeCheck } from "lucide-react"

const sizeMap = {
  sm: { px: 28, cls: "h-7 w-7 text-[11px]" },
  md: { px: 40, cls: "h-10 w-10 text-sm" },
  lg: { px: 56, cls: "h-14 w-14 text-base" },
} as const

type Size = keyof typeof sizeMap

interface ProfileAvatarProps {
  username: string
  profilePicUrl?: string | null
  isVerified?: boolean
  size?: Size
  // Tailwind classes for the fallback letter background. Default is purple
  // (used for the user's own profile); pass a slate gradient for competitors.
  fallbackGradient?: string
  className?: string
}

export function ProfileAvatar({
  username,
  profilePicUrl,
  isVerified = false,
  size = "md",
  fallbackGradient = "bg-gradient-to-br from-purple-500 to-purple-700",
  className = "",
}: ProfileAvatarProps) {
  const { px, cls } = sizeMap[size]
  const [errored, setErrored] = useState(false)
  const showPic = profilePicUrl && !errored
  const initial = username.charAt(0).toUpperCase() || "?"

  return (
    <div
      className={`relative rounded-full overflow-hidden shadow-sm ring-2 ring-white ${cls} ${!showPic ? fallbackGradient : "bg-slate-100"} ${className}`}
    >
      {showPic ? (
        <Image
          src={profilePicUrl}
          alt={`@${username}`}
          width={px}
          height={px}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
          unoptimized
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-bold text-white">
          {initial}
        </span>
      )}
      {isVerified && (
        <BadgeCheck
          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-sky-500 fill-white drop-shadow"
          aria-label="Verified"
        />
      )}
    </div>
  )
}
