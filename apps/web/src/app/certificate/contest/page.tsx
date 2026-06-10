/**
 * /certificate/contest — legacy alias.
 *
 * Точка входа в чемпионат унифицирована на /championship (решение 2026-06-10),
 * который сам выбирает surface (гость → лендинг, авторизован → AuthLayout-chrome).
 * Этот роут оставлен как редирект, чтобы старые ссылки/закладки не ломались.
 */
import { redirect } from "next/navigation";

export default function ContestRedirect() {
  redirect("/championship");
}
