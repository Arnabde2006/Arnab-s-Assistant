import React from "react";
import { Plus, Save, X, AlertTriangle } from "lucide-react";
import { PRESET_CLASSES, DAYS } from "../../utils/timetableUtils.js";

export function TimetableAddForm({
  showAddForm,
  form,
  setForm,
  subjects,
  addSlot,
  pending,
}) {
  if (!showAddForm) return null;

  return (
    <form
      onSubmit={addSlot}
      className="card"
      style={{
        display: "flex",
        gap: 12,
        marginBottom: 20,
        flexWrap: "wrap",
        alignItems: "flex-end",
      }}
    >
      <div>
        <label className="label">Class / Year</label>
        <select
          className="input"
          value={form.className}
          onChange={(e) => setForm({ ...form, className: e.target.value })}
        >
          {PRESET_CLASSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Subject</label>
        {subjects.length > 0 ? (
          <select
            className="input"
            value={form.subjectId}
            onChange={(e) =>
              setForm({ ...form, subjectId: e.target.value, subjectName: "" })
            }
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="NEW">+ Add new subject...</option>
          </select>
        ) : (
          <input
            className="input"
            placeholder="e.g. Data Structures"
            value={form.subjectName}
            onChange={(e) =>
              setForm({ ...form, subjectId: "NEW", subjectName: e.target.value })
            }
            required
          />
        )}
      </div>

      {subjects.length > 0 && form.subjectId === "NEW" && (
        <div>
          <label className="label">New Subject Name</label>
          <input
            className="input"
            placeholder="Enter subject name"
            value={form.subjectName}
            onChange={(e) => setForm({ ...form, subjectName: e.target.value })}
            required
          />
        </div>
      )}

      <div>
        <label className="label">Day</label>
        <select
          className="input"
          value={form.dayOfWeek}
          onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
        >
          {DAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Start</label>
        <input
          className="input"
          type="time"
          value={form.startTime}
          onChange={(e) => setForm({ ...form, startTime: e.target.value })}
        />
      </div>

      <div>
        <label className="label">End</label>
        <input
          className="input"
          type="time"
          value={form.endTime}
          onChange={(e) => setForm({ ...form, endTime: e.target.value })}
        />
      </div>

      <div>
        <label className="label">Room</label>
        <input
          className="input"
          placeholder="Optional"
          value={form.room}
          onChange={(e) => setForm({ ...form, room: e.target.value })}
        />
      </div>

      <div>
        <label className="label">Teacher</label>
        <input
          className="input"
          placeholder="Optional"
          value={form.instructor}
          onChange={(e) => setForm({ ...form, instructor: e.target.value })}
        />
      </div>

      <button
        className="btn"
        type="submit"
        disabled={pending}
        style={{ display: "flex", alignItems: "center", gap: 6 }}
      >
        <Plus size={15} /> {pending ? "Adding…" : "Add Class Slot"}
      </button>
    </form>
  );
}

export function TimetableEditModal({
  editingSlot,
  setEditingSlot,
  editForm,
  setEditForm,
  editSubmitting,
  handleEditSubmit,
  subjects,
  editDialog,
}) {
  if (!editingSlot) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" {...editDialog.dialogProps}>
        <div className="modal-header">
          <h3 className="modal-title" {...editDialog.titleProps}>
            Edit Class Slot
          </h3>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setEditingSlot(null)}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {editingSlot._isMergedGroup && (
          <div
            style={{
              padding: "10px 14px",
              background: "var(--accent-soft)",
              border: "1px solid var(--accent)",
              borderRadius: "var(--radius-sm)",
              marginBottom: 16,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0, color: "var(--accent)" }} />
            <span>
              This slot spans {editingSlot._spanCount} consecutive periods. Editing updates period 1.
            </span>
          </div>
        )}

        <form onSubmit={handleEditSubmit}>
          <div className="form-group-layout">
            <label className="form-label-styled">Subject</label>
            {subjects.length > 0 ? (
              <select
                className="input"
                value={editForm.subjectId}
                onChange={(e) =>
                  setEditForm({ ...editForm, subjectId: e.target.value, subjectName: "" })
                }
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="NEW">+ Add new subject...</option>
              </select>
            ) : (
              <input
                className="input"
                placeholder="e.g. Data Structures"
                value={editForm.subjectName}
                onChange={(e) =>
                  setEditForm({ ...editForm, subjectId: "NEW", subjectName: e.target.value })
                }
                required
              />
            )}
          </div>

          {subjects.length > 0 && editForm.subjectId === "NEW" && (
            <div className="form-group-layout">
              <label className="form-label-styled">New Subject Name</label>
              <input
                className="input"
                placeholder="Enter subject name"
                value={editForm.subjectName}
                onChange={(e) => setEditForm({ ...editForm, subjectName: e.target.value })}
                required
              />
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group-layout">
              <label className="form-label-styled">Day</label>
              <select
                className="input"
                value={editForm.dayOfWeek}
                onChange={(e) =>
                  setEditForm({ ...editForm, dayOfWeek: Number(e.target.value) })
                }
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group-layout">
              <label className="form-label-styled">Class / Year</label>
              <select
                className="input"
                value={editForm.className}
                onChange={(e) => setEditForm({ ...editForm, className: e.target.value })}
              >
                {PRESET_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group-layout">
              <label className="form-label-styled">Start Time</label>
              <input
                className="input"
                type="time"
                value={editForm.startTime}
                onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
              />
            </div>

            <div className="form-group-layout">
              <label className="form-label-styled">End Time</label>
              <input
                className="input"
                type="time"
                value={editForm.endTime}
                onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group-layout">
              <label className="form-label-styled">Room (Optional)</label>
              <input
                className="input"
                placeholder="e.g. Lab 2"
                value={editForm.room}
                onChange={(e) => setEditForm({ ...editForm, room: e.target.value })}
              />
            </div>

            <div className="form-group-layout">
              <label className="form-label-styled">Teacher (Optional)</label>
              <input
                className="input"
                placeholder="e.g. Dr. Roy"
                value={editForm.instructor}
                onChange={(e) => setEditForm({ ...editForm, instructor: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setEditingSlot(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={editSubmitting}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Save size={15} />
              <span>{editSubmitting ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
