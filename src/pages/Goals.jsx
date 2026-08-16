import { useState, useMemo } from "react";
import { fmt, nextId, monthsUntil, requiredSIP } from "../utils/finance";
import {
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
  Sparkles,
  Link2,
  Unlink,
  CheckCircle2,
  AlertTriangle,
  User,
  Zap,
} from "lucide-react";
import { useConfirm } from "../hooks/useConfirm";
import EmptyState from "../components/EmptyState";
import AmountInput from "../components/AmountInput";
import {
  getGoalTotalFunding,
  findGoalFundingSuggestions,
  linkInvestmentToGoal,
  unlinkInvestmentFromGoal,
  getInvestmentCurrentValue,
  calculatePersonPortfolioSourcing,
} from "../utils/goalFunding";
import { ASSET_TYPE_THEMES } from "../utils/mfCategorizer";

const EMOJIS = [
  "🏠",
  "✈️",
  "🎓",
  "👶",
  "🚗",
  "💍",
  "🛡️",
  "📱",
  "🏖️",
  "💰",
  "🏋️",
  "🌍",
  "🎵",
  "💻",
];

function PersonFundingHub({
  person = "p1",
  personName = "Person 1",
  personColor = "var(--p1)",
  personInvestments = [],
  personCash = 0,
  targetShare = 0,
  goal = {},
  allGoals = [],
  onLinkInvestment,
  onUnlinkInvestment,
  months = 0,
}) {
  const sourcing = useMemo(
    () =>
      calculatePersonPortfolioSourcing({
        person,
        personInvestments,
        personCash,
        targetShare,
        goal,
        allGoals,
      }),
    [person, personInvestments, personCash, targetShare, goal, allGoals],
  );

  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        border: `1px solid ${personColor}44`,
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <User size={14} style={{ color: personColor }} />
          <span style={{ fontWeight: 600, fontSize: 13, color: personColor }}>
            {personName}&apos;s Share & Sourcing
          </span>
        </div>
        <div style={{ fontSize: 12 }}>
          Target Share: <strong>{fmt(targetShare)}</strong> · Funded:{" "}
          <strong style={{ color: sourcing.isSufficient ? "var(--green)" : "var(--gold)" }}>
            {fmt(sourcing.totalFunded)}
          </strong>{" "}
          ({targetShare > 0 ? Math.round((sourcing.totalFunded / targetShare) * 100) : 100}%)
        </div>
      </div>

      {/* Sourcing capacity indicator */}
      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          padding: "6px 10px",
          borderRadius: 6,
          background: sourcing.isSufficient
            ? "rgba(16, 185, 129, 0.1)"
            : sourcing.canFullyFundFromPortfolio
            ? "rgba(201, 168, 76, 0.1)"
            : "rgba(239, 68, 68, 0.1)",
          color: sourcing.isSufficient
            ? "var(--green)"
            : sourcing.canFullyFundFromPortfolio
            ? "var(--gold)"
            : "var(--red)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <span>
          {sourcing.isSufficient
            ? `✓ ${personName} is 100% funded (${fmt(sourcing.totalFunded)})!`
            : sourcing.canFullyFundFromPortfolio
            ? `💡 ${personName} has ${fmt(sourcing.totalAvailableToAllocate)} in investments available to fund the remaining ${fmt(sourcing.shortfall)}!`
            : `⚠️ ${personName} has a shortfall of ${fmt(sourcing.shortfall)} ${
                months > 0
                  ? `(Needs ${fmt(Math.round(requiredSIP(sourcing.shortfall, 10, months)))}/mo SIP)`
                  : ""
              }`}
        </span>

        {sourcing.availableInvestments.length > 0 && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setExpanded(!expanded)}
            style={{ fontSize: 10, padding: "2px 6px", height: "auto" }}
          >
            {expanded ? "Hide Options" : `View ${sourcing.availableInvestments.length} Investments`}
          </button>
        )}
      </div>

      {/* Available Investments list */}
      {expanded && sourcing.availableInvestments.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {sourcing.availableInvestments.map((inv) => (
            <div
              key={inv.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 11,
                padding: "6px 8px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 6,
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: "#fff" }}>
                  {inv.type === "FD" ? "🏦" : "📈"} {inv.name}
                </span>
                <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
                  Val: {fmt(inv.currentValue)} {inv.returnPct ? `(${inv.returnPct}%)` : ""}
                </span>
                {inv.isLowYield && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 9,
                      padding: "1px 4px",
                      borderRadius: 3,
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "var(--gold)",
                      fontWeight: 600,
                    }}
                  >
                    Low Yield (Recommended)
                  </span>
                )}
              </div>

              <div>
                {inv.isCurrentlyLinked ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onUnlinkInvestment(inv.id)}
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      color: "var(--red)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    <Unlink size={10} /> Linked ({fmt(inv.linkedAmount)})
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onLinkInvestment(inv.id, inv.availableToAllocate, person)}
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      color: "var(--blue, #60a5fa)",
                      borderColor: "rgba(96, 165, 250, 0.4)",
                    }}
                  >
                    + Allocate {fmt(inv.availableToAllocate)}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  onUpdate,
  onDelete,
  isShared,
  personNames,
  p1Investments = [],
  p2Investments = [],
  allInvestments = [],
  allGoals = [],
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(goal);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [selectedInvId, setSelectedInvId] = useState("");
  const [allocatedAmt, setAllocatedAmt] = useState("");
  const [linkPerson, setLinkPerson] = useState("p1");
  const { confirm, dialog } = useConfirm();

  const funding = useMemo(
    () => getGoalTotalFunding(goal, allInvestments),
    [goal, allInvestments],
  );

  const smartSuggestions = useMemo(
    () => findGoalFundingSuggestions(allInvestments, goal, allGoals),
    [allInvestments, goal, allGoals],
  );

  const target = goal.target;
  const totalSaved = funding.totalSaved;
  const pct = funding.pct;
  const months = monthsUntil(goal.deadline);

  const save = () => {
    onUpdate({
      ...form,
      target: Number(form.target),
      saved: Number(form.saved || 0),
      p1Saved: Number(form.p1Saved || 0),
      p2Saved: Number(form.p2Saved || 0),
    });
    setEditing(false);
  };

  const handleLinkInvestment = (invId = selectedInvId, amt = allocatedAmt, prs = linkPerson) => {
    const idToLink = invId || selectedInvId;
    if (!idToLink) return;
    const inv = allInvestments.find((x) => String(x.id) === String(idToLink));
    if (!inv) return;
    const maxVal = getInvestmentCurrentValue(inv);
    const amount = amt !== undefined && amt !== "" ? Math.min(maxVal, Number(amt)) : maxVal;
    const updated = linkInvestmentToGoal(goal, idToLink, amount, isShared ? prs : "p1");
    onUpdate(updated);
    setShowLinkPicker(false);
    setSelectedInvId("");
    setAllocatedAmt("");
  };

  const handleUnlink = (invId) => {
    const updated = unlinkInvestmentFromGoal(goal, invId);
    onUpdate(updated);
  };

  const handleApplySuggestion = (sug) => {
    const updated = linkInvestmentToGoal(
      goal,
      sug.investment.id,
      sug.suggestedAmount,
      sug.investment.person || "p1",
    );
    onUpdate(updated);
  };

  return (
    <div
      className="card section-gap"
      style={{
        borderLeft: `4px solid ${goal.color || "var(--gold)"}`,
        background: "linear-gradient(135deg, rgba(255,255,255,0.02), rgba(18,18,24,0.98))",
      }}
    >
      {editing ? (
        <div>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Goal name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Target (₹)
              </label>
              <AmountInput
                value={form.target}
                onChange={(val) => setForm({ ...form, target: val })}
              />
            </div>
            {isShared ? (
              <>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {personNames?.p1 || "Person 1"} cash saved (₹)
                  </label>
                  <AmountInput
                    value={form.p1Saved || 0}
                    onChange={(val) => setForm({ ...form, p1Saved: val })}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {personNames?.p2 || "Person 2"} cash saved (₹)
                  </label>
                  <AmountInput
                    value={form.p2Saved || 0}
                    onChange={(val) => setForm({ ...form, p2Saved: val })}
                  />
                </div>
              </>
            ) : (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Cash saved so far (₹)
                </label>
                <AmountInput
                  value={form.saved || 0}
                  onChange={(val) => setForm({ ...form, saved: val })}
                />
              </div>
            )}
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Deadline
              </label>
              <input
                type="month"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 8,
              }}
            >
              Icon
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setForm({ ...form, emoji: e })}
                  style={{
                    width: 34,
                    height: 34,
                    fontSize: 17,
                    borderRadius: 8,
                    background:
                      form.emoji === e ? "var(--gold-dim)" : "var(--bg-card2)",
                    border:
                      form.emoji === e
                        ? "1px solid var(--gold)"
                        : "1px solid var(--border)",
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={save}
            >
              <Check size={13} /> Save
            </button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>
              <X size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: (goal.color || "var(--gold)") + "22",
                border: `1px solid ${(goal.color || "var(--gold)")}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              {goal.emoji || "🎯"}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div
                    style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}
                  >
                    {goal.name}
                  </div>
                  {isShared ? (
                    <div
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      {personNames?.p1 || "Person 1"}:{" "}
                      <span style={{ color: "var(--p1)" }}>
                        {fmt(goal.p1Saved || 0)}
                      </span>{" "}
                      · {personNames?.p2 || "Person 2"}:{" "}
                      <span style={{ color: "var(--p2)" }}>
                        {fmt(goal.p2Saved || 0)}
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      Cash Saved: {fmt(funding.cashSaved)} · Remaining:{" "}
                      {fmt(funding.remaining)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    className="btn-icon"
                    aria-label={`Edit ${goal.name}`}
                    onClick={() => {
                      setForm(goal);
                      setEditing(true);
                    }}
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    className="btn-icon"
                    aria-label={`Delete ${goal.name}`}
                    onClick={async () => {
                      if (
                        await confirm(
                          "Delete goal?",
                          `Remove "${goal.name}" and its progress?`,
                        )
                      )
                        onDelete();
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Progress & Totals */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 10,
                }}
              >
                <div style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>
                    {fmt(totalSaved)}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {" "}
                    / {fmt(target)}
                  </span>
                </div>
                {months !== null && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {months > 0 ? `${months} months left` : "Deadline passed"}
                  </span>
                )}
              </div>
              <div className="progress-track" style={{ height: 6, marginTop: 4 }}>
                <div
                  className="progress-fill"
                  style={{
                    width: pct + "%",
                    background:
                      pct >= 100
                        ? "var(--green, #10b981)"
                        : goal.color || "var(--gold)",
                  }}
                />
              </div>

              {/* Funding Source Breakdown */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  marginTop: 6,
                }}
              >
                <span>
                  💵 Cash: <strong style={{ color: "#fff" }}>{fmt(funding.cashSaved)}</strong>
                </span>
                <span>
                  🏦 Linked Assets:{" "}
                  <strong style={{ color: "var(--blue, #60a5fa)" }}>
                    {fmt(funding.investmentsSaved)}
                  </strong>
                </span>
                <span style={{ marginLeft: "auto", fontWeight: 600, color: pct >= 100 ? "var(--green)" : "var(--gold)" }}>
                  {pct}% funded
                </span>
              </div>

              {/* Per-Person Investment Sourcing Hub */}
              <div style={{ marginTop: 10 }}>
                {isShared ? (
                  <>
                    <PersonFundingHub
                      person="p1"
                      personName={personNames?.p1 || "Person 1"}
                      personColor="var(--p1)"
                      personInvestments={p1Investments}
                      personCash={goal.p1Saved || 0}
                      targetShare={Math.round(target / 2)}
                      goal={goal}
                      allGoals={allGoals}
                      onLinkInvestment={handleLinkInvestment}
                      onUnlinkInvestment={handleUnlink}
                      months={months}
                    />
                    <PersonFundingHub
                      person="p2"
                      personName={personNames?.p2 || "Person 2"}
                      personColor="var(--p2)"
                      personInvestments={p2Investments}
                      personCash={goal.p2Saved || 0}
                      targetShare={Math.round(target / 2)}
                      goal={goal}
                      allGoals={allGoals}
                      onLinkInvestment={handleLinkInvestment}
                      onUnlinkInvestment={handleUnlink}
                      months={months}
                    />
                  </>
                ) : (
                  <PersonFundingHub
                    person="p1"
                    personName={personNames?.p1 || "My Portfolio"}
                    personColor="var(--gold)"
                    personInvestments={p1Investments}
                    personCash={goal.saved || 0}
                    targetShare={target}
                    goal={goal}
                    allGoals={allGoals}
                    onLinkInvestment={handleLinkInvestment}
                    onUnlinkInvestment={handleUnlink}
                    months={months}
                  />
                )}
              </div>

              {/* Linked Investments List */}
              {funding.linkedDetails.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    background: "rgba(59, 130, 246, 0.05)",
                    border: "1px solid rgba(59, 130, 246, 0.2)",
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--blue, #60a5fa)",
                      marginBottom: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    <Link2 size={12} />
                    Linked Investment Funding Sources ({funding.linkedDetails.length}):
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {funding.linkedDetails.map((link) => {
                      const theme = ASSET_TYPE_THEMES[link.type] || ASSET_TYPE_THEMES.Other;
                      return (
                        <div
                          key={link.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 12,
                            padding: "3px 0",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span>{theme.icon}</span>
                            <span style={{ color: "#fff" }}>{link.name}</span>
                            {link.returnPct && (
                              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                                ({link.returnPct}%)
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong style={{ color: "var(--green, #10b981)" }}>
                              {fmt(link.allocatedAmount)}
                            </strong>
                            <button
                              className="btn-icon"
                              title="Unlink investment from this goal"
                              onClick={() => handleUnlink(link.id)}
                              style={{ padding: 2, color: "var(--text-muted)" }}
                            >
                              <Unlink size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Smart Sourcing Assistant Box */}
              {pct < 100 && smartSuggestions.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(18,18,24,0.95))",
                    border: "1px solid rgba(245,158,11,0.25)",
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--gold, #fbbf24)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <Sparkles size={13} />
                    💡 Smart Sourcing Assistant — Fund this goal faster:
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {smartSuggestions.map((sug) => (
                      <div
                        key={sug.investment.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 12,
                          background: "rgba(255,255,255,0.03)",
                          padding: "6px 8px",
                          borderRadius: 6,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                            <span>{sug.investment.name}</span>
                            <span
                              style={{
                                fontSize: 9,
                                padding: "1px 5px",
                                borderRadius: 4,
                                background: sug.badgeColor + "22",
                                color: sug.badgeColor,
                                fontWeight: 700,
                              }}
                            >
                              {sug.badge}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            {sug.reason} · Available: {fmt(sug.availableAmount)}
                          </div>
                        </div>
                        <button
                          className="btn-secondary"
                          onClick={() => handleApplySuggestion(sug)}
                          style={{
                            fontSize: 11,
                            padding: "4px 8px",
                            whiteSpace: "nowrap",
                            borderColor: "var(--gold)",
                            color: "var(--gold)",
                          }}
                        >
                          ⚡ Link {fmt(sug.suggestedAmount)}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Link Investment Selector Toggle */}
              {allInvestments.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {!showLinkPicker ? (
                    <button
                      className="btn-ghost"
                      onClick={() => setShowLinkPicker(true)}
                      style={{
                        fontSize: 11,
                        padding: "4px 8px",
                        color: "var(--blue, #60a5fa)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Link2 size={12} />
                      + Connect an investment (FD, MF, Gold) to this goal
                    </button>
                  ) : (
                    <div
                      style={{
                        padding: 10,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <select
                        value={selectedInvId}
                        onChange={(e) => {
                          setSelectedInvId(e.target.value);
                          const inv = allInvestments.find((x) => String(x.id) === e.target.value);
                          if (inv) setAllocatedAmt(getInvestmentCurrentValue(inv));
                        }}
                        style={{ flex: 1, minWidth: 160, fontSize: 12, padding: "5px 8px" }}
                      >
                        <option value="">Select an investment...</option>
                        {allInvestments.map((inv) => {
                          const val = getInvestmentCurrentValue(inv);
                          return (
                            <option key={inv.id} value={inv.id}>
                              {inv.type === "FD" ? "🏦" : "📈"} {inv.name} — {fmt(val)} ({inv.returnPct}%)
                            </option>
                          );
                        })}
                      </select>

                      <input
                        type="number"
                        placeholder="Amount to link (₹)"
                        value={allocatedAmt}
                        onChange={(e) => setAllocatedAmt(e.target.value)}
                        style={{ width: 140, fontSize: 12, padding: "5px 8px" }}
                      />

                      {isShared && (
                        <select
                          value={linkPerson}
                          onChange={(e) => setLinkPerson(e.target.value)}
                          style={{ width: 110, fontSize: 12, padding: "5px 8px" }}
                        >
                          <option value="p1">{personNames?.p1 || "Person 1"}&apos;s Share</option>
                          <option value="p2">{personNames?.p2 || "Person 2"}&apos;s Share</option>
                        </select>
                      )}

                      <button
                        className="btn-primary"
                        onClick={handleLinkInvestment}
                        disabled={!selectedInvId}
                        style={{ fontSize: 11, padding: "6px 12px" }}
                      >
                        Link
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => setShowLinkPicker(false)}
                        style={{ fontSize: 11, padding: "6px 8px" }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Goal celebration */}
              {pct >= 100 && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "8px 12px",
                    background:
                      "linear-gradient(135deg, rgba(72,187,120,0.12), rgba(201,168,76,0.12))",
                    border: "1px solid rgba(72,187,120,0.25)",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    animation: "goalCelebrate 0.6s ease-out",
                  }}
                >
                  <span style={{ fontSize: 22 }}>🎉</span>
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        color: "var(--green)",
                      }}
                    >
                      Goal achieved!
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      You funded {fmt(totalSaved)} — well done!
                    </div>
                  </div>
                  <span style={{ fontSize: 22, marginLeft: "auto" }}>🏆</span>
                </div>
              )}

              {/* SIP adequacy calculation */}
              {months > 0 && totalSaved < target && (
                <div
                  style={{
                    marginTop: 6,
                    padding: "5px 10px",
                    background: "rgba(201,168,76,0.06)",
                    border: "1px solid rgba(201,168,76,0.12)",
                    borderRadius: 6,
                    fontSize: 11,
                    color: "var(--gold)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  💡 Save{" "}
                  <strong>
                    {fmt(Math.round(requiredSIP(target - totalSaved, 10, months)))}
                    /mo
                  </strong>{" "}
                  at 10% return to hit target by deadline
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}

export default function Goals({
  data,
  sharedData,
  p1,
  p2,
  personName,
  personColor,
  updatePerson,
  updateShared,
  isHousehold,
  personNames,
}) {
  const personalGoals = useMemo(() => data?.goals || [], [data?.goals]);
  const sharedGoals = useMemo(() => sharedData?.goals || [], [sharedData?.goals]);
  const [showAdd, setShowAdd] = useState(null); // 'personal' | 'shared'
  const [newGoal, setNewGoal] = useState({
    name: "",
    target: "",
    saved: 0,
    p1Saved: 0,
    p2Saved: 0,
    emoji: "🎯",
    color: "#c9a84c",
    deadline: "",
    linkedInvestments: [],
  });

  const allInvestments = useMemo(() => {
    const list1 = p1?.investments || (data?.investments ? data.investments : []);
    const list2 = p2?.investments || [];
    return [...list1, ...list2];
  }, [p1, p2, data]);

  const allGoals = useMemo(
    () => [...personalGoals, ...sharedGoals],
    [personalGoals, sharedGoals],
  );

  const addGoal = (type) => {
    if (!newGoal.name || !newGoal.target) return;
    if (type === "personal") {
      updatePerson("goals", [
        ...personalGoals,
        {
          ...newGoal,
          id: nextId(personalGoals),
          target: Number(newGoal.target),
          saved: Number(newGoal.saved),
          shared: false,
        },
      ]);
    } else {
      updateShared("goals", [
        ...sharedGoals,
        {
          ...newGoal,
          id: nextId(sharedGoals),
          target: Number(newGoal.target),
          p1Saved: Number(newGoal.p1Saved),
          p2Saved: Number(newGoal.p2Saved),
        },
      ]);
    }
    setNewGoal({
      name: "",
      target: "",
      saved: 0,
      p1Saved: 0,
      p2Saved: 0,
      emoji: "🎯",
      color: "#c9a84c",
      deadline: "",
      linkedInvestments: [],
    });
    setShowAdd(null);
  };

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        {isHousehold ? (
          "All Goals"
        ) : (
          <>
            <span style={{ color: personColor }}>{personName}&apos;s</span> Goals
          </>
        )}
      </div>

      {/* Personal goals */}
      {!isHousehold && (
        <div className="section-gap">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500 }}>Personal goals</div>
            <button
              className="btn-ghost"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
              }}
              onClick={() => setShowAdd("personal")}
            >
              <Plus size={13} /> Add
            </button>
          </div>
          {personalGoals.length === 0 && showAdd !== "personal" && (
            <EmptyState
              type="goal"
              title="No personal goals yet"
              description="Set a savings target — house, vacation, emergency fund — and connect your investments or cash."
              actionLabel="+ Add goal"
              onAction={() => setShowAdd("personal")}
            />
          )}
          {personalGoals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              isShared={false}
              personNames={personNames}
              p1Investments={p1?.investments || data?.investments || []}
              p2Investments={p2?.investments || []}
              allInvestments={allInvestments}
              allGoals={allGoals}
              onUpdate={(u) =>
                updatePerson(
                  "goals",
                  personalGoals.map((x) => (x.id === u.id ? u : x)),
                )
              }
              onDelete={() =>
                updatePerson(
                  "goals",
                  personalGoals.filter((x) => x.id !== g.id),
                )
              }
            />
          ))}
          {showAdd === "personal" && (
            <AddGoalForm
              form={newGoal}
              setForm={setNewGoal}
              onAdd={() => addGoal("personal")}
              onCancel={() => setShowAdd(null)}
              isShared={false}
              personNames={personNames}
              p1Investments={p1?.investments || data?.investments || []}
              p2Investments={p2?.investments || []}
              allInvestments={allInvestments}
              allGoals={allGoals}
            />
          )}
        </div>
      )}

      {/* Shared goals */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            🏠 Shared household goals
          </div>
          <button
            className="btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
            }}
            onClick={() => setShowAdd("shared")}
          >
            <Plus size={13} /> Add
          </button>
        </div>
        {sharedGoals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            isShared={true}
            personNames={personNames}
            p1Investments={p1?.investments || []}
            p2Investments={p2?.investments || []}
            allInvestments={allInvestments}
            allGoals={allGoals}
            onUpdate={(u) =>
              updateShared(
                "goals",
                sharedGoals.map((x) => (x.id === u.id ? u : x)),
              )
            }
            onDelete={() =>
              updateShared(
                "goals",
                sharedGoals.filter((x) => x.id !== g.id),
              )
            }
          />
        ))}
        {showAdd === "shared" && (
          <AddGoalForm
            form={newGoal}
            setForm={setNewGoal}
            onAdd={() => addGoal("shared")}
            onCancel={() => setShowAdd(null)}
            isShared={true}
            personNames={personNames}
            p1Investments={p1?.investments || []}
            p2Investments={p2?.investments || []}
            allInvestments={allInvestments}
            allGoals={allGoals}
          />
        )}
      </div>
    </div>
  );
}

function AddGoalForm({
  form,
  setForm,
  onAdd,
  onCancel,
  isShared,
  personNames,
  p1Investments = [],
  p2Investments = [],
  allGoals = [],
}) {
  const COLORS = [
    "#4caf82",
    "#5b9cf6",
    "#c9a84c",
    "#e05c5c",
    "#9b7fe8",
    "#d46eb3",
    "#f0875a",
  ];

  const handleAddLink = (invId, amount, person) => {
    const nextForm = linkInvestmentToGoal(form, invId, amount, person);
    setForm(nextForm);
  };

  const handleAddUnlink = (invId) => {
    const nextForm = unlinkInvestmentFromGoal(form, invId);
    setForm(nextForm);
  };

  const targetNum = Number(form.target || 0);

  return (
    <div className="card section-gap">
      <div className="card-title">
        New {isShared ? "Shared" : "Personal"} Goal
      </div>
      <div className="grid-2" style={{ marginBottom: 12 }}>
        <div>
          <label
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              display: "block",
              marginBottom: 4,
            }}
          >
            Goal name
          </label>
          <input
            placeholder="e.g. Home Down Payment"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              display: "block",
              marginBottom: 4,
            }}
          >
            Target (₹)
          </label>
          <AmountInput
            value={form.target}
            onChange={(val) => setForm({ ...form, target: val })}
            placeholder="e.g. 10,00,000"
          />
        </div>
        {isShared ? (
          <>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {personNames?.p1 || "Person 1"} cash saved (₹)
              </label>
              <AmountInput
                value={form.p1Saved || 0}
                onChange={(val) => setForm({ ...form, p1Saved: val })}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {personNames?.p2 || "Person 2"} cash saved (₹)
              </label>
              <AmountInput
                value={form.p2Saved || 0}
                onChange={(val) => setForm({ ...form, p2Saved: val })}
              />
            </div>
          </>
        ) : (
          <div>
            <label
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Cash saved so far (₹)
            </label>
            <AmountInput
              value={form.saved || 0}
              onChange={(val) => setForm({ ...form, saved: val })}
            />
          </div>
        )}
        <div>
          <label
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              display: "block",
              marginBottom: 4,
            }}
          >
            Deadline
          </label>
          <input
            type="month"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
        </div>
      </div>

      {/* Interactive Per-Person Investment Sourcing Hub */}
      {targetNum > 0 && (
        <div style={{ marginTop: 14, marginBottom: 14 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--gold)",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Sparkles size={14} />
            Investment Sourcing Capacity & Options:
          </div>

          {isShared ? (
            <>
              <PersonFundingHub
                person="p1"
                personName={personNames?.p1 || "Person 1"}
                personColor="var(--p1)"
                personInvestments={p1Investments}
                personCash={form.p1Saved || 0}
                targetShare={Math.round(targetNum / 2)}
                goal={form}
                allGoals={allGoals}
                onLinkInvestment={handleAddLink}
                onUnlinkInvestment={handleAddUnlink}
                months={monthsUntil(form.deadline)}
              />
              <PersonFundingHub
                person="p2"
                personName={personNames?.p2 || "Person 2"}
                personColor="var(--p2)"
                personInvestments={p2Investments}
                personCash={form.p2Saved || 0}
                targetShare={Math.round(targetNum / 2)}
                goal={form}
                allGoals={allGoals}
                onLinkInvestment={handleAddLink}
                onUnlinkInvestment={handleAddUnlink}
                months={monthsUntil(form.deadline)}
              />
            </>
          ) : (
            <PersonFundingHub
              person="p1"
              personName={personNames?.p1 || "My Portfolio"}
              personColor="var(--gold)"
              personInvestments={p1Investments}
              personCash={form.saved || 0}
              targetShare={targetNum}
              goal={form}
              allGoals={allGoals}
              onLinkInvestment={handleAddLink}
              onUnlinkInvestment={handleAddUnlink}
              months={monthsUntil(form.deadline)}
            />
          )}
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <label
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            display: "block",
            marginBottom: 8,
          }}
        >
          Icon
        </label>
        <div
          style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setForm({ ...form, emoji: e })}
              style={{
                width: 34,
                height: 34,
                fontSize: 17,
                borderRadius: 8,
                background:
                  form.emoji === e ? "var(--gold-dim)" : "var(--bg-card2)",
                border:
                  form.emoji === e
                    ? "1px solid var(--gold)"
                    : "1px solid var(--border)",
              }}
            >
              {e}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm({ ...form, color: c })}
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: c,
                border:
                  form.color === c
                    ? "2px solid white"
                    : "2px solid transparent",
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-primary" onClick={onAdd}>
          Add Goal
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}


