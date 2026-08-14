import { useState, useMemo } from "react";
import {
  calculateSettlement,
  generateSettlementShareText,
} from "../utils/settlement";
import { fmt, nextId } from "../utils/finance";
import {
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  Share2,
  ChevronDown,
  ChevronUp,
  History,
  Trash2,
  Sparkles,
  MessageCircle,
  Copy,
  Plus,
  Sliders,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "../hooks/useConfirm";

export default function SettlementCard({
  p1,
  p2,
  shared,
  month,
  personNames = { p1: "Person 1", p2: "Person 2" },
  updateShared,
  updatePerson,
}) {
  const [showItems, setShowItems] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMockTester, setShowMockTester] = useState(false);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { confirm, dialog } = useConfirm();

  const p1Name = personNames.p1 || "Person 1";
  const p2Name = personNames.p2 || "Person 2";

  // Mock tester state
  const [mockP1Paid, setMockP1Paid] = useState(45000);
  const [mockP2Paid, setMockP2Paid] = useState(20000);
  const [mockSplitRatio, setMockSplitRatio] = useState(50); // P1 %

  const settlement = useMemo(() => {
    return calculateSettlement(p1, p2, shared, month);
  }, [p1, p2, shared, month]);

  const [settleForm, setSettleForm] = useState({
    amount: settlement.amountOwed || 0,
    from: settlement.debtor || "p2",
    to: settlement.creditor || "p1",
    method: "UPI",
    note: "Monthly shared expense settlement",
    date: new Date().toISOString().slice(0, 10),
  });

  const handleOpenSettle = () => {
    setSettleForm({
      amount: settlement.amountOwed || 0,
      from: settlement.debtor || "p2",
      to: settlement.creditor || "p1",
      method: "UPI",
      note: `Settlement for ${month || "current month"}`,
      date: new Date().toISOString().slice(0, 10),
    });
    setSettleModalOpen(true);
  };

  const handleRecordSettlement = () => {
    if (!updateShared) return;
    const currentSettlements = shared?.settlements || [];
    const newEntry = {
      id: nextId(currentSettlements),
      date: settleForm.date,
      month: month || settleForm.date.slice(0, 7),
      amount: Number(settleForm.amount) || 0,
      from: settleForm.from,
      to: settleForm.to,
      method: settleForm.method,
      note: settleForm.note,
      createdAt: new Date().toISOString(),
    };

    updateShared("settlements", [...currentSettlements, newEntry]);
    toast.success("Settlement recorded successfully!");
    setSettleModalOpen(false);
  };

  const handleDeleteSettlement = async (settlementId) => {
    const ok = await confirm({
      title: "Delete Settlement Record?",
      message: "This will restore the outstanding balance for this month.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok || !updateShared) return;

    const currentSettlements = shared?.settlements || [];
    const updated = currentSettlements.filter((s) => s.id !== settlementId);
    updateShared("settlements", updated);
    toast.success("Settlement record removed");
  };

  // WhatsApp share handler
  const handleShareWhatsApp = (customText = null) => {
    const text = customText || generateSettlementShareText(settlement, personNames);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
    toast.success("Opening WhatsApp & copied breakdown to clipboard!");
  };

  const handleCopyText = (customText = null) => {
    const text = customText || generateSettlementShareText(settlement, personNames);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Settlement summary copied to clipboard!");
    }
  };

  // Injects realistic demo shared expenses
  const handleLoadDemoExpenses = () => {
    if (!updatePerson) {
      toast.info("Demo expenses ready in simulator below!");
      setShowMockTester(true);
      return;
    }

    const curYm = month || new Date().toISOString().slice(0, 7);
    const p1Current = p1?.expenses || [];
    const p2Current = p2?.expenses || [];

    const demoP1 = [
      ...p1Current,
      {
        id: "demo_groceries_" + Date.now(),
        name: "Nature's Basket Organic Groceries",
        category: "Groceries",
        amount: 6500,
        expenseType: "monthly",
        month: curYm,
        date: `${curYm}-04`,
        isSplit: true,
        splitWithPartner: true,
        splitMode: "50:50",
        paidBy: "p1",
      },
      {
        id: "demo_dinner_" + Date.now(),
        name: "Bastian Bandra Weekend Dinner",
        category: "Dining",
        amount: 4800,
        expenseType: "monthly",
        month: curYm,
        date: `${curYm}-11`,
        isSplit: true,
        splitWithPartner: true,
        splitMode: "50:50",
        paidBy: "p1",
      },
    ];

    const demoP2 = [
      ...p2Current,
      {
        id: "demo_wifi_" + Date.now(),
        name: "Airtel Fiber & Electricity Bill",
        category: "Utilities",
        amount: 3200,
        expenseType: "monthly",
        month: curYm,
        date: `${curYm}-08`,
        isSplit: true,
        splitWithPartner: true,
        splitMode: "50:50",
        paidBy: "p2",
      },
    ];

    updatePerson("p1", "expenses", demoP1);
    updatePerson("p2", "expenses", demoP2);
    toast.success("Loaded 3 demo shared expenses! Settlement card updated.");
  };

  const hasDemoItems = useMemo(() => {
    return (
      (p1?.expenses || []).some((e) => String(e.id).startsWith("demo_")) ||
      (p2?.expenses || []).some((e) => String(e.id).startsWith("demo_"))
    );
  }, [p1, p2]);

  const handleClearDemoExpenses = () => {
    if (!updatePerson) return;
    const cleanP1 = (p1?.expenses || []).filter((e) => !String(e.id).startsWith("demo_"));
    const cleanP2 = (p2?.expenses || []).filter((e) => !String(e.id).startsWith("demo_"));
    updatePerson("p1", "expenses", cleanP1);
    updatePerson("p2", "expenses", cleanP2);
    toast.success("Cleared demo shared expenses");
  };

  // Mock calculation
  const mockTotal = mockP1Paid + mockP2Paid;
  const mockP1Share = Math.round((mockTotal * mockSplitRatio) / 100);
  const mockP2Share = mockTotal - mockP1Share;
  const mockNet = mockP1Paid - mockP1Share; // positive = P2 owes P1

  const mockShareText = useMemo(() => {
    let t = `📊 *WealthOS Household Settlement* (${month || "Aug 2026"})\n`;
    t += `━━━━━━━━━━━━━━━━━━━━\n`;
    t += `💰 Total Shared: ${fmt(mockTotal)}\n`;
    t += `• ${p1Name} Paid: ${fmt(mockP1Paid)} (Share: ${fmt(mockP1Share)})\n`;
    t += `• ${p2Name} Paid: ${fmt(mockP2Paid)} (Share: ${fmt(mockP2Share)})\n`;
    t += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (mockNet > 0) {
      t += `👉 *${p2Name}* owes *${p1Name}*: *${fmt(mockNet)}*\n`;
    } else if (mockNet < 0) {
      t += `👉 *${p1Name}* owes *${p2Name}*: *${fmt(Math.abs(mockNet))}*\n`;
    } else {
      t += `✅ *All settled up!* No outstanding balance.\n`;
    }
    t += `\n🚀 Shared via WealthOS Couple Expense Engine`;
    return t;
  }, [mockTotal, mockP1Paid, mockP2Paid, mockP1Share, mockP2Share, mockNet, month, p1Name, p2Name]);

  const debtorName = settlement.debtor === "p1" ? p1Name : p2Name;
  const creditorName = settlement.creditor === "p1" ? p1Name : p2Name;
  const debtorColor = settlement.debtor === "p1" ? "var(--p1, #3b82f6)" : "var(--p2, #ec4899)";
  const creditorColor = settlement.creditor === "p1" ? "var(--p1, #3b82f6)" : "var(--p2, #ec4899)";

  const hasRealExpenses = settlement.expenses.length > 0 || (settlement.settlements && settlement.settlements.length > 0);

  return (
    <div
      className="card section-gap"
      style={{
        background: "linear-gradient(135deg, rgba(25,25,36,0.95), rgba(18,18,24,0.98))",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        backdropFilter: "blur(12px)",
        borderRadius: "var(--radius-lg, 16px)",
        padding: "22px",
        marginBottom: "1.5rem",
      }}
    >
      {dialog}

      {/* ── Top Header & Status ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: hasRealExpenses && settlement.isSettled ? "rgba(16,185,129,0.15)" : "rgba(201,168,76,0.15)",
              color: hasRealExpenses && settlement.isSettled ? "var(--green, #10b981)" : "var(--gold, #c9a84c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${hasRealExpenses && settlement.isSettled ? "rgba(16,185,129,0.3)" : "rgba(201,168,76,0.3)"}`,
            }}
          >
            {hasRealExpenses && settlement.isSettled ? <CheckCircle2 size={22} /> : <ArrowRightLeft size={22} />}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-muted, #9896a0)" }}>
              Household Split Balance
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {!hasRealExpenses ? (
                <span style={{ color: "var(--text-primary, #eeeae4)" }}>
                  Monthly Split Balance ({month || "Current Month"})
                </span>
              ) : settlement.isSettled ? (
                <span style={{ color: "var(--green, #10b981)" }}>All settled up 🎉</span>
              ) : (
                <span>
                  <strong style={{ color: debtorColor }}>{debtorName}</strong> owes{" "}
                  <strong style={{ color: creditorColor }}>{creditorName}</strong>:{" "}
                  <span style={{ color: "var(--gold, #c9a84c)", fontSize: 18 }}>{fmt(settlement.amountOwed)}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Header Action Buttons ── */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* WhatsApp Share Button */}
          <button
            onClick={() => handleShareWhatsApp()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 13px",
              borderRadius: 8,
              background: "#25D366",
              color: "#0c0c0f",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(37, 211, 102, 0.3)",
              transition: "all 0.15s ease",
            }}
            title="Share breakdown on WhatsApp"
          >
            <MessageCircle size={15} color="#0c0c0f" />
            <span>Share on WhatsApp</span>
          </button>

          {/* Copy Summary */}
          <button
            onClick={() => handleCopyText()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 500,
              padding: "7px 12px",
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.05)",
              color: "var(--text-primary, #eeeae4)",
              border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
              cursor: "pointer",
            }}
            title="Copy breakdown text"
          >
            {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>

          {/* Settle Up Button */}
          {hasRealExpenses && !settlement.isSettled && (
            <button
              onClick={handleOpenSettle}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "7px 14px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "linear-gradient(135deg, var(--gold, #c9a84c), #b39238)",
                color: "#000",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              <Sparkles size={14} /> Settle Up
            </button>
          )}

          {/* Clear Demo Expenses Button */}
          {hasDemoItems && (
            <button
              onClick={handleClearDemoExpenses}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 500,
                padding: "7px 12px",
                borderRadius: 8,
                background: "rgba(239, 68, 68, 0.12)",
                color: "var(--red, #ef4444)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                cursor: "pointer",
              }}
              title="Remove demo test expenses"
            >
              <Trash2 size={13} />
              <span>Clear Demo</span>
            </button>
          )}

          {/* Mock Tester Toggle */}
          <button
            onClick={() => setShowMockTester(!showMockTester)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 500,
              padding: "7px 12px",
              borderRadius: 8,
              background: showMockTester ? "rgba(201, 168, 76, 0.18)" : "rgba(255, 255, 255, 0.05)",
              color: showMockTester ? "var(--gold, #c9a84c)" : "var(--text-secondary, #c4c2cc)",
              border: showMockTester ? "1px solid var(--gold, #c9a84c)" : "1px solid var(--border, rgba(255, 255, 255, 0.1))",
              cursor: "pointer",
            }}
            title="Open Interactive WhatsApp Simulator"
          >
            <Sliders size={14} />
            <span>{showMockTester ? "Hide Simulator" : "🧪 Test Simulator"}</span>
          </button>
        </div>
      </div>

      {/* ── Empty State Helper when no real split expenses logged ── */}
      {!hasRealExpenses && (
        <div
          style={{
            background: "rgba(201, 168, 76, 0.05)",
            border: "1px dashed rgba(201, 168, 76, 0.3)",
            borderRadius: 10,
            padding: "16px",
            marginBottom: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary, #eeeae4)" }}>
              No shared expenses logged for {month || "this month"} yet
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted, #9896a0)", marginTop: 2 }}>
              You can toggle "Split with Partner" on any individual expense, or click below to populate mock expenses.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={handleLoadDemoExpenses}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 6,
                background: "rgba(201, 168, 76, 0.15)",
                color: "var(--gold, #c9a84c)",
                border: "1px solid var(--gold, #c9a84c)",
                cursor: "pointer",
              }}
            >
              <Plus size={14} /> 🧪 Load Demo Shared Expenses
            </button>
          </div>
        </div>
      )}

      {/* ── Real Settlement Metrics Overview ── */}
      {hasRealExpenses && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--text-muted, #9896a0)" }}>Total Shared Spend</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4, color: "#ffffff" }}>
              {fmt(settlement.totalSharedAmount)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted, #9896a0)", marginTop: 2 }}>
              {settlement.expenses.length} split item{settlement.expenses.length === 1 ? "" : "s"}
            </div>
          </div>

          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--p1, #3b82f6)" }}>{p1Name} Paid</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4, color: "var(--p1, #3b82f6)" }}>
              {fmt(settlement.p1PaidTotal)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted, #9896a0)", marginTop: 2 }}>
              Expected Share: {fmt(settlement.p1ObligationTotal)}
            </div>
          </div>

          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--p2, #ec4899)" }}>{p2Name} Paid</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4, color: "var(--p2, #ec4899)" }}>
              {fmt(settlement.p2PaidTotal)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted, #9896a0)", marginTop: 2 }}>
              Expected Share: {fmt(settlement.p2ObligationTotal)}
            </div>
          </div>

          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--gold, #c9a84c)" }}>Net Settlement</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4, color: settlement.isSettled ? "var(--green, #10b981)" : "var(--gold, #c9a84c)" }}>
              {settlement.isSettled ? "₹0 (Settled)" : fmt(settlement.amountOwed)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted, #9896a0)", marginTop: 2 }}>
              {settlement.isSettled ? "All balances cleared" : `${debtorName} → ${creditorName}`}
            </div>
          </div>
        </div>
      )}

      {/* ── Interactive Live WhatsApp Settlement Tester ── */}
      {showMockTester && (
        <div
          style={{
            background: "rgba(18, 22, 34, 0.95)",
            border: "1px solid rgba(201, 168, 76, 0.25)",
            borderRadius: 12,
            padding: "16px",
            marginBottom: 16,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>🧪</span>
              <strong style={{ fontSize: 13, color: "var(--gold, #c9a84c)" }}>
                Interactive Live WhatsApp Settlement Simulator
              </strong>
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted, #9896a0)" }}>
              Tweak numbers to see instant WhatsApp message preview
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 14 }}>
            {/* P1 Input */}
            <div>
              <label style={{ fontSize: 11, color: "var(--p1, #3b82f6)", fontWeight: 600, display: "block", marginBottom: 4 }}>
                {p1Name} Paid Amount (₹):
              </label>
              <input
                type="number"
                step="1000"
                value={mockP1Paid}
                onChange={(e) => setMockP1Paid(Number(e.target.value) || 0)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border, rgba(255,255,255,0.15))",
                  background: "rgba(0,0,0,0.4)",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              />
            </div>

            {/* P2 Input */}
            <div>
              <label style={{ fontSize: 11, color: "var(--p2, #ec4899)", fontWeight: 600, display: "block", marginBottom: 4 }}>
                {p2Name} Paid Amount (₹):
              </label>
              <input
                type="number"
                step="1000"
                value={mockP2Paid}
                onChange={(e) => setMockP2Paid(Number(e.target.value) || 0)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border, rgba(255,255,255,0.15))",
                  background: "rgba(0,0,0,0.4)",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              />
            </div>

            {/* Split Ratio */}
            <div>
              <label style={{ fontSize: 11, color: "var(--gold, #c9a84c)", fontWeight: 600, display: "block", marginBottom: 4 }}>
                Split Ratio ({mockSplitRatio}% {p1Name} / {100 - mockSplitRatio}% {p2Name}):
              </label>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={mockSplitRatio}
                onChange={(e) => setMockSplitRatio(Number(e.target.value))}
                style={{ width: "100%", marginTop: 6 }}
              />
            </div>
          </div>

          {/* Live WhatsApp Message Preview Box */}
          <div
            style={{
              background: "#075e54",
              backgroundImage: "linear-gradient(135deg, #0b4038 0%, #075e54 100%)",
              border: "1px solid rgba(37, 211, 102, 0.4)",
              borderRadius: 10,
              padding: "14px",
              color: "#ffffff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#25D366", display: "flex", alignItems: "center", gap: 5 }}>
                <MessageCircle size={14} /> WhatsApp Message Preview:
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => handleCopyText(mockShareText)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "4px 8px",
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Copy
                </button>
                <button
                  onClick={() => handleShareWhatsApp(mockShareText)}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 4,
                    background: "#25D366",
                    color: "#0c0c0f",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Send to WhatsApp ➔
                </button>
              </div>
            </div>
            <pre
              style={{
                margin: 0,
                fontFamily: "inherit",
                fontSize: 12,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                color: "#e2f7ea",
              }}
            >
              {mockShareText}
            </pre>
          </div>
        </div>
      )}

      {/* ── Toggle Item Details & History ── */}
      {hasRealExpenses && (
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button
            onClick={() => setShowItems(!showItems)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              color: "var(--text-secondary, #c4c2cc)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {showItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{showItems ? "Hide item breakdown" : `View ${settlement.expenses.length} shared items`}</span>
          </button>

          {settlement.settlements && settlement.settlements.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                color: "var(--text-secondary, #c4c2cc)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                marginLeft: 12,
              }}
            >
              <History size={14} />
              <span>{showHistory ? "Hide past payments" : `Past payments (${settlement.settlements.length})`}</span>
            </button>
          )}
        </div>
      )}

      {/* ── Item Breakdown List ── */}
      {showItems && hasRealExpenses && (
        <div
          style={{
            marginTop: 14,
            padding: "12px",
            background: "rgba(0,0,0,0.25)",
            borderRadius: 8,
            border: "1px solid var(--border, rgba(255,255,255,0.06))",
          }}
        >
          {settlement.expenses.map((exp) => (
            <div
              key={exp.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                fontSize: 12,
              }}
            >
              <div>
                <strong style={{ color: "var(--text-primary, #eeeae4)" }}>{exp.name}</strong>
                <span style={{ color: "var(--text-muted, #9896a0)", marginLeft: 6 }}>
                  (Paid by {exp.paidBy === "p1" ? p1Name : p2Name} · {exp.splitMode})
                </span>
              </div>
              <div style={{ fontWeight: 600, color: "var(--gold, #c9a84c)" }}>
                {fmt(exp.amount)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Past Settlements History ── */}
      {showHistory && settlement.settlements && settlement.settlements.length > 0 && (
        <div
          style={{
            marginTop: 14,
            padding: "12px",
            background: "rgba(0,0,0,0.25)",
            borderRadius: 8,
            border: "1px solid var(--border, rgba(255,255,255,0.06))",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted, #9896a0)", marginBottom: 8 }}>
            Settlement Payment History ({month || "This Month"})
          </div>
          {settlement.settlements.map((s) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                fontSize: 12,
              }}
            >
              <div>
                <strong style={{ color: "var(--green, #10b981)" }}>{fmt(s.amount)}</strong>
                <span style={{ color: "var(--text-muted, #9896a0)", marginLeft: 6 }}>
                  ({s.from === "p1" ? p1Name : p2Name} → {s.to === "p1" ? p1Name : p2Name} via {s.method || "UPI"})
                </span>
                {s.note && <span style={{ fontSize: 11, color: "var(--text-muted, #9896a0)", marginLeft: 6 }}>· {s.note}</span>}
              </div>
              <button
                onClick={() => handleDeleteSettlement(s.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--red, #ef4444)",
                  cursor: "pointer",
                  padding: "2px 6px",
                }}
                title="Delete settlement"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Settlement Recording Modal ── */}
      {settleModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(10, 10, 15, 0.85)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#181824",
              border: "1px solid var(--border, rgba(255,255,255,0.15))",
              borderRadius: 14,
              padding: 22,
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            }}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "var(--text-primary, #eeeae4)" }}>
              Record Settlement Payment
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted, #9896a0)" }}>Payment Amount (₹)</label>
                <input
                  type="number"
                  value={settleForm.amount}
                  onChange={(e) => setSettleForm({ ...settleForm, amount: Number(e.target.value) })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(0,0,0,0.3)",
                    color: "#ffffff",
                    marginTop: 4,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted, #9896a0)" }}>Payment Method</label>
                <select
                  value={settleForm.method}
                  onChange={(e) => setSettleForm({ ...settleForm, method: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "#181824",
                    color: "#ffffff",
                    marginTop: 4,
                  }}
                >
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Bank Transfer">Bank NEFT / IMPS</option>
                  <option value="Cash">Cash</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--text-muted, #9896a0)" }}>Note / Reference</label>
                <input
                  type="text"
                  value={settleForm.note}
                  onChange={(e) => setSettleForm({ ...settleForm, note: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(0,0,0,0.3)",
                    color: "#ffffff",
                    marginTop: 4,
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => setSettleModalOpen(false)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.06)",
                    color: "var(--text-primary, #eeeae4)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordSettlement}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 6,
                    background: "var(--gold, #c9a84c)",
                    color: "#0c0c0f",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Confirm Settlement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
