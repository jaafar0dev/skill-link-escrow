import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRoles } from "@/lib/hooks/useRoles";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase, Wallet, Sparkles, Rocket, TrendingUp, Gavel, CheckCircle2, Zap } from "lucide-react";
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

  const { data: stats } = useQuery({
    queryKey: ["stats", user?.id, isProvider],
    enabled: !!user && !!roles,
    queryFn: async () => {
      if (isProvider) {
        const { data: myBids } = await supabase.from("bids").select("status, amount_naira").eq("provider_id", user!.id);
        const active = myBids?.filter((b) => b.status === "pending").length ?? 0;
        const won = myBids?.filter((b) => b.status === "accepted").length ?? 0;
        return { primary: { label: "Active bids", value: active, icon: Gavel }, secondary: { label: "Won", value: won, icon: CheckCircle2 } };
      }
      const { data: myJobs } = await supabase.from("jobs").select("status").eq("poster_id", user!.id);
      const open = myJobs?.filter((j) => j.status === "open").length ?? 0;
      const done = myJobs?.filter((j) => j.status === "completed").length ?? 0;
      return { primary: { label: "Open jobs", value: open, icon: Zap }, secondary: { label: "Completed", value: done, icon: CheckCircle2 } };
    },
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0]
    || user?.email?.split("@")[0]
    || "there";

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-emerald-600 p-6 text-primary-foreground shadow-xl">
        <div className="pointer-events-none absolute -right-10 -bottom-10 opacity-15">
          <Rocket className="h-44 w-44" />
        </div>
        <div className="pointer-events-none absolute right-6 top-6 h-20 w-20 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] opacity-90">
            <Sparkles className="h-3.5 w-3.5" /> SkillSwap
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-tight">{greeting}, {firstName} 👋</h1>
          <p className="mt-1 text-sm opacity-90">
            {roles?.includes("admin")
              ? "Admin dashboard"
              : isProvider
                ? "Find jobs and grow your portfolio."
                : "Post a project to get started."}
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label={stats.primary.label} value={stats.primary.value} Icon={stats.primary.icon} tone="primary" />
          <StatCard label={stats.secondary.label} value={stats.secondary.value} Icon={stats.secondary.icon} tone="emerald" />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {isPoster && (
          <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
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
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <TrendingUp className="h-4 w-4" /> Recent activity
        </h2>

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

function StatCard({ label, value, Icon, tone }: { label: string; value: number; Icon: any; tone: "primary" | "emerald" }) {
  const toneClasses = tone === "primary"
    ? "from-primary/15 to-primary/5 text-primary"
    : "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400";
  return (
    <Card className={`overflow-hidden bg-gradient-to-br ${toneClasses} border-0`}>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/70 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
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
