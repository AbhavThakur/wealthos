#!/usr/bin/env python3
"""Split OtherPages.jsx and Investments.jsx to keep files under 6000 lines."""

import os

BASE = os.path.dirname(os.path.abspath(__file__))
PAGES = os.path.join(BASE, "src", "pages")

# ── 1. Split CashFlow out of OtherPages.jsx ──────────────────────────────────

op_path = os.path.join(PAGES, "OtherPages.jsx")
with open(op_path, "r") as f:
    op_lines = f.readlines()

print(f"OtherPages.jsx: {len(op_lines)} lines")

# Find the CashFlow comment marker
cf_idx = None
for i, line in enumerate(op_lines):
    if "Cash Flow (merged Transactions" in line:
        cf_idx = i
        break

if cf_idx is None:
    print("ERROR: Could not find CashFlow section marker!")
else:
    cf_body = op_lines[cf_idx:]
    remaining = op_lines[:cf_idx]

    # Write CashFlow.jsx
    cf_imports = [
        'import { useState, useCallback } from "react";\n',
        'import { fmt, nextId, EXPENSE_CATEGORIES } from "../utils/finance";\n',
        'import { Plus, Trash2, Search, RefreshCw, Bell, BellOff } from "lucide-react";\n',
        'import { useConfirm } from "../hooks/useConfirm";\n',
        'import { useUndoToast } from "../hooks/useUndoToast";\n',
        'import { autoRecurringRules } from "../utils/autoRecurringRules";\n',
        'import { useData } from "../context/DataContext";\n',
        '\n',
        'function useSessionState(key, initial) {\n',
        '  const [val, setVal] = useState(() => {\n',
        '    try {\n',
        '      const s = sessionStorage.getItem(key);\n',
        '      return s !== null ? JSON.parse(s) : initial;\n',
        '    } catch {\n',
        '      return initial;\n',
        '    }\n',
        '  });\n',
        '  const set = useCallback(\n',
        '    (v) => {\n',
        '      setVal(v);\n',
        '      try {\n',
        '        sessionStorage.setItem(key, JSON.stringify(v));\n',
        '      } catch {\n',
        '        /* empty */\n',
        '      }\n',
        '    },\n',
        '    [key],\n',
        '  );\n',
        '  return [val, set];\n',
        '}\n',
        '\n',
    ]

    cf_path = os.path.join(PAGES, "CashFlow.jsx")
    with open(cf_path, "w") as f:
        f.writelines(cf_imports)
        f.writelines(cf_body)

    # Add re-export to trimmed OtherPages
    remaining.append('\n// Re-export CashFlow components (extracted to CashFlow.jsx)\n')
    remaining.append('export { CashFlow, HouseholdCashFlow } from "./CashFlow";\n')

    with open(op_path, "w") as f:
        f.writelines(remaining)

    with open(cf_path) as f:
        print(f"CashFlow.jsx: {len(f.readlines())} lines")
    with open(op_path) as f:
        print(f"OtherPages.jsx: {len(f.readlines())} lines")

# ── 2. Split Investments.jsx ──────────────────────────────────────────────────

inv_path = os.path.join(PAGES, "Investments.jsx")
with open(inv_path, "r") as f:
    inv_lines = f.readlines()

print(f"\nInvestments.jsx: {len(inv_lines)} lines")

# Find HouseholdInvestments export
hi_idx = None
for i, line in enumerate(inv_lines):
    if "export function HouseholdInvestments" in line:
        hi_idx = i
        break

if hi_idx is None:
    print("ERROR: Could not find HouseholdInvestments!")
else:
    hi_body = inv_lines[hi_idx:]
    inv_remaining = inv_lines[:hi_idx]

    # Write HouseholdInvestments.jsx
    # It needs the same imports as the parent file + internal helpers
    # Instead, have it import from the main file
    hi_imports = [
        'import { useState, useMemo, useCallback } from "react";\n',
        'import {\n',
        '  AreaChart,\n',
        '  Area,\n',
        '  XAxis,\n',
        '  YAxis,\n',
        '  Tooltip,\n',
        '  ResponsiveContainer,\n',
        '} from "recharts";\n',
        'import {\n',
        '  fmt,\n',
        '  fmtCr,\n',
        '  nextId,\n',
        '  INVESTMENT_TYPES,\n',
        '  totalCorpus,\n',
        '  ppfCorpus,\n',
        '  fdCorpus,\n',
        '  ltcgTax,\n',
        '  lumpCorpus,\n',
        '  freqToMonthly,\n',
        '  sipCorpus,\n',
        '} from "../utils/finance";\n',
        'import { Plus, Trash2, Edit3, Check, X, Download } from "lucide-react";\n',
        'import { useConfirm } from "../hooks/useConfirm";\n',
        'import { useData } from "../context/DataContext";\n',
        'import { SIPCard, PortfolioCharts, ExportMenu, computeInvRow } from "./Investments";\n',
        '\n',
    ]

    hi_path = os.path.join(PAGES, "HouseholdInvestments.jsx")
    with open(hi_path, "w") as f:
        f.writelines(hi_imports)
        f.writelines(hi_body)

    # Add re-export + make internals available
    inv_remaining.append('\n// Re-export HouseholdInvestments (extracted to HouseholdInvestments.jsx)\n')
    inv_remaining.append('export { HouseholdInvestments } from "./HouseholdInvestments";\n')

    with open(inv_path, "w") as f:
        f.writelines(inv_remaining)

    with open(hi_path) as f:
        print(f"HouseholdInvestments.jsx: {len(f.readlines())} lines")
    with open(inv_path) as f:
        print(f"Investments.jsx: {len(f.readlines())} lines")

print("\nDone! All files split.")
