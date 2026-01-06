import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css" // Tailwind + your global styles only

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "PolluxChess",
  description: "Skill-based chess wagering on Xahau • Powered by xMerch",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}