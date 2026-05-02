export type DayOfWeek =
  | "Monday" | "Tuesday" | "Wednesday" | "Thursday"
  | "Friday" | "Saturday" | "Sunday";

export type RepeatType = "none" | "weekly" | "fortnightly" | "monthly";

export const MEMBER_COLORS = [
  "#2A8F88", "#5E3A4C", "#D29A22", "#E07B3A", "#4A7B5E", "#3A6EA8",
];

export interface FamilyMember {
  id: string;
  name: string;
  role: "adult" | "child";
  color: string;
}

export interface CarpoolContactEntry {
  name: string;
  relationship: string;
  canHelpWith: string[];
  phone: string;
  notes: string;
  mobile?: string;
}

export interface FamilyEvent {
  id: string;
  title: string;
  day: DayOfWeek;
  time: string;
  endTime?: string;
  location?: string;
  personIds: string[];
  driverId?: string;
  assignedAdult?: string;
  priority?: "must" | "nice";
  isRecurring?: boolean;
  carpoolContact?: string;
  carpoolContacts?: CarpoolContactEntry[];
  repeat: RepeatType;
  monthlyWeek?: number | null;
  createdDate?: string;
  notes?: string;
  isAppointment?: boolean;
  originOverride?: string;
  requiresAdultPresence?: boolean;
}

export interface FamilyState {
  members: FamilyMember[];
  events: FamilyEvent[];
}
