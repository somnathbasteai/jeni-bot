import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Jeni — Life OS',
  description: 'Your personal AI life intelligence system',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
