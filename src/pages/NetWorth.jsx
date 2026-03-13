import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { fmtCr, nextId } from "../utils/finance";
import { Camera, Plus, Trash2 } from "lucide-react";
import { useConfirm } from "../App";

const ASSET_TYPES = [
  "cash",
  "investment",
  "property",
  "gold",
  "vehicle",
  "other",
];
const LIABILITY_TYPES = ["loan", "credit_card", "mortgage", "other"];

function calcNetWorth(data) {
  const assets = (data?.assets || []).reduce((s, a) => s + (a.value || 0), 0);
  const liabilities = (data?.liabilities || []).reduce(
    (s, l) => s + (l.value || 0),
    0,
  );
  return { assets, liabilities, net: assets - liabilities };
}

function AssetsEditor({ person, data, color, updatePerson, confirm }) {
  const assets = data?.assets || [];
  const liabilities = data?.liabilities || [];

  const addAsset = () =>
    updatePerson(person, "assets", [
      ...assets,
      { id: nextId(assets), name: "New asset", value: 0, type: "cash" },
    ]);
  const addLiability = () =>
    updatePerson(person, "liabilities", [
      ...liabilities,
      {
        id: nextId(liabilities),
        name: "New liability",
        value: 0,
        type: "loan",
      },
    ]);

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
          {person === "abhav" ? "Abhav" : "Aanya"}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 13 }}>
          Net worth:{" "}
          <strong style={{ color }}>{fmtCr(calcNetWorth(data).net)}</strong>
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: ".06em",
            }}
          >
            Assets
          </div>
          <button
            className="btn-ghost"
            style={{
              padding: "4px 10px",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            onClick={addAsset}
          >
            <Plus size={11} /> Add
          </button>
        </div>
        {assets.map((a) => (
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
              onChange={(e) =>
                updatePerson(
                  person,
                  "assets",
                  assets.map((x) =>
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
                  assets.map((x) =>
                    x.id === a.id ? { ...x, type: e.target.value } : x,
                  ),
                )
              }
              style={{ flex: 1 }}
            >
              {ASSET_TYPES.map((t) => (
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
                  assets.map((x) =>
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
                    assets.filter((x) => x.id !== a.id),
                  );
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        <div
          style={{
            textAlign: "right",
            fontSize: 13,
            color: "var(--green)",
            fontWeight: 500,
            marginTop: 4,
          }}
        >
          Total: {fmtCr(calcNetWorth(data).assets)}
        </div>
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: ".06em",
            }}
          >
            Liabilities
          </div>
          <button
            className="btn-ghost"
            style={{
              padding: "4px 10px",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            onClick={addLiability}
          >
            <Plus size={11} /> Add
          </button>
        </div>
        {liabilities.map((l) => (
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
              onChange={(e) =>
                updatePerson(
                  person,
                  "liabilities",
                  liabilities.map((x) =>
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
                  liabilities.map((x) =>
                    x.id === l.id ? { ...x, type: e.target.value } : x,
                  ),
                )
              }
              style={{ flex: 1 }}
            >
              {LIABILITY_TYPES.map((t) => (
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
                  liabilities.map((x) =>
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
                    liabilities.filter((x) => x.id !== l.id),
                  );
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {liabilities.length > 0 && (
          <div
            style={{
              textAlign: "right",
              fontSize: 13,
              color: "var(--red)",
              fontWeight: 500,
              marginTop: 4,
            }}
          >
            Total: {fmtCr(calcNetWorth(data).liabilities)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NetWorth({
  abhav,
  aanya,
  shared,
  updatePerson,
  updateShared,
  takeSnapshot,
}) {
  const [activeTab, setActiveTab] = useState("timeline");
  const [snapshotDone, setSnapshotDone] = useState(false);
  const { confirm, dialog } = useConfirm();

  const history = shared?.netWorthHistory || [];

  const aStats = calcNetWorth(abhav);
  const bStats = calcNetWorth(aanya);
  const hNet = aStats.net + bStats.net;
  const hAssets = aStats.assets + bStats.assets;
  const hLiabilities = aStats.liabilities + bStats.liabilities;

  const handleSnapshot = () => {
    takeSnapshot();
    setSnapshotDone(true);
    setTimeout(() => setSnapshotDone(false), 3000);
  };

  const chartData = history.map((s) => ({
    abhav: Math.round(s.abhavNetWorth || 0),
    aanya: Math.round(s.aanyaNetWorth || 0),
    household: Math.round((s.abhavNetWorth || 0) + (s.aanyaNetWorth || 0)),
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
        <button
          className="btn-primary"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
          onClick={handleSnapshot}
        >
          <Camera size={14} />{" "}
          {snapshotDone ? "✓ Snapshot saved!" : "Take monthly snapshot"}
        </button>
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
                Click "Take monthly snapshot" at the end of each month.
                <br />
                After 2+ snapshots, you'll see your net worth growing here.
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
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="netGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#c9a84c"
                            stopOpacity={0.25}
                          />
                          <stop
                            offset="95%"
                            stopColor="#c9a84c"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#55535e" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        formatter={fmtCr}
                        contentStyle={{
                          background: "#13131a",
                          border: "1px solid rgba(255,255,255,0.07)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="household"
                        name="Household"
                        stroke="#c9a84c"
                        strokeWidth={2}
                        fill="url(#netGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card section-gap">
                <div className="card-title">Abhav vs Aanya net worth</div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#55535e" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis hide />
                      <Tooltip
                        formatter={fmtCr}
                        contentStyle={{
                          background: "#13131a",
                          border: "1px solid rgba(255,255,255,0.07)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar
                        dataKey="abhav"
                        name="Abhav"
                        fill="#5b9cf6"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="aanya"
                        name="Aanya"
                        fill="#d46eb3"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
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
                  <span style={{ flex: 1 }}>Abhav</span>
                  <span style={{ flex: 1 }}>Aanya</span>
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
                    <span style={{ flex: 1, color: "var(--abhav)" }}>
                      {fmtCr(s.abhavNetWorth || 0)}
                    </span>
                    <span style={{ flex: 1, color: "var(--aanya)" }}>
                      {fmtCr(s.aanyaNetWorth || 0)}
                    </span>
                    <span style={{ flex: 1, color: "var(--gold)" }}>
                      {fmtCr((s.abhavNetWorth || 0) + (s.aanyaNetWorth || 0))}
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
              person="abhav"
              data={abhav}
              color="var(--abhav)"
              updatePerson={updatePerson}
              confirm={confirm}
            />
          </div>
          <div className="card">
            <AssetsEditor
              person="aanya"
              data={aanya}
              color="var(--aanya)"
              updatePerson={updatePerson}
              confirm={confirm}
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
