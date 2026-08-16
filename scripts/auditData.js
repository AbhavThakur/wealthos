import { DEMO_PERSON1, DEMO_PERSON2 } from "../src/data/demoData.js";
import { auditWorkspaceData } from "../src/utils/financialDiagnostics.js";

console.log("=================================================");
console.log("       WEALTHOS FINANCIAL DATA AUDIT TOOL        ");
console.log("=================================================\n");

const p1 = DEMO_PERSON1;
const p2 = DEMO_PERSON2;
const shared = { trips: [], goals: [], savingsAccounts: [] };

const monthsToAudit = ["2026-06", "2026-07", "2026-08"];

for (const monthYm of monthsToAudit) {
  const report = auditWorkspaceData({
    p1,
    p2,
    shared,
    monthYm,
    personNames: { p1: "Abhav", p2: "Aanya" },
  });

  console.log(`📅 Month: ${report.monthYm}`);
  console.log(`💳 Combined Income:   ${report.summary.totalIncome}`);
  console.log(`💸 Monthly Expenses:  ${report.summary.totalExpenses}`);
  console.log(`🎉 Monthly Surplus:   ${report.summary.monthlySurplus} (${report.summary.savingsRate} saved)`);
  console.log(`📊 Status:            ${report.financials.statusTitle}`);
  console.log(`💡 Next Action:       ${report.financials.nextActionText}`);
  console.log(`-------------------------------------------------`);
}

const latestReport = auditWorkspaceData({
  p1,
  p2,
  shared,
  monthYm: "2026-08",
  personNames: { p1: "Abhav", p2: "Aanya" },
});

console.log(`\n💰 3-TIER WEALTH STRUCTURE:`);
console.log(`   1. Liquid & Daily Cash: ${latestReport.summary.liquidCash} (${latestReport.wealth.liquidPct}%)`);
console.log(`   2. Wealth Growers:      ${latestReport.summary.wealthGrowers} (${latestReport.wealth.growersPct}%)`);
console.log(`   3. Guaranteed Safe:     ${latestReport.summary.guaranteedSafe} (${latestReport.wealth.safePct}%)`);
console.log(`   Total Portfolio:        ${latestReport.summary.totalNetWorth}`);

console.log(`\n🛡️ DATA INTEGRITY CHECK:`);
if (latestReport.integrity.isHealthy) {
  console.log(`   ✅ All accounts and records are 100% consistent and healthy.`);
} else {
  console.log(`   ⚠️ Found ${latestReport.integrity.anomalies.length} anomaly(ies):`);
  latestReport.integrity.anomalies.forEach((a, i) => console.log(`     ${i + 1}. [${a.level}] ${a.message}`));
}

console.log("\n=================================================\n");
