import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Панель РОП | LegalHunter",
  description: "Аналитика команды и управление",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
