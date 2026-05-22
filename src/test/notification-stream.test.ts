import { describe, expect, it } from "vitest";
import {
  createNotificationHeartbeatEvent,
  createNotificationSnapshotEvent,
  encodeSseEvent,
  notificationStreamIntervalMs,
  notificationStreamPath,
} from "../../apps/api/src/modules/notifications/notification-stream";

describe("notification SSE stream", () => {
  it("defines the stream path and interval", () => {
    expect(notificationStreamPath).toBe("/api/notifications/stream");
    expect(notificationStreamIntervalMs).toBe(15_000);
  });

  it("encodes SSE events with JSON data", () => {
    expect(encodeSseEvent("test", { ok: true })).toBe("event: test\ndata: {\"ok\":true}\n\n");
  });

  it("creates snapshot and heartbeat events", () => {
    expect(createNotificationSnapshotEvent([])).toContain("event: notifications:snapshot");
    expect(createNotificationHeartbeatEvent()).toContain("event: notifications:heartbeat");
  });
});
