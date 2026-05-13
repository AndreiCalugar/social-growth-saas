import { GA4Script } from "@/components/ga4-script"

// Login page needs GA4 loaded directly so `login_completed` conversion
// events fire. We don't show a consent banner here because the user has
// explicitly come to sign in — they've made an active choice to use us.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GA4Script />
      {children}
    </>
  )
}
