export type Gift = { key: string; name: string; cost: number; emoji: string };

/** Costs must match public.gift_cost() in the database. */
export const GIFTS: Gift[] = [
  { key: "rose", name: "وردة", cost: 8, emoji: "🌹" },
  { key: "heart", name: "قلب", cost: 15, emoji: "💖" },
  { key: "butterfly", name: "فراشة", cost: 25, emoji: "🦋" },
  { key: "cake", name: "كعكة", cost: 40, emoji: "🎂" },
  { key: "crown", name: "تاج", cost: 80, emoji: "👑" },
  { key: "diamond", name: "ألماسة", cost: 150, emoji: "💎" },
  { key: "castle", name: "قصر", cost: 300, emoji: "🏰" },
  { key: "rocket", name: "صاروخ", cost: 500, emoji: "🚀" },
];

export const giftByKey = new Map(GIFTS.map((g) => [g.key, g]));

/** Level grows with XP: level n needs 50 * n^2 total XP (level 1 starts at 0). */
export function levelFromXp(xp: number) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
  const cur = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, progress: (xp - cur) / (next - cur), next };
}
