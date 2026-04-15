import { useState } from "react";
import { Chart } from "../components/Chart";
import { fmtCr, fmt, nextId, lumpCorpus } from "../utils/finance";
import { Camera, Download, Plus, Trash2 } from "lucide-react";
import { useConfirm } from "../hooks/useConfirm";

const MANUAL_ASSET_TYPES = [
  "cash",
  "property",
  "gold_physical",
  "vehicle",
  "other",
];
const MANUAL_LIABILITY_TYPES = ["credit_card", "mortgage", "other"];

const NW_BANK_LIST = [
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "State Bank of India",
  "Bank of Baroda",
  "Punjab National Bank",
  "IDFC First Bank",
  "IndusInd Bank",
  "Yes Bank",
  "AU Small Finance Bank",
  "Federal Bank",
  "Canara Bank",
  "Union Bank of India",
];

/* ---------- auto-derive from investments & debts sections ---------- */
function autoAssets(data) {
  return (data?.investments || []).map((inv) => {
    const isFDType = inv.type === "FD";
    const isOneTime = inv.frequency === "onetime";
    let value;
    if (isFDType) {
      const now = new Date();
      const start = inv.startDate ? new Date(inv.startDate) : now;
      const elapsed = Math.max(0, (now - start) / (365.25 * 86400000));
      value = lumpCorpus(inv.amount || 0, inv.returnPct || 0, elapsed);
    } else if (isOneTime) {
      const now = new Date();
      const start = inv.startDate ? new Date(inv.startDate) : now;
      const elapsed = Math.max(0, (now - start) / (365.25 * 86400000));
      value = lumpCorpus(
        (inv.existingCorpus || 0) + (inv.amount || 0),
        inv.returnPct || 0,
        elapsed,
      );
    } else {
      // Regular SIP: existingCorpus IS the current portfolio value (from user's investment app)
      value = inv.existingCorpus || 0;
    }
    return {
      name: inv.name,
      value: Math.round(value),
      type: inv.type,
      auto: true,
    };
  });
}

function autoLiabilities(data) {
  return (data?.debts || []).map((d) => ({
    name: d.name,
    value: d.outstanding || 0,
    type: "loan",
    auto: true,
  }));
}

function calcNetWorth(data) {
  const invAssets = autoAssets(data);
  const debtLiabilities = autoLiabilities(data);
  const manualAssets = (data?.assets || []).filter((a) => !a.auto);
  const manualLiabilities = (data?.liabilities || []).filter((l) => !l.auto);
  const savingsAccounts = data?.savingsAccounts || [];
  const savingsTotal = savingsAccounts.reduce(
    (s, a) => s + (a.balance || 0),
    0,
  );

  const totalAssets =
    invAssets.reduce((s, a) => s + a.value, 0) +
    manualAssets.reduce((s, a) => s + (a.value || 0), 0) +
    savingsTotal;
  const totalLiabilities =
    debtLiabilities.reduce((s, l) => s + l.value, 0) +
    manualLiabilities.reduce((s, l) => s + (l.value || 0), 0);

  return {
    assets: totalAssets,
    liabilities: totalLiabilities,
    net: totalAssets - totalLiabilities,
    invAssets,
    debtLiabilities,
    manualAssets,
    manualLiabilities,
    savingsAccounts,
    savingsTotal,
  };
}

function AssetsEditor({
  person,
  data,
  color,
  updatePerson,
  confirm,
  personNames,
}) {
  const nw = calcNetWorth(data);

  const addAsset = () =>
    updatePerson(person, "assets", [
      ...(data?.assets || []),
      { id: nextId(data?.assets || []), name: "", value: 0, type: "cash" },
    ]);
  const addLiability = () =>
    updatePerson(person, "liabilities", [
      ...(data?.liabilities || []),
      {
        id: nextId(data?.liabilities || []),
        name: "",
        value: 0,
        type: "credit_card",
      },
    ]);

  const autoRowStyle = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    marginBottom: 6,
    opacity: 0.7,
    fontSize: 13,
  };
  const tagStyle = {
    fontSize: 9,
    background: "var(--bg-card2)",
    padding: "1px 6px",
    borderRadius: 4,
    color: "var(--text-muted)",
    flexShrink: 0,
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
          }}
        />
        <div style={{ fontWeight: 500, fontSize: 14, color }}>
          {personNames?.[person] || person}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 13 }}>
          Net worth: <strong style={{ color }}>{fmtCr(nw.net)}</strong>
        </div>
      </div>

      {/* ── ASSETS ── */}
      <div style={{ marginBottom: "1rem" }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: ".06em",
            marginBottom: 8,
          }}
        >
          Assets
        </div>

        {/* Auto from Investments */}
        {nw.invAssets.map((a, i) => (
          <div key={`inv-${i}`} style={autoRowStyle}>
            <span style={{ flex: 2 }}>{a.name}</span>
            <span style={tagStyle}>from Investments</span>
            <span
              style={{ flex: 1, textAlign: "right", color: "var(--green)" }}
            >
              {fmt(a.value)}
            </span>
          </div>
        ))}

        {/* ── Savings & Bank Accounts ── */}
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: ".05em",
            marginTop: nw.invAssets.length > 0 ? 12 : 0,
            marginBottom: 6,
          }}
        >
          Savings &amp; Bank Accounts
        </div>
        {nw.savingsAccounts.map((acc) => {
          const rate = acc.interestRate ?? 3.5;
          const annualInterest = Math.round(((acc.balance || 0) * rate) / 100);
          return (
            <div
              key={acc.id}
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <input
                value={acc.bankName || ""}
                placeholder="Bank name"
                list={`nw-bank-list-${person}`}
                onChange={(e) =>
                  updatePerson(
                    person,
                    "savingsAccounts",
                    (data?.savingsAccounts || []).map((x) =>
                      x.id === acc.id ? { ...x, bankName: e.target.value } : x,
                    ),
                  )
                }
                style={{ flex: 2, minWidth: 0 }}
              />
              <datalist id={`nw-bank-list-${person}`}>
                {NW_BANK_LIST.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
              <input
                type="number"
                value={acc.balance || ""}
                placeholder="Balance ₹"
                min="0"
                onChange={(e) =>
                  updatePerson(
                    person,
                    "savingsAccounts",
                    (data?.savingsAccounts || []).map((x) =>
                      x.id === acc.id
                        ? { ...x, balance: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
                style={{ flex: 1.5, minWidth: 0 }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  flexShrink: 0,
                }}
              >
                <input
                  type="number"
                  value={rate}
                  step="0.1"
                  min="0"
                  max="15"
                  title="Interest rate % p.a."
                  onChange={(e) =>
                    updatePerson(
                      person,
                      "savingsAccounts",
                      (data?.savingsAccounts || []).map((x) =>
                        x.id === acc.id
                          ? { ...x, interestRate: Number(e.target.value) }
                          : x,
                      ),
                    )
                  }
                  style={{ width: 52 }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  %
                </span>
              </div>
              {acc.balance > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--green)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    minWidth: 64,
                    textAlign: "right",
                  }}
                  title={`₹${annualInterest.toLocaleString("en-IN")} interest per year at ${rate}%`}
                >
                  {fmt(acc.balance)}
                </span>
              )}
              <button
                className="btn-danger"
                aria-label={`Remove ${acc.bankName || "account"}`}
                onClick={async () => {
                  if (
                    await confirm(
                      "Remove account?",
                      `Remove "${acc.bankName || "this account"}"?`,
                    )
                  )
                    updatePerson(
                      person,
                      "savingsAccounts",
                      (data?.savingsAccounts || []).filter(
                        (x) => x.id !== acc.id,
                      ),
                    );
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
        {nw.savingsTotal > 0 &&
          (() => {
            const avgRate =
              nw.savingsAccounts.reduce(
                (s, a) => s + (a.interestRate ?? 3.5),
                0,
              ) / nw.savingsAccounts.length;
            const annualEarned = Math.round((nw.savingsTotal * avgRate) / 100);
            const oppLoss = Math.round(
              (nw.savingsTotal * (12 - avgRate)) / 100,
            );
            return (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  background: "var(--bg-card2)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  marginBottom: 6,
                  lineHeight: 1.6,
                }}
              >
                Earning ~{fmt(annualEarned)}/yr at {avgRate.toFixed(1)}% avg
                {oppLoss > 0 && (
                  <span style={{ color: "#fbbf24", marginLeft: 6 }}>
                    · {fmt(oppLoss)}/yr opportunity cost vs 12% equity
                  </span>
                )}
              </div>
            );
          })()}
        <button
          className="btn-ghost"
          style={{
            padding: "4px 10px",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 8,
          }}
          onClick={() =>
            updatePerson(person, "savingsAccounts", [
              ...(data?.savingsAccounts || []),
              {
                id: nextId(data?.savingsAccounts || []),
                bankName: "",
                balance: 0,
                interestRate: 3.5,
              },
            ])
          }
        >
          <Plus size={11} /> Add savings account
        </button>

        {/* Manual assets */}
        {nw.manualAssets.map((a) => (
          <div
            key={a.id}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <input
              value={a.name}
              placeholder="Asset name"
              onChange={(e) =>
                updatePerson(
                  person,
                  "assets",
                  (data?.assets || []).map((x) =>
                    x.id === a.id ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
              style={{ flex: 2 }}
            />
            <select
              value={a.type}
              onChange={(e) =>
                updatePerson(
                  person,
                  "assets",
                  (data?.assets || []).map((x) =>
                    x.id === a.id ? { ...x, type: e.target.value } : x,
                  ),
                )
              }
              style={{ flex: 1 }}
            >
              {MANUAL_ASSET_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input
              type="number"
              value={a.value}
              onChange={(e) =>
                updatePerson(
                  person,
                  "assets",
                  (data?.assets || []).map((x) =>
                    x.id === a.id ? { ...x, value: Number(e.target.value) } : x,
                  ),
                )
              }
              style={{ flex: 1 }}
              min="0"
            />
            <button
              className="btn-danger"
              aria-label={`Delete ${a.name}`}
              onClick={async () => {
                if (await confirm("Delete asset?", `Remove "${a.name}"?`))
                  updatePerson(
                    person,
                    "assets",
                    (data?.assets || []).filter((x) => x.id !== a.id),
                  );
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        <button
          className="btn-ghost"
          style={{
            padding: "4px 10px",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 4,
          }}
          onClick={addAsset}
        >
          <Plus size={11} /> Add manual asset
        </button>
        <div
          style={{
            textAlign: "right",
            fontSize: 13,
            color: "var(--green)",
            fontWeight: 500,
            marginTop: 8,
          }}
        >
          Total assets: {fmtCr(nw.assets)}
        </div>
      </div>

      {/* ── LIABILITIES ── */}
      <div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: ".06em",
            marginBottom: 8,
          }}
        >
          Liabilities
        </div>

        {/* Auto from Debts */}
        {nw.debtLiabilities.map((l, i) => (
          <div key={`debt-${i}`} style={autoRowStyle}>
            <span style={{ flex: 2 }}>{l.name}</span>
            <span style={tagStyle}>from Debts</span>
            <span style={{ flex: 1, textAlign: "right", color: "var(--red)" }}>
              {fmt(l.value)}
            </span>
          </div>
        ))}

        {/* Manual liabilities */}
        {nw.manualLiabilities.map((l) => (
          <div
            key={l.id}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <input
              value={l.name}
              placeholder="Liability name"
              onChange={(e) =>
                updatePerson(
                  person,
                  "liabilities",
                  (data?.liabilities || []).map((x) =>
                    x.id === l.id ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
              style={{ flex: 2 }}
            />
            <select
              value={l.type}
              onChange={(e) =>
                updatePerson(
                  person,
                  "liabilities",
                  (data?.liabilities || []).map((x) =>
                    x.id === l.id ? { ...x, type: e.target.value } : x,
                  ),
                )
              }
              style={{ flex: 1 }}
            >
              {MANUAL_LIABILITY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input
              type="number"
              value={l.value}
              onChange={(e) =>
                updatePerson(
                  person,
                  "liabilities",
                  (data?.liabilities || []).map((x) =>
                    x.id === l.id ? { ...x, value: Number(e.target.value) } : x,
                  ),
                )
              }
              style={{ flex: 1 }}
              min="0"
            />
            <button
              className="btn-danger"
              aria-label={`Delete ${l.name}`}
              onClick={async () => {
                if (await confirm("Delete liability?", `Remove "${l.name}"?`))
                  updatePerson(
                    person,
                    "liabilities",
                    (data?.liabilities || []).filter((x) => x.id !== l.id),
                  );
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        <button
          className="btn-ghost"
          style={{
            padding: "4px 10px",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 4,
          }}
          onClick={addLiability}
        >
          <Plus size={11} /> Add manual liability
        </button>

        {(nw.debtLiabilities.length > 0 || nw.manualLiabilities.length > 0) && (
          <div
            style={{
              textAlign: "right",
              fontSize: 13,
              color: "var(--red)",
              fontWeight: 500,
              marginTop: 8,
            }}
          >
            Total liabilities: {fmtCr(nw.liabilities)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NetWorth({
  p1,
  p2,
  shared,
  updatePerson,
  updateShared,
  takeSnapshot,
  personNames,
}) {
  const [activeTab, setActiveTab] = useState("timeline");
  const [snapshotDone, setSnapshotDone] = useState(false);
  const { confirm, dialog } = useConfirm();

  const history = shared?.netWorthHistory || [];

  const aStats = calcNetWorth(p1);
  const bStats = calcNetWorth(p2);
  const hNet = aStats.net + bStats.net;
  const hAssets = aStats.assets + bStats.assets;
  const hLiabilities = aStats.liabilities + bStats.liabilities;

  const handleSnapshot = () => {
    takeSnapshot();
    setSnapshotDone(true);
    setTimeout(() => setSnapshotDone(false), 3000);
  };

  const exportNetWorth = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const p1Name = personNames?.p1 || "Person 1";
    const p2Name = personNames?.p2 || "Person 2";
    const today = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const rows = [];
    const section = (title) => {
      rows.push([]);
      rows.push([title]);
    };

    rows.push([`WealthOS — Net Worth Export`].map(esc).join(","));
    rows.push([`Exported: ${today}`].map(esc).join(","));

    // ── Savings accounts ─────────────────────────────────────────────
    section("SAVINGS ACCOUNTS");
    rows.push(
      ["Person", "Bank", "Balance (₹)", "Interest Rate (%)"].map(esc).join(","),
    );
    [
      [p1Name, aStats.savingsAccounts],
      [p2Name, bStats.savingsAccounts],
    ].forEach(([name, accounts]) => {
      accounts.forEach((acc) =>
        rows.push(
          [name, acc.bankName || "—", acc.balance || 0, acc.interestRate ?? 3.5]
            .map(esc)
            .join(","),
        ),
      );
    });

    // ── Investment assets (current value) ────────────────────────────
    section("INVESTMENT PORTFOLIO (Current Value)");
    rows.push(
      ["Person", "Name", "Type", "Current Value (₹)"].map(esc).join(","),
    );
    [
      [p1Name, aStats.invAssets],
      [p2Name, bStats.invAssets],
    ].forEach(([name, assets]) => {
      assets.forEach((a) =>
        rows.push([name, a.name, a.type, a.value].map(esc).join(",")),
      );
    });

    // ── Manual assets ────────────────────────────────────────────────
    const allManual = [
      ...aStats.manualAssets.map((a) => ({ ...a, _person: p1Name })),
      ...bStats.manualAssets.map((a) => ({ ...a, _person: p2Name })),
    ];
    if (allManual.length > 0) {
      section("MANUAL ASSETS");
      rows.push(["Person", "Name", "Type", "Value (₹)"].map(esc).join(","));
      allManual.forEach((a) =>
        rows.push([a._person, a.name, a.type, a.value || 0].map(esc).join(",")),
      );
    }

    // ── Summary ──────────────────────────────────────────────────────
    const aInvTotal = aStats.invAssets.reduce((s, a) => s + a.value, 0);
    const bInvTotal = bStats.invAssets.reduce((s, a) => s + a.value, 0);
    section("SUMMARY");
    rows.push(["", p1Name, p2Name, "Household"].map(esc).join(","));
    rows.push(
      [
        "Savings",
        aStats.savingsTotal,
        bStats.savingsTotal,
        aStats.savingsTotal + bStats.savingsTotal,
      ]
        .map(esc)
        .join(","),
    );
    rows.push(
      ["Investment Value", aInvTotal, bInvTotal, aInvTotal + bInvTotal]
        .map(esc)
        .join(","),
    );
    rows.push(
      ["Total Assets", aStats.assets, bStats.assets, hAssets]
        .map(esc)
        .join(","),
    );
    rows.push(
      [
        "Total Liabilities",
        aStats.liabilities,
        bStats.liabilities,
        hLiabilities,
      ]
        .map(esc)
        .join(","),
    );
    rows.push(["Net Worth", aStats.net, bStats.net, hNet].map(esc).join(","));

    const content = rows
      .map((r) => (Array.isArray(r) ? r.join(",") : r))
      .join("\n");
    const blob = new Blob(["\uFEFF" + content], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `net-worth-${new Date().toISOString().slice(0, 7)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportNetWorthText = () => {
    const p1Name = personNames?.p1 || "Person 1";
    const p2Name = personNames?.p2 || "Person 2";
    const today = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const pad = (s, w) => String(s).padEnd(w);
    const rpad = (s, w) => String(s).padStart(w);
    const divider = "─".repeat(54);
    const lines = [];
    lines.push("WealthOS — Net Worth Report");
    lines.push(`Exported: ${today}`);
    lines.push(divider);
    lines.push("");
    lines.push("SAVINGS ACCOUNTS");
    lines.push(divider);
    for (const [name, accounts] of [
      [p1Name, aStats.savingsAccounts],
      [p2Name, bStats.savingsAccounts],
    ]) {
      for (const acc of accounts) {
        lines.push(
          `  ${pad(name + " · " + (acc.bankName || "Bank"), 34)} ${rpad("₹" + (acc.balance || 0).toLocaleString("en-IN"), 16)}`,
        );
      }
    }
    lines.push("");
    lines.push("INVESTMENT PORTFOLIO");
    lines.push(divider);
    for (const [name, assets] of [
      [p1Name, aStats.invAssets],
      [p2Name, bStats.invAssets],
    ]) {
      for (const a of assets) {
        lines.push(
          `  ${pad(name + " · " + a.name, 34)} ${rpad("₹" + Math.round(a.value).toLocaleString("en-IN"), 16)}`,
        );
      }
    }
    if (aStats.manualAssets.length + bStats.manualAssets.length > 0) {
      lines.push("");
      lines.push("MANUAL ASSETS");
      lines.push(divider);
      for (const a of [
        ...aStats.manualAssets.map((x) => ({ ...x, _p: p1Name })),
        ...bStats.manualAssets.map((x) => ({ ...x, _p: p2Name })),
      ]) {
        lines.push(
          `  ${pad(a._p + " · " + a.name, 34)} ${rpad("₹" + (a.value || 0).toLocaleString("en-IN"), 16)}`,
        );
      }
    }
    lines.push("");
    lines.push("SUMMARY");
    lines.push(divider);
    lines.push(
      `  ${pad("", 24)} ${rpad(p1Name, 14)} ${rpad(p2Name, 14)} ${rpad("Household", 14)}`,
    );
    lines.push(
      `  ${pad("Savings", 24)} ${rpad("₹" + aStats.savingsTotal.toLocaleString("en-IN"), 14)} ${rpad("₹" + bStats.savingsTotal.toLocaleString("en-IN"), 14)} ${rpad("₹" + (aStats.savingsTotal + bStats.savingsTotal).toLocaleString("en-IN"), 14)}`,
    );
    const aInv = aStats.invAssets.reduce((s, a) => s + a.value, 0);
    const bInv = bStats.invAssets.reduce((s, a) => s + a.value, 0);
    lines.push(
      `  ${pad("Investments", 24)} ${rpad("₹" + Math.round(aInv).toLocaleString("en-IN"), 14)} ${rpad("₹" + Math.round(bInv).toLocaleString("en-IN"), 14)} ${rpad("₹" + Math.round(aInv + bInv).toLocaleString("en-IN"), 14)}`,
    );
    lines.push(
      `  ${pad("Total Assets", 24)} ${rpad("₹" + aStats.assets.toLocaleString("en-IN"), 14)} ${rpad("₹" + bStats.assets.toLocaleString("en-IN"), 14)} ${rpad("₹" + hAssets.toLocaleString("en-IN"), 14)}`,
    );
    lines.push(
      `  ${pad("Liabilities", 24)} ${rpad("₹" + aStats.liabilities.toLocaleString("en-IN"), 14)} ${rpad("₹" + bStats.liabilities.toLocaleString("en-IN"), 14)} ${rpad("₹" + hLiabilities.toLocaleString("en-IN"), 14)}`,
    );
    lines.push(
      `  ${pad("NET WORTH", 24)} ${rpad("₹" + aStats.net.toLocaleString("en-IN"), 14)} ${rpad("₹" + bStats.net.toLocaleString("en-IN"), 14)} ${rpad("₹" + hNet.toLocaleString("en-IN"), 14)}`,
    );
    lines.push("");
    lines.push("Generated by WealthOS");
    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `net-worth-${new Date().toISOString().slice(0, 7)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportNetWorthPDF = () => {
    const p1Name = personNames?.p1 || "Person 1";
    const p2Name = personNames?.p2 || "Person 2";
    const today = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const fmtN = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
    const row = (label, av, bv, hv, bold) =>
      `<tr style="${bold ? "border-top:2px solid #c9a84c;" : "border-top:1px solid #eee;"}">
        <td style="padding:7px 12px;font-weight:${bold ? 700 : 400};color:${bold ? "#c9a84c" : "#222"};font-size:13px;">${label}</td>
        <td style="padding:7px 12px;text-align:right;font-weight:${bold ? 700 : 400};color:${bold ? "#c9a84c" : "#222"};font-size:13px;">${fmtN(av)}</td>
        <td style="padding:7px 12px;text-align:right;font-weight:${bold ? 700 : 400};color:${bold ? "#c9a84c" : "#222"};font-size:13px;">${fmtN(bv)}</td>
        <td style="padding:7px 12px;text-align:right;font-weight:${bold ? 700 : 400};color:${bold ? "#c9a84c" : "#222"};font-size:13px;">${fmtN(hv)}</td>
      </tr>`;
    const aInv = aStats.invAssets.reduce((s, a) => s + a.value, 0);
    const bInv = bStats.invAssets.reduce((s, a) => s + a.value, 0);

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Net Worth — ${today}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:32px;color:#222;background:#fff;}
  h1{font-size:22px;margin:0 0 4px;color:#1a1a1a;}
  .sub{font-size:13px;color:#888;margin-bottom:28px;}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:#888;margin:24px 0 8px;font-weight:600;}
  table{width:100%;border-collapse:collapse;margin-bottom:8px;}
  th{padding:8px 12px;text-align:right;font-size:12px;color:#888;font-weight:500;background:#f5f5f5;}
  th:first-child{text-align:left;}
  .footer{margin-top:32px;font-size:11px;color:#aaa;text-align:center;}
  @media print{body{padding:16px;}@page{margin:1.5cm;}}
</style></head><body>
<h1>💰 Net Worth Report</h1>
<div class="sub">Generated by WealthOS · ${today}</div>

<h2>Summary</h2>
<table>
  <thead><tr>
    <th style="text-align:left;"></th>
    <th>${p1Name}</th><th>${p2Name}</th><th>Household</th>
  </tr></thead>
  <tbody>
    ${row("Liquid Savings", aStats.savingsTotal, bStats.savingsTotal, aStats.savingsTotal + bStats.savingsTotal)}
    ${row("Investments", aInv, bInv, aInv + bInv)}
    ${row("Total Assets", aStats.assets, bStats.assets, hAssets)}
    ${row("Liabilities", aStats.liabilities, bStats.liabilities, hLiabilities)}
    ${row("Net Worth", aStats.net, bStats.net, hNet, true)}
  </tbody>
</table>

<h2>Savings Accounts</h2>
<table>
  <thead><tr><th style="text-align:left;">Person</th><th style="text-align:left;">Bank</th><th>Balance</th><th>Rate</th></tr></thead>
  <tbody>${[
    ...aStats.savingsAccounts.map((a) => ({ ...a, _p: p1Name })),
    ...bStats.savingsAccounts.map((a) => ({ ...a, _p: p2Name })),
  ]
    .map(
      (a) =>
        `<tr style="border-top:1px solid #eee;">
      <td style="padding:6px 12px;font-size:13px;">${a._p}</td>
      <td style="padding:6px 12px;font-size:13px;">${a.bankName || "—"}</td>
      <td style="padding:6px 12px;text-align:right;font-size:13px;">${fmtN(a.balance || 0)}</td>
      <td style="padding:6px 12px;text-align:right;font-size:13px;">${a.interestRate ?? 3.5}%</td>
    </tr>`,
    )
    .join("")}</tbody>
</table>

<h2>Investment Portfolio</h2>
<table>
  <thead><tr><th style="text-align:left;">Person</th><th style="text-align:left;">Name</th><th style="text-align:left;">Type</th><th>Value</th></tr></thead>
  <tbody>${[
    ...aStats.invAssets.map((a) => ({ ...a, _p: p1Name })),
    ...bStats.invAssets.map((a) => ({ ...a, _p: p2Name })),
  ]
    .map(
      (a) =>
        `<tr style="border-top:1px solid #eee;">
      <td style="padding:6px 12px;font-size:13px;">${a._p}</td>
      <td style="padding:6px 12px;font-size:13px;">${a.name}</td>
      <td style="padding:6px 12px;font-size:13px;">${a.type}</td>
      <td style="padding:6px 12px;text-align:right;font-size:13px;">${fmtN(a.value)}</td>
    </tr>`,
    )
    .join("")}</tbody>
</table>

<div class="footer">WealthOS · Personal Finance · Data is private and stored locally</div>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const chartData = history
    .filter((s) => (s.p1NetWorth || 0) !== 0 || (s.p2NetWorth || 0) !== 0)
    .map((s) => ({
      label: s.label || `${s.month}/${s.year}`,
      p1: Math.round(s.p1NetWorth || 0),
      p2: Math.round(s.p2NetWorth || 0),
      household: Math.round((s.p1NetWorth || 0) + (s.p2NetWorth || 0)),
    }));

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>
          Net Worth Timeline
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn-ghost"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={exportNetWorth}
            title="Export to CSV (opens in Excel)"
          >
            <Download size={14} /> CSV
          </button>
          <button
            className="btn-ghost"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={exportNetWorthText}
            title="Export as plain text"
          >
            <Download size={14} /> Text
          </button>
          <button
            className="btn-ghost"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={exportNetWorthPDF}
            title="Export as PDF (browser print dialog)"
          >
            <Download size={14} /> PDF
          </button>
          <button
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={handleSnapshot}
          >
            <Camera size={14} />{" "}
            {snapshotDone ? "✓ Snapshot saved!" : "Take snapshot now"}
          </button>
        </div>
      </div>

      <div className="grid-3 section-gap">
        <div className="metric-card">
          <div className="metric-label">Household net worth</div>
          <div className="metric-value gold-text">{fmtCr(hNet)}</div>
          <div className="metric-sub">Assets − Liabilities</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total assets</div>
          <div className="metric-value green-text">{fmtCr(hAssets)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total liabilities</div>
          <div className="metric-value red-text">{fmtCr(hLiabilities)}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: "1.25rem" }}>
        {["timeline", "edit"].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "7px 16px",
              borderRadius: "var(--radius-sm)",
              background: activeTab === t ? "var(--gold-dim)" : "transparent",
              color: activeTab === t ? "var(--gold)" : "var(--text-secondary)",
              border:
                activeTab === t
                  ? "1px solid var(--gold-border)"
                  : "1px solid var(--border)",
              textTransform: "capitalize",
            }}
          >
            {t === "timeline" ? "Timeline" : "Edit Assets"}
          </button>
        ))}
      </div>

      {activeTab === "timeline" && (
        <div>
          {chartData.length < 2 ? (
            <div
              className="card"
              style={{ textAlign: "center", padding: "3rem 2rem" }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>📸</div>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>
                No history yet
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  marginBottom: "1.25rem",
                  lineHeight: 1.6,
                }}
              >
                Snapshots are taken automatically at the start of each month.
                <br />
                After 2+ snapshots, you'll see your net worth trend here.
              </div>
              <button
                className="btn-primary"
                onClick={handleSnapshot}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Camera size={14} /> Take first snapshot now
              </button>
            </div>
          ) : (
            <div>
              <div className="card section-gap">
                <div className="card-title">Household net worth over time</div>
                <div style={{ height: 220 }}>
                  <Chart
                    categories={chartData.map((d) => d.label)}
                    series={[
                      {
                        name: "Household",
                        type: "area",
                        data: chartData.map((d) => d.household),
                        color: "#c9a84c",
                      },
                    ]}
                    fmt={fmtCr}
                  />
                </div>
              </div>
              <div className="card section-gap">
                <div className="card-title">
                  {personNames?.p1 || "Person 1"} vs{" "}
                  {personNames?.p2 || "Person 2"} net worth
                </div>
                <div style={{ height: 200 }}>
                  <Chart
                    categories={chartData.map((d) => d.label)}
                    series={[
                      {
                        name: personNames?.p1 || "Person 1",
                        type: "bar",
                        data: chartData.map((d) => d.p1),
                        color: "#5b9cf6",
                      },
                      {
                        name: personNames?.p2 || "Person 2",
                        type: "bar",
                        data: chartData.map((d) => d.p2),
                        color: "#d46eb3",
                      },
                    ]}
                    fmt={fmtCr}
                  />
                </div>
              </div>
              <div className="card">
                <div className="card-title">Monthly snapshots</div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "0 0 8px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 11,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                  }}
                >
                  <span style={{ flex: 1 }}>Month</span>
                  <span style={{ flex: 1 }}>
                    {personNames?.p1 || "Person 1"}
                  </span>
                  <span style={{ flex: 1 }}>
                    {personNames?.p2 || "Person 2"}
                  </span>
                  <span style={{ flex: 1 }}>Household</span>
                  <span style={{ width: 30 }}></span>
                </div>
                {[...history].reverse().map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ flex: 1, fontWeight: 500 }}>{s.label}</span>
                    <span style={{ flex: 1, color: "var(--p1)" }}>
                      {fmtCr(s.p1NetWorth || 0)}
                    </span>
                    <span style={{ flex: 1, color: "var(--p2)" }}>
                      {fmtCr(s.p2NetWorth || 0)}
                    </span>
                    <span style={{ flex: 1, color: "var(--gold)" }}>
                      {fmtCr((s.p1NetWorth || 0) + (s.p2NetWorth || 0))}
                    </span>
                    <button
                      className="btn-danger"
                      aria-label={`Delete ${s.label} snapshot`}
                      onClick={async () => {
                        if (
                          await confirm(
                            "Delete snapshot?",
                            `Remove ${s.label} snapshot from history?`,
                          )
                        )
                          updateShared(
                            "netWorthHistory",
                            history.filter(
                              (_, j) => j !== history.length - 1 - i,
                            ),
                          );
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "edit" && (
        <div className="grid-2">
          <div className="card">
            <AssetsEditor
              person="p1"
              data={p1}
              color="var(--p1)"
              updatePerson={updatePerson}
              confirm={confirm}
              personNames={personNames}
            />
          </div>
          <div className="card">
            <AssetsEditor
              person="p2"
              data={p2}
              color="var(--p2)"
              updatePerson={updatePerson}
              confirm={confirm}
              personNames={personNames}
            />
          </div>
        </div>
      )}

      <div className="tip" style={{ marginTop: "1rem" }}>
        💡 Take a snapshot on the last day of each month. Over time this builds
        your wealth timeline — one of the most motivating things you can track
        as a couple.
      </div>
      {dialog}
    </div>
  );
}
