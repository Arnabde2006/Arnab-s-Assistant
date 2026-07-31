import "dotenv/config";
import { getPool } from "../db.js";

async function seedBCA2A() {
  const pool = getPool();
  const usersRes = await pool.query("SELECT id FROM users");
  const userIds = usersRes.rows.map((r) => r.id);

  const bca2aSlots = [
    { subject: "PDB", startTime: "09:30", endTime: "10:20", color: "#3968db" },
    { subject: "PRC", startTime: "10:20", endTime: "11:10", color: "#4fa88a" },
    { subject: "BT", startTime: "11:10", endTime: "12:00", color: "#c1554a" },
    { subject: "RH", startTime: "12:00", endTime: "12:50", color: "#9b51e0" },
    { subject: "SS", startTime: "13:40", endTime: "14:30", color: "#f2994a" },
    { subject: "GG", startTime: "14:30", endTime: "15:20", color: "#2d9cdb" },
    { subject: "SHD", startTime: "15:20", endTime: "16:10", color: "#eb5757" },
  ];

  for (const userId of userIds) {
    for (const slot of bca2aSlots) {
      const subjRes = await pool.query(
        "SELECT id FROM subjects WHERE user_id = $1 AND name = $2",
        [userId, slot.subject]
      );
      let subjId;
      if (subjRes.rows.length === 0) {
        const created = await pool.query(
          "INSERT INTO subjects (user_id, name, color) VALUES ($1, $2, $3) RETURNING id",
          [userId, slot.subject, slot.color]
        );
        subjId = created.rows[0].id;
      } else {
        subjId = subjRes.rows[0].id;
      }

      for (let day = 1; day <= 5; day++) {
        const existingSlot = await pool.query(
          "SELECT id FROM timetable_slots WHERE user_id = $1 AND day_of_week = $2 AND start_time = $3 AND class_name = $4",
          [userId, day, slot.startTime, "BCA 2A"]
        );
        if (existingSlot.rows.length === 0) {
          await pool.query(
            "INSERT INTO timetable_slots (user_id, subject_id, day_of_week, start_time, end_time, class_name) VALUES ($1, $2, $3, $4, $5, $6)",
            [userId, subjId, day, slot.startTime, slot.endTime, "BCA 2A"]
          );
        }
      }
    }
  }

  const check = await pool.query("SELECT count(*) FROM timetable_slots WHERE class_name = $1", ["BCA 2A"]);
  console.log("Successfully seeded BCA 2A slots! Total count in DB:", check.rows[0].count);
  process.exit(0);
}

seedBCA2A().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
