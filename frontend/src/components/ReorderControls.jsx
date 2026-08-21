import React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

/**
 * Keyboard-accessible reorder buttons for a manually-ordered list.
 *
 * Drag-and-drop is pointer-only, so before this there was no way at all to
 * reorder with a keyboard. These buttons are additive — the drag handle stays
 * exactly where it was for mouse users.
 *
 * Two deliberate choices:
 *
 * `aria-disabled` rather than `disabled` at the ends of the list. A `disabled`
 * button is pulled out of the tab order, so walking an item to the bottom with
 * repeated presses would drop focus onto <body> on the final press and strand a
 * keyboard user mid-task. aria-disabled keeps the button focusable and
 * announced as unavailable, and the handler guards the no-op.
 *
 * Direction wording is passed in, not hardcoded, because it depends on layout.
 * A single-column list moves "up"/"down". A wrapping card grid moves
 * "earlier"/"later" — there the previous item may sit to the left, or at the end
 * of the row above, depending on viewport width, so "up" would be a lie.
 */
export default function ReorderControls({
  itemName,
  position,
  total,
  onPrev,
  onNext,
  prevLabel = "up",
  nextLabel = "down",
}) {
  const atStart = position <= 1;
  const atEnd = position >= total;

  return (
    // Stops clicks reaching an enclosing card that toggles expansion, and keeps a
    // stray press in the 2px gap between the buttons from doing the same.
    <span className="reorder-controls" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="reorder-btn"
        draggable={false}
        aria-disabled={atStart || undefined}
        aria-label={`Move ${itemName} ${prevLabel}, currently ${position} of ${total}`}
        title={`Move ${prevLabel}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!atStart) onPrev();
        }}
      >
        <ChevronUp size={13} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="reorder-btn"
        draggable={false}
        aria-disabled={atEnd || undefined}
        aria-label={`Move ${itemName} ${nextLabel}, currently ${position} of ${total}`}
        title={`Move ${nextLabel}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!atEnd) onNext();
        }}
      >
        <ChevronDown size={13} aria-hidden="true" />
      </button>
    </span>
  );
}
