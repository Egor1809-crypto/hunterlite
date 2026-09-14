import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "База знаний | LegalHunter",
  description: "Справочник по банкротству, судебная практика и учебные материалы",
};

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
