import { api } from "@/lib/axios";

export interface DayOfInterest {
  id: string;
  scope: "global" | "block";
  blockId: string | null;
  name: string;
  startDate: string;
  endDate: string;
  expectedMultiplier: string;
  note: string | null;
}

export function listDaysOfInterest() {
  return api
    .get<{ daysOfInterest: DayOfInterest[] }>("/days-of-interest")
    .then((res) => res.data.daysOfInterest);
}

export function createDayOfInterest(input: {
  name: string;
  startDate: string;
  endDate: string;
  expectedMultiplier: number;
  note?: string;
}) {
  return api
    .post<{ dayOfInterest: DayOfInterest }>("/days-of-interest", input)
    .then((res) => res.data.dayOfInterest);
}
