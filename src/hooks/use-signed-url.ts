import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useSignedStorageUrl(bucket: string, path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-storage-url", bucket, path],
    queryFn: async (): Promise<string | null> => {
      if (!path) return null;
      const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24);
      if (error) throw error;
      return data?.signedUrl ?? null;
    },
    enabled: !!path,
    staleTime: 60 * 60 * 1000,
  });
}
