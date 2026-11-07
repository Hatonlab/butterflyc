import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MediaType = "image" | "video" | "audio";

const BUCKET = "chat-media";

export async function uploadMedia(userId: string, file: Blob, type: MediaType, ext: string) {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return { media_url: path, media_type: type };
}

export function useMediaUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["media-url", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 50,
    retry: 2,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
  });
}
