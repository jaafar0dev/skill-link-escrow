import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRoles } from "@/lib/hooks/useRoles";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase, Wallet, Sparkles, Rocket } from "lucide-react";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { data: roles } = useRoles(user?.id);
  const isPoster = roles?.includes("poster");
  const isProvider = roles?.includes("provider");

  const { data: jobs } = useQuery({
    queryKey: ["my-jobs", user?.id, roles],
    enabled: !!user && !!roles,
    queryFn: async () => {
      let q = supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(10);
      if (isPoster && !isProvider) q = q.eq("poster_id", user!.id);
      else if (isProvider && !isPoster) q = q.eq("assigned_provider_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/70 p-5 text-primary-foreground shadow-lg">
        <div className="absolute -right-8 -bottom-8 opacity-15">
          <Rocket className="h-36 w-36" />
        </div>
        <div className="relative">
          <p className="flex items-center gap-1 text-xs uppercase tracking-wider opacity-90">
            <Sparkles className="h-3.5 w-3.5" /> SkillSwap
          </p>
          <h1 className="mt-1 text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm opacity-90">
            {roles?.includes("admin")
              ? "Admin dashboard"
              : isProvider
                ? "Find jobs and grow your portfolio."
                : "Post a project to get started."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {isPoster && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <Button asChild className="w-full">
                <Link to="/jobs/new"><Plus className="mr-2 h-4 w-4" /> Post a new job</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-6">
            <Button asChild variant="outline" className="w-full">
              <Link to="/jobs"><Briefcase className="mr-2 h-4 w-4" /> Browse jobs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Recent activity</h2>
        {!jobs?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Briefcase className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium">No jobs yet</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                {isPoster ? "Post your first job to attract bids." : "Browse open jobs to start bidding."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {jobs.map((j) => (
              <Link key={j.id} to="/jobs/$id" params={{ id: j.id }}>
                <Card className="transition hover:bg-accent">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{j.title}</span>
                      <StatusPill status={j.status} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-3.5 w-3.5" />
                      {formatNaira(j.final_price_naira ?? j.budget_naira)}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-blue-500/15 text-blue-600",
    in_escrow: "bg-amber-500/15 text-amber-600",
    delivered: "bg-violet-500/15 text-violet-600",
    completed: "bg-emerald-500/15 text-emerald-600",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-muted"}`}>
      {status === "in_escrow" ? "in escrow" : status}
    </span>
  );
}
