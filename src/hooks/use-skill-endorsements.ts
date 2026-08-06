// Endorsing someone else's taught skill — the"community_recognized"tier
// is earned this way (see 20260705140000_skill_verification.sql), never
// self-claimed.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEndorseSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileId,
      skillId,
      endorsedBy,
    }: {
      profileId: string;
      skillId: string;
      endorsedBy: string;
    }) => {
      const { error } = await supabase
        .from("skill_endorsements")
        .insert({ profile_id: profileId, skill_id: skillId, endorsed_by: endorsedBy });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-profile"] });
    },
  });
}
