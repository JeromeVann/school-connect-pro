import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationInput = {
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

/** Insert in-app notifications with the privileged client. */
export async function insertNotifications(
  admin: SupabaseClient,
  rows: NotificationInput[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const { error } = await admin.from("notifications").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

/** Parent user ids for a set of students. */
export async function parentsForStudents(
  admin: SupabaseClient,
  studentIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (studentIds.length === 0) return map;
  const { data, error } = await admin
    .from("guardians")
    .select("parent_id, student_id")
    .in("student_id", studentIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const list = map.get(row.student_id as string) ?? [];
    list.push(row.parent_id as string);
    map.set(row.student_id as string, list);
  }
  return map;
}

/** Parent user ids that should receive an announcement (class-scoped or school-wide). */
export async function audienceForAnnouncement(
  admin: SupabaseClient,
  classId: string | null,
): Promise<string[]> {
  let studentQuery = admin.from("students").select("id");
  if (classId) studentQuery = studentQuery.eq("class_id", classId);
  const { data: students, error } = await studentQuery;
  if (error) throw new Error(error.message);
  const ids = (students ?? []).map((s) => s.id as string);
  const map = await parentsForStudents(admin, ids);
  return Array.from(new Set(Array.from(map.values()).flat()));
}

export async function assertAdmin(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: administrators only");
}

/** Find an existing auth user by email, or create one (parents added by the school). */
export async function findOrCreateParent(
  admin: SupabaseClient,
  email: string,
  fullName: string | null,
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();
  if (existingProfile?.id) return existingProfile.id as string;

  const { data, error } = await admin.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not create the parent account");
  return data.user.id;
}
