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
