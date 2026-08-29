import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { publishAnnouncement } from "@/lib/school.functions";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — SchoolPurse" },
      { name: "description", content: "School notices sent straight to every parent." },
      { property: "og:title", content: "Announcements — SchoolPurse" },
      { property: "og:description", content: "School notices sent straight to every parent." },
    ],
  }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const publish = useServerFn(publishAnnouncement);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", classId: "all" });

  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: async () =>
      (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const announcements = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, created_at, classes(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as {
        id: string;
        title: string;
        body: string;
        created_at: string;
        classes: { name: string } | null;
      }[];
    },
  });

  const send = useMutation({
    mutationFn: async () =>
      publish({
        data: {
          title: form.title.trim(),
          body: form.body.trim(),
          classId: form.classId === "all" ? null : form.classId,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Notice posted · ${r.notified} parent alert(s) sent`);
      setForm({ title: "", body: "", classId: "all" });
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Announcements">
      {isAdmin ? (
        <div className="mb-4 flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">New notice</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Post an announcement</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="atitle">Title</Label>
                  <Input
                    id="atitle"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="abody">Message</Label>
                  <Textarea
                    id="abody"
                    rows={5}
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Audience</Label>
                  <Select
                    value={form.classId}
                    onValueChange={(v) => setForm({ ...form, classId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Whole school</SelectItem>
                      {(classes.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => send.mutate()}
                  disabled={!form.title.trim() || !form.body.trim() || send.isPending}
                >
                  Post & notify
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}

      {announcements.isLoading ? (
        <Skeleton className="h-32" />
      ) : (announcements.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No notices yet.</p>
      ) : (
        <div className="space-y-2">
          {(announcements.data ?? []).map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-card-foreground">{a.title}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
                <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {a.classes?.name ?? "Whole school"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
