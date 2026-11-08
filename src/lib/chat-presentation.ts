export function compactCoins(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const units = [{ at: 1e12, suffix: "T" }, { at: 1e9, suffix: "B" }, { at: 1e6, suffix: "M" }, { at: 1e3, suffix: "K" }];
  const unit = units.find((u) => Math.abs(value) >= u.at);
  if (!unit) return String(Math.trunc(value));
  const scaled = Math.trunc((value / unit.at) * 10) / 10;
  return `${scaled}${unit.suffix}`;
}

export type ModerationMessage = { id: string; user_id: string; room_id: string; created_at: string; content: string };

export function groupMemberRooms<T extends ModerationMessage>(messages: T[]) {
  const members = new Map<string, { userId: string; count: number; rooms: Map<string, T[]> }>();
  for (const message of messages) {
    const member = members.get(message.user_id) ?? { userId: message.user_id, count: 0, rooms: new Map<string, T[]>() };
    member.count++;
    const room = member.rooms.get(message.room_id) ?? [];
    room.push(message);
    member.rooms.set(message.room_id, room);
    members.set(message.user_id, member);
  }
  return [...members.values()];
}

export function canAssignRank(isAdmin: boolean, isOwner: boolean, targetIsOwner: boolean) {
  return isAdmin && (!targetIsOwner || isOwner);
}