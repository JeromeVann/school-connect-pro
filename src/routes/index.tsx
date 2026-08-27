import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Receipt, Smartphone, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SchoolPurse — School fees & parent communication" },
      {
        name: "description",
        content:
          "Manage students, issue fee invoices and reach parents instantly. Parents check balances and pay by mobile money in seconds.",
      },
      { property: "og:title", content: "SchoolPurse — School fees & parent communication" },
      {
        property: "og:description",
        content:
          "Manage students, issue fee invoices and reach parents instantly. Parents pay school fees by mobile money.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: GraduationCap,
    title: "Student records",
    body: "Classes, students and the parents linked to each of them.",
  },
  {
    icon: Receipt,
    title: "Fee invoices",
    body: "Bill one student or a whole class, with clear line items and due dates.",
  },
  {
    icon: Smartphone,
    title: "Mobile money",
    body: "Parents pay by MTN, Telecel, AirtelTigo MoMo or card. Balances update automatically.",
  },
  {
    icon: Megaphone,
    title: "Announcements",
    body: "Send notices to every parent or a single class, in-app and by email.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-4" />
          </span>
          SchoolPurse
        </div>
        <Link to="/auth">
          <Button size="sm">Sign in</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20">
        <section className="py-12 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            For schools in Ghana
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight text-foreground md:text-5xl">
            School fees, sorted. Parents informed.
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Administrators manage students and send fee invoices. Parents see exactly what they owe
            and settle it with mobile money from their phone.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg">Get started</Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline">
                Parent sign in
              </Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <article key={f.title} className="rounded-xl border border-border bg-card p-5">
              <f.icon className="size-5 text-primary" />
              <h2 className="mt-3 font-semibold text-card-foreground">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
