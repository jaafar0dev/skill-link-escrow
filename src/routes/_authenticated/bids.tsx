import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRoles } from "@/lib/hooks/useRoles";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox, Gavel, Wallet, Sparkles } from "lucide-react";
import { formatNaira } from "@/lib/format";
import { StatusPill } from "./dashboard";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/bids")({
  component: BidsPage,
});

function BidsPage() {
  const { user } = useAuth();
  const { data: roles } = useRoles(user?.id);
  const qc = useQueryClient();
  const isProvider = roles?.includes("provider");

  // Provider: my submitted bids. Poster: bids on my jobs.
  const { data: bids, isLoading } = useQuery({
    queryKey: ["my-bids", user?.id, isProvider],
    enabled: !!user && !!roles,
    queryFn: async () => {
      if (isProvider) {
        const { data, error } = await supabase
          .from("bids")
          .select("*, jobs:job_id(id, title, status, budget_naira)")
          .eq("provider_id", user!.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      }
      const { data: myJobs } = await supabase.from("jobs").select("id, title, status").eq("poster_id", user!.id);
      const ids = (myJobs ?? []).map((j) => j.id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("bids")
        .select("*, jobs:job_id(id, title, status, budget_naira)")
        .in("job_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const pids = Array.from(new Set((data ?? []).map((b) => b.provider_id)));
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", pids);
      const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return (data ?? []).map((b) => ({ ...b, profiles: { full_name: nameById.get(b.provider_id) ?? "Provider" } }));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("bids-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bids" }, () => {
        qc.invalidateQueries({ queryKey: ["my-bids"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-5 text-primary-foreground shadow">
        <div className="absolute -right-6 -top-6 opacity-20">
          <Gavel className="h-28 w-28" />
        </div>
        <div className="relative">
          <p className="text-xs uppercase tracking-wider opacity-90">{isProvider ? "Your bids" : "Bids on your jobs"}</p>
          <h1 className="mt-1 text-2xl font-bold">{bids?.length ?? 0} {bids?.length === 1 ? "bid" : "bids"}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm opacity-90">
            <Sparkles className="h-3.5 w-3.5" /> Live updates
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !bids?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium">No bids yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              {isProvider ? "Browse open jobs and place your first bid." : "Bids on your jobs will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {bids.map((b: any) => (
            <Link key={b.id} to="/jobs/$id" params={{ id: b.jobs?.id ?? b.job_id }}>
              <Card className="transition hover:bg-accent">
                <CardContent className="flex items-center justify-between gap-3 pt-6">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.jobs?.title || "Job"}</p>
                    {!isProvider && b.profiles?.full_name && (
                      <p className="text-xs text-muted-foreground">by {b.profiles.full_name}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1 text-sm font-semibold">
                      <Wallet className="h-3.5 w-3.5" />
                      {formatNaira(b.amount_naira)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusPill status={b.status} />
                    {b.jobs?.status && <span className="text-[10px] text-muted-foreground">{b.jobs.status}</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
