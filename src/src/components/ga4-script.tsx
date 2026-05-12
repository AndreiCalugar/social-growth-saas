import Script from "next/script"

/**
 * GA4 loader, env-gated. When NEXT_PUBLIC_GA_ID is unset (dev / local /
 * preview), this renders nothing — so analytics never fires off-prod.
 *
 * `afterInteractive` is the right strategy here: gtag must be available
 * before client code calls `trackEvent`, but loading it before hydration
 * blocks paint for no benefit (events are user-driven, not first-paint).
 */
export function GA4Script() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  if (!gaId) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${gaId}', { send_page_view: true });
        `}
      </Script>
    </>
  )
}
