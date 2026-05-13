import { GA4Script } from "@/components/ga4-script"

// Signup page needs GA4 loaded directly so `signup_completed` conversion
// events fire. See the matching note in /login/layout.tsx.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GA4Script />
      {children}
    </>
  )
}
