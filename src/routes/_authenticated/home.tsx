import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Receipt, Users, Wallet, Settings, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { formatGhs } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Dashboard — SchoolPurse" },
      { name: "description", content: "Fee balances, invoices and school notices at a glance." },
      { property: "og:title", content: "Dashboard — SchoolPurse" },
      {
        property: "og:description",
        content: "Fee balances, invoices and school notices at a glance.",
      },
    ],
  }),
  component: HomePage,
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-card-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function AdminHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-summary"],
    queryFn: async () => {
      const [invoices, payments, students] = await Promise.all([
        supabase.from("invoices").select("id, total_pesewas, status"),
        supabase.from("payments").select("amount_pesewas, status, created_at"),
        supabase.from("students").select("id"),
      ]);
      const invoiceRows = invoices.data ?? [];
      const paidTotal = (payments.data ?? [])
        .filter((p) => p.status === "success")
        .reduce((s, p) => s + Number(p.amount_pesewas), 0);
      const billed = invoiceRows.reduce((s, i) => s + Number(i.total_pesewas), 0);
      return {
        outstanding: Math.max(billed - paidTotal, 0),
        collected: paidTotal,
        unpaid: invoiceRows.filter((i) => i.status !== "paid").length,
        students: (students.data ?? []).length,
      };
    },
  });

  const links = [
    { to: "/students", label: "Students & parents", icon: Users },
    { to: "/invoices", label: "Invoices", icon: Receipt },
    { to: "/payments", label: "Payments", icon: Wallet },
    { to: "/announcements", label: "Announcements", icon: Megaphone },
    { to: "/settings", label: "Classes & fee items", icon: Settings },
  ] as const;

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Outstanding" value={formatGhs(data?.outstanding)} />
          <Stat label="Collected" value={formatGhs(data?.collected)} />
          <Stat label="Unpaid invoices" value={String(data?.unpaid ?? 0)} />
          <Stat label="Students" value={String(data?.students ?? 0)} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <Link key={l.to} to={l.to}>
            <Card className="transition-colors hover:border-primary">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
                  <l.icon className="size-4" />
                </span>
                <span className="font-medium text-card-foreground">{l.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ParentHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["parent-summary"],
    queryFn: async () => {
      const { data: guardians } = await supabase
        .from("guardians")
        .select("student_id, students(id, first_name, last_name, classes(name))");
      const studentIds = (guardians ?? []).map((g) => g.student_id as string);
      const { data: invoices } = studentIds.length
        ? await supabase
            .from("invoices")
            .select("id, student_id, title, total_pesewas, status, due_date")
            .in("student_id", studentIds)
        : { data: [] };
      const { data: payments } = studentIds.length
        ? await supabase
            .from("payments")
            .select("invoice_id, amount_pesewas, status")
            .in("student_id", studentIds)
        : { data: [] };

      const paidByInvoice = new Map<string, number>();
      for (const p of payments ?? []) {
        if (p.status !== "success") continue;
        paidByInvoice.set(
          p.invoice_id as string,
          (paidByInvoice.get(p.invoice_id as string) ?? 0) + Number(p.amount_pesewas),
        );
      }

      const children = (guardians ?? []).map((g) => {
        const student = g.students as unknown as {
          id: string;
          first_name: string;
          last_name: string;
          classes: { name: string } | null;
        } | null;
        const own = (invoices ?? []).filter((i) => i.student_id === g.student_id);
        const balance = own.reduce(
          (sum, i) =>
            sum + Math.max(Number(i.total_pesewas) - (paidByInvoice.get(i.id as string) ?? 0), 0),
          0,
        );
        return { student, balance };
      });

      const openInvoices = (invoices ?? [])
        .filter((i) => i.status !== "paid")
        .slice(0, 5)
        .map((i) => ({
          ...i,
          outstanding: Number(i.total_pesewas) - (paidByInvoice.get(i.id as string) ?? 0),
        }));

      return { children, openInvoices };
    },
  });

  if (isLoading) return <Skeleton className="h-40" />;

  const total = (data?.children ?? []).reduce((s, c) => s + c.balance, 0);

  return (
    <div className="space-y-5">
      <Card className="border-primary/30 bg-primary text-primary-foreground">
        <CardContent className="p-5">
          <p className="text-xs uppercase tracking-widest opacity-80">Total balance</p>
          <p className="mt-1 text-3xl font-semibold">{formatGhs(total)}</p>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Your children</h2>
        {(data?.children ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No children linked yet. Ask the school office to link your account.
          </p>
        ) : (
          <div className="space-y-2">
            {(data?.children ?? []).map((c) => (
              <Card key={c.student?.id ?? Math.random()}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-primary">
                      <GraduationCap className="size-4" />
                    </span>
                    <div>
                      <p className="font-medium text-card-foreground">
                        {c.student?.first_name} {c.student?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.student?.classes?.name ?? "No class"}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold">{formatGhs(c.balance)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Invoices to settle</h2>
        {(data?.openInvoices ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Everything is paid up. Nice.</p>
        ) : (
          <div className="space-y-2">
            {(data?.openInvoices ?? []).map((i) => (
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
    </div>
  );
}

function HomePage() {
  const { isAdmin, loading } = useAuth();
  return (
    <AppShell title={isAdmin ? "School dashboard" : "Your fees"}>
      {loading ? <Skeleton className="h-40" /> : isAdmin ? <AdminHome /> : <ParentHome />}
    </AppShell>
  );
}
