import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Настройки | LegalHunter",
  description: "Настройки аккаунта и предпочтения",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
