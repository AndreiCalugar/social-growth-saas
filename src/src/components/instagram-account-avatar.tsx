"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

// Profile picture of the connected Instagram account. The URL is a signed
// Instagram CDN link that can expire mid-session, so a broken image falls
// back to the username's initial on the brand gradient.
export function InstagramAccountAvatar({
  username,
  src,
  className,
}: {
  username: string
  src: string | null
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const showImage = src && !broken

  return (
    <div
      className={cn(
        "shrink-0 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600",
        className
      )}
    >
      <div className="h-full w-full rounded-full bg-white p-[2px]">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`@${username}`}
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold uppercase text-white">
            {username.charAt(0)}
          </div>
        )}
      </div>
    </div>
  )
}
