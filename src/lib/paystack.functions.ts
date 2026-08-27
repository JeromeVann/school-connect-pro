import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InitInput = z.object({
  invoiceId: z.string().uuid(),
  amountPesewas: z.number().int().positive().max(100_000_000).optional(),
  callbackUrl: z.string().url(),
});

const ManualPaymentInput = z.object({
  invoiceId: z.string().uuid(),
  amountPesewas: z.number().int().positive().max(100_000_000),
  method: z.enum(["cash", "bank", "momo"]),
  reference: z.string().max(120).optional(),
});

export const startInvoicePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InitInput.parse(input))
  .handler(async ({ data, context }) => {
    const secret = process.env["PAYSTACK_SECRET_KEY"];
    if (!secret) throw new Error("Payments are not configured yet. Add the Paystack secret key.");

    // RLS: this read only succeeds for an admin or a linked parent.
    const { data: invoice, error } = await context.supabase
      .from("invoices")
      .select("id, title, student_id, total_pesewas, status")
      .eq("id", data.invoiceId)
      .single();
    if (error || !invoice) throw new Error("Invoice not found");

    const { data: paid } = await context.supabase
      .from("payments")
      .select("amount_pesewas")
      .eq("invoice_id", data.invoiceId)
      .eq("status", "success");
    const paidTotal = (paid ?? []).reduce((sum, p) => sum + Number(p.amount_pesewas), 0);
    const outstanding = Number(invoice.total_pesewas) - paidTotal;
    if (outstanding <= 0) throw new Error("This invoice is already fully paid");

    const amount = Math.min(data.amountPesewas ?? outstanding, outstanding);
    const reference = `SP-${data.invoiceId.slice(0, 8)}-${Date.now()}`;

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .maybeSingle();

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: profile?.email ?? `${context.userId}@parent.local`,
        amount,
        currency: "GHS",
        reference,
        callback_url: data.callbackUrl,
        channels: ["mobile_money", "card"],
        metadata: { invoice_id: data.invoiceId, student_id: invoice.student_id },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Paystack initialize failed [${response.status}]: ${text}`);
      throw new Error(`Could not start the payment [${response.status}]`);
    }

    const payload = (await response.json()) as {
      status: boolean;
      message?: string;
      data?: { authorization_url: string };
    };
    if (!payload.status || !payload.data?.authorization_url) {
      throw new Error(payload.message ?? "Could not start the payment");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insertError } = await supabaseAdmin.from("payments").insert({
      invoice_id: data.invoiceId,
      student_id: invoice.student_id,
      amount_pesewas: amount,
      method: "momo",
      reference,
      status: "pending",
      paid_by: context.userId,
    });
    if (insertError) throw new Error(insertError.message);

    return { authorizationUrl: payload.data.authorization_url, reference };
  });

export const recordManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ManualPaymentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, parentsForStudents, insertNotifications } = await import(
      "@/lib/school.server"
    );
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invoice, error } = await supabaseAdmin
      .from("invoices")
      .select("id, title, student_id")
      .eq("id", data.invoiceId)
      .single();
    if (error || !invoice) throw new Error("Invoice not found");

    const { error: insertError } = await supabaseAdmin.from("payments").insert({
      invoice_id: data.invoiceId,
      student_id: invoice.student_id,
      amount_pesewas: data.amountPesewas,
      method: data.method,
      channel: "manual",
      reference: data.reference || `MAN-${Date.now()}`,
      status: "success",
      paid_at: new Date().toISOString(),
      recorded_by: context.userId,
    });
    if (insertError) throw new Error(insertError.message);

    const map = await parentsForStudents(supabaseAdmin, [invoice.student_id as string]);
    await insertNotifications(
      supabaseAdmin,
      (map.get(invoice.student_id as string) ?? []).map((parentId) => ({
        user_id: parentId,
        type: "payment",
        title: "Payment recorded",
        body: `${(data.amountPesewas / 100).toFixed(2)} GHS received for ${invoice.title as string}.`,
        link: `/invoice/${data.invoiceId}`,
      })),
    );

    return { ok: true };
  });
