import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { linkParentToStudent } from "@/lib/school.functions";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Students — SchoolPurse" },
      { name: "description", content: "Add students, assign classes and link parent accounts." },
      { property: "og:title", content: "Students — SchoolPurse" },
      {
        property: "og:description",
        content: "Add students, assign classes and link parent accounts.",
      },
    ],
  }),
  component: StudentsPage,
});

type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  student_code: string | null;
  class_id: string | null;
  classes: { name: string } | null;
};

function StudentsPage() {
  const qc = useQueryClient();
  const linkParent = useServerFn(linkParentToStudent);
  const [addOpen, setAddOpen] = useState(false);
  const [linkFor, setLinkFor] = useState<StudentRow | null>(null);
  const [form, setForm] = useState({ first: "", last: "", code: "", classId: "" });
  const [parentForm, setParentForm] = useState({ email: "", fullName: "", relationship: "" });

  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const students = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, student_code, class_id, classes(name)")
        .order("last_name");
      if (error) throw error;
      return data as unknown as StudentRow[];
    },
  });

  const guardians = useQuery({
    queryKey: ["guardians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guardians")
        .select("student_id, relationship, profiles:parent_id(full_name, email)");
      if (error) throw error;
      return data as unknown as {
        student_id: string;
        relationship: string | null;
        profiles: { full_name: string | null; email: string | null } | null;
      }[];
    },
  });

  const addStudent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("students").insert({
        first_name: form.first.trim(),
        last_name: form.last.trim(),
        student_code: form.code.trim() || null,
        class_id: form.classId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Student added");
      setForm({ first: "", last: "", code: "", classId: "" });
      setAddOpen(false);
      void qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const link = useMutation({
    mutationFn: async () => {
      if (!linkFor) return;
      await linkParent({
        data: {
          studentId: linkFor.id,
          email: parentForm.email.trim(),
          fullName: parentForm.fullName.trim() || undefined,
          relationship: parentForm.relationship.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Parent linked");
      setParentForm({ email: "", fullName: "", relationship: "" });
      setLinkFor(null);
      void qc.invalidateQueries({ queryKey: ["guardians"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Students">
      <div className="mb-4 flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Add student</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New student</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="first">First name</Label>
                  <Input
                    id="first"
                    value={form.first}
                    onChange={(e) => setForm({ ...form, first: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="last">Last name</Label>
                  <Input
                    id="last"
                    value={form.last}
                    onChange={(e) => setForm({ ...form, last: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="code">Student code</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div>
                <Label>Class</Label>
                <Select
                  value={form.classId}
                  onValueChange={(v) => setForm({ ...form, classId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a class" />
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
            </div>
            <DialogFooter>
              <Button
                onClick={() => addStudent.mutate()}
                disabled={!form.first.trim() || !form.last.trim() || addStudent.isPending}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {students.isLoading ? (
        <Skeleton className="h-40" />
      ) : (students.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No students yet. Add classes in settings first, then add students here.
        </p>
      ) : (
        <div className="space-y-2">
          {(students.data ?? []).map((s) => {
            const linked = (guardians.data ?? []).filter((g) => g.student_id === s.id);
            return (
              <Card key={s.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-card-foreground">
                      {s.first_name} {s.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.classes?.name ?? "No class"}
                      {s.student_code ? ` · ${s.student_code}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {linked.length === 0
                        ? "No parent linked"
                        : linked
                            .map((g) => g.profiles?.full_name || g.profiles?.email || "Parent")
                            .join(", ")}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setLinkFor(s)}>
                    Link parent
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!linkFor} onOpenChange={(o) => !o && setLinkFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Link a parent to {linkFor?.first_name} {linkFor?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pemail">Parent email</Label>
              <Input
                id="pemail"
                type="email"
                value={parentForm.email}
                onChange={(e) => setParentForm({ ...parentForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="pname">Parent name</Label>
              <Input
                id="pname"
                value={parentForm.fullName}
                onChange={(e) => setParentForm({ ...parentForm, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="prel">Relationship</Label>
              <Input
                id="prel"
                placeholder="Mother, father, guardian"
                value={parentForm.relationship}
                onChange={(e) => setParentForm({ ...parentForm, relationship: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              If the parent has no account yet, one is created for them. They sign in with this
              email using the password reset link on the sign-in page.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => link.mutate()}
              disabled={!parentForm.email.trim() || link.isPending}
            >
              Link parent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
