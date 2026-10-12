import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Plane,
  Upload,
  Download,
  Code,
  AlertCircle,
  Users,
  User,
  Database,
  ArrowRightLeft,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  normalizeTripPayload,
  mergeTripItems,
  exportTripToArchitectureFormat,
  fetchSupabaseTrips,
  syncWealthOSTripToSupabase,
  parseSupabaseTripToWealthOS,
  DEFAULT_SUPABASE_URL,
} from "../utils/tripSync.js";
import { fmt, nextId } from "../utils/finance.js";

export default function TripSyncModal({
  open,
  onClose,
  expenses = [],
  sharedTrips = [],
  updatePerson,
  updateShared,
}) {
  const [tab, setTab] = useState("cloud"); // "cloud" | "import" | "export" | "webhook"
  const [rawJson, setRawJson] = useState("");
  const [importTarget, setImportTarget] = useState("shared"); // "shared" | "personal" | "merge"
  const [selectedMergeId, setSelectedMergeId] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [selectedExportTripKey, setSelectedExportTripKey] = useState("");

  // Supabase Cloud State
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [supabaseTrips, setSupabaseTrips] = useState([]);
  const [supabaseError, setSupabaseError] = useState(null);
  const [syncingTripId, setSyncingTripId] = useState(null);

  const allAvailableTrips = useMemo(() => {
    const list = [];
    (sharedTrips || []).forEach((t) =>
      list.push({ ...t, _isShared: true, key: `shared_${t.id}` }),
    );
    (expenses || [])
      .filter((e) => e.expenseType === "trip")
      .forEach((t) => list.push({ ...t, _isShared: false, key: `personal_${t.id}` }));
    return list;
  }, [expenses, sharedTrips]);

  // Load trips from Supabase when modal opens or cloud tab is selected
  useEffect(() => {
    if (!open) return;
    loadSupabaseTrips();
  }, [open]);

  const loadSupabaseTrips = async () => {
    setSupabaseLoading(true);
    setSupabaseError(null);
    try {
      const rows = await fetchSupabaseTrips();
      setSupabaseTrips(rows || []);
    } catch (err) {
      setSupabaseError(err.message || "Failed to connect to Supabase");
    } finally {
      setSupabaseLoading(false);
    }
  };

  // Pull from Supabase into WealthOS
  const handlePullFromSupabase = (row, targetMode = "shared", mergeTargetKey = "") => {
    try {
      const parsed = parseSupabaseTripToWealthOS(row);
      if (!parsed) {
        toast.error("Could not parse trip from Supabase");
        return;
      }

      if (targetMode === "merge" && mergeTargetKey) {
        const targetTrip = allAvailableTrips.find((t) => t.key === mergeTargetKey);
        if (!targetTrip) {
          toast.error("Select a trip to merge into");
          return;
        }

        if (targetTrip._isShared) {
          updateShared("trips", (prev = []) =>
            prev.map((t) => {
              if (t.id === targetTrip.id) {
                const updated = mergeTripItems(t, parsed.items, { deduplicate: true });
                updated.supabaseTripId = parsed.supabaseTripId;
                if (parsed.itineraryUrl) updated.itineraryUrl = parsed.itineraryUrl;
                return updated;
              }
              return t;
            }),
          );
        } else {
          updatePerson("expenses", (prev = []) =>
            prev.map((e) => {
              if (e.id === targetTrip.id) {
                const updated = mergeTripItems(e, parsed.items, { deduplicate: true });
                updated.supabaseTripId = parsed.supabaseTripId;
                if (parsed.itineraryUrl) updated.itineraryUrl = parsed.itineraryUrl;
                return updated;
              }
              return e;
            }),
          );
        }
        toast.success(`Merged ${parsed.items.length} items from Supabase into "${targetTrip.name}"`);
      } else if (targetMode === "personal") {
        const newId = nextId(expenses);
        updatePerson("expenses", (prev = []) => [
          { ...parsed, id: newId },
          ...prev,
        ]);
        toast.success(`Imported "${parsed.name}" as Personal Trip!`);
      } else {
        // Shared
        const newId = nextId(sharedTrips);
        updateShared("trips", (prev = []) => [
          { ...parsed, id: newId },
          ...prev,
        ]);
        toast.success(`Imported "${parsed.name}" as Shared Trip!`);
      }
    } catch (err) {
      toast.error(`Import failed: ${err.message}`);
    }
  };

  // Push WealthOS trip to Supabase
  const handlePushToSupabase = async (wealthOSTrip, supabaseTripId) => {
    const targetId = supabaseTripId || wealthOSTrip.supabaseTripId;
    if (!targetId) {
      toast.error("Please specify which Supabase trip to sync with");
      return;
    }

    setSyncingTripId(targetId);
    try {
      await syncWealthOSTripToSupabase(wealthOSTrip, targetId);
      toast.success(
        `Successfully pushed ${wealthOSTrip.items?.length || 0} expenses (${fmt(
          wealthOSTrip.amount,
        )}) to Trip Architect!`,
      );
      await loadSupabaseTrips();
    } catch (err) {
      toast.error(`Push failed: ${err.message}`);
    } finally {
      setSyncingTripId(null);
    }
  };

  // 2-Way Sync: Merge Supabase items + WealthOS items, update both sides
  const handleTwoWaySync = async (row, existingWealthOSTrip) => {
    const supabaseTripId = row.id;
    setSyncingTripId(supabaseTripId);
    try {
      const parsedSupabase = parseSupabaseTripToWealthOS(row);

      // 1. Merge items locally
      const mergedLocal = mergeTripItems(existingWealthOSTrip, parsedSupabase.items, {
        deduplicate: true,
      });
      mergedLocal.supabaseTripId = supabaseTripId;

      // 2. Update local state
      if (existingWealthOSTrip._isShared) {
        updateShared("trips", (prev = []) =>
          prev.map((t) => (t.id === existingWealthOSTrip.id ? mergedLocal : t)),
        );
      } else {
        updatePerson("expenses", (prev = []) =>
          prev.map((e) => (e.id === existingWealthOSTrip.id ? mergedLocal : e)),
        );
      }

      // 3. Push merged set back to Supabase
      await syncWealthOSTripToSupabase(mergedLocal, supabaseTripId);

      toast.success(`2-way sync complete! ${mergedLocal.items.length} items reconciled.`);
      await loadSupabaseTrips();
    } catch (err) {
      toast.error(`2-way sync failed: ${err.message}`);
    } finally {
      setSyncingTripId(null);
    }
  };

  // Real-time parsed trip from textarea for manual import
  const parsedPreview = useMemo(() => {
    if (!rawJson.trim()) return null;
    try {
      return { success: true, trip: normalizeTripPayload(rawJson) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [rawJson]);

  const handleFillSample = () => {
    const sample = {
      name: "Goa Beach Holiday",
      startDate: "2026-11-10",
      endDate: "2026-11-15",
      budget: 35000,
      itineraryUrl: "https://trip-architecture.web.app/trips/goa-2026",
      bookings: [
        {
          title: "Indigo Flights",
          cost: 8500,
          type: "Flight",
          date: "2026-11-10",
        },
        {
          title: "Taj Resort Stay",
          cost: 14000,
          type: "Hotel",
          date: "2026-11-11",
        },
        {
          title: "Scuba Diving & Watersports",
          cost: 4500,
          type: "Activities",
          date: "2026-11-12",
        },
      ],
    };
    setRawJson(JSON.stringify(sample, null, 2));
  };

  const handleCommitManualImport = () => {
    if (!parsedPreview?.success) {
      toast.error(parsedPreview?.error || "Invalid trip JSON");
      return;
    }

    const tripData = parsedPreview.trip;

    if (importTarget === "merge") {
      const targetTrip = allAvailableTrips.find((t) => t.key === selectedMergeId);
      if (!targetTrip) {
        toast.error("Please select a trip to merge into.");
        return;
      }

      if (targetTrip._isShared) {
        updateShared("trips", (prev = []) =>
          prev.map((t) => {
            if (t.id === targetTrip.id) {
              const updated = mergeTripItems(t, tripData.items, { deduplicate: true });
              if (tripData.itineraryUrl) updated.itineraryUrl = tripData.itineraryUrl;
              return updated;
            }
            return t;
          }),
        );
      } else {
        updatePerson("expenses", (prev = []) =>
          prev.map((e) => {
            if (e.id === targetTrip.id) {
              const updated = mergeTripItems(e, tripData.items, { deduplicate: true });
              if (tripData.itineraryUrl) updated.itineraryUrl = tripData.itineraryUrl;
              return updated;
            }
            return e;
          }),
        );
      }
      toast.success(`Merged ${tripData.items.length} items into "${targetTrip.name}"`);
    } else if (importTarget === "personal") {
      const newId = nextId(expenses);
      updatePerson("expenses", (prev = []) => [
        { ...tripData, id: newId },
        ...prev,
      ]);
      toast.success(`Personal trip "${tripData.name}" created!`);
    } else {
      // Shared
      const newId = nextId(sharedTrips);
      updateShared("trips", (prev = []) => [
        { ...tripData, id: newId },
        ...prev,
      ]);
      toast.success(`Shared trip "${tripData.name}" created!`);
    }

    setRawJson("");
    onClose();
  };

  // Export trip selection
  const exportTargetTrip = useMemo(() => {
    if (!allAvailableTrips.length) return null;
    if (selectedExportTripKey) {
      return (
        allAvailableTrips.find((t) => t.key === selectedExportTripKey) ||
        allAvailableTrips[0]
      );
    }
    return allAvailableTrips[0];
  }, [allAvailableTrips, selectedExportTripKey]);

  const exportJsonString = useMemo(() => {
    if (!exportTargetTrip) return "";
    return JSON.stringify(exportTripToArchitectureFormat(exportTargetTrip), null, 2);
  }, [exportTargetTrip]);

  const handleCopyExport = async () => {
    if (!exportJsonString) return;
    try {
      await navigator.clipboard.writeText(exportJsonString);
      setCopied(true);
      toast.success("Trip JSON copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/trip-sync`
      : "https://your-wealthos-domain/api/trip-sync";

  const curlExample = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Manali Workation",
    "startDate": "2026-11-01",
    "budget": 30000,
    "itineraryUrl": "https://trip-architecture.web.app/trips/manali",
    "items": [
      { "name": "Volvo Bus", "amount": 3200, "category": "Transport" },
      { "name": "Resort Booking", "amount": 16000, "category": "Housing" }
    ]
  }'`;

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlExample);
      setCopiedCurl(true);
      toast.success("Curl command copied!");
      setTimeout(() => setCopiedCurl(false), 2000);
    } catch {
      toast.error("Failed to copy curl command");
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(4px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-card, #1c1c27)",
          border: "1px solid var(--border, rgba(255,255,255,0.12))",
          borderRadius: 16,
          padding: 24,
          maxWidth: 640,
          width: "100%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 28px 70px rgba(0,0,0,0.65)",
          color: "var(--text, #eeeae4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(99, 102, 241, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary, #6366f1)",
              }}
            >
              <Plane size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Trip Architecture Sync
              </h3>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
                Live bidirectional sync between Trip Architect &amp; WealthOS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: 6,
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 6,
              display: "flex",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab navigation */}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 16,
            borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))",
            paddingBottom: 8,
            overflowX: "auto",
          }}
        >
          <button
            onClick={() => setTab("cloud")}
            style={{
              padding: "7px 13px",
              fontSize: 12,
              fontWeight: tab === "cloud" ? 600 : 400,
              color: tab === "cloud" ? "var(--primary, #6366f1)" : "var(--text-muted)",
              background: tab === "cloud" ? "rgba(99, 102, 241, 0.14)" : "transparent",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <Database size={13} /> ⚡ Supabase Cloud
          </button>
          <button
            onClick={() => setTab("import")}
            style={{
              padding: "7px 13px",
              fontSize: 12,
              fontWeight: tab === "import" ? 600 : 400,
              color: tab === "import" ? "var(--primary, #6366f1)" : "var(--text-muted)",
              background: tab === "import" ? "rgba(99, 102, 241, 0.14)" : "transparent",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <Download size={13} /> Manual JSON
          </button>
          <button
            onClick={() => setTab("export")}
            style={{
              padding: "7px 13px",
              fontSize: 12,
              fontWeight: tab === "export" ? 600 : 400,
              color: tab === "export" ? "var(--primary, #6366f1)" : "var(--text-muted)",
              background: tab === "export" ? "rgba(99, 102, 241, 0.14)" : "transparent",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <Upload size={13} /> Export JSON
          </button>
          <button
            onClick={() => setTab("webhook")}
            style={{
              padding: "7px 13px",
              fontSize: 12,
              fontWeight: tab === "webhook" ? 600 : 400,
              color: tab === "webhook" ? "var(--primary, #6366f1)" : "var(--text-muted)",
              background: tab === "webhook" ? "rgba(99, 102, 241, 0.14)" : "transparent",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <Code size={13} /> Webhook API
          </button>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
          {/* TAB: Supabase Cloud Live Sync */}
          {tab === "cloud" && (
            <div>
              {/* Connection Status Banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  borderRadius: 10,
                  marginBottom: 16,
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--green, #10b981)",
                      boxShadow: "0 0 8px #10b981",
                    }}
                  />
                  <span>
                    Connected to <strong>Supabase Cloud</strong> (<code>eqciatcascbstrohqbnp</code>)
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={loadSupabaseTrips}
                    disabled={supabaseLoading}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--primary, #6366f1)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      padding: 0,
                    }}
                  >
                    <RefreshCw
                      size={12}
                      style={{
                        animation: supabaseLoading ? "spin 1s linear infinite" : "none",
                      }}
                    />
                    Refresh
                  </button>
                  <a
                    href="https://supabase.com/dashboard/project/eqciatcascbstrohqbnp"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      fontSize: 11,
                      textDecoration: "none",
                    }}
                  >
                    Dashboard <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              {supabaseError && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: 8,
                    marginBottom: 16,
                    color: "var(--red, #ef4444)",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{supabaseError}</span>
                </div>
              )}

              {/* Trip Cards from Supabase */}
              <div style={{ marginBottom: 18 }}>
                <h4
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>Trips in Trip Architect Database ({supabaseTrips.length})</span>
                  {supabaseLoading && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Loading trips...
                    </span>
                  )}
                </h4>

                {supabaseTrips.length === 0 && !supabaseLoading && (
                  <div
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: 12,
                      background: "rgba(0,0,0,0.15)",
                      borderRadius: 8,
                    }}
                  >
                    No trips found in Supabase database.
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {supabaseTrips.map((row) => {
                    const parsed = parseSupabaseTripToWealthOS(row);
                    const tripId = row.id;

                    // Match with local WealthOS trip
                    const linkedLocalTrip = allAvailableTrips.find(
                      (t) =>
                        t.supabaseTripId === tripId ||
                        t.name?.toLowerCase().trim() === parsed?.name?.toLowerCase().trim(),
                    );

                    const isSyncing = syncingTripId === tripId;

                    return (
                      <div
                        key={tripId}
                        style={{
                          background: "rgba(0,0,0,0.28)",
                          border: linkedLocalTrip
                            ? "1px solid rgba(99, 102, 241, 0.4)"
                            : "1px solid var(--border)",
                          borderRadius: 10,
                          padding: "12px 14px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: 8,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                marginBottom: 2,
                              }}
                            >
                              <span style={{ fontWeight: 600, fontSize: 13 }}>
                                {parsed?.name || tripId}
                              </span>
                              <code
                                style={{
                                  fontSize: 10,
                                  background: "rgba(255,255,255,0.06)",
                                  padding: "1px 5px",
                                  borderRadius: 4,
                                  color: "var(--text-muted)",
                                }}
                              >
                                {tripId}
                              </code>
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                display: "flex",
                                gap: 10,
                                flexWrap: "wrap",
                              }}
                            >
                              {parsed?.startDate && (
                                <span>
                                  📅 {parsed.startDate}
                                  {parsed.endDate ? ` to ${parsed.endDate}` : ""}
                                </span>
                              )}
                              <span>💰 Budget: {fmt(parsed?.budget || 0)}</span>
                              <span>📋 {parsed?.items?.length || 0} items ({fmt(parsed?.amount || 0)})</span>
                            </div>
                          </div>

                          {linkedLocalTrip ? (
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 8px",
                                borderRadius: 12,
                                background: "rgba(99, 102, 241, 0.15)",
                                color: "var(--primary, #6366f1)",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <CheckCircle2 size={11} /> Linked to {linkedLocalTrip.name}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 8px",
                                borderRadius: 12,
                                background: "rgba(255,255,255,0.06)",
                                color: "var(--text-muted)",
                              }}
                            >
                              Not in WealthOS
                            </span>
                          )}
                        </div>

                        {/* Actions for this trip */}
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 10,
                            paddingTop: 8,
                            borderTop: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          {linkedLocalTrip ? (
                            <>
                              {/* 2-Way Sync Button */}
                              <button
                                type="button"
                                onClick={() => handleTwoWaySync(row, linkedLocalTrip)}
                                disabled={isSyncing}
                                className="btn-primary"
                                style={{
                                  fontSize: 11,
                                  padding: "5px 11px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 5,
                                  cursor: isSyncing ? "wait" : "pointer",
                                }}
                              >
                                <ArrowRightLeft size={12} />
                                {isSyncing ? "Syncing..." : "🔄 2-Way Sync Both"}
                              </button>

                              {/* Push Local to Supabase */}
                              <button
                                type="button"
                                onClick={() => handlePushToSupabase(linkedLocalTrip, tripId)}
                                disabled={isSyncing}
                                className="btn-secondary"
                                style={{
                                  fontSize: 11,
                                  padding: "5px 11px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 5,
                                  cursor: isSyncing ? "wait" : "pointer",
                                }}
                              >
                                <Upload size={12} /> Push WealthOS &rarr; Trip
                              </button>

                              {/* Pull Supabase into Local */}
                              <button
                                type="button"
                                onClick={() =>
                                  handlePullFromSupabase(row, "merge", linkedLocalTrip.key)
                                }
                                disabled={isSyncing}
                                className="btn-secondary"
                                style={{
                                  fontSize: 11,
                                  padding: "5px 11px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 5,
                                  cursor: isSyncing ? "wait" : "pointer",
                                }}
                              >
                                <Download size={12} /> Pull Trip &rarr; WealthOS
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Import as Shared */}
                              <button
                                type="button"
                                onClick={() => handlePullFromSupabase(row, "shared")}
                                className="btn-primary"
                                style={{
                                  fontSize: 11,
                                  padding: "5px 11px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 5,
                                  cursor: "pointer",
                                }}
                              >
                                <Users size={12} /> Import as Shared Trip
                              </button>

                              {/* Import as Personal */}
                              <button
                                type="button"
                                onClick={() => handlePullFromSupabase(row, "personal")}
                                className="btn-secondary"
                                style={{
                                  fontSize: 11,
                                  padding: "5px 11px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 5,
                                  cursor: "pointer",
                                }}
                              >
                                <User size={12} /> Import as Personal Trip
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Push Existing WealthOS Trip to Supabase */}
              {allAvailableTrips.length > 0 && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: 14,
                    marginTop: 16,
                  }}
                >
                  <h4 style={{ fontSize: 12, fontWeight: 600, margin: "0 0 8px 0" }}>
                    📤 Push Any WealthOS Trip to Trip Architect
                  </h4>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px 0" }}>
                    Select a trip created in WealthOS and choose which Trip Architect ID to sync expenses with.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <select
                      id="sourceWealthOSTrip"
                      defaultValue={allAvailableTrips[0]?.key || ""}
                      style={{
                        flex: 1,
                        fontSize: 11,
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                        minWidth: 160,
                      }}
                    >
                      {allAvailableTrips.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t._isShared ? "🤝 [Shared] " : "✈️ [Personal] "}
                          {t.name} ({fmt(t.amount)})
                        </option>
                      ))}
                    </select>

                    <select
                      id="targetSupabaseTripId"
                      defaultValue={supabaseTrips[0]?.id || ""}
                      style={{
                        flex: 1,
                        fontSize: 11,
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                        minWidth: 160,
                      }}
                    >
                      {supabaseTrips.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.data?.title || r.id} ({r.id})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        const sourceKey = document.getElementById("sourceWealthOSTrip")?.value;
                        const targetId = document.getElementById("targetSupabaseTripId")?.value;
                        const trip = allAvailableTrips.find((t) => t.key === sourceKey);
                        if (!trip) {
                          toast.error("Please select a WealthOS trip");
                          return;
                        }
                        if (!targetId) {
                          toast.error("Please select a target Supabase trip ID");
                          return;
                        }
                        handlePushToSupabase(trip, targetId);
                      }}
                      style={{
                        fontSize: 11,
                        padding: "6px 12px",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        cursor: "pointer",
                      }}
                    >
                      <Upload size={12} /> Push Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: Manual JSON Import */}
          {tab === "import" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Paste Trip Architecture JSON or Bookings payload:
                </label>
                <button
                  type="button"
                  onClick={handleFillSample}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary, #6366f1)",
                    fontSize: 11,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Load sample payload
                </button>
              </div>

              <textarea
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                placeholder='{\n  "name": "Goa Trip",\n  "budget": 30000,\n  "itineraryUrl": "https://...",\n  "bookings": [\n    { "title": "Flight", "cost": 8000, "type": "Flight" }\n  ]\n}'
                style={{
                  width: "100%",
                  minHeight: 120,
                  fontSize: 11,
                  fontFamily: "monospace",
                  padding: 10,
                  borderRadius: 8,
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  boxSizing: "border-box",
                  marginBottom: 12,
                }}
              />

              {/* Preview card */}
              {parsedPreview && (
                <div
                  style={{
                    background: parsedPreview.success
                      ? "rgba(16, 185, 129, 0.08)"
                      : "rgba(239, 68, 68, 0.08)",
                    border: `1px solid ${
                      parsedPreview.success
                        ? "rgba(16, 185, 129, 0.25)"
                        : "rgba(239, 68, 68, 0.25)"
                    }`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 14,
                  }}
                >
                  {parsedPreview.success ? (
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          marginBottom: 4,
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>✈️ {parsedPreview.trip.name}</span>
                        <span style={{ color: "var(--green, #10b981)" }}>
                          Total: {fmt(parsedPreview.trip.amount)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        {parsedPreview.trip.startDate && (
                          <span>
                            Dates: {parsedPreview.trip.startDate}
                            {parsedPreview.trip.endDate
                              ? ` to ${parsedPreview.trip.endDate}`
                              : ""}
                          </span>
                        )}
                        {parsedPreview.trip.budget > 0 && (
                          <span>Budget: {fmt(parsedPreview.trip.budget)}</span>
                        )}
                        <span>Items: {parsedPreview.trip.items.length}</span>
                        {parsedPreview.trip.itineraryUrl && (
                          <span style={{ color: "var(--primary, #6366f1)" }}>
                            🔗 Itinerary link included
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: "var(--red, #ef4444)",
                        fontSize: 12,
                      }}
                    >
                      <AlertCircle size={14} />
                      <span>{parsedPreview.error}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Import Target */}
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 8,
                  }}
                >
                  Destination in WealthOS:
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="importTarget"
                      value="shared"
                      checked={importTarget === "shared"}
                      onChange={() => setImportTarget("shared")}
                    />
                    <Users size={13} style={{ color: "var(--green)" }} />
                    <span>Create as <strong>Shared Trip</strong> (Visible to both partners)</span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="importTarget"
                      value="personal"
                      checked={importTarget === "personal"}
                      onChange={() => setImportTarget("personal")}
                    />
                    <User size={13} style={{ color: "var(--purple)" }} />
                    <span>Create as <strong>My Personal Trip</strong></span>
                  </label>
                  {allAvailableTrips.length > 0 && (
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="importTarget"
                        value="merge"
                        checked={importTarget === "merge"}
                        onChange={() => setImportTarget("merge")}
                      />
                      <RefreshCw size={13} style={{ color: "var(--gold)" }} />
                      <span>Merge items into existing trip:</span>
                      {importTarget === "merge" && (
                        <select
                          value={selectedMergeId}
                          onChange={(e) => setSelectedMergeId(e.target.value)}
                          style={{
                            fontSize: 11,
                            padding: "3px 6px",
                            borderRadius: 4,
                            background: "rgba(0,0,0,0.3)",
                            color: "var(--text)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <option value="">Select trip...</option>
                          {allAvailableTrips.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t._isShared ? "🤝 " : "✈️ "}
                              {t.name} ({fmt(t.amount)})
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                  )}
                </div>
              </div>

              {/* Action */}
              <button
                type="button"
                className="btn-primary"
                onClick={handleCommitManualImport}
                disabled={!parsedPreview?.success}
                style={{
                  width: "100%",
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: parsedPreview?.success ? 1 : 0.5,
                  cursor: parsedPreview?.success ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Download size={14} /> Import to WealthOS
              </button>
            </div>
          )}

          {/* TAB: Export JSON */}
          {tab === "export" && (
            <div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0 }}>
                Select a trip in WealthOS to export clean JSON for the Trip Architecture website:
              </p>
              {allAvailableTrips.length === 0 ? (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    textAlign: "center",
                    padding: "20px 0",
                  }}
                >
                  No trips found in WealthOS to export.
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 6 }}>
                      Select Trip:
                    </label>
                    <select
                      value={selectedExportTripKey || (allAvailableTrips[0]?.key || "")}
                      onChange={(e) => setSelectedExportTripKey(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        fontSize: 12,
                        borderRadius: 6,
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                    >
                      {allAvailableTrips.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t._isShared ? "🤝 [Shared] " : "✈️ [Personal] "}
                          {t.name} — {fmt(t.amount)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <pre
                    style={{
                      maxHeight: 200,
                      overflowY: "auto",
                      background: "rgba(0,0,0,0.35)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: 10,
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: "var(--text)",
                    }}
                  >
                    {exportJsonString}
                  </pre>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleCopyExport}
                    style={{
                      width: "100%",
                      padding: "8px 14px",
                      fontSize: 12,
                      marginTop: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied to Clipboard!" : "Copy Trip JSON"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: Webhook & API */}
          {tab === "webhook" && (
            <div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0 }}>
                Trip Architecture can automatically post new bookings and expense line items to WealthOS using this webhook:
              </p>

              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  Webhook URL:
                </span>
                <code
                  style={{
                    display: "block",
                    padding: "6px 10px",
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 11,
                    wordBreak: "break-all",
                  }}
                >
                  {webhookUrl}
                </code>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    cURL / HTTP Request Example:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCurl}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary, #6366f1)",
                      fontSize: 11,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {copiedCurl ? <Check size={12} /> : <Copy size={12} />}
                    {copiedCurl ? "Copied" : "Copy curl"}
                  </button>
                </div>
                <pre
                  style={{
                    maxHeight: 180,
                    overflowY: "auto",
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: 8,
                    fontSize: 11,
                    fontFamily: "monospace",
                    margin: 0,
                  }}
                >
                  {curlExample}
                </pre>
              </div>

              <div
                style={{
                  background: "rgba(99, 102, 241, 0.08)",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 11,
                  color: "var(--text)",
                }}
              >
                💡 <strong>Tip:</strong> In your Trip Architecture website, add an <em>&quot;Export Expenses to WealthOS&quot;</em> button that triggers this POST request with the trip&apos;s itinerary link and booking list!
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
