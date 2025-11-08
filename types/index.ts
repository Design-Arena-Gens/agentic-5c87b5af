export type LabourStatus = "present" | "absent" | "leave" | "standby";

export interface Worker {
  id: string;
  name: string;
  trade: string;
  dailyRate: number;
  status: LabourStatus;
  phone?: string;
  contractorId: string;
}

export interface Contractor {
  id: string;
  name: string;
  company: string;
  scope: string;
  budget: number;
  startDate: string;
  endDate: string;
  crewSizeTarget: number;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  workerId: string;
  date: string;
  hoursWorked: number;
  presence: LabourStatus;
  remarks?: string;
  site: string;
}

export type PaymentCategory = "advance" | "material" | "bonus" | "deduction";

export interface Payment {
  id: string;
  workerId: string;
  amount: number;
  date: string;
  category: PaymentCategory;
  note?: string;
}
