import { fireEvent, render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatView } from "@/components/ChatView";

const upload = vi.hoisted(() => vi.fn());
vi.mock("@/lib/media", () => ({ uploadMedia: upload, useMediaUrl: () => ({ data: null }) }));
vi.mock("@/components/UserAvatar", () => ({ UserAvatar: () => null, RoleBadge: () => null, LevelBadge: () => null }));
vi.mock("@/components/AudioPlayer", () => ({ AudioPlayer: () => null }));

describe("Chat media sending", () => {
  beforeEach(() => upload.mockReset());
  afterEach(cleanup);
  for (const [type, name] of [["image", "photo.png"], ["video", "clip.mp4"]] as const) {
    it(`sends a ${type} without requiring text`, async () => {
      const onSend = vi.fn().mockResolvedValue(undefined);
      upload.mockResolvedValue({ media_url: `member/${name}`, media_type: type });
      const view = render(<ChatView messages={[]} meId="member" onSend={onSend} canDelete={() => false} onDelete={() => {}} />);
      const input = view.container.querySelector('input[type="file"]');
      if (!input) throw new Error("Missing file picker");
      const file = new File(["media"], name, { type: type === "image" ? "image/png" : "video/mp4" });
      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() => expect(onSend).toHaveBeenCalledWith({ content: "", media_url: `member/${name}`, media_type: type }));
      expect(upload).toHaveBeenCalledWith("member", file, type, name.split(".").pop());
    });
  }
  it("keeps the draft if sending fails", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error("send failed"));
    const view = render(<ChatView messages={[]} meId="member" onSend={onSend} canDelete={() => false} onDelete={() => {}} />);
    const input = view.getByPlaceholderText("اكتب رسالتك... تدعم الزخرفة 🦋");
    fireEvent.change(input, { target: { value: "رسالة لم ترسل" } });
    fireEvent.click(view.getByRole("button", { name: "إرسال" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ content: "رسالة لم ترسل" }));
    expect(input).toHaveValue("رسالة لم ترسل");
  });
});