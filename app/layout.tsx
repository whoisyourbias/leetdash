import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, GitFork, Users } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeetCode Progress Radar",
  description: "GitHub repository based LeetCode study progress dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="shell-header">
          <Link className="brand" href="/">
            <BarChart3 size={22} aria-hidden="true" />
            <span>LeetCode Progress Radar</span>
          </Link>
          <nav className="top-nav" aria-label="Primary navigation">
            <Link href="/">
              <BarChart3 size={16} aria-hidden="true" />
              Dashboard
            </Link>
            <Link href="/admin">
              <Users size={16} aria-hidden="true" />
              Participants
            </Link>
            <a href="https://github.com" target="_blank" rel="noreferrer">
              <GitFork size={16} aria-hidden="true" />
              GitHub
            </a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
