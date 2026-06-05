import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { OnboardingCarousel } from "@/components/OnboardingCarousel";
import authBg from "@/assets/auth-bg.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — SkillSwap" }] }),
  component: AuthPage,
});

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"poster" | "provider">("poster");

  // Login
  const [lEmail, setLEmail] = useState("");
  const [lPassword, setLPassword] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Use a separate key when running as an installed PWA so the slides
    // show on first launch of the installed app, independent of the browser.
    const key = isStandalone() ? "skillswap_onboarded_pwa" : "skillswap_onboarded";
    if (!localStorage.getItem(key)) {
      setShowOnboarding(true);
    }
  }, []);

  const finishOnboarding = () => {
    localStorage.setItem(ONBOARD_KEY, "1");
    setShowOnboarding(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name, role },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created!");
    navigate({ to: "/dashboard" });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: lEmail,
      password: lPassword,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  };

  if (showOnboarding) return <OnboardingCarousel onDone={finishOnboarding} />;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Decorative background blobs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-emerald-300/20 blur-3xl" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 lg:grid-cols-2">
        {/* Left brand panel (desktop only) */}
        <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div
            className="absolute inset-0 -z-10 bg-cover bg-center"
            style={{ backgroundImage: `url(${authBg})` }}
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/85 via-primary/70 to-emerald-900/80" />

          <div className="flex items-center gap-2 text-white">
            <ShieldCheck className="h-7 w-7" />
            <span className="text-xl font-bold tracking-tight">SkillSwap</span>
          </div>

          <div className="text-white">
            <h1 className="text-4xl font-bold leading-tight">
              Hire help.<br />Earn fairly.<br />Stay protected.
            </h1>
            <p className="mt-4 max-w-sm text-white/85">
              The student marketplace where every Naira is held safely in escrow until the job is done right.
            </p>
            <div className="mt-8 flex items-center gap-6 text-sm text-white/80">
              <div>
                <p className="text-2xl font-bold text-white">100%</p>
                <p>Escrow protected</p>
              </div>
              <div className="h-10 w-px bg-white/30" />
              <div>
                <p className="text-2xl font-bold text-white">₦</p>
                <p>Naira native</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">
            {/* Mobile brand */}
            <div className="mb-8 flex flex-col items-center text-center lg:hidden">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h1 className="text-2xl font-bold">Welcome to SkillSwap</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Post jobs, hire talent, paid safely.
              </p>
            </div>

            <Card className="border-border/60 shadow-xl shadow-black/5 backdrop-blur-sm">
              <CardHeader className="hidden lg:block">
                <CardTitle className="text-2xl">Welcome back</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Sign in to continue, or create an account.
                </p>
              </CardHeader>
              <CardContent className="pt-6 lg:pt-0">
                <Tabs defaultValue="login">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Sign in</TabsTrigger>
                    <TabsTrigger value="signup">Sign up</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={handleLogin} className="space-y-4 pt-6">
                      <div className="space-y-2">
                        <Label htmlFor="lemail">Email</Label>
                        <Input id="lemail" type="email" required placeholder="you@school.edu" value={lEmail} onChange={(e) => setLEmail(e.target.value)} className="h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lpassword">Password</Label>
                        <Input id="lpassword" type="password" required placeholder="••••••••" value={lPassword} onChange={(e) => setLPassword(e.target.value)} className="h-11" />
                      </div>
                      <Button type="submit" className="h-11 w-full rounded-full text-base font-semibold shadow-lg shadow-primary/20" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignUp} className="space-y-4 pt-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full name</Label>
                        <Input id="name" required placeholder="Ada Okonkwo" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" required placeholder="you@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" required minLength={6} placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label>I want to</Label>
                        <RadioGroup value={role} onValueChange={(v) => setRole(v as any)} className="grid grid-cols-2 gap-2">
                          <label className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-all ${role === "poster" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="poster" id="r-poster" />
                              <span className="text-sm font-semibold">Post jobs</span>
                            </div>
                            <span className="ml-6 text-xs text-muted-foreground">I'm a student</span>
                          </label>
                          <label className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-all ${role === "provider" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="provider" id="r-provider" />
                              <span className="text-sm font-semibold">Provide</span>
                            </div>
                            <span className="ml-6 text-xs text-muted-foreground">I offer skills</span>
                          </label>
                        </RadioGroup>
                      </div>
                      <Button type="submit" className="h-11 w-full rounded-full text-base font-semibold shadow-lg shadow-primary/20" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create account
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              By continuing you agree to keep things respectful and pay on delivery.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

