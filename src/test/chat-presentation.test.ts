import { describe, expect, it } from "vitest";
import { compactCoins, groupMemberRooms, canAssignRank } from "@/lib/chat-presentation";

describe("chat presentation rules", () => {
  it("abbreviates thousands", () => { expect(compactCoins(12500)).toBe("12.5K"); });
  it("abbreviates millions and larger balances", () => {
    expect(compactCoins(2400000)).toBe("2.4M");
    expect(compactCoins(3000000000)).toBe("3B");
    expect(compactCoins(1000000000000)).toBe("1T");
  });
  it("groups each person's messages by room without truncation", () => {
    const rows = Array.from({ length: 1501 }, (_, i) => ({ id: String(i), user_id: i === 1500 ? "b" : "a", room_id: i % 2 ? "one" : "two", content: "", created_at: "2026-11-08" }));
    const groups = groupMemberRooms(rows);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.count).toBe(1500);
    expect(groups[0]?.rooms.get("one")).toHaveLength(750);
    expect(groups[0]?.rooms.get("two")).toHaveLength(750);
  });
  it("lets the owner change their own rank", () => { expect(canAssignRank(true, true, true)).toBe(true); });
  it("does not let another admin change the owner's rank", () => { expect(canAssignRank(true, false, true)).toBe(false); });
  it("does not let members assign ranks", () => { expect(canAssignRank(false, false, false)).toBe(false); });
});