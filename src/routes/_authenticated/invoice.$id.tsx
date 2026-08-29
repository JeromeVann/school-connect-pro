import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { recordManualPayment, startInvoicePayment } from "@/lib/paystack.functions";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatGhs, toPesewas } from "@/lib/money";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/invoice/$id")({
  head: () => ({
    meta: [
      { title: "Invoice — SchoolPurse" },
      { name: "description", content: "Invoice details, payments and mobile money checkout." },
      { property: "og:title", content: "Invoice — SchoolPurse" },
      {
        property: "og:description",
        content: "Invoice details, payments and mobile money checkout.",
      },
    ],
  }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const pay = useServerFn(startInvoicePayment);
  const record = useServerFn(recordManualPayment);
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState({ amount: "", method: "cash", reference: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data: invoice, error } = await supabase
        .from("invoices")
        .select(
          "id, title, status, total_pesewas, due_date, students(first_name, last_name, classes(name))",
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      const lines =
        (await supabase.from("invoice_lines").select("*").eq("invoice_id", id)).data ?? [];
      const payments =
        (
          await supabase
            .from("payments")
            .select("id, amount_pesewas, status, method, channel, created_at")
            .eq("invoice_id", id)
            .order("created_at", { ascending: false })
        ).data ?? [];
      const paid = payments
        .filter((p) => p.status === "success")
        .reduce((s, p) => s + Number(p.amount_pesewas), 0);
      return {
        invoice: invoice as unknown as {
          id: string;
          title: string;
          status: string;
          total_pesewas: number;
          due_date: string | null;
          students: {
            first_name: string;
            last_name: string;
            classes: { name: string } | null;
          } | null;
        },
        lines,
        payments,
        outstanding: Math.max(Number(invoice.total_pesewas) - paid, 0),
      };
    },
  });

  const startPay = useMutation({
    mutationFn: async () => {
      const result = await pay({
        data: { invoiceId: id, callbackUrl: window.location.href },
      });
      window.location.href = result.authorizationUrl;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveManual = useMutation({
    mutationFn: async () =>
      record({
        data: {
          invoiceId: id,
          amountPesewas: toPesewas(manual.amount),
          method: manual.method as "cash" | "bank" | "momo",
          reference: manual.reference.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Payment recorded");
      setManual({ amount: "", method: "cash", reference: "" });
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["invoice", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <AppShell title="Invoice">
        <Skeleton className="h-40" />
      </AppShell>
    );
  }

  const { invoice, lines, payments, outstanding } = data;

  return (
    <AppShell title={invoice.title}>
      <div className="space-y-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  {invoice.students
                    ? `${invoice.students.first_name} ${invoice.students.last_name}`
                    : "Student"}
                  {invoice.students?.classes?.name ? ` · ${invoice.students.classes.name}` : ""}
                </p>
                <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
                  Outstanding
                </p>
                <p className="text-3xl font-semibold text-card-foreground">
                  {formatGhs(outstanding)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Total {formatGhs(invoice.total_pesewas)}
                  {invoice.due_date ? ` · due ${invoice.due_date}` : ""}
                </p>
              </div>
              <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                {invoice.status}
              </Badge>
            </div>

            {outstanding > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {!isAdmin ? (
                  <Button onClick={() => startPay.mutate()} disabled={startPay.isPending}>
                    Pay with MoMo or card
                  </Button>
                ) : null}
                {isAdmin ? (
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline">Record payment</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Record a payment</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="amt">Amount (GHS)</Label>
                          <Input
                            id="amt"
                            inputMode="decimal"
                            value={manual.amount}
                            onChange={(e) => setManual({ ...manual, amount: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Method</Label>
                          <Select
                            value={manual.method}
                            onValueChange={(v) => setManual({ ...manual, method: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="bank">Bank transfer</SelectItem>
                              <SelectItem value="momo">Mobile money</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="ref">Reference</Label>
                          <Input
                            id="ref"
                            value={manual.reference}
                            onChange={(e) => setManual({ ...manual, reference: e.target.value })}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => saveManual.mutate()}
                          disabled={toPesewas(manual.amount) <= 0 || saveManual.isPending}
                        >
                          Save
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Items</h2>
          <div className="space-y-2">
            {lines.map((l) => (
              <Card key={l.id as string}>
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <span>
                    {l.description as string}
                    {Number(l.quantity) > 1 ? ` × ${Number(l.quantity)}` : ""}
                  </span>
                  <span className="font-medium">
                    {formatGhs(Number(l.quantity) * Number(l.unit_amount_pesewas))}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Payments</h2>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <Card key={p.id as string}>
                  <CardContent className="flex items-center justify-between p-3 text-sm">
                    <span>
                      <span className="font-medium">{formatGhs(Number(p.amount_pesewas))}</span>
                      <span className="ml-2 text-muted-foreground">
                        {(p.channel as string) ?? (p.method as string)}
                      </span>
                    </span>
                    <Badge
                      variant={p.status === "success" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {p.status as string}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
