import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — SchoolPurse" },
      { name: "description", content: "Invoice alerts, payment receipts and school notices." },
      { property: "og:title", content: "Notifications — SchoolPurse" },
      {
        property: "og:description",
        content: "Invoice alerts, payment receipts and school notices.",
      },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const markAllRead = async () => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <AppShell title="Notifications">
      <div className="mb-3 flex justify-end">
        <Button size="sm" variant="outline" onClick={markAllRead}>
          Mark all read
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-32" />
      ) : (data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((n) => {
            const inner = (
              <Card className={n.read_at ? "opacity-70" : "border-primary/40"}>
                <CardContent className="p-4">
                  <p className="font-medium text-card-foreground">{n.title}</p>
                  {n.body ? (
                    <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            );
            return n.link?.startsWith("/invoice/") ? (
              <Link key={n.id} to="/invoice/$id" params={{ id: n.link.split("/")[2] ?? "" }}>
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
