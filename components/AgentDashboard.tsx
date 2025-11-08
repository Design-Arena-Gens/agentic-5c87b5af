"use client";

import { useMemo, useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import clsx from "clsx";
import {
  AttendanceRecord,
  LabourStatus,
  PaymentCategory,
  Worker
} from "@/types";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

const statusPalette: Record<LabourStatus, { label: string; color: string }> = {
  present: { label: "Present", color: "rgba(34,197,94,0.85)" },
  absent: { label: "Absent", color: "rgba(239,68,68,0.9)" },
  leave: { label: "On Leave", color: "rgba(249,115,22,0.85)" },
  standby: { label: "Standby", color: "rgba(250,204,21,0.85)" }
};

const paymentLabels: Record<PaymentCategory, string> = {
  advance: "Advance",
  material: "Material",
  bonus: "Bonus",
  deduction: "Deduction"
};

type AttendanceDraft = {
  workerId: string;
  hoursWorked: number;
  presence: LabourStatus;
  remarks?: string;
  site: string;
};

type PaymentDraft = {
  workerId: string;
  amount: number;
  category: PaymentCategory;
  note?: string;
};

const defaultAttendanceDraft: AttendanceDraft = {
  workerId: "",
  hoursWorked: 8,
  presence: "present",
  remarks: "",
  site: ""
};

const defaultPaymentDraft: PaymentDraft = {
  workerId: "",
  amount: 5000,
  category: "advance",
  note: ""
};

const dailyPresenceWeight: Record<LabourStatus, number> = {
  present: 1,
  standby: 0.5,
  leave: 0,
  absent: 0
};

export function AgentDashboard() {
  const [
    contractors,
    workers,
    attendance,
    payments,
    selectedContractorId,
    setSelectedContractor,
    addAttendance,
    updateAttendancePresence,
    updateWorkerStatus,
    addPayment
  ] = useWorkspaceStore((state) => [
    state.contractors,
    state.workers,
    state.attendance,
    state.payments,
    state.selectedContractorId,
    state.setSelectedContractor,
    state.addAttendance,
    state.updateAttendancePresence,
    state.updateWorkerStatus,
    state.addPayment
  ]);

  const [attendanceDraft, setAttendanceDraft] =
    useState<AttendanceDraft>(defaultAttendanceDraft);
  const [paymentDraft, setPaymentDraft] =
    useState<PaymentDraft>(defaultPaymentDraft);

  const selectedContractor = useMemo(
    () => contractors.find((item) => item.id === selectedContractorId) ?? null,
    [contractors, selectedContractorId]
  );

  const crew = useMemo(
    () =>
      workers.filter((worker) =>
        selectedContractor ? worker.contractorId === selectedContractor.id : true
      ),
    [workers, selectedContractor]
  );

  const latestAttendance = useMemo(
    () =>
      attendance.filter((record) =>
        crew.some((worker) => worker.id === record.workerId)
      ),
    [attendance, crew]
  );

  const latestPayments = useMemo(
    () =>
      payments.filter((payment) =>
        crew.some((worker) => worker.id === payment.workerId)
      ),
    [payments, crew]
  );

  const totals = useMemo(() => {
    const dailySpend = crew.reduce((total, worker) => {
      const weight = dailyPresenceWeight[worker.status] ?? 0;
      return total + worker.dailyRate * weight;
    }, 0);

    const totalPayments = latestPayments.reduce(
      (total, payment) => total + payment.amount,
      0
    );

    const presentCount = crew.filter((worker) => worker.status === "present")
      .length;
    const offCount = crew.length - presentCount;

    const contractorBudget = selectedContractor?.budget ?? 0;
    const targetCrew = selectedContractor?.crewSizeTarget ?? crew.length;
    const crewHealth = crew.length
      ? Math.round((presentCount / targetCrew) * 100)
      : 0;

    return {
      dailySpend,
      totalPayments,
      presentCount,
      offCount,
      crewHealth
    };
  }, [crew, latestPayments, selectedContractor]);

  const keyRisks = useMemo(() => {
    const riskFlags: string[] = [];

    const leaveHeads = crew.filter((worker) => worker.status === "leave");
    if (leaveHeads.length >= 2) {
      riskFlags.push(
        `Crew short by ${leaveHeads.length} specialist${
          leaveHeads.length > 1 ? "s" : ""
        } today.`
      );
    }

    const budgetBurnRate =
      totals.dailySpend * (selectedContractor ? 6 : 1) ?? 0; // 6-day working assumption

    if (selectedContractor && budgetBurnRate) {
      const daysRemaining = differenceInDays(
        parseISO(selectedContractor.endDate),
        new Date()
      );

      if (daysRemaining > 0) {
        const projectedSpend = budgetBurnRate * (daysRemaining / 6);
        if (projectedSpend > selectedContractor.budget * 0.4) {
          riskFlags.push("Budget exposure: tighten purchase approvals.");
        }
      }
    }

    const absentRecords = latestAttendance.filter(
      (record) => record.presence === "absent"
    );
    if (absentRecords.length > 0) {
      riskFlags.push("Attendance drops flagged for supervisor follow-up.");
    }

    return riskFlags;
  }, [crew, latestAttendance, selectedContractor, totals.dailySpend]);

  const actionSuggestions = useMemo(() => {
    const items: { title: string; detail: string; category: string }[] = [];

    const standby = crew.filter((worker) => worker.status === "standby");
    if (standby.length) {
      items.push({
        title: "Redeploy standby crew",
        detail: `Assign ${standby.length} standby member${
          standby.length > 1 ? "s" : ""
        } to BlueWave shaft prep.`,
        category: "Crew"
      });
    }

    const deductionCount = latestPayments.filter(
      (payment) => payment.category === "deduction"
    ).length;
    if (deductionCount > 1) {
      items.push({
        title: "Review deductions",
        detail: "Multiple deductions this week - align with contractor rep.",
        category: "Finance"
      });
    }

    items.push({
      title: "Daily AI brief",
      detail:
        "Use quick brief below to align contractor, labour captain, and supplier.",
      category: "AI Agent"
    });

    return items;
  }, [crew, latestPayments]);

  const rosterOptions = useMemo(
    () =>
      crew.map((worker) => ({
        label: worker.name,
        value: worker.id
      })),
    [crew]
  );

  const selectedWorker = useMemo(() => {
    if (!attendanceDraft.workerId) return null;
    return crew.find((worker) => worker.id === attendanceDraft.workerId) ?? null;
  }, [attendanceDraft.workerId, crew]);

  const handleAddAttendance = () => {
    if (!attendanceDraft.workerId) return;
    const record: Omit<AttendanceRecord, "id"> = {
      workerId: attendanceDraft.workerId,
      date: format(new Date(), "yyyy-MM-dd"),
      hoursWorked: attendanceDraft.hoursWorked,
      presence: attendanceDraft.presence,
      remarks: attendanceDraft.remarks?.trim()
        ? attendanceDraft.remarks.trim()
        : undefined,
      site: attendanceDraft.site || (selectedContractor?.scope ?? "Site")
    };
    addAttendance(record);
    updateWorkerStatus(record.workerId, record.presence);
    setAttendanceDraft({
      ...defaultAttendanceDraft,
      workerId: record.workerId
    });
  };

  const handleAddPayment = () => {
    if (!paymentDraft.workerId || !paymentDraft.amount) return;
    addPayment({
      workerId: paymentDraft.workerId,
      amount: paymentDraft.amount,
      date: format(new Date(), "yyyy-MM-dd"),
      category: paymentDraft.category,
      note: paymentDraft.note || undefined
    });
    setPaymentDraft({
      ...defaultPaymentDraft,
      workerId: paymentDraft.workerId
    });
  };

  return (
    <main>
      <div className="container">
        <header className="section-card section-card--accent">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "24px",
              flexWrap: "wrap"
            }}
          >
            <div style={{ flex: "1 1 420px" }}>
              <span className="badge">
                <span
                  className="indicator-dot"
                  style={{ background: "var(--success)" }}
                />
                Live Site Agent
              </span>
              <h1
                style={{
                  fontSize: "2.3rem",
                  marginTop: "18px",
                  marginBottom: "12px"
                }}
              >
                Contractor & Labour Control Centre
              </h1>
              <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                Track presence, issue payouts, and coordinate milestones with an
                AI co-pilot built for plumbing contractors.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                minWidth: "240px"
              }}
            >
              <label
                htmlFor="contractor-select"
                style={{
                  fontSize: "0.8rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--text-muted)"
                }}
              >
                Focus Contractor
              </label>
              <select
                id="contractor-select"
                value={selectedContractorId ?? ""}
                onChange={(event) => setSelectedContractor(event.target.value)}
                style={{
                  padding: "14px 16px",
                  borderRadius: "16px",
                  border: "1px solid rgba(148,163,184,0.2)",
                  background: "rgba(15,23,42,0.65)",
                  color: "var(--text)",
                  fontSize: "1rem"
                }}
              >
                {contractors.map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.name}
                  </option>
                ))}
              </select>
              {selectedContractor && (
                <div
                  className="glass"
                  style={{
                    padding: "16px 18px",
                    display: "grid",
                    gap: "8px",
                    background: "rgba(15,23,42,0.65)"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.85rem",
                      color: "var(--text-muted)"
                    }}
                  >
                    <span>Budget</span>
                    <strong style={{ color: "var(--accent)" }}>
                      ₹{selectedContractor.budget.toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.85rem",
                      color: "var(--text-muted)"
                    }}
                  >
                    <span>Window</span>
                    <span>
                      {format(parseISO(selectedContractor.startDate), "d MMM")} –{" "}
                      {format(parseISO(selectedContractor.endDate), "d MMM")}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.85rem",
                      color: "var(--text-muted)"
                    }}
                  >
                    <span>Target Crew</span>
                    <span>{selectedContractor.crewSizeTarget} heads</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="dashboard-shell">
          <div className="dashboard-shell__grid">
            <MetricCard
              title="Expected Payroll (Today)"
              primary={`₹${Math.round(totals.dailySpend).toLocaleString("en-IN")}`}
              hint="Calculated from crew rates & presence"
            />
            <MetricCard
              title="Crew Pulse"
              primary={`${totals.presentCount} present`}
              hint={`${totals.offCount} off-site or on leave`}
            />
            <MetricCard
              title="Crew Availability"
              primary={`${totals.crewHealth}% of target`}
              hint="Current roster readiness"
            />
            <MetricCard
              title="Payouts (Last 7 days)"
              primary={`₹${Math.round(
                totals.totalPayments
              ).toLocaleString("en-IN")}`}
              hint="Across labour + contractor advances"
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.2fr)",
              gap: "24px",
              alignItems: "stretch"
            }}
          >
            <div style={{ display: "grid", gap: "24px" }}>
              <section className="section-card">
                <header
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: "1.2rem" }}>Presence Radar</h2>
                    <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
                      Quick update on who&apos;s on ground, who needs support.
                    </p>
                  </div>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      const firstCrew = crew[0];
                      if (!firstCrew) return;
                      setAttendanceDraft((prev) => ({
                        ...prev,
                        workerId: firstCrew.id
                      }));
                    }}
                  >
                    Fill Quick Log
                  </button>
                </header>

                <div
                  style={{
                    marginTop: "22px",
                    display: "grid",
                    gap: "16px"
                  }}
                >
                  {crew.map((worker) => (
                    <div
                      key={worker.id}
                      className="glass"
                      style={{
                        padding: "16px 18px",
                        display: "grid",
                        gap: "10px",
                        border: "1px solid rgba(148,163,184,0.12)"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "18px",
                          flexWrap: "wrap"
                        }}
                      >
                        <div>
                          <h3 style={{ fontSize: "1.05rem" }}>{worker.name}</h3>
                          <div
                            style={{
                              display: "flex",
                              gap: "10px",
                              alignItems: "center",
                              marginTop: "4px",
                              color: "var(--text-muted)",
                              fontSize: "0.85rem"
                            }}
                          >
                            <span className="tag">{worker.trade}</span>
                            <span>
                              ₹{worker.dailyRate.toLocaleString("en-IN")} / day
                            </span>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px"
                          }}
                        >
                          {(Object.keys(statusPalette) as LabourStatus[]).map(
                            (status) => (
                              <button
                                key={status}
                                className={clsx("btn", "btn-ghost")}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "12px",
                                  background:
                                    worker.status === status
                                      ? "rgba(56,189,248,0.18)"
                                      : "transparent",
                                  border:
                                    worker.status === status
                                      ? "1px solid rgba(56,189,248,0.6)"
                                      : "1px solid rgba(148,163,184,0.25)",
                                  color: "var(--text)"
                                }}
                                onClick={() => updateWorkerStatus(worker.id, status)}
                              >
                                {statusPalette[status].label}
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: "14px",
                          fontSize: "0.85rem",
                          color: "var(--text-muted)"
                        }}
                      >
                        <span>
                          Presence Weight:{" "}
                          <strong style={{ color: "var(--text)" }}>
                            {dailyPresenceWeight[worker.status]}
                          </strong>
                        </span>
                        <span>
                          Contact:{" "}
                          <strong style={{ color: "var(--text)" }}>
                            {worker.phone || "—"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <AttendanceForm
                crew={crew}
                draft={attendanceDraft}
                onChange={setAttendanceDraft}
                onSubmit={handleAddAttendance}
              />
            </div>

            <aside style={{ display: "grid", gap: "24px" }}>
              <section className="section-card">
                <h2 style={{ fontSize: "1.2rem" }}>Alerts & Risks</h2>
                <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
                  Watchlist generated from today&apos;s roster and spend.
                </p>
                <div style={{ marginTop: "18px", display: "grid", gap: "14px" }}>
                  {keyRisks.length === 0 && (
                    <div
                      className="glass"
                      style={{
                        padding: "18px",
                        background: "rgba(56, 189, 248, 0.1)"
                      }}
                    >
                      <strong style={{ color: "var(--accent)" }}>
                        Stable for now
                      </strong>
                      <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
                        No urgent risks detected. Continue monitoring attendance
                        and budget.
                      </p>
                    </div>
                  )}
                  {keyRisks.map((risk, index) => (
                    <div
                      key={risk}
                      style={{
                        padding: "16px",
                        borderRadius: "12px",
                        border: "1px solid rgba(239,68,68,0.3)",
                        background: "rgba(127,29,29,0.2)"
                      }}
                    >
                      <strong style={{ color: "#fda4af" }}>
                        Risk #{index + 1}
                      </strong>
                      <p style={{ marginTop: "8px", lineHeight: 1.5 }}>{risk}</p>
                    </div>
                  ))}
                </div>
              </section>

              <PaymentForm
                crew={crew}
                draft={paymentDraft}
                onChange={setPaymentDraft}
                onSubmit={handleAddPayment}
              />

              <section className="section-card">
                <h2 style={{ fontSize: "1.15rem" }}>AI Brief Generator</h2>
                <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
                  Copy these prompts into your agent or WhatsApp broadcast for
                  aligned updates.
                </p>
                <div style={{ marginTop: "18px", display: "grid", gap: "14px" }}>
                  <PromptCard
                    title="Contractor Update"
                    prompt={`Summarise today's plumbing site update for ${selectedContractor?.name ?? "contractor"}, highlight ${totals.presentCount} present crew, list risks: ${keyRisks.join(
                      "; "
                    ) || "none"}, and request approvals for payouts totalling ₹${totals.totalPayments.toLocaleString(
                      "en-IN"
                    )}.`}
                  />
                  <PromptCard
                    title="Labour Captain Brief"
                    prompt={`Coach labour captain on redeployment needs. Mention standby crew count ${crew.filter((w) => w.status === "standby").length}, ensure all absent members log reasons, and remind about safety checks before hydro tests.`}
                  />
                  <PromptCard
                    title="Supplier Coordination"
                    prompt={`Draft message to supplier for materials linked to ${selectedContractor?.scope ?? "scope"}, schedule deliveries aligned with crew availability (${totals.presentCount}/${crew.length}) and prevent overtime spend beyond ₹${Math.round(
                      totals.dailySpend * 1.3
                    ).toLocaleString("en-IN")}.`}
                  />
                </div>
              </section>
            </aside>
          </div>

          <section className="section-card">
            <h2 style={{ fontSize: "1.2rem" }}>Agenda Builder</h2>
            <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
              Use these recommended moves for your next coordination call.
            </p>
            <div
              style={{
                marginTop: "18px",
                display: "grid",
                gap: "18px",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"
              }}
            >
              {actionSuggestions.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  style={{
                    padding: "18px",
                    borderRadius: "16px",
                    border: "1px solid rgba(148,163,184,0.2)",
                    background: "rgba(15,23,42,0.6)"
                  }}
                >
                  <span className="tag">{item.category}</span>
                  <h3 style={{ marginTop: "12px", fontSize: "1.05rem" }}>
                    {item.title}
                  </h3>
                  <p style={{ marginTop: "8px", lineHeight: 1.5 }}>
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="section-card">
            <h2 style={{ fontSize: "1.2rem" }}>Recent Attendance</h2>
            <div style={{ marginTop: "18px", display: "grid", gap: "10px" }}>
              {latestAttendance.slice(0, 6).map((record) => {
                const worker =
                  crew.find((crewMember) => crewMember.id === record.workerId) ??
                  null;
                return (
                  <div
                    key={record.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      border: "1px solid rgba(148,163,184,0.15)",
                      background: "rgba(15, 23, 42, 0.55)",
                      fontSize: "0.9rem",
                      gap: "12px"
                    }}
                  >
                    <div>
                      <strong>{worker?.name ?? "Worker"}</strong>
                      <p style={{ color: "var(--text-muted)", marginTop: "4px" }}>
                        {record.site}
                      </p>
                    </div>
                    <div>
                      <span className="tag">
                        {format(parseISO(record.date), "d MMM")}
                      </span>
                    </div>
                    <div>
                      <span
                        className="badge"
                        style={{
                          background: "rgba(148,163,184,0.12)",
                          borderColor: statusPalette[record.presence].color,
                          color: statusPalette[record.presence].color
                        }}
                      >
                        {statusPalette[record.presence].label}
                      </span>
                    </div>
                    <div>
                      <p>
                        {record.hoursWorked} hrs
                        {record.remarks
                          ? ` · ${record.remarks.substring(0, 36)}`
                          : ""}
                      </p>
                      <button
                        className="btn btn-ghost"
                        style={{ marginTop: "6px", padding: "6px 12px" }}
                        onClick={() =>
                          updateAttendancePresence(
                            record.id,
                            record.presence === "present" ? "absent" : "present"
                          )
                        }
                      >
                        Toggle Presence
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  title,
  primary,
  hint
}: {
  title: string;
  primary: string;
  hint: string;
}) {
  return (
    <div className="section-card">
      <p className="section-title">{title}</p>
      <strong style={{ fontSize: "1.6rem" }}>{primary}</strong>
      <p style={{ color: "var(--text-muted)", marginTop: "10px" }}>{hint}</p>
    </div>
  );
}

function AttendanceForm({
  crew,
  draft,
  onChange,
  onSubmit
}: {
  crew: Worker[];
  draft: AttendanceDraft;
  onChange: (draft: AttendanceDraft) => void;
  onSubmit: () => void;
}) {
  const worker = crew.find((item) => item.id === draft.workerId) ?? null;

  return (
    <section className="section-card">
      <h2 style={{ fontSize: "1.15rem" }}>Smart Attendance Log</h2>
      <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
        Draft the day&apos;s presence and hours in one go.
      </p>
      <div style={{ display: "grid", gap: "16px", marginTop: "18px" }}>
        <select
          value={draft.workerId}
          onChange={(event) =>
            onChange({ ...draft, workerId: event.target.value })
          }
          style={{
            padding: "12px 14px",
            borderRadius: "14px",
            border: "1px solid rgba(148,163,184,0.22)",
            background: "rgba(15,23,42,0.55)",
            color: "var(--text)"
          }}
        >
          <option value="">Select crew member</option>
          {crew.map((crewMember) => (
            <option key={crewMember.id} value={crewMember.id}>
              {crewMember.name} · {crewMember.trade}
            </option>
          ))}
        </select>

        {worker && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              color: "var(--text-muted)",
              fontSize: "0.85rem"
            }}
          >
            <span>
              Default rate: ₹{worker.dailyRate.toLocaleString("en-IN")}/day
            </span>
            <span>Status: {statusPalette[worker.status].label}</span>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "14px"
          }}
        >
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Hours worked
            </span>
            <input
              type="number"
              min={0}
              max={24}
              value={draft.hoursWorked}
              onChange={(event) =>
                onChange({ ...draft, hoursWorked: Number(event.target.value) })
              }
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(148,163,184,0.22)",
                background: "rgba(15,23,42,0.55)",
                color: "var(--text)"
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Presence
            </span>
            <select
              value={draft.presence}
              onChange={(event) =>
                onChange({
                  ...draft,
                  presence: event.target.value as LabourStatus
                })
              }
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(148,163,184,0.22)",
                background: "rgba(15,23,42,0.55)",
                color: "var(--text)"
              }}
            >
              {(Object.keys(statusPalette) as LabourStatus[]).map((status) => (
                <option key={status} value={status}>
                  {statusPalette[status].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Work front / site
          </span>
          <input
            type="text"
            placeholder="e.g. Tower B vertical shaft"
            value={draft.site}
            onChange={(event) => onChange({ ...draft, site: event.target.value })}
            style={{
              padding: "12px 14px",
              borderRadius: "14px",
              border: "1px solid rgba(148,163,184,0.22)",
              background: "rgba(15,23,42,0.55)",
              color: "var(--text)"
            }}
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Notes
          </span>
          <textarea
            placeholder="Inspection status, blockers, material notes..."
            value={draft.remarks}
            onChange={(event) =>
              onChange({ ...draft, remarks: event.target.value })
            }
            rows={3}
            style={{
              padding: "12px 14px",
              borderRadius: "14px",
              border: "1px solid rgba(148,163,184,0.22)",
              background: "rgba(15,23,42,0.55)",
              color: "var(--text)",
              resize: "vertical"
            }}
          />
        </label>

        <button className="btn" onClick={onSubmit} disabled={!draft.workerId}>
          Log Attendance Update
        </button>
      </div>
    </section>
  );
}

function PaymentForm({
  crew,
  draft,
  onChange,
  onSubmit
}: {
  crew: Worker[];
  draft: PaymentDraft;
  onChange: (draft: PaymentDraft) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="section-card">
      <h2 style={{ fontSize: "1.15rem" }}>Payment Console</h2>
      <p style={{ color: "var(--text-muted)", marginTop: "6px" }}>
        Release advances or material cash with instant logging.
      </p>
      <div style={{ display: "grid", gap: "16px", marginTop: "18px" }}>
        <select
          value={draft.workerId}
          onChange={(event) =>
            onChange({ ...draft, workerId: event.target.value })
          }
          style={{
            padding: "12px 14px",
            borderRadius: "14px",
            border: "1px solid rgba(148,163,184,0.22)",
            background: "rgba(15,23,42,0.55)",
            color: "var(--text)"
          }}
        >
          <option value="">Select crew</option>
          {crew.map((crewMember) => (
            <option key={crewMember.id} value={crewMember.id}>
              {crewMember.name} · {crewMember.trade}
            </option>
          ))}
        </select>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "14px"
          }}
        >
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Amount (₹)
            </span>
            <input
              type="number"
              min={0}
              value={draft.amount}
              onChange={(event) =>
                onChange({ ...draft, amount: Number(event.target.value) })
              }
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(148,163,184,0.22)",
                background: "rgba(15,23,42,0.55)",
                color: "var(--text)"
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Category
            </span>
            <select
              value={draft.category}
              onChange={(event) =>
                onChange({
                  ...draft,
                  category: event.target.value as PaymentCategory
                })
              }
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(148,163,184,0.22)",
                background: "rgba(15,23,42,0.55)",
                color: "var(--text)"
              }}
            >
              {(Object.keys(paymentLabels) as PaymentCategory[]).map((key) => (
                <option key={key} value={key}>
                  {paymentLabels[key]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Note
          </span>
          <input
            type="text"
            placeholder="Reason or invoice reference"
            value={draft.note}
            onChange={(event) => onChange({ ...draft, note: event.target.value })}
            style={{
              padding: "12px 14px",
              borderRadius: "14px",
              border: "1px solid rgba(148,163,184,0.22)",
              background: "rgba(15,23,42,0.55)",
              color: "var(--text)"
            }}
          />
        </label>

        <button className="btn" onClick={onSubmit} disabled={!draft.workerId}>
          Record Payment
        </button>
      </div>
    </section>
  );
}

function PromptCard({ title, prompt }: { title: string; prompt: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "14px",
        border: "1px solid rgba(148,163,184,0.20)",
        background: "rgba(15,23,42,0.55)",
        display: "grid",
        gap: "10px"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px"
        }}
      >
        <strong>{title}</strong>
        <button
          className="btn btn-secondary"
          style={{ padding: "6px 14px" }}
          onClick={() => {
            navigator.clipboard.writeText(prompt).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{prompt}</p>
    </div>
  );
}
