import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LinkParentInput = z.object({
  studentId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().optional(),
  relationship: z.string().optional(),
});

const NotifyInvoicesInput = z.object({
  invoiceIds: z.array(z.string().uuid()).min(1).max(500),
});

const AnnouncementInput = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  classId: z.string().uuid().nullable().optional(),
});

export const linkParentToStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LinkParentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, findOrCreateParent, insertNotifications } = await import(
      "@/lib/school.server"
    );
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const parentId = await findOrCreateParent(
      supabaseAdmin,
      data.email,
      data.fullName ?? null,
    );

    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", parentId)
      .eq("role", "parent")
      .maybeSingle();
    if (!existingRole) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: parentId, role: "parent" });
      if (roleError) throw new Error(roleError.message);
    }

    const { data: existingLink } = await supabaseAdmin
      .from("guardians")
      .select("id")
      .eq("parent_id", parentId)
      .eq("student_id", data.studentId)
      .maybeSingle();
    if (!existingLink) {
      const { error } = await supabaseAdmin.from("guardians").insert({
        parent_id: parentId,
        student_id: data.studentId,
        relationship: data.relationship ?? null,
      });
      if (error) throw new Error(error.message);
    }

    await insertNotifications(supabaseAdmin, [
      {
        user_id: parentId,
        type: "linked",
        title: "You were linked to a student",
        body: "You can now see fee invoices and school notices for your child.",
        link: "/children",
      },
    ]);

    return { parentId };
  });

export const notifyInvoicesIssued = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NotifyInvoicesInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, parentsForStudents, insertNotifications } = await import(
      "@/lib/school.server"
    );
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invoices, error } = await supabaseAdmin
      .from("invoices")
      .select("id, title, student_id, total_pesewas, due_date")
      .in("id", data.invoiceIds);
    if (error) throw new Error(error.message);

    const map = await parentsForStudents(
      supabaseAdmin,
      (invoices ?? []).map((i) => i.student_id as string),
    );

    const rows = (invoices ?? []).flatMap((invoice) =>
      (map.get(invoice.student_id as string) ?? []).map((parentId) => ({
        user_id: parentId,
        type: "invoice",
        title: `New invoice: ${invoice.title as string}`,
        body: `Amount due ${((invoice.total_pesewas as number) / 100).toFixed(2)} GHS${
          invoice.due_date ? ` by ${invoice.due_date as string}` : ""
        }.`,
        link: `/invoice/${invoice.id as string}`,
      })),
    );

    const sent = await insertNotifications(supabaseAdmin, rows);
    return { notified: sent };
  });

export const publishAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnnouncementInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, audienceForAnnouncement, insertNotifications } = await import(
      "@/lib/school.server"
    );
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const classId = data.classId ?? null;
    const { data: announcement, error } = await supabaseAdmin
      .from("announcements")
      .insert({
        title: data.title,
        body: data.body,
        class_id: classId,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const audience = await audienceForAnnouncement(supabaseAdmin, classId);
    const sent = await insertNotifications(
      supabaseAdmin,
      audience.map((parentId) => ({
        user_id: parentId,
        type: "announcement",
        title: data.title,
        body: data.body.slice(0, 200),
        link: "/announcements",
      })),
    );

    return { announcementId: announcement.id as string, notified: sent };
  });
