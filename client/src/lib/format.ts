const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number): string => moneyFormatter.format(value);

export const formatCategory = (value: string): string =>
  value
    .split("-")
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
