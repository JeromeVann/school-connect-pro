import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "parent";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      const currentUser = data.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", currentUser.id);
        if (!active) return;
        const list = (roles ?? []).map((r) => r.role as AppRole);
        setRole(list.includes("admin") ? "admin" : list.includes("parent") ? "parent" : null);
      } else {
        setRole(null);
      }
      setLoading(false);
    };

    void load();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setLoading(true);
        void load();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, role, loading, isAdmin: role === "admin" };
}
