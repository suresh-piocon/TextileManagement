import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function generateVoucherNo(prefix: string = "V", number: number | string = 1): string {
  const num = typeof number === "number" ? number : parseInt(number) || 1;
  return `${prefix}${num.toString().padStart(4, "0")}`;
}

export function roundOff(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function calculateGST(
  amount: number,
  cgstPerc: number,
  sgstPerc: number,
  igstPerc: number,
  isInterState: boolean
) {
  if (isInterState) {
    const igstAmt = roundOff((amount * igstPerc) / 100);
    return { cgstAmt: 0, sgstAmt: 0, igstAmt, totalTax: igstAmt };
  }
  const cgstAmt = roundOff((amount * cgstPerc) / 100);
  const sgstAmt = roundOff((amount * sgstPerc) / 100);
  return { cgstAmt, sgstAmt, igstAmt: 0, totalTax: cgstAmt + sgstAmt };
}
