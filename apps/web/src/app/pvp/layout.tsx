import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Арена PvP | LegalHunter",
  description: "Соревнования между менеджерами",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
