import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatGhs } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/children")({
  head: () => ({
    meta: [
      { title: "Your children — SchoolPurse" },
      { name: "description", content: "Balances and invoices for each of your children." },
      { property: "og:title", content: "Your children — SchoolPurse" },
      { property: "og:description", content: "Balances and invoices for each of your children." },
    ],
  }),
  component: ChildrenPage,
});

function ChildrenPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["children-detail"],
    queryFn: async () => {
      const { data: guardians } = await supabase
        .from("guardians")
        .select("student_id, relationship, students(id, first_name, last_name, classes(name))");
      const ids = (guardians ?? []).map((g) => g.student_id as string);
      const invoices = ids.length
        ? (
            await supabase
              .from("invoices")
              .select("id, student_id, title, total_pesewas, status, due_date")
              .in("student_id", ids)
              .order("created_at", { ascending: false })
          ).data ?? []
        : [];
      const payments = ids.length
        ? (
            await supabase
              .from("payments")
              .select("invoice_id, amount_pesewas, status")
              .in("student_id", ids)
          ).data ?? []
        : [];
      const paidByInvoice = new Map<string, number>();
      for (const p of payments) {
        if (p.status !== "success") continue;
        paidByInvoice.set(
          p.invoice_id as string,
          (paidByInvoice.get(p.invoice_id as string) ?? 0) + Number(p.amount_pesewas),
        );
      }
      return (guardians ?? []).map((g) => {
        const student = g.students as unknown as {
          id: string;
          first_name: string;
          last_name: string;
          classes: { name: string } | null;
        } | null;
        const own = invoices
          .filter((i) => i.student_id === g.student_id)
          .map((i) => ({
            ...i,
            outstanding: Math.max(
              Number(i.total_pesewas) - (paidByInvoice.get(i.id as string) ?? 0),
              0,
            ),
          }));
        return {
          student,
          relationship: g.relationship,
          invoices: own,
          balance: own.reduce((s, i) => s + i.outstanding, 0),
        };
      });
    },
  });

  if (isLoading) {
    return (
      <AppShell title="Your children">
        <Skeleton className="h-40" />
      </AppShell>
    );
  }

  return (
    <AppShell title="Your children">
      {(data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No children linked to your account yet. The school office can link you.
        </p>
      ) : (
        <div className="space-y-5">
          {(data ?? []).map((c) => (
            <section key={c.student?.id ?? Math.random()}>
              <div className="mb-2 flex items-end justify-between">
                <div>
                  <h2 className="font-semibold text-foreground">
                    {c.student?.first_name} {c.student?.last_name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {c.student?.classes?.name ?? "No class"}
                    {c.relationship ? ` · ${c.relationship}` : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold">{formatGhs(c.balance)} due</span>
              </div>
              {c.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                <div className="space-y-2">
                  {c.invoices.map((i) => (
                    <Link key={i.id as string} to="/invoice/$id" params={{ id: i.id as string }}>
                      <Card className="transition-colors hover:border-primary">
                        <CardContent className="flex items-center justify-between p-4">
                          <div>
                            <p className="font-medium text-card-foreground">{i.title as string}</p>
                            <p className="text-xs text-muted-foreground">
                              {i.due_date ? `Due ${i.due_date as string}` : "No due date"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatGhs(i.outstanding)}</p>
                            <Badge variant="secondary" className="mt-1 text-[10px]">
                              {i.status as string}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
