import { useQuery } from "@tanstack/react-query";
import { getUserRoles } from "@/lib/api/roles.functions";

export type AppRole = "poster" | "provider" | "admin";

export function useRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ["roles", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AppRole[]> => {
      const { roles, error } = await getUserRoles({ data: { userId: userId! } });
      if (error) throw new Error(error);
      return (roles ?? []) as AppRole[];
    },
  });
}
