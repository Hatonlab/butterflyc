import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GiftEffects } from "@/components/GiftEffects";

const state = vi.hoisted(() => ({ receive: undefined as undefined | ((payload: { new: unknown }) => void), invalidate: vi.fn(), remove: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: state.invalidate }) }));
vi.mock("@/lib/people", () => ({ usePeople: () => ({ data: { byId: new Map([["sender", { username: "مرسل" }], ["receiver", { username: "مستقبل" }]]) } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { channel: () => ({ on: (_event: string, _filter: unknown, callback: typeof state.receive) => { state.receive = callback; return { subscribe: () => ({}) }; } }), removeChannel: state.remove } }));

afterEach(() => { cleanup(); vi.useRealTimers(); state.receive = undefined; });
describe("confirmed shared gifts", () => {
  it("shows the committed gift event to a viewer who is neither sender nor receiver", () => {
    render(<GiftEffects userId="viewer" />);
    act(() => state.receive?.({ new: { id: "gift-1", gift_key: "rose", sender_id: "sender", receiver_id: "receiver", cost: 8, created_at: "2026-11-08" } }));
    expect(screen.getByRole("status")).toHaveTextContent("مرسل أهدى وردة");
    expect(screen.getByRole("status")).toHaveTextContent("إلى مستقبل");
  });
  it("shows nothing without a committed gift and ignores duplicate events", () => {
    vi.useFakeTimers();
    render(<GiftEffects userId="viewer" />);
    expect(screen.queryByRole("status")).toBeNull();
    const event = { new: { id: "gift-2", gift_key: "rose", sender_id: "sender", receiver_id: "receiver", cost: 8, created_at: "2026-11-08" } };
    act(() => { state.receive?.(event); state.receive?.(event); });
    act(() => vi.advanceTimersByTime(3500));
    expect(screen.queryByRole("status")).toBeNull();
  });
});