import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRoles } from "@/lib/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LogOut, Mail, Wallet, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { formatNaira } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { data: roles } = useRoles(user?.id);
  const isPoster = roles?.includes("poster");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [depositAmount, setDepositAmount] = useState("");

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("balance_naira")
        .eq("user_id", user!.id)
        .maybeSingle();
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

  const balance = wallet?.balance_naira ?? 0;

  const depositFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount = Math.max(0, parseInt(depositAmount || "0", 10));
    if (!amount) return toast.error("Enter a valid deposit amount.");

    const { error } = await supabase.from("wallet_transactions").insert({
      user_id: user.id,
      amount_naira: amount,
      kind: "deposit",
      note: "Student wallet deposit",
    });
    if (error) return toast.error(error.message);

    setDepositAmount("");
    qc.invalidateQueries({ queryKey: ["wallet", user.id] });
    qc.invalidateQueries({ queryKey: ["wallet-tx", user.id] });
    toast.success("Deposit successful.");
  };

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
            <p className="mt-1 text-xs opacity-90">
              Your balance grows only from completed work and refunds.
            </p>
          </div>
        </CardContent>
      </Card>

      {isPoster ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Deposit funds</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={depositFunds}>
              <div className="space-y-2">
                <Label htmlFor="deposit">Deposit amount</Label>
                <input
                  id="deposit"
                  type="number"
                  min="0"
                  step="100"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="0"
                />
              </div>
              <Button type="submit" className="w-full">
                Deposit funds
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Deposits are only available to students.
            </p>
          </CardContent>
        </Card>
      )}

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
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${positive ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"}`}
                      >
                        {positive ? (
                          <ArrowDownCircle className="h-5 w-5" />
                        ) : (
                          <ArrowUpCircle className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium capitalize">{t.kind}</p>
                        {t.note && (
                          <p className="truncate text-xs text-muted-foreground">{t.note}</p>
                        )}
                      </div>
                    </div>
                    <p
                      className={`text-sm font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {positive ? "+" : ""}
                      {formatNaira(t.amount_naira)}
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
