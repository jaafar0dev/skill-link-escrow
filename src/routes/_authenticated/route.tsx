import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRoles } from "@/lib/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { ShieldCheck, LogOut, LayoutDashboard, Briefcase, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = useAuth();
  const { data: roles } = useRoles(user?.id);
  const navigate = useNavigate();
  const isAdmin = roles?.includes("admin");

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            SkillSwap
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t bg-background">
        <div className="mx-auto flex max-w-5xl">
          <NavLink to="/dashboard" icon={<LayoutDashboard className="h-5 w-5" />} label="Home" />
          <NavLink to="/jobs" icon={<Briefcase className="h-5 w-5" />} label="Jobs" />
          {isAdmin && <NavLink to="/admin" icon={<ShieldAlert className="h-5 w-5" />} label="Admin" />}
        </div>
      </nav>
    </div>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-1 flex-col items-center gap-1 py-3 text-xs text-muted-foreground hover:text-foreground"
      activeProps={{ className: "flex flex-1 flex-col items-center gap-1 py-3 text-xs text-primary" }}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
