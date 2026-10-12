export const localDateISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

export const localYearMonth = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const yearMonthToDate = (ym) => {
  const [y, m] = String(ym || "").split("-");
  const year = Number(y);
  const month = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return new Date();
  return new Date(year, month - 1, 1);
};

export const parseLocalDate = (value) => {
  if (value instanceof Date) return new Date(value.getTime());
  if (!value) return null;

  const str = String(value).trim();
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    return new Date(year, month - 1, day);
  }

  const ym = str.match(/^(\d{4})-(\d{2})$/);
  if (ym) {
    const year = Number(ym[1]);
    const month = Number(ym[2]);
    return new Date(year, month - 1, 1);
  }

  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const compareISODateDesc = (a, b) =>
  String(b || "").localeCompare(String(a || ""));

export const compareISODateAsc = (a, b) =>
  String(a || "").localeCompare(String(b || ""));

export const goalDeadlineDate = (value) => {
  const str = String(value || "").trim();
  const ym = str.match(/^(\d{4})-(\d{2})$/);
  if (ym) {
    const year = Number(ym[1]);
    const month = Number(ym[2]);
    return new Date(year, month, 0);
  }
  return parseLocalDate(str);
};

const MONTH_MAP = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

export function parseDateRangeString(raw) {
  if (!raw || typeof raw !== "string") return { startDate: "", endDate: "" };
  const str = raw.trim();

  // Pattern 1: ISO dates (e.g. "2026-10-02" or "2026-10-02 to 2026-10-04")
  const isoMatches = str.match(/(\d{4}-\d{2}-\d{2})/g);
  if (isoMatches && isoMatches.length > 0) {
    return {
      startDate: isoMatches[0],
      endDate: isoMatches[1] || isoMatches[0],
    };
  }

  // Pattern 2: "Oct 2 – 4, 2026" or "Sep 12 – 14, 2026"
  const m1 = str.match(/([A-Za-z]+)\s+(\d{1,2})(?:\s*[–-]\s*(?:([A-Za-z]+)\s+)?(\d{1,2}))?,?\s+(\d{4})/);
  if (m1) {
    const startMonthStr = m1[1].toLowerCase().slice(0, 3);
    const startMonth = MONTH_MAP[startMonthStr] || "01";
    const startDay = m1[2].padStart(2, "0");
    const endMonthStr = (m1[3] ? m1[3].toLowerCase().slice(0, 3) : startMonthStr);
    const endMonth = MONTH_MAP[endMonthStr] || startMonth;
    const endDay = (m1[4] || m1[2]).padStart(2, "0");
    const year = m1[5];

    return {
      startDate: `${year}-${startMonth}-${startDay}`,
      endDate: `${year}-${endMonth}-${endDay}`,
    };
  }

  return { startDate: str, endDate: str };
}
