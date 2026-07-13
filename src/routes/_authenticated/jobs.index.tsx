import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getJobs } from "@/lib/api/jobs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Briefcase, Search } from "lucide-react";
import { formatUSD } from "@/lib/format";
import { StatusPill } from "./dashboard";

export const Route = createFileRoute("/_authenticated/jobs/")({
  component: JobsList,
});

function JobsList() {
  const { data } = useQuery({
    queryKey: ["jobs-all"],
    queryFn: async () => {
      const { jobs, error } = await getJobs({ data: {} });
      if (error) throw new Error(error);
      return jobs;
    },
  });

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-5 text-primary-foreground shadow">
        <div className="absolute -right-6 -top-6 opacity-20">
          <Briefcase className="h-28 w-28" />
        </div>
        <div className="relative">
          <p className="text-xs uppercase tracking-wider opacity-90">Marketplace</p>
          <h1 className="mt-1 text-2xl font-bold">All jobs</h1>
          <p className="mt-1 text-sm opacity-90">{data?.length ?? 0} {data?.length === 1 ? "listing" : "listings"} available</p>
        </div>
      </div>
      {!data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium">No jobs yet</p>
            <p className="text-sm text-muted-foreground">Check back soon for new listings.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((j) => (
            <Link key={j.id} to="/jobs/$id" params={{ id: j.id }}>
              <Card className="transition hover:bg-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="truncate">{j.title}</span>
                    <StatusPill status={j.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="line-clamp-2 text-sm text-muted-foreground">{j.description}</p>
                  <div className="mt-2 flex items-center gap-1 text-sm font-medium">
                    <Wallet className="h-3.5 w-3.5" />
                    {formatUSD(j.final_price_naira ?? j.budget_naira)}
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
