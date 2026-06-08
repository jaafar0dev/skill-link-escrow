import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRoles } from "@/lib/hooks/useRoles";
import { LayoutDashboard, Briefcase, ShieldAlert, Settings, Gavel } from "lucide-react";

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
  const isAdmin = roles?.includes("admin");

  return (
    <div className="min-h-screen bg-background pb-24">
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-5xl">
          <NavLink to="/dashboard" icon={<LayoutDashboard className="h-5 w-5" />} label="Home" />
          <NavLink to="/jobs" icon={<Briefcase className="h-5 w-5" />} label="Jobs" />
          <NavLink to="/bids" icon={<Gavel className="h-5 w-5" />} label="Bids" />
          {isAdmin && <NavLink to="/admin" icon={<ShieldAlert className="h-5 w-5" />} label="Admin" />}
          <NavLink to="/settings" icon={<Settings className="h-5 w-5" />} label="Settings" />
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

