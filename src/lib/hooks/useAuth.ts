import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const applySession = (s: Session | null) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    };

    try {
      const auth = supabase?.auth;
      const subscriptionResult = auth?.onAuthStateChange?.((_event, s) => {
        applySession(s ?? null);
      });
      const subscription = subscriptionResult?.data?.subscription;

      auth?.getSession?.()
        .then((result) => {
          const s = result?.data?.session ?? null;
          applySession(s);
        })
        .catch(() => {
          applySession(null);
        });

      return () => {
        subscription?.unsubscribe?.();
      };
    } catch {
      applySession(null);
      return undefined;
    }
  }, []);

  return { session, user, loading };
}
