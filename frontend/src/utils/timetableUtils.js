/**
 * Helper utilities for timetable slot manipulation, grouping, and merged slot handling.
 */

/**
 * Checks if a given slot represents a BREAK or lunch period.
 * @param {Object} slot 
 * @returns {boolean}
 */
export function isBreakSlot(slot) {
  if (!slot) return false;
  const name = (slot.subject?.name || slot.subjectName || "").trim();
  if (!name) return false;

  return (
    /^(break|lunch|recess|tea\s*break|lunch\s*break|interval)$/i.test(name) ||
    /\b(break|lunch|recess|interval)\b/i.test(name)
  );
}

/**
 * Determines whether two adjacent slots can be merged into a single logical block.
 * @param {Object} s1 Previous slot
 * @param {Object} s2 Current slot
 * @returns {boolean}
 */
export function slotsCanMerge(s1, s2) {
  if (!s1 || !s2) return false;

  // 1. Must be adjacent in time (no gap)
  const end1 = (s1.endTime || "").trim();
  const start2 = (s2.startTime || "").trim();
  if (!end1 || !start2 || end1 !== start2) {
    return false;
  }

  // 2. Day must match
  if (s1.dayOfWeek !== s2.dayOfWeek) {
    return false;
  }

  // 3. Class / section must match
  const class1 = (s1.className || "").trim().toLowerCase();
  const class2 = (s2.className || "").trim().toLowerCase();
  if (class1 !== class2) {
    return false;
  }

  // 4. Do NOT merge across BREAK or lunch periods
  if (isBreakSlot(s1) || isBreakSlot(s2)) {
    return false;
  }

  // 5. Subject name must match
  const name1 = (s1.subject?.name || s1.subjectName || "").trim().toLowerCase();
  const name2 = (s2.subject?.name || s2.subjectName || "").trim().toLowerCase();
  if (!name1 || !name2 || name1 !== name2) {
    return false;
  }

  // If both have subject IDs, they must match
  const subId1 = s1.subject?._id || s1.subjectId;
  const subId2 = s2.subject?._id || s2.subjectId;
  if (subId1 && subId2 && subId1 !== subId2) {
    return false;
  }

  // 6. Room / Lab location must match
  const room1 = (s1.room || "").trim().toLowerCase();
  const room2 = (s2.room || "").trim().toLowerCase();
  if (room1 !== room2) {
    return false;
  }

  // 7. Instructor must match (if present)
  const inst1 = (s1.instructor || s1.subject?.instructor || "").trim().toLowerCase();
  const inst2 = (s2.instructor || s2.subject?.instructor || "").trim().toLowerCase();
  if (inst1 !== inst2) {
    return false;
  }

  return true;
}

/**
 * Groups consecutive identical periods in a list of slots into merged blocks.
 * @param {Array} slots List of slot objects
 * @returns {Array} List of merged slot objects
 */
export function groupConsecutiveSlots(slots) {
  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return [];
  }

  // Sort slots by startTime
  const sorted = [...slots].sort((a, b) =>
    (a.startTime || "").localeCompare(b.startTime || "")
  );

  const merged = [];
  let currentGroup = [];

  for (const slot of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(slot);
    } else {
      const prevSlot = currentGroup[currentGroup.length - 1];
      if (slotsCanMerge(prevSlot, slot)) {
        currentGroup.push(slot);
      } else {
        merged.push(createMergedSlotBlock(currentGroup));
        currentGroup = [slot];
      }
    }
  }

  if (currentGroup.length > 0) {
    merged.push(createMergedSlotBlock(currentGroup));
  }

  return merged;
}

/**
 * Combines an array of consecutive slot objects into a single merged slot descriptor.
 * @param {Array} group Array of 1 or more consecutive slot objects
 * @returns {Object}
 */

function createMergedSlotBlock(group) {
  const first = group[0];
  const last = group[group.length - 1];
  const isMerged = group.length > 1;

  return {
    ...first,
    _id: first._id,
    startTime: first.startTime,
    endTime: last.endTime,
    isMerged,
    spanCount: group.length,
    originalSlots: group,
    originalIds: group.map((s) => s._id),
  };
}
