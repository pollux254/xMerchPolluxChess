import { Suspense } from "react"
import BotsClient from "./BotsClient"

export default function BotsPage() {
  // Next.js requires `useSearchParams()` to live under a Suspense boundary.
  // We keep the page as a Server Component and render a Client Component inside Suspense.
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-gradient-to-br from-gray-900 via-purple-900/30 to-black text-white p-4 flex items-center justify-center">
          <p className="text-xl font-bold">Loading bots…</p>
        </div>
      }
    >
      <BotsClient />
    </Suspense>
  )
}
