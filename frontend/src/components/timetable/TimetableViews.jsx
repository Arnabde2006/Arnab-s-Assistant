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
