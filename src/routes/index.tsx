import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { InstallPrompt } from "@/components/InstallPrompt";
import { supabase } from "@/integrations/supabase/client";

const SEEN_KEY = "skillswap_install_seen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkillSwap — Escrow-protected student services" },
      { name: "description", content: "Post a project, get bids, and pay safely with built-in escrow." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate({ to: "/dashboard" });
        return;
      }
      if (!seen) {
        setShowInstall(true);
      } else {
        navigate({ to: "/auth" });
      }
      setReady(true);
    });
  }, [navigate]);

  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-background" />;

  if (showInstall) {
    return (
      <InstallPrompt
        onDone={() => {
          localStorage.setItem(SEEN_KEY, "1");
          navigate({ to: "/auth" });
        }}
      />
    );
  }
  return null;
}
