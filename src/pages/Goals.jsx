import { useState } from "react";
import { fmt, nextId, monthsUntil } from "../utils/finance";
import { Plus, Edit3, Trash2, Check, X } from "lucide-react";
import { useConfirm } from "../hooks/useConfirm";

const EMOJIS = [
  "🏠",
  "✈️",
  "🎓",
  "👶",
  "🚗",
  "💍",
  "🛡️",
  "📱",
  "🏖️",
  "💰",
  "🏋️",
  "🌍",
  "🎵",
  "💻",
];

function GoalCard({ goal, onUpdate, onDelete, isShared, personNames }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(goal);
  const { confirm, dialog } = useConfirm();

  const saved = isShared
    ? (goal.abhavSaved || 0) + (goal.aanyaSaved || 0)
    : goal.saved;
  const target = goal.target;
  const pct = Math.min(100, Math.round((saved / target) * 100));
  const months = monthsUntil(goal.deadline);

  const save = () => {
    onUpdate({
      ...form,
      target: Number(form.target),
      saved: Number(form.saved || 0),
      abhavSaved: Number(form.abhavSaved || 0),
      aanyaSaved: Number(form.aanyaSaved || 0),
    });
    setEditing(false);
  };

  return (
    <div
      className="card section-gap"
      style={{ borderLeft: `3px solid ${goal.color}` }}
    >
      {editing ? (
        <div>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Goal name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Target (₹)
              </label>
              <input
                type="number"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
              />
            </div>
            {isShared ? (
              <>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {personNames?.abhav || "Person 1"} saved (₹)
                  </label>
                  <input
                    type="number"
                    value={form.abhavSaved || 0}
                    onChange={(e) =>
                      setForm({ ...form, abhavSaved: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {personNames?.aanya || "Person 2"} saved (₹)
                  </label>
                  <input
                    type="number"
                    value={form.aanyaSaved || 0}
                    onChange={(e) =>
                      setForm({ ...form, aanyaSaved: e.target.value })
                    }
                  />
                </div>
              </>
            ) : (
              <div>
                <label
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Saved so far (₹)
                </label>
                <input
                  type="number"
                  value={form.saved || 0}
                  onChange={(e) => setForm({ ...form, saved: e.target.value })}
                />
              </div>
            )}
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Deadline
              </label>
              <input
                type="month"
                value={form.deadline || ""}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 8,
              }}
            >
              Icon
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setForm({ ...form, emoji: e })}
                  style={{
                    width: 34,
                    height: 34,
                    fontSize: 17,
                    borderRadius: 8,
                    background:
                      form.emoji === e ? "var(--gold-dim)" : "var(--bg-card2)",
                    border:
                      form.emoji === e
                        ? "1px solid var(--gold)"
                        : "1px solid var(--border)",
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={save}
            >
              <Check size={13} /> Save
            </button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>
              <X size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: goal.color + "22",
                border: `1px solid ${goal.color}44`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {goal.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div
                    style={{ fontWeight: 500, fontSize: 15, marginBottom: 2 }}
                  >
                    {goal.name}
                  </div>
                  {isShared ? (
                    <div
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      {personNames?.abhav || "Person 1"}:{" "}
                      <span style={{ color: "var(--abhav)" }}>
                        {fmt(goal.abhavSaved || 0)}
                      </span>{" "}
                      · {personNames?.aanya || "Person 2"}:{" "}
                      <span style={{ color: "var(--aanya)" }}>
                        {fmt(goal.aanyaSaved || 0)}
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      Saved: {fmt(goal.saved || 0)} · Remaining:{" "}
                      {fmt(target - (goal.saved || 0))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    className="btn-icon"
                    aria-label={`Edit ${goal.name}`}
                    onClick={() => {
                      setForm(goal);
                      setEditing(true);
                    }}
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    className="btn-icon"
                    aria-label={`Delete ${goal.name}`}
                    onClick={async () => {
                      if (
                        await confirm(
                          "Delete goal?",
                          `Remove "${goal.name}" and its progress?`,
                        )
                      )
                        onDelete();
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <div style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{fmt(saved)}</span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {" "}
                    / {fmt(target)}
                  </span>
                </div>
                {months !== null && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {months} months left
                  </span>
                )}
              </div>
              <div className="progress-track" style={{ height: 5 }}>
                <div
                  className="progress-fill"
                  style={{ width: pct + "%", background: goal.color }}
                />
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 4,
                }}
              >
                {pct}% complete
              </div>
            </div>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}

export default function Goals({
  data,
  sharedData,
  personName,
  personColor,
  updatePerson,
  updateShared,
  isHousehold,
  personNames,
}) {
  const personalGoals = data?.goals || [];
  const sharedGoals = sharedData?.goals || [];
  const [showAdd, setShowAdd] = useState(null); // 'personal' | 'shared'
  const [newGoal, setNewGoal] = useState({
    name: "",
    target: "",
    saved: 0,
    abhavSaved: 0,
    aanyaSaved: 0,
    emoji: "🎯",
    color: "#c9a84c",
    deadline: "",
  });

  const addGoal = (type) => {
    if (!newGoal.name || !newGoal.target) return;
    if (type === "personal") {
      updatePerson("goals", [
        ...personalGoals,
        {
          ...newGoal,
          id: nextId(personalGoals),
          target: Number(newGoal.target),
          saved: Number(newGoal.saved),
          shared: false,
        },
      ]);
    } else {
      updateShared("goals", [
        ...sharedGoals,
        {
          ...newGoal,
          id: nextId(sharedGoals),
          target: Number(newGoal.target),
          abhavSaved: Number(newGoal.abhavSaved),
          aanyaSaved: Number(newGoal.aanyaSaved),
        },
      ]);
    }
    setNewGoal({
      name: "",
      target: "",
      saved: 0,
      abhavSaved: 0,
      aanyaSaved: 0,
      emoji: "🎯",
      color: "#c9a84c",
      deadline: "",
    });
    setShowAdd(null);
  };

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          marginBottom: "1.25rem",
        }}
      >
        {isHousehold ? (
          "All Goals"
        ) : (
          <>
            <span style={{ color: personColor }}>{personName}'s</span> Goals
          </>
        )}
      </div>

      {/* Personal goals */}
      {!isHousehold && (
        <div className="section-gap">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500 }}>Personal goals</div>
            <button
              className="btn-ghost"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
              }}
              onClick={() => setShowAdd("personal")}
            >
              <Plus size={13} /> Add
            </button>
          </div>
          {personalGoals.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              isShared={false}
              personName={personName}
              onUpdate={(u) =>
                updatePerson(
                  "goals",
                  personalGoals.map((x) => (x.id === u.id ? u : x)),
                )
              }
              onDelete={() =>
                updatePerson(
                  "goals",
                  personalGoals.filter((x) => x.id !== g.id),
                )
              }
            />
          ))}
          {showAdd === "personal" && (
            <AddGoalForm
              form={newGoal}
              setForm={setNewGoal}
              onAdd={() => addGoal("personal")}
              onCancel={() => setShowAdd(null)}
              isShared={false}
            />
          )}
        </div>
      )}

      {/* Shared goals */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            🏠 Shared household goals
          </div>
          <button
            className="btn-ghost"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
            }}
            onClick={() => setShowAdd("shared")}
          >
            <Plus size={13} /> Add
          </button>
        </div>
        {sharedGoals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            isShared={true}
            personNames={personNames}
            onUpdate={(u) =>
              updateShared(
                "goals",
                sharedGoals.map((x) => (x.id === u.id ? u : x)),
              )
            }
            onDelete={() =>
              updateShared(
                "goals",
                sharedGoals.filter((x) => x.id !== g.id),
              )
            }
          />
        ))}
        {showAdd === "shared" && (
          <AddGoalForm
            form={newGoal}
            setForm={setNewGoal}
            onAdd={() => addGoal("shared")}
            onCancel={() => setShowAdd(null)}
            isShared={true}
            personNames={personNames}
          />
        )}
      </div>
    </div>
  );
}

function AddGoalForm({
  form,
  setForm,
  onAdd,
  onCancel,
  isShared,
  personNames,
}) {
  const COLORS = [
    "#4caf82",
    "#5b9cf6",
    "#c9a84c",
    "#e05c5c",
    "#9b7fe8",
    "#d46eb3",
    "#f0875a",
  ];
  const EMOJIS = [
    "🏠",
    "✈️",
    "🎓",
    "👶",
    "🚗",
    "💍",
    "🛡️",
    "📱",
    "🏖️",
    "💰",
    "🌍",
  ];
  return (
    <div className="card section-gap">
      <div className="card-title">
        New {isShared ? "Shared" : "Personal"} Goal
      </div>
      <div className="grid-2" style={{ marginBottom: 12 }}>
        <div>
          <label
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              display: "block",
              marginBottom: 4,
            }}
          >
            Goal name
          </label>
          <input
            placeholder="e.g. Home Down Payment"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              display: "block",
              marginBottom: 4,
            }}
          >
            Target (₹)
          </label>
          <input
            type="number"
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
          />
        </div>
        {isShared ? (
          <>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {personNames?.abhav || "Person 1"} saved (₹)
              </label>
              <input
                type="number"
                value={form.abhavSaved}
                onChange={(e) =>
                  setForm({ ...form, abhavSaved: e.target.value })
                }
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {personNames?.aanya || "Person 2"} saved (₹)
              </label>
              <input
                type="number"
                value={form.aanyaSaved}
                onChange={(e) =>
                  setForm({ ...form, aanyaSaved: e.target.value })
                }
              />
            </div>
          </>
        ) : (
          <div>
            <label
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Already saved (₹)
            </label>
            <input
              type="number"
              value={form.saved}
              onChange={(e) => setForm({ ...form, saved: e.target.value })}
            />
          </div>
        )}
        <div>
          <label
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              display: "block",
              marginBottom: 4,
            }}
          >
            Deadline
          </label>
          <input
            type="month"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            display: "block",
            marginBottom: 8,
          }}
        >
          Icon
        </label>
        <div
          style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setForm({ ...form, emoji: e })}
              style={{
                width: 34,
                height: 34,
                fontSize: 17,
                borderRadius: 8,
                background:
                  form.emoji === e ? "var(--gold-dim)" : "var(--bg-card2)",
                border:
                  form.emoji === e
                    ? "1px solid var(--gold)"
                    : "1px solid var(--border)",
              }}
            >
              {e}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setForm({ ...form, color: c })}
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: c,
                border:
                  form.color === c
                    ? "2px solid white"
                    : "2px solid transparent",
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-primary" onClick={onAdd}>
          Add Goal
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
