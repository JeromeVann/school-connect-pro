export function formatGhs(pesewas: number | null | undefined): string {
  const value = (pesewas ?? 0) / 100;
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(value);
}

export function toPesewas(input: string | number): number {
  const n = typeof input === "number" ? input : Number.parseFloat(input);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}
