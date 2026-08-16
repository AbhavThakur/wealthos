import { formatIndianWords } from "../utils/finance";

/**
 * AmountInput — Formatted numeric input for Indian Rupee amounts
 *
 * Automatically displays Indian locale commas (e.g., 10,00,000)
 * and renders a live verbal preview badge (e.g., "₹10 Lakhs").
 */
export default function AmountInput({
  value,
  onChange,
  placeholder = "0",
  style = {},
  className = "",
  showBadge = true,
  disabled = false,
  autoFocus = false,
  min,
  max,
  id,
  name,
}) {
  const formatRaw = (val) => {
    if (val === "" || val === null || val === undefined) return "";
    const clean = String(val).replace(/[^0-9.]/g, "");
    if (!clean) return "";
    const [intPart, decPart] = clean.split(".");
    const num = Number(intPart);
    if (isNaN(num)) return clean;
    const formatted = num.toLocaleString("en-IN");
    return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
  };

  const displayVal = formatRaw(value);

  const handleChange = (e) => {
    const rawInput = e.target.value;
    // Allow digits and at most one decimal point
    const cleaned = rawInput.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    const sanitized = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : parts[0];

    const numVal = sanitized === "" ? 0 : Number(sanitized);

    if (min !== undefined && numVal < min && sanitized !== "") return;
    if (max !== undefined && numVal > max) return;

    if (onChange) {
      onChange(sanitized === "" ? "" : isNaN(numVal) ? 0 : numVal);
    }
  };

  const num = Number(String(value).replace(/[^0-9.]/g, "")) || 0;
  const words = num >= 1000 ? formatIndianWords(num) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={{ position: "relative", width: "100%" }}>
        <input
          type="text"
          inputMode="numeric"
          id={id}
          name={name}
          value={displayVal}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={className}
          style={{
            width: "100%",
            ...style,
          }}
        />
      </div>

      {showBadge && words && (
        <div
          style={{
            fontSize: 11,
            color: "var(--gold, #fbbf24)",
            fontWeight: 600,
            marginTop: 3,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>≈</span>
          <span>₹{words}</span>
        </div>
      )}
    </div>
  );
}
