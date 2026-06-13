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

      const escrows = data ?? [];
      const jobIds = Array.from(new Set(escrows.map((e: any) => e.job_id)));
      if (!jobIds.length) return escrows;

      const { data: messages, error: msgErr } = await supabase
        .from("messages")
        .select("job_id, body, attachment_name, created_at, sender_id")
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });
      if (msgErr) throw msgErr;

      const latestMessageByJob = new Map<string, any>();
      const countByJob = new Map<string, number>();
      const latestSupportByJob = new Map<string, any>();
      for (const message of messages ?? []) {
        const count = countByJob.get(message.job_id) ?? 0;
        countByJob.set(message.job_id, count + 1);
        if (!latestMessageByJob.has(message.job_id)) {
          latestMessageByJob.set(message.job_id, message);
        }
        if (
          message.body.startsWith("REPORT_TO_ADMIN:") &&
          !latestSupportByJob.has(message.job_id)
        ) {
          latestSupportByJob.set(message.job_id, message);
        }
      }

      return escrows.map((e: any) => ({
        ...e,
        latest_message: latestMessageByJob.get(e.job_id) ?? null,
        message_count: countByJob.get(e.job_id) ?? 0,
        latest_support_message: latestSupportByJob.get(e.job_id) ?? null,
      }));
    },
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
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
    const { data: esc } = await supabase
      .from("escrow_transactions")
      .select("amount_naira")
      .eq("id", escrowId)
      .maybeSingle();
    const { data: jb } = await supabase
      .from("jobs")
      .select("assigned_provider_id, title")
      .eq("id", jobId)
      .maybeSingle();
    const { error: eErr } = await supabase
      .from("escrow_transactions")
      .update({ status: "released", released_at: new Date().toISOString(), released_by: user!.id })
      .eq("id", escrowId);
    if (eErr) return toast.error(eErr.message);
    const { error: jErr } = await supabase
      .from("jobs")
      .update({ status: "completed" })
      .eq("id", jobId);
    if (jErr) return toast.error(jErr.message);
    if (jb?.assigned_provider_id && esc?.amount_naira) {
      await supabase.from("wallet_transactions").insert({
        user_id: jb.assigned_provider_id,
        amount_naira: esc.amount_naira,
        kind: "earning",
        note: `Earnings from "${jb.title}"`,
      });
    }
    toast.success("Escrow released to provider's wallet");
    qc.invalidateQueries({ queryKey: ["admin-escrows"] });
  };

  const refund = async (escrowId: string, jobId: string) => {
    const { data: esc } = await supabase
      .from("escrow_transactions")
      .select("amount_naira")
      .eq("id", escrowId)
      .maybeSingle();
    const { data: jb } = await supabase
      .from("jobs")
      .select("poster_id, title")
      .eq("id", jobId)
      .maybeSingle();
    await supabase
      .from("escrow_transactions")
      .update({ status: "refunded", released_at: new Date().toISOString(), released_by: user!.id })
      .eq("id", escrowId);
    await supabase.from("jobs").update({ status: "cancelled" }).eq("id", jobId);
    if (jb?.poster_id && esc?.amount_naira) {
      await supabase.from("wallet_transactions").insert({
        user_id: jb.poster_id,
        amount_naira: esc.amount_naira,
        kind: "refund",
        note: `Refund from "${jb.title}"`,
      });
    }
    toast.success("Refunded to poster's wallet");
    qc.invalidateQueries({ queryKey: ["admin-escrows"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Manage escrow, refunds, and support requests.
          </p>
        </div>
        <Link
          to="/support"
          className="rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          Support queue
        </Link>
      </div>

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
                <p className="text-sm">
                  Amount: <span className="font-semibold">{formatNaira(e.amount_naira)}</span>
                </p>
                <p className="text-xs text-muted-foreground">Escrow: {e.status}</p>
                <p className="text-sm">
                  Messages: <span className="font-semibold">{e.message_count ?? 0}</span>
                </p>
                <p className="text-sm">
                  Support:{" "}
                  <span className="font-semibold">
                    {e.latest_support_message ? "Requested" : "None"}
                  </span>
                </p>
                {e.latest_support_message ? (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-medium">Latest support request</p>
                    <p className="mt-1 truncate">
                      {e.latest_support_message.body.replace("REPORT_TO_ADMIN:", "").trim() ||
                        "Support request submitted."}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Requested at {new Date(e.latest_support_message.created_at).toLocaleString()}
                    </p>
                  </div>
                ) : e.latest_message ? (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-medium">Latest admin-visible message</p>
                    <p className="mt-1 truncate">{e.latest_message.body || "Attachment only"}</p>
                    {e.latest_message.attachment_name ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Attachment: {e.latest_message.attachment_name}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No conversation yet for this escrow.
                  </p>
                )}
                {e.status === "funded" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => release(e.id, e.job_id)}>
                      Release to provider
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => refund(e.id, e.job_id)}>
                      Refund poster
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {!escrows?.length && (
            <p className="text-sm text-muted-foreground">No escrow transactions yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Users ({users?.length ?? 0})
        </h2>
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
