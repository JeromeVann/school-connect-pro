import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYSTACK_SECRET_KEY"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const expected = createHmac("sha512", secret).update(raw).digest("hex");
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(raw) as {
          event?: string;
          data?: {
            reference?: string;
            amount?: number;
            channel?: string;
            status?: string;
            paid_at?: string;
          };
        };

        const reference = event.data?.reference;
        if (!reference) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("id, invoice_id, student_id, status, amount_pesewas")
          .eq("reference", reference)
          .maybeSingle();
        if (!payment) return new Response("ok");

        if (event.event === "charge.success" && event.data?.status === "success") {
          if (payment.status === "success") return new Response("ok");
          await supabaseAdmin
            .from("payments")
            .update({
              status: "success",
              channel: event.data.channel ?? null,
              amount_pesewas: event.data.amount ?? payment.amount_pesewas,
              paid_at: event.data.paid_at ?? new Date().toISOString(),
            })
            .eq("id", payment.id);

          const { data: invoice } = await supabaseAdmin
            .from("invoices")
            .select("title")
            .eq("id", payment.invoice_id)
            .maybeSingle();

          const { data: guardians } = await supabaseAdmin
            .from("guardians")
            .select("parent_id")
            .eq("student_id", payment.student_id);

          const rows = (guardians ?? []).map((g) => ({
            user_id: g.parent_id as string,
            type: "payment",
            title: "Payment received",
            body: `${(((event.data?.amount ?? payment.amount_pesewas) as number) / 100).toFixed(2)} GHS received for ${
              (invoice?.title as string) ?? "your invoice"
            }.`,
            link: `/invoice/${payment.invoice_id as string}`,
          }));
          if (rows.length > 0) await supabaseAdmin.from("notifications").insert(rows);
        } else if (event.event === "charge.failed") {
          await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", payment.id);
        }

        return new Response("ok");
      },
    },
  },
});
