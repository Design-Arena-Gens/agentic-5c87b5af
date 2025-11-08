"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  AttendanceRecord,
  Contractor,
  LabourStatus,
  Payment,
  Worker
} from "@/types";

type WorkspaceState = {
  contractors: Contractor[];
  workers: Worker[];
  attendance: AttendanceRecord[];
  payments: Payment[];
  selectedContractorId: string | null;
  setSelectedContractor: (id: string | null) => void;
  addAttendance: (input: Omit<AttendanceRecord, "id">) => void;
  updateAttendancePresence: (id: string, presence: LabourStatus) => void;
  addPayment: (input: Omit<Payment, "id">) => void;
  updateWorkerStatus: (workerId: string, status: LabourStatus) => void;
  addWorker: (worker: Omit<Worker, "id">) => void;
};

const today = new Date();
const format = (date: Date) => date.toISOString().slice(0, 10);

const initialContractors: Contractor[] = [
  {
    id: "c1",
    name: "Skyline Mechanical",
    company: "Skyline Mechanical",
    scope: "High-rise plumbing installation & QA",
    budget: 180000,
    startDate: format(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: format(new Date(today.getFullYear(), today.getMonth() + 2, 0)),
    crewSizeTarget: 12,
    notes: "Key milestone: pressure test every Wednesday."
  },
  {
    id: "c2",
    name: "BlueWave Piping",
    company: "BlueWave Piping",
    scope: "Basement drainage rerouting",
    budget: 95000,
    startDate: format(new Date(today.getFullYear(), today.getMonth(), 5)),
    endDate: format(new Date(today.getFullYear(), today.getMonth() + 1, 20)),
    crewSizeTarget: 8,
    notes: "Coordinate with civil to avoid conduit clashes."
  }
];

const initialWorkers: Worker[] = [
  {
    id: "w1",
    name: "Priya Sharma",
    trade: "Pipe Fitter",
    dailyRate: 4200,
    status: "present",
    phone: "+91 98765 43210",
    contractorId: "c1"
  },
  {
    id: "w2",
    name: "Akash Patel",
    trade: "Welder",
    dailyRate: 4600,
    status: "present",
    phone: "+91 93210 76543",
    contractorId: "c1"
  },
  {
    id: "w3",
    name: "Michael Lopez",
    trade: "Foreman",
    dailyRate: 5800,
    status: "leave",
    phone: "+1 415-555-2010",
    contractorId: "c2"
  },
  {
    id: "w4",
    name: "Lily Chen",
    trade: "Assistant",
    dailyRate: 3600,
    status: "standby",
    contractorId: "c2"
  }
];

const initialAttendance: AttendanceRecord[] = [
  {
    id: "a1",
    workerId: "w1",
    date: format(today),
    hoursWorked: 8,
    presence: "present",
    remarks: "Stack 12 inspection passed",
    site: "Tower B level 21"
  },
  {
    id: "a2",
    workerId: "w2",
    date: format(today),
    hoursWorked: 7.5,
    presence: "present",
    remarks: "Pressure test follow-up",
    site: "Tower B roof"
  },
  {
    id: "a3",
    workerId: "w3",
    date: format(today),
    hoursWorked: 0,
    presence: "leave",
    remarks: "Family emergency",
    site: "Basement shaft"
  }
];

const initialPayments: Payment[] = [
  {
    id: "p1",
    workerId: "w1",
    amount: 12000,
    date: format(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2)),
    category: "advance",
    note: "Rotation bonus"
  },
  {
    id: "p2",
    workerId: "w2",
    amount: 18000,
    date: format(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)),
    category: "material",
    note: "Gas cylinder procurement"
  }
];

export const useWorkspaceStore = create<WorkspaceState>()(
  immer((set) => ({
    contractors: initialContractors,
    workers: initialWorkers,
    attendance: initialAttendance,
    payments: initialPayments,
    selectedContractorId: initialContractors[0]?.id ?? null,
    setSelectedContractor: (id) =>
      set((state) => {
        state.selectedContractorId = id;
      }),
    addAttendance: (input) =>
      set((state) => {
        state.attendance.unshift({
          id: crypto.randomUUID(),
          ...input
        });
      }),
    updateAttendancePresence: (id, presence) =>
      set((state) => {
        const record = state.attendance.find((item) => item.id === id);
        if (record) {
          record.presence = presence;
        }
      }),
    addPayment: (input) =>
      set((state) => {
        state.payments.unshift({
          id: crypto.randomUUID(),
          ...input
        });
      }),
    updateWorkerStatus: (workerId, status) =>
      set((state) => {
        const worker = state.workers.find((item) => item.id === workerId);
        if (worker) {
          worker.status = status;
        }
      }),
    addWorker: (worker) =>
      set((state) => {
        state.workers.push({
          id: crypto.randomUUID(),
          ...worker
        });
      })
  }))
);
