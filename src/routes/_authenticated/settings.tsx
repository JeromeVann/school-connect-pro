import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatGhs, toPesewas } from "@/lib/money";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Classes & fees — SchoolPurse" },
      { name: "description", content: "Set up classes and the standard fee items you bill." },
      { property: "og:title", content: "Classes & fees — SchoolPurse" },
      {
        property: "og:description",
        content: "Set up classes and the standard fee items you bill.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const [className, setClassName] = useState("");
  const [term, setTerm] = useState("");
  const [fee, setFee] = useState({ name: "", amount: "", classId: "all" });

  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, term_label")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const feeItems = useQuery({
    queryKey: ["fee-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_items")
        .select("id, name, amount_pesewas, class_id, classes(name)")
        .order("name");
      if (error) throw error;
      return data as unknown as {
        id: string;
        name: string;
        amount_pesewas: number;
        class_id: string | null;
        classes: { name: string } | null;
      }[];
    },
  });

  const addClass = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("classes")
        .insert({ name: className.trim(), term_label: term.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      setClassName("");
      setTerm("");
      toast.success("Class added");
      void qc.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFee = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("fee_items").insert({
        name: fee.name.trim(),
        amount_pesewas: toPesewas(fee.amount),
        class_id: fee.classId === "all" ? null : fee.classId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setFee({ name: "", amount: "", classId: "all" });
      toast.success("Fee item added");
      void qc.invalidateQueries({ queryKey: ["fee-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Classes & fees">
      <div className="grid gap-5 md:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Classes</h2>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <Label htmlFor="cname">Class name</Label>
                <Input
                  id="cname"
                  placeholder="Basic 4"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="term">Term label</Label>
                <Input
                  id="term"
                  placeholder="Term 1 2026"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                onClick={() => addClass.mutate()}
                disabled={!className.trim() || addClass.isPending}
              >
                Add class
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {(classes.data ?? []).map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">{c.term_label ?? "—"}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Fee items</h2>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <Label htmlFor="fname">Fee name</Label>
                <Input
                  id="fname"
                  placeholder="Tuition"
                  value={fee.name}
                  onChange={(e) => setFee({ ...fee, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="famount">Amount (GHS)</Label>
                <Input
                  id="famount"
                  inputMode="decimal"
                  placeholder="450.00"
                  value={fee.amount}
                  onChange={(e) => setFee({ ...fee, amount: e.target.value })}
                />
              </div>
              <div>
                <Label>Applies to</Label>
                <Select value={fee.classId} onValueChange={(v) => setFee({ ...fee, classId: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {(classes.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                onClick={() => addFee.mutate()}
                disabled={!fee.name.trim() || toPesewas(fee.amount) <= 0 || addFee.isPending}
              >
                Add fee item
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {(feeItems.data ?? []).map((f) => (
              <Card key={f.id}>
                <CardContent className="flex items-center justify-between p-3 text-sm">
                  <span>
                    <span className="font-medium">{f.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {f.classes?.name ?? "All classes"}
                    </span>
                  </span>
                  <span className="font-semibold">{formatGhs(f.amount_pesewas)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
