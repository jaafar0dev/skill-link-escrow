import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getUserRoles = createServerFn()
  .validator(z.object({ userId: z.string() }))
  .handler(async ({ data }) => {
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    
    if (error) return { roles: [], error: error.message };
    return { roles: (roles ?? []).map((r) => r.role), error: null };
  });
