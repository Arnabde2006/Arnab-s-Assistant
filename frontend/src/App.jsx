import React, { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import MobileNav from "./components/MobileNav.jsx";
import MobileHeader from "./components/MobileHeader.jsx";
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
import Finance from "./pages/Finance.jsx";
import Debts from "./pages/Debts.jsx";
import Pomodoro from "./pages/Pomodoro.jsx";
import Profile from "./pages/Profile.jsx";

import LoadingScreen from "./components/LoadingScreen.jsx";
import { useMobileSwipeNavigation } from "./hooks/useMobileSwipeNavigation.js";

function ProtectedShell({ children }) {
  const { user, loading } = useAuth();
  useMobileSwipeNavigation();

  if (loading) return <LoadingScreen message="Verifying session..." />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <Sidebar />
      <MobileHeader />
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
      <Route path="/finance" element={<ProtectedShell><Finance /></ProtectedShell>} />
      <Route path="/debts" element={<ProtectedShell><Debts /></ProtectedShell>} />
      <Route path="/pomodoro" element={<ProtectedShell><Pomodoro /></ProtectedShell>} />
      <Route path="/profile" element={<ProtectedShell><Profile /></ProtectedShell>} />
    </Routes>
  );
}
