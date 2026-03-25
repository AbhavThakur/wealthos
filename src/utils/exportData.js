// ─────────────────────────────────────────────────────────────────────────────
// DATA EXPORT (CSV)
// ─────────────────────────────────────────────────────────────────────────────
function toCsvRow(arr) {
  return arr
    .map((v) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    })
    .join(",");
}

function downloadCsv(filename, header, rows) {
  const csv = [toCsvRow(header), ...rows.map(toCsvRow)].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAllData(abhav, aanya, shared, personNames = {}) {
  const date = new Date().toISOString().slice(0, 10);
  const p1 = personNames.abhav || "Person 1";
  const p2 = personNames.aanya || "Person 2";

  // Incomes
  const incH = ["Person", "Name", "Amount", "Type"];
  const incR = [];
  for (const [name, d] of [
    [p1, abhav],
    [p2, aanya],
  ]) {
    for (const i of d?.incomes || [])
      incR.push([name, i.name, i.amount, i.type || ""]);
  }
  downloadCsv(`wealthos-incomes-${date}.csv`, incH, incR);

  // Expenses
  const expH = ["Person", "Name", "Amount", "Category", "Type", "SubCategory"];
  const expR = [];
  for (const [name, d] of [
    [p1, abhav],
    [p2, aanya],
  ]) {
    for (const e of d?.expenses || [])
      expR.push([
        name,
        e.name,
        e.amount,
        e.category || "",
        e.expenseType || "",
        e.subCategory || "",
      ]);
  }
  downloadCsv(`wealthos-expenses-${date}.csv`, expH, expR);

  // Investments
  const invH = [
    "Person",
    "Name",
    "Type",
    "Amount",
    "Frequency",
    "Return%",
    "ExistingCorpus",
    "StartDate",
  ];
  const invR = [];
  for (const [name, d] of [
    [p1, abhav],
    [p2, aanya],
  ]) {
    for (const i of d?.investments || [])
      invR.push([
        name,
        i.name,
        i.type,
        i.amount,
        i.frequency || "monthly",
        i.returnPct,
        i.existingCorpus || 0,
        i.startDate || "",
      ]);
  }
  downloadCsv(`wealthos-investments-${date}.csv`, invH, invR);

  // Transactions
  const txH = ["Person", "Date", "Description", "Amount", "Type", "Category"];
  const txR = [];
  for (const [name, d] of [
    [p1, abhav],
    [p2, aanya],
  ]) {
    for (const t of d?.transactions || [])
      txR.push([name, t.date, t.desc, t.amount, t.type, t.category || ""]);
  }
  downloadCsv(`wealthos-transactions-${date}.csv`, txH, txR);

  // Debts
  const dbtH = ["Person", "Name", "Outstanding", "Rate%", "Tenure(months)"];
  const dbtR = [];
  for (const [name, d] of [
    [p1, abhav],
    [p2, aanya],
  ]) {
    for (const db of d?.debts || [])
      dbtR.push([name, db.name, db.outstanding, db.rate, db.tenure]);
  }
  downloadCsv(`wealthos-debts-${date}.csv`, dbtH, dbtR);

  // Insurance
  const insH = [
    "Person",
    "Name",
    "Type",
    "Provider",
    "Premium",
    "PremiumFreq",
    "Coverage",
    "RenewalDate",
  ];
  const insR = [];
  for (const [name, d] of [
    [p1, abhav],
    [p2, aanya],
  ]) {
    for (const i of d?.insurances || [])
      insR.push([
        name,
        i.name,
        i.type,
        i.provider || "",
        i.premium,
        i.premiumFreq,
        i.coverage || 0,
        i.renewalDate || "",
      ]);
  }
  downloadCsv(`wealthos-insurance-${date}.csv`, insH, insR);

  // Subscriptions
  const subH = ["Person", "Name", "Category", "Amount", "Frequency", "Active"];
  const subR = [];
  for (const [name, d] of [
    [p1, abhav],
    [p2, aanya],
  ]) {
    for (const s of d?.subscriptions || [])
      subR.push([name, s.name, s.category, s.amount, s.frequency, s.active]);
  }
  downloadCsv(`wealthos-subscriptions-${date}.csv`, subH, subR);

  // Goals (shared)
  const goalH = [
    "Name",
    "Target",
    "AbhavSaved",
    "AanyaSaved",
    "Deadline",
    "Emoji",
  ];
  const goalR = (shared?.goals || []).map((g) => [
    g.name,
    g.target,
    g.abhavSaved || g.saved || 0,
    g.aanyaSaved || 0,
    g.deadline || "",
    g.emoji || "",
  ]);
  downloadCsv(`wealthos-goals-${date}.csv`, goalH, goalR);

  // Net worth history
  const nwH = [
    "Month",
    "Year",
    "AbhavNetWorth",
    "AanyaNetWorth",
    "AbhavIncome",
    "AanyaIncome",
    "AbhavExpenses",
    "AanyaExpenses",
  ];
  const nwR = (shared?.netWorthHistory || []).map((s) => [
    s.month,
    s.year,
    s.abhavNetWorth || 0,
    s.aanyaNetWorth || 0,
    s.abhavIncome || 0,
    s.aanyaIncome || 0,
    s.abhavExpenses || 0,
    s.aanyaExpenses || 0,
  ]);
  downloadCsv(`wealthos-networth-history-${date}.csv`, nwH, nwR);

  return 8; // number of files exported
}
