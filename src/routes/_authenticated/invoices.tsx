import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyInvoicesIssued } from "@/lib/school.functions";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatGhs } from "@/lib/money";
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

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — SchoolPurse" },
      { name: "description", content: "Create fee invoices and notify parents instantly." },
      { property: "og:title", content: "Invoices — SchoolPurse" },
      { property: "og:description", content: "Create fee invoices and notify parents instantly." },
    ],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const qc = useQueryClient();
  const notify = useServerFn(notifyInvoicesIssued);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    scope: "class" as "class" | "student",
    classId: "",
    studentId: "",
    feeItemId: "",
    title: "",
    dueDate: "",
  });

  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const students = useQuery({
    queryKey: ["students"],
    queryFn: async () =>
      (
        await supabase
          .from("students")
          .select("id, first_name, last_name, class_id")
          .order("last_name")
      ).data ?? [],
  });

  const feeItems = useQuery({
    queryKey: ["fee-items"],
    queryFn: async () =>
      (await supabase.from("fee_items").select("id, name, amount_pesewas, class_id").order("name"))
        .data ?? [],
  });

  const invoices = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, title, status, total_pesewas, due_date, students(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as {
        id: string;
        title: string;
        status: string;
        total_pesewas: number;
        due_date: string | null;
        students: { first_name: string; last_name: string } | null;
      }[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const fee = (feeItems.data ?? []).find((f) => f.id === form.feeItemId);
      if (!fee) throw new Error("Pick a fee item");
      const targets =
        form.scope === "student"
          ? (students.data ?? []).filter((s) => s.id === form.studentId)
          : (students.data ?? []).filter((s) => s.class_id === form.classId);
      if (targets.length === 0) throw new Error("No students selected");

      const title = form.title.trim() || fee.name;
      const { data: created, error } = await supabase
        .from("invoices")
        .insert(
          targets.map((s) => ({
            student_id: s.id,
            title,
            due_date: form.dueDate || null,
          })),
        )
        .select("id");
      if (error) throw error;

      const { error: lineError } = await supabase.from("invoice_lines").insert(
        (created ?? []).map((inv) => ({
          invoice_id: inv.id,
          description: fee.name,
          quantity: 1,
          unit_amount_pesewas: fee.amount_pesewas,
        })),
      );
      if (lineError) throw lineError;

      const ids = (created ?? []).map((i) => i.id as string);
      const result = await notify({ data: { invoiceIds: ids } });
      return { count: ids.length, notified: result.notified };
    },
    onSuccess: (r) => {
      toast.success(`${r.count} invoice(s) created · ${r.notified} parent alert(s) sent`);
      setOpen(false);
      setForm({ ...form, feeItemId: "", title: "", dueDate: "" });
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Invoices">
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">New invoice</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Issue invoices</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Bill</Label>
                <Select
                  value={form.scope}
                  onValueChange={(v) => setForm({ ...form, scope: v as "class" | "student" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">A whole class</SelectItem>
                    <SelectItem value="student">One student</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.scope === "class" ? (
                <div>
                  <Label>Class</Label>
                  <Select
                    value={form.classId}
                    onValueChange={(v) => setForm({ ...form, classId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {(classes.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label>Student</Label>
                  <Select
                    value={form.studentId}
                    onValueChange={(v) => setForm({ ...form, studentId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {(students.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.first_name} {s.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Fee item</Label>
                <Select
                  value={form.feeItemId}
                  onValueChange={(v) => setForm({ ...form, feeItemId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fee" />
                  </SelectTrigger>
                  <SelectContent>
                    {(feeItems.data ?? []).map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name} · {formatGhs(f.amount_pesewas)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ititle">Invoice title</Label>
                <Input
                  id="ititle"
                  placeholder="Term 1 tuition"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="idue">Due date</Label>
                <Input
                  id="idue"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => create.mutate()}
                disabled={
                  create.isPending ||
                  !form.feeItemId ||
                  (form.scope === "class" ? !form.classId : !form.studentId)
                }
              >
                Create & notify
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {invoices.isLoading ? (
        <Skeleton className="h-40" />
      ) : (invoices.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices yet.</p>
      ) : (
        <div className="space-y-2">
          {(invoices.data ?? []).map((i) => (
            <Link key={i.id} to="/invoice/$id" params={{ id: i.id }}>
              <Card className="transition-colors hover:border-primary">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-card-foreground">{i.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.students ? `${i.students.first_name} ${i.students.last_name}` : "Student"}
                      {i.due_date ? ` · due ${i.due_date}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatGhs(i.total_pesewas)}</p>
                    <Badge
                      variant={i.status === "paid" ? "default" : "secondary"}
                      className="mt-1 text-[10px]"
                    >
                      {i.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
