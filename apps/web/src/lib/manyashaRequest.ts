/** Client deadline also covers a stalled reverse proxy or response body. */
export async function requestManyasha(
  endpoint: string,
  messages: { role: string; content: string }[],
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("Маняша пока не смогла ответить. Попробуйте ещё раз.");
    }
    return data.reply;
  } catch {
    throw new Error(controller.signal.aborted
      ? "Ответ задерживается. Попробуйте ещё раз — ваш вопрос сохранён."
      : "Не удалось получить ответ. Проверьте соединение и попробуйте ещё раз.");
  } finally {
    clearTimeout(timeout);
  }
}
