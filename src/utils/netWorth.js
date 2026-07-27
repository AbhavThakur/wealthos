import { lumpCorpus, sumMoney } from "./finance";
import { parseLocalDate } from "./date";

export function deriveInvestmentAssets(data, now = new Date()) {
  return (data?.investments || []).map((investment) => {
    const isFD = investment.type === "FD";
    const isOneTime = investment.frequency === "onetime";
    let value = investment.existingCorpus || 0;

    if (isFD) {
      const start = investment.startDate
        ? parseLocalDate(investment.startDate) || now
        : now;
      const elapsed = Math.max(0, (now - start) / (365.25 * 86400000));
      value = lumpCorpus(
        investment.amount || 0,
        investment.returnPct || 0,
        elapsed,
      );
    } else if (isOneTime && !investment.existingCorpus) {
      const start = investment.startDate
        ? parseLocalDate(investment.startDate) || now
        : now;
      const elapsed = Math.max(0, (now - start) / (365.25 * 86400000));
      value = lumpCorpus(
        investment.amount || 0,
        investment.returnPct || 0,
        elapsed,
      );
    }

    return {
      name: investment.name,
      value: Math.round(value),
      type: investment.type,
      auto: true,
    };
  });
}

export function calculateNetWorth(data, now = new Date()) {
  const invAssets = deriveInvestmentAssets(data, now);
  const debtLiabilities = (data?.debts || []).map((debt) => ({
    name: debt.name,
    value: debt.outstanding || 0,
    type: "loan",
    auto: true,
  }));
  const manualAssets = (data?.assets || []).filter((asset) => !asset.auto);
  const manualLiabilities = (data?.liabilities || []).filter(
    (liability) => !liability.auto,
  );
  const savingsAccounts = data?.savingsAccounts || [];
  const savingsTotal = sumMoney(
    savingsAccounts.map((account) => account.balance || 0),
  );
  const assets = sumMoney([
    ...invAssets.map((asset) => asset.value),
    ...manualAssets.map((asset) => asset.value || 0),
    savingsTotal,
  ]);
  const liabilities = sumMoney([
    ...debtLiabilities.map((liability) => liability.value),
    ...manualLiabilities.map((liability) => liability.value || 0),
  ]);

  return {
    assets,
    liabilities,
    net: sumMoney([assets, -liabilities]),
    invAssets,
    debtLiabilities,
    manualAssets,
    manualLiabilities,
    savingsAccounts,
    savingsTotal,
  };
}
