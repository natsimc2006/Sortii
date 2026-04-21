import AsyncStorage from "@react-native-async-storage/async-storage";

export const BILLS_KEY = "@sortii_bills_v1";

export type BillType       = "recurring" | "oneOff";
export type RecurrenceType = "Weekly" | "Fortnightly" | "Monthly" | "Quarterly" | "Yearly";
export type EssentialLevel = "Essential" | "Flexible" | "Can Wait";

export interface Bill {
  id: string;
  title: string;
  category: string;
  amount: number;
  dueDate: string;            // YYYY-MM-DD
  billType: BillType;
  recurrenceType?: RecurrenceType;
  assignedTo?: string;
  notes?: string;
  essentialLevel: EssentialLevel;
  isPaid: boolean;
  paidDate?: string;
  createdAt: number;
  updatedAt: number;
}

export async function loadBills(): Promise<Bill[]> {
  try {
    const raw = await AsyncStorage.getItem(BILLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function saveBills(bills: Bill[]): Promise<void> {
  await AsyncStorage.setItem(BILLS_KEY, JSON.stringify(bills));
}

export function advanceDueDate(dateStr: string, recurrence: RecurrenceType): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y!, (m! - 1), d!);
  switch (recurrence) {
    case "Weekly":      date.setDate(date.getDate() + 7);       break;
    case "Fortnightly": date.setDate(date.getDate() + 14);      break;
    case "Monthly":     date.setMonth(date.getMonth() + 1);     break;
    case "Quarterly":   date.setMonth(date.getMonth() + 3);     break;
    case "Yearly":      date.setFullYear(date.getFullYear() + 1); break;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function computeBillStatus(bill: Bill): "Paid" | "Overdue" | "Due Soon" | "Upcoming" {
  if (bill.isPaid) return "Paid";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = bill.dueDate.split("-").map(Number);
  const due = new Date(y!, (m! - 1), d!);
  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0)   return "Overdue";
  if (diffDays <= 7)  return "Due Soon";
  return "Upcoming";
}

export function daysUntilDue(bill: Bill): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = bill.dueDate.split("-").map(Number);
  const due = new Date(y!, (m! - 1), d!);
  return Math.floor((due.getTime() - today.getTime()) / 86_400_000);
}

export async function getBillsDueThisWeek(): Promise<Bill[]> {
  try {
    const bills = await loadBills();
    return bills
      .filter((b) => !b.isPaid && daysUntilDue(b) >= 0 && daysUntilDue(b) <= 7)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  } catch { return []; }
}

export async function getTotalDueThisWeek(): Promise<number> {
  try {
    const bills = await getBillsDueThisWeek();
    return bills.reduce((sum, b) => sum + b.amount, 0);
  } catch { return 0; }
}

export async function getOneOffBillsDueThisWeek(): Promise<Bill[]> {
  try {
    const bills = await loadBills();
    return bills
      .filter((b) => !b.isPaid && b.billType === "oneOff" && daysUntilDue(b) >= 0 && daysUntilDue(b) <= 7)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  } catch { return []; }
}
