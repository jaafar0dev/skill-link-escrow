import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Mail, Wallet, Plus, ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("balance_naira").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: txs } = useQuery({
    queryKey: ["wallet-tx", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const deposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = Math.max(0, parseInt(amount || "0", 10));
    if (!amt) return toast.error("Enter an amount");
    setLoading(true);
    const { error } = await supabase.from("wallet_transactions").insert({
      user_id: user.id,
      amount_naira: amt,
      kind: "deposit",
      note: "Manual deposit",
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setAmount("");
    qc.invalidateQueries({ queryKey: ["wallet", user.id] });
    qc.invalidateQueries({ queryKey: ["wallet-tx", user.id] });
    toast.success(`Deposited ${formatNaira(amt)}`);
  };

  const balance = wallet?.balance_naira ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and wallet</p>
      </div>

      {/* Wallet balance */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary via-primary to-emerald-600 text-primary-foreground shadow-xl">
        <CardContent className="relative pt-6">
          <div className="pointer-events-none absolute -right-6 -bottom-6 opacity-15">
            <Wallet className="h-32 w-32" />
          </div>
          <div className="relative">
            <p className="flex items-center gap-1 text-xs uppercase tracking-wider opacity-90">
              <Wallet className="h-3.5 w-3.5" /> Wallet balance
            </p>
            <p className="mt-1 text-4xl font-bold">{formatNaira(balance)}</p>
            <p className="mt-1 text-xs opacity-90">Use this to fund jobs and pay freelancers</p>
          </div>
        </CardContent>
      </Card>

      {/* Deposit form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> Deposit funds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={deposit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="amt">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">₦</span>
                <Input id="amt" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000" className="pl-8 text-lg font-semibold" />
              </div>
              <p className="text-xs text-muted-foreground">Manual deposit (demo) — amount is credited instantly.</p>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deposit
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!txs?.length ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="divide-y">
              {txs.map((t: any) => {
                const positive = t.amount_naira >= 0;
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${positive ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"}`}>
                        {positive ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium capitalize">{t.kind}</p>
                        {t.note && <p className="truncate text-xs text-muted-foreground">{t.note}</p>}
                      </div>
                    </div>
                    <p className={`text-sm font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                      {positive ? "+" : ""}{formatNaira(t.amount_naira)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="truncate font-medium">{user?.email}</p>
          </div>
        </div>
      </Card>

      <Button variant="destructive" className="w-full" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Log out
      </Button>
    </div>
  );
}
