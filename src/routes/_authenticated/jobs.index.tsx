import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { formatNaira } from "@/lib/format";
import { StatusPill } from "./dashboard";

export const Route = createFileRoute("/_authenticated/jobs/")({
  component: JobsList,
});

function JobsList() {
  const { data } = useQuery({
    queryKey: ["jobs-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">All jobs</h1>
      {!data?.length ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No jobs yet.</CardContent></Card>
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
                    {formatNaira(j.final_price_naira ?? j.budget_naira)}
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
