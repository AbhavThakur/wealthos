import { freqToMonthly } from "./finance";

// Standing monthly credit/debit flows tagged to a specific savings account,
// derived from recurring income/investment config (not a transaction ledger).
export function computeAccountFlows(accountId, data) {
  if (!accountId) {
    return { salaryCredit: 0, sipDebit: 0, swpCredit: 0, net: 0 };
  }
  // linkedAccountId comes from <select> values, which are always strings,
  // while account ids are numbers (from nextId()) — compare as strings.
  const id = String(accountId);

  const salaryCredit = (data?.incomes || [])
    .filter((inc) => String(inc.linkedAccountId) === id)
    .reduce((s, inc) => s + (Number(inc.amount) || 0), 0);

  const linkedInvestments = (data?.investments || []).filter(
    (inv) => String(inv.linkedAccountId) === id && inv.frequency !== "onetime",
  );

  const sipDebit = linkedInvestments
    .filter((inv) => !inv.isSWP)
    .reduce((s, inv) => s + freqToMonthly(inv.amount || 0, inv.frequency), 0);

  const swpCredit = linkedInvestments
    .filter((inv) => inv.isSWP)
    .reduce((s, inv) => s + freqToMonthly(inv.amount || 0, inv.frequency), 0);

  return {
    salaryCredit,
    sipDebit,
    swpCredit,
    net: salaryCredit - sipDebit + swpCredit,
  };
}

// True once an account has tagged flows that haven't been applied for this month yet.
export function isSyncPending(account, flows, month) {
  return flows.net !== 0 && account.lastSyncedMonth !== month;
}

// Applies this month's net flow to the account's balance and stamps the sync month.
export function applyAccountSync(account, flows, month) {
  return {
    ...account,
    balance: Math.round(((account.balance || 0) + flows.net) * 100) / 100,
    lastSyncedMonth: month,
  };
}
