// B5-12: redirect for stale `/pvp/quiz` (no sessionId) bookmarks.
//
// The quiz route only ever has meaning at `/pvp/quiz/[sessionId]/`
// (that page handles the active quiz). Visitors who clicked an
// outdated link or stripped the sessionId from the URL would have
// landed on a Next.js 404 — now they land on the training map where
// they start a fresh test from anyway.
import { redirect } from "next/navigation";

export default function PvPQuizIndexPage() {
  redirect("/training");
}
