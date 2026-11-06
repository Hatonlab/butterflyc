import { describe, it, expect } from "vitest";
import { GIFTS, levelFromXp } from "@/lib/gifts";

describe("gifts and levels", () => {
  it("cheapest gift costs 8 coins", () => {
    expect(Math.min(...GIFTS.map((g) => g.cost))).toBe(8);
  });
  it("new members start at level 1", () => {
    expect(levelFromXp(0).level).toBe(1);
  });
  it("50 xp reaches level 2", () => {
    expect(levelFromXp(50).level).toBe(2);
  });
});
