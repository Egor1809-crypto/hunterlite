import { describe, expect, it } from "vitest";
import type { NotificationDto } from "@/lib/api-contracts";
import { notificationStreamUrl, liveNotificationPollMs, mergeNotifications } from "@/lib/live-notifications";

const notification = (id: string, title = id): NotificationDto => ({
  id,
  title,
  body: "body",
  time: "сейчас",
  tone: "info",
  unread: true,
});

describe("live notifications", () => {
  it("polls often enough for near-realtime UX without hammering the API", () => {
    expect(liveNotificationPollMs).toBe(15_000);
    expect(notificationStreamUrl).toBe("/api/notifications/stream");
  });

  it("merges incoming notifications before existing ones and deduplicates by id", () => {
    expect(mergeNotifications(
      [notification("old"), notification("same", "old same")],
      [notification("new"), notification("same", "new same")],
    )).toEqual([
      notification("new"),
      notification("same", "old same"),
      notification("old"),
    ]);
  });
});
