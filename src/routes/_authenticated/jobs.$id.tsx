import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRoles } from "@/lib/hooks/useRoles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatNaira } from "@/lib/format";
import { StatusPill } from "./dashboard";
import { Wallet, CheckCircle2, ShieldCheck, Loader2, Inbox, Gavel } from "lucide-react";

export const Route = createFileRoute("/_authenticated/jobs/$id")({
  component: JobDetail,
});

function JobDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data: roles } = useRoles(user?.id);
  const qc = useQueryClient();

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: bids } = useQuery({
    queryKey: ["bids", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bids")
        .select("*")
        .eq("job_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const pids = Array.from(new Set((data ?? []).map((b) => b.provider_id)));
      const { data: profs } = pids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", pids)
        : { data: [] as { id: string; full_name: string }[] };
      const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return (data ?? []).map((b) => ({ ...b, profiles: { full_name: nameById.get(b.provider_id) ?? "Provider" } }));
    },
  });

  const { data: posterProfile } = useQuery({
    queryKey: ["profile", job?.poster_id],
    enabled: !!job,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", job!.poster_id).maybeSingle();
      return data;
    },
  });

  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [bidLoading, setBidLoading] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel(`job-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bids", filter: `job_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["bids", id] });
        qc.invalidateQueries({ queryKey: ["my-bids"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["job", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!job) return <p className="text-sm text-muted-foreground">Job not found.</p>;

  const isPoster = user?.id === job.poster_id;
  const isProvider = roles?.includes("provider");
  const isAssigned = user?.id === job.assigned_provider_id;
  const myBid = bids?.find((b) => b.provider_id === user?.id);
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["job", id] }),
      qc.invalidateQueries({ queryKey: ["bids", id] }),
      qc.invalidateQueries({ queryKey: ["my-bids"] }),
    ]);
  };


  const submitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBidLoading(true);
    const amt = Math.max(0, parseInt(amount || "0", 10));
    const { error } = myBid
      ? await supabase.from("bids")
          .update({ amount_naira: amt, message, status: "pending" })
          .eq("id", myBid.id)
      : await supabase.from("bids").insert({
          job_id: id,
          provider_id: user.id,
          amount_naira: amt,
          message,
        });
    setBidLoading(false);
    if (error) return toast.error(error.message);
    setAmount(""); setMessage("");
    await refresh();
    toast.success(myBid ? "Bid updated" : "Bid placed");
  };

  const acceptBid = async (bid: any) => {
    const { error: bErr } = await supabase.from("bids").update({ status: "rejected" }).eq("job_id", id).neq("id", bid.id);
    if (bErr) return toast.error(bErr.message);
    await supabase.from("bids").update({ status: "accepted" }).eq("id", bid.id);
    const { error: jErr } = await supabase.from("jobs").update({
      status: "in_escrow",
      assigned_provider_id: bid.provider_id,
      final_price_naira: bid.amount_naira,
    }).eq("id", id);
    if (jErr) return toast.error(jErr.message);
    const { error: eErr } = await supabase.from("escrow_transactions").insert({
      job_id: id,
      amount_naira: bid.amount_naira,
      status: "funded",
    });
    if (eErr) return toast.error(eErr.message);
    toast.success("Bid accepted — funds held in escrow");
    refresh();
  };

  const rejectBid = async (bid: any) => {
    const { error } = await supabase.from("bids").update({ status: "rejected" }).eq("id", bid.id);
    if (error) return toast.error(error.message);
    toast.success("Bid rejected — they can submit a counter-offer");
    refresh();
  };

  const markDelivered = async () => {
    const { error } = await supabase.from("jobs").update({ status: "delivered" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked delivered — waiting for admin to release escrow");
    refresh();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle>{job.title}</CardTitle>
            <StatusPill status={job.status} />
          </div>
          <p className="text-xs text-muted-foreground">Posted by {posterProfile?.full_name || "—"}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="whitespace-pre-wrap text-sm">{job.description}</p>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Wallet className="h-4 w-4" />
            Budget: {formatNaira(job.budget_naira)}
            {job.final_price_naira ? <span className="text-muted-foreground">· Agreed: {formatNaira(job.final_price_naira)}</span> : null}
          </div>
          {job.status === "in_escrow" && (
            <div className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              <ShieldCheck className="mr-1 inline h-4 w-4" />
              {formatNaira(job.final_price_naira)} held in escrow.
            </div>
          )}
          {job.status === "completed" && (
            <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="mr-1 inline h-4 w-4" /> Escrow released to provider.
            </div>
          )}

          {/* Poster marks delivery received? Actually provider marks delivered. */}
          {isAssigned && job.status === "in_escrow" && (
            <Button onClick={markDelivered}>Mark as delivered</Button>
          )}
          {isPoster && job.status === "delivered" && (
            <p className="text-xs text-muted-foreground">
              Provider marked delivered. An admin will review and release escrow.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Already-placed bid summary */}
      {myBid && (
        <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-transparent">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> Your bid
              </p>
              <p className="mt-1 text-lg font-bold">{formatNaira(myBid.amount_naira)}</p>
              {myBid.message && <p className="mt-1 text-xs text-muted-foreground">"{myBid.message}"</p>}
            </div>
            <span className="rounded-full bg-background/70 px-2 py-0.5 text-xs font-medium capitalize">{myBid.status}</span>
          </CardContent>
        </Card>
      )}

      {/* Bid form for providers — also used for editing an existing bid */}
      {job.status === "open" && isProvider && !isPoster && (
        <Card className="overflow-hidden border-primary/30">
          <div className="bg-gradient-to-r from-primary to-emerald-600 px-5 py-4 text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <Gavel className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="font-semibold leading-tight">
                  {myBid ? (myBid.status === "rejected" ? "Counter your bid" : "Update your bid") : "Place your bid"}
                </p>
                <p className="text-xs opacity-90">
                  {myBid
                    ? myBid.status === "rejected"
                      ? "Your last bid was rejected — try a different price"
                      : `Current bid: ${formatNaira(myBid.amount_naira)} · ${myBid.status}`
                    : "Haggle — you can edit your bid anytime"}
                </p>
              </div>
            </div>
          </div>
          <CardContent className="pt-5">
            <form onSubmit={submitBid} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="a">Your price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">₦</span>
                  <Input id="a" type="number" min={0} required value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="pl-8 text-lg font-semibold" placeholder={myBid ? String(myBid.amount_naira) : "0"} />
                </div>
                <p className="text-xs text-muted-foreground">Budget: {formatNaira(job.budget_naira)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m">Pitch (optional)</Label>
                <Textarea id="m" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={myBid?.message || "Why should they pick you?"} />
              </div>
              <Button type="submit" disabled={bidLoading} className="w-full" size="lg">
                {bidLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {myBid ? "Update bid" : "Submit bid"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Bids list — visible to poster & admin */}
      {(isPoster || roles?.includes("admin")) && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Gavel className="h-4 w-4" /> Bids received ({bids?.length ?? 0})
          </h2>
          <div className="space-y-2">
            {bids?.map((b: any) => (
              <Card key={b.id} className={`overflow-hidden ${b.status === "accepted" ? "border-emerald-500/50 bg-emerald-500/5" : ""}`}>
                <CardContent className="flex items-start justify-between gap-3 pt-6">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{b.profiles?.full_name || "Provider"}</p>
                    {b.message && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">"{b.message}"</p>}
                    <p className="mt-1.5 flex items-center gap-1 text-base font-bold text-primary">
                      <Wallet className="h-3.5 w-3.5" /> {formatNaira(b.amount_naira)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                      b.status === "accepted" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : b.status === "rejected" ? "bg-muted text-muted-foreground"
                      : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    }`}>{b.status}</span>
                    {isPoster && job.status === "open" && b.status === "pending" && (
                      <Button size="sm" onClick={() => acceptBid(b)}>Accept</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!bids?.length && (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                  <Inbox className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No bids yet — share your job to get bids faster.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
