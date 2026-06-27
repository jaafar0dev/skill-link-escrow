import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNaira } from "@/lib/format";
import { Briefcase, MessageSquareWarning, ShieldAlert, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw redirect({ to: "/auth" });
    }

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = !rolesError && (roles ?? []).some((role: any) => role.role === "admin");

    if (!isAdmin) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [{ data: jobsData, error: jobsError }, { data: profilesData, error: profilesError }, { data: reportsData, error: reportsError }] = await Promise.all([
        supabase.from("jobs").select("id, title, status, budget_naira, final_price_naira, created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("profiles").select("id"),
        supabase.from("messages").select("id").ilike("body", "REPORT_TO_ADMIN:%"),
      ]);

      if (jobsError || profilesError || reportsError) {
        throw jobsError ?? profilesError ?? reportsError;
      }

      const totalJobs = jobsData?.length ?? 0;
      const openJobs = jobsData?.filter((job: any) => job.status === "open").length ?? 0;
      const totalMembers = profilesData?.length ?? 0;
      const supportReports = reportsData?.length ?? 0;

      return {
        totalJobs,
        openJobs,
        totalMembers,
        supportReports,
        recentJobs: jobsData ?? [],
      };
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading admin workspace…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">Admin console</p>
            <h1 className="text-2xl font-semibold">Operations overview</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review activity, support reports, and recent jobs directly from the database.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total jobs" value={overview?.totalJobs ?? 0} icon={<Briefcase className="h-5 w-5" />} />
        <StatCard label="Open jobs" value={overview?.openJobs ?? 0} icon={<Briefcase className="h-5 w-5" />} />
        <StatCard label="Members" value={overview?.totalMembers ?? 0} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Support reports" value={overview?.supportReports ?? 0} icon={<MessageSquareWarning className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {!overview?.recentJobs?.length ? (
            <p className="text-sm text-muted-foreground">No jobs have been created yet.</p>
          ) : (
            <div className="space-y-2">
              {overview.recentJobs.map((job: any) => (
                <div key={job.id} className="flex items-center justify-between rounded-xl border p-3">
                  <div>
                    <p className="font-medium">{job.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.status ? job.status.replace(/_/g, " ") : "Unknown"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatNaira(job.final_price_naira ?? job.budget_naira)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 py-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-2xl bg-muted p-3 text-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}
