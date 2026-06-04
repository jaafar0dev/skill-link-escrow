import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRoles } from "@/lib/hooks/useRoles";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatNaira } from "@/lib/format";
import { StatusPill } from "./dashboard";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const { data: roles, isLoading } = useRoles(user?.id);
  const qc = useQueryClient();
  const isAdmin = roles?.includes("admin");

  const { data: escrows } = useQuery({
    queryKey: ["admin-escrows"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escrow_transactions")
        .select("*, jobs(id, title, status, poster_id, assigned_provider_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <ShieldAlert className="mx-auto mb-2 h-6 w-6" />
          Admin access only.
        </CardContent>
      </Card>
    );
  }

  const release = async (escrowId: string, jobId: string) => {
    const { error: eErr } = await supabase
      .from("escrow_transactions")
      .update({ status: "released", released_at: new Date().toISOString(), released_by: user!.id })
      .eq("id", escrowId);
    if (eErr) return toast.error(eErr.message);
    const { error: jErr } = await supabase.from("jobs").update({ status: "completed" }).eq("id", jobId);
    if (jErr) return toast.error(jErr.message);
    toast.success("Escrow released");
    qc.invalidateQueries({ queryKey: ["admin-escrows"] });
  };

  const refund = async (escrowId: string, jobId: string) => {
    await supabase
      .from("escrow_transactions")
      .update({ status: "refunded", released_at: new Date().toISOString(), released_by: user!.id })
      .eq("id", escrowId);
    await supabase.from("jobs").update({ status: "cancelled" }).eq("id", jobId);
    toast.success("Refunded to poster");
    qc.invalidateQueries({ queryKey: ["admin-escrows"] });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Escrow transactions</h2>
        <div className="space-y-2">
          {escrows?.map((e: any) => (
            <Card key={e.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <Link to="/jobs/$id" params={{ id: e.job_id }} className="hover:underline">
                    {e.jobs?.title}
                  </Link>
                  <StatusPill status={e.jobs?.status ?? "—"} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">Amount: <span className="font-semibold">{formatNaira(e.amount_naira)}</span></p>
                <p className="text-xs text-muted-foreground">Escrow: {e.status}</p>
                {e.status === "funded" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => release(e.id, e.job_id)}>Release to provider</Button>
                    <Button size="sm" variant="outline" onClick={() => refund(e.id, e.job_id)}>Refund poster</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {!escrows?.length && <p className="text-sm text-muted-foreground">No escrow transactions yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Users ({users?.length ?? 0})</h2>
        <Card>
          <CardContent className="divide-y p-0">
            {users?.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 text-sm">
                <span>{u.full_name || "—"}</span>
                <span className="text-xs text-muted-foreground">{u.id.slice(0, 8)}…</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
