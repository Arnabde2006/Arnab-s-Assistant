import React, { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import MobileNav from "./components/MobileNav.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ViewOnly from "./pages/ViewOnly.jsx";
import ViewOnlyEntry from "./pages/ViewOnlyEntry.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Attendance from "./pages/Attendance.jsx";
import Todos from "./pages/Todos.jsx";
import Timetable from "./pages/Timetable.jsx";
import ExamTimetable from "./pages/ExamTimetable.jsx";
import Grades from "./pages/Grades.jsx";
import Pomodoro from "./pages/Pomodoro.jsx";

function ProtectedShell({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">{children}</div>
      <MobileNav />
    </div>
  );
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const titleMap = {
      "/": "Dashboard",
      "/attendance": "Attendance",
      "/todos": "To-do & Calendar",
      "/timetable": "Timetable",
      "/exams": "Exam Timetable",
      "/grades": "Grades",
      "/finance": "Finance",
      "/debts": "Debts",
      "/pomodoro": "Focus Timer",
      "/profile": "Profile",
      "/login": "Log in",
      "/register": "Register",
      "/view": "View Only Access",
    };

    if (path.startsWith("/view/")) {
      document.title = "View Dashboard - Assistant";
      return;
    }

    const pageTitle = titleMap[path] || "Assistant";
    document.title = `${pageTitle} - Assistant`;
  }, [location]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/view" element={<ViewOnlyEntry />} />
      <Route path="/view/:token" element={<ViewOnly />} />
      <Route path="/" element={<ProtectedShell><Dashboard /></ProtectedShell>} />
      <Route path="/attendance" element={<ProtectedShell><Attendance /></ProtectedShell>} />
      <Route path="/todos" element={<ProtectedShell><Todos /></ProtectedShell>} />
      <Route path="/timetable" element={<ProtectedShell><Timetable /></ProtectedShell>} />
      <Route path="/exams" element={<ProtectedShell><ExamTimetable /></ProtectedShell>} />
      <Route path="/grades" element={<ProtectedShell><Grades /></ProtectedShell>} />
      <Route path="/pomodoro" element={<ProtectedShell><Pomodoro /></ProtectedShell>} />
    </Routes>
  );
}
