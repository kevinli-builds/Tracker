import type { Metadata } from 'next'

// The share page is unlisted: reachable only by its unguessable token, so keep
// crawlers out. (The token IS the secret — never let it into an index.)
export const metadata: Metadata = {
  title: 'Shared progress · DailyTally',
  robots: { index: false, follow: false },
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children
}
