import { supabase } from "@/integrations/supabase/client";

export function badgeExtension(file: File) {
  const extensions: Record<string, string> = { "image/gif": "gif", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif" };
  const ext = extensions[file.type];
  if (!ext) throw new Error("اختر صورة PNG أو JPG أو WebP أو GIF");
  return ext;
}

export async function uploadRankBadge(file: File) {
  const ext = badgeExtension(file);
  if (file.size > 5 * 1024 * 1024) throw new Error("حجم الشارة يجب ألا يتجاوز 5 ميغابايت");
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) throw new Error("سجّل الدخول أولاً");
  const path = `${data.user.id}/badges/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("chat-media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("تعذر رفع الشارة، حاول مجدداً");
  return path;
}