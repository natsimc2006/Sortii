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

export interface FamilyEvent {
  id: string;
  title: string;
  day: DayOfWeek;
  time: string;
  endTime?: string;
  location?: string;
  personIds: string[];
  driverId?: string;
  carpoolContact?: string;
  carpoolContacts?: { name: string; mobile?: string }[];
  repeat: RepeatType;
  notes?: string;
  isAppointment?: boolean;
}

export interface FamilyState {
  members: FamilyMember[];
  events: FamilyEvent[];
}
