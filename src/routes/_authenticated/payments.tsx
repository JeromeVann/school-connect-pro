import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatGhs } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments — SchoolPurse" },
      { name: "description", content: "Every mobile money, card and cash payment in one ledger." },
      { property: "og:title", content: "Payments — SchoolPurse" },
      {
        property: "og:description",
        content: "Every mobile money, card and cash payment in one ledger.",
      },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, amount_pesewas, method, channel, status, reference, created_at, students(first_name, last_name), invoices(title)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as {
        id: string;
        amount_pesewas: number;
        method: string;
        channel: string | null;
        status: string;
        reference: string | null;
        created_at: string;
        students: { first_name: string; last_name: string } | null;
        invoices: { title: string } | null;
      }[];
    },
  });

  return (
    <AppShell title="Payments">
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : (data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-card-foreground">
                    {p.students ? `${p.students.first_name} ${p.students.last_name}` : "Student"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.invoices?.title ?? "Invoice"} · {p.channel ?? p.method}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleString()}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatGhs(p.amount_pesewas)}</p>
                  <Badge
                    variant={p.status === "success" ? "default" : "secondary"}
                    className="mt-1 text-[10px]"
                  >
                    {p.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
