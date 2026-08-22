import React from "react";
import { Clock, MapPin, GraduationCap, Pencil, Trash2 } from "lucide-react";
import { groupConsecutiveSlots } from "../../utils/timetableUtils.js";

export function SlotCard({
  slot,
  activeTheme,
  isCompact,
  showRoom,
  showClassTag,
  selectedClass,
  onEdit,
  onRemove,
}) {
  return (
    <div
      className="timetable-slot-card"
      style={{
        padding: isCompact ? "7px 9px" : "10px 12px",
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-elevated)",
        borderLeft: `4px solid ${slot.subject?.color || activeTheme.accent}`,
        position: "relative",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 6,
          marginBottom: isCompact ? 2 : 4,
        }}
      >
        <div
          title={slot.subject?.name}
          style={{
            fontSize: isCompact ? 12 : 14,
            fontWeight: 700,
            color: "var(--text)",
            lineHeight: 1.25,
            display: "-webkit-box",
            WebkitLineClamp: isCompact ? 1 : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          {slot.subject?.name}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          {slot.isMerged && slot.spanCount > 1 && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 5px",
                borderRadius: 4,
                background: "var(--accent-soft)",
                color: activeTheme.accent,
                whiteSpace: "nowrap",
              }}
            >
              {slot.spanCount} periods
            </span>
          )}

          {showClassTag && (selectedClass === "All" || slot.className !== selectedClass) && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 5px",
                borderRadius: 4,
                background: "var(--accent-soft)",
                color: activeTheme.accent,
                whiteSpace: "nowrap",
              }}
            >
              {slot.className || "BCA 2A"}
            </span>
          )}

          <button
            type="button"
            onClick={() => onEdit(slot)}
            title="Edit class slot"
            aria-label={`Edit ${slot.subject?.name || "class"} slot`}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 2,
              borderRadius: 4,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s ease",
            }}
          >
            <Pencil size={13} />
          </button>

          <button
            type="button"
            onClick={() => onRemove(slot)}
            title="Remove class slot"
            aria-label={`Remove ${slot.subject?.name || "class"} slot`}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 2,
              borderRadius: 4,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s ease",
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div
        style={{
          fontSize: isCompact ? 10 : 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Clock size={11} style={{ opacity: 0.7 }} />
        <span>
          {slot.startTime} – {slot.endTime}
        </span>
      </div>

      {showRoom && slot.room && (
        <div
          style={{
            fontSize: isCompact ? 10 : 11,
            color: activeTheme.accent,
            fontWeight: 500,
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <MapPin size={11} style={{ opacity: 0.8 }} />
          <span>{slot.room}</span>
        </div>
      )}

      {slot.instructor && (
        <div
          style={{
            fontSize: isCompact ? 10 : 11,
            color: "var(--text-muted)",
            fontWeight: 500,
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <GraduationCap size={11} style={{ opacity: 0.8 }} />
          <span>{slot.instructor}</span>
        </div>
      )}
    </div>
  );
}

export function TimetableColumnsView({
  activeDays,
  currentDayIndex,
  filteredSlots,
  activeTheme,
  isCompact,
  isMobile,
  hideWeekends,
  showRoom,
  showClassTag,
  selectedClass,
  onEdit,
  onRemove,
}) {
  return (
    <div
      className="grid timetable-grid"
      style={{
        gridTemplateColumns: isMobile ? "1fr" : hideWeekends ? "repeat(5, 1fr)" : "repeat(7, 1fr)",
        gap: isCompact ? 8 : 12,
        alignItems: "stretch",
      }}
    >
      {activeDays.map(({ dayName, index: dayIdx }) => {
        const isToday = currentDayIndex === dayIdx;
        const daySlotsRaw = filteredSlots.filter((s) => s.dayOfWeek === dayIdx);
        const daySlots = groupConsecutiveSlots(daySlotsRaw);

        return (
          <div
            key={dayName}
            style={{
              minHeight: isCompact ? 160 : 220,
              padding: isCompact ? "10px" : "14px",
              display: "flex",
              flexDirection: "column",
              borderRadius: "var(--radius-sm)",
              border: isToday ? `1.5px solid ${activeTheme.accent}` : `1px solid ${activeTheme.border}`,
              background: activeTheme.cardBg,
              boxShadow: isToday ? `0 4px 20px rgba(0, 242, 254, 0.15)` : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
                paddingBottom: 6,
                borderBottom: `1px solid ${activeTheme.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: isCompact ? 14 : 15,
                    fontWeight: 700,
                    color: isToday ? activeTheme.accent : "var(--text)",
                  }}
                >
                  {dayName}
                </span>
                {isToday && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 5px",
                      borderRadius: 999,
                      background: activeTheme.accent,
                      color: activeTheme.accentText,
                      textTransform: "uppercase",
                    }}
                  >
                    Today
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
                {daySlots.length}
              </span>
            </div>

            {daySlots.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  fontStyle: "italic",
                  opacity: 0.6,
                }}
              >
                No classes
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: isCompact ? 6 : 10, flex: 1 }}>
                {daySlots.map((s) => (
                  <SlotCard
                    key={s._id}
                    slot={s}
                    activeTheme={activeTheme}
                    isCompact={isCompact}
                    showRoom={showRoom}
                    showClassTag={showClassTag}
                    selectedClass={selectedClass}
                    onEdit={onEdit}
                    onRemove={onRemove}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TimetableMatrixView({
  activeDays,
  currentDayIndex,
  filteredSlots,
  timePeriods,
  activeTheme,
  showRoom,
  showClassTag,
  selectedClass,
  onEdit,
  onRemove,
}) {
  return (
    <div
      className="custom-scrollbar"
      style={{
        overflowX: "auto",
        paddingBottom: 8,
        "--scrollbar-track": activeTheme.cardBg,
        "--scrollbar-thumb": activeTheme.accent,
        "--scrollbar-thumb-hover": activeTheme.accent,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 6 }}>
        <thead>
          <tr>
            <th
              style={{
                padding: "10px",
                textAlign: "left",
                fontSize: 13,
                fontWeight: 700,
                borderBottom: `1px solid ${activeTheme.border}`,
                color: "var(--text-muted)",
                minWidth: 90,
              }}
            >
              Day / Time
            </th>
            {timePeriods.length === 0 ? (
              <th
                style={{
                  padding: "10px",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  textAlign: "center",
                }}
              >
                No time slots available
              </th>
            ) : (
              timePeriods.map((tp) => (
                <th
                  key={tp.key}
                  style={{
                    padding: "8px 12px",
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    borderBottom: `1px solid ${activeTheme.border}`,
                    color: activeTheme.accent,
                    background: "var(--bg-elevated)",
                    borderRadius: "var(--radius-sm)",
                    minWidth: 120,
                  }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Clock size={13} />
                    <span>
                      {tp.startTime} – {tp.endTime}
                    </span>
                  </div>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {activeDays.map(({ dayName, index: dayIdx }) => {
            const isToday = currentDayIndex === dayIdx;
            const daySlotsRaw = filteredSlots.filter((s) => s.dayOfWeek === dayIdx);
            const dayMergedSlots = groupConsecutiveSlots(daySlotsRaw);

            const matrixCells = [];
            let skipUntilIndex = -1;

            timePeriods.forEach((tp, tpIdx) => {
              if (tpIdx < skipUntilIndex) return;

              const mergedSlot = dayMergedSlots.find(
                (s) => (s.startTime || "").trim() === (tp.startTime || "").trim()
              );

              if (mergedSlot) {
                let colSpan = 1;
                for (let k = tpIdx + 1; k < timePeriods.length; k++) {
                  const nextTp = timePeriods[k];
                  if ((nextTp.startTime || "").trim() < (mergedSlot.endTime || "").trim()) {
                    colSpan++;
                  } else {
                    break;
                  }
                }
                skipUntilIndex = tpIdx + colSpan;

                matrixCells.push(
                  <td
                    key={tp.key}
                    colSpan={colSpan}
                    style={{
                      padding: 4,
                      verticalAlign: "top",
                    }}
                  >
                    <SlotCard
                      slot={mergedSlot}
                      activeTheme={activeTheme}
                      isCompact={true}
                      showRoom={showRoom}
                      showClassTag={showClassTag}
                      selectedClass={selectedClass}
                      onEdit={onEdit}
                      onRemove={() => onRemove(mergedSlot)}
                    />
                  </td>
                );
              } else {
                const isCovered = dayMergedSlots.some((s) => {
                  const start = (s.startTime || "").trim();
                  const end = (s.endTime || "").trim();
                  return start < (tp.startTime || "").trim() && end > (tp.startTime || "").trim();
                });

                if (!isCovered) {
                  matrixCells.push(
                    <td
                      key={tp.key}
                      style={{
                        padding: 4,
                        verticalAlign: "top",
                      }}
                    >
                      <div
                        style={{
                          height: 48,
                          border: `1px dashed ${activeTheme.border}`,
                          borderRadius: "var(--radius-sm)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-muted)",
                          fontSize: 12,
                          opacity: 0.4,
                        }}
                      >
                        —
                      </div>
                    </td>
                  );
                }
              }
            });

            return (
              <tr key={dayName}>
                <td
                  style={{
                    padding: "12px 10px",
                    fontWeight: 700,
                    fontSize: 14,
                    color: isToday ? activeTheme.accent : "var(--text)",
                    background: isToday ? "var(--accent-soft)" : "transparent",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{dayName}</span>
                    {isToday && (
                      <span
                        style={{
                          fontSize: 9,
                          background: activeTheme.accent,
                          color: activeTheme.accentText,
                          padding: "1px 5px",
                          borderRadius: 4,
                          fontWeight: 800,
                        }}
                      >
                        TODAY
                      </span>
                    )}
                  </div>
                </td>

                {matrixCells}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TimetableAgendaView({
  activeDays,
  currentDayIndex,
  filteredSlots,
  activeTheme,
  showRoom,
  showClassTag,
  selectedClass,
  onEdit,
  onRemove,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {activeDays.map(({ dayName, index: dayIdx }) => {
        const isToday = currentDayIndex === dayIdx;
        const daySlotsRaw = filteredSlots.filter((s) => s.dayOfWeek === dayIdx);
        const daySlots = groupConsecutiveSlots(daySlotsRaw);

        return (
          <div
            key={dayName}
            style={{
              padding: "16px",
              borderRadius: "var(--radius-sm)",
              border: isToday ? `1.5px solid ${activeTheme.accent}` : `1px solid ${activeTheme.border}`,
              background: activeTheme.cardBg,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
                borderBottom: `1px solid ${activeTheme.border}`,
                paddingBottom: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: isToday ? activeTheme.accent : "var(--text)",
                  }}
                >
                  {dayName} Agenda
                </span>
                {isToday && (
                  <span
                    style={{
                      fontSize: 10,
                      background: activeTheme.accent,
                      color: activeTheme.accentText,
                      padding: "2px 6px",
                      borderRadius: 999,
                      fontWeight: 800,
                    }}
                  >
                    TODAY
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                {daySlots.length} class{daySlots.length === 1 ? "" : "es"}
              </span>
            </div>

            {daySlots.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic", opacity: 0.6 }}>
                No classes on {dayName}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {daySlots.map((s) => (
                  <div
                    key={s._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--bg-elevated)",
                      borderLeft: `4px solid ${s.subject?.color || activeTheme.accent}`,
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: activeTheme.accent,
                          minWidth: 110,
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Clock size={13} />
                        <span>
                          {s.startTime} – {s.endTime}
                        </span>
                      </div>
                      <div
                        title={s.subject?.name}
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "var(--text)",
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: "vertical",
                          maxWidth: 220,
                        }}
                      >
                        {s.subject?.name}
                      </div>
                      {s.isMerged && s.spanCount > 1 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            background: "var(--accent-soft)",
                            color: activeTheme.accent,
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {s.spanCount} periods
                        </span>
                      )}
                      {showRoom && s.room && (
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            background: "var(--panel)",
                            padding: "2px 8px",
                            borderRadius: 4,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <MapPin size={12} /> {s.room}
                        </span>
                      )}
                      {showClassTag && (selectedClass === "All" || s.className !== selectedClass) && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            background: "var(--accent-soft)",
                            color: activeTheme.accent,
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {s.className || "BCA 2A"}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => onEdit(s)}
                        title="Edit class slot"
                        aria-label={`Edit ${s.subject?.name || "class"} slot`}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          padding: 4,
                          borderRadius: 4,
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(s)}
                        title="Remove class slot"
                        aria-label={`Remove ${s.subject?.name || "class"} slot`}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          padding: 4,
                          borderRadius: 4,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
