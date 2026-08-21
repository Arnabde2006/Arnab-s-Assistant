import React, { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import MobileNav from "./components/MobileNav.jsx";
import MobileHeader from "./components/MobileHeader.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";
import { useMobileSwipeNavigation } from "./hooks/useMobileSwipeNavigation.js";

// Eager: tiny, unauthenticated entry points — loaded up front so the login
// screen paints instantly with no loading flash on first visit.
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

// Lazy: every other page (and its heavy children) is code-split into its own
// chunk, fetched on navigation instead of shipping in the initial bundle.
const ViewOnly = lazy(() => import("./pages/ViewOnly.jsx"));
const ViewOnlyEntry = lazy(() => import("./pages/ViewOnlyEntry.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Attendance = lazy(() => import("./pages/Attendance.jsx"));
const Todos = lazy(() => import("./pages/Todos.jsx"));
const Subscriptions = lazy(() => import("./pages/Subscriptions.jsx"));
const Nptel = lazy(() => import("./pages/Nptel.jsx"));
const Timetable = lazy(() => import("./pages/Timetable.jsx"));
const ExamTimetable = lazy(() => import("./pages/ExamTimetable.jsx"));
const Grades = lazy(() => import("./pages/Grades.jsx"));
const Finance = lazy(() => import("./pages/Finance.jsx"));
const Debts = lazy(() => import("./pages/Debts.jsx"));
const Pomodoro = lazy(() => import("./pages/Pomodoro.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));

function ProtectedShell({ children }) {
  const { user, loading } = useAuth();
  useMobileSwipeNavigation();

  if (loading) return <LoadingScreen message="Verifying session..." />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <Sidebar />
      <MobileHeader />
      <div className="main-content">
        <Suspense fallback={<LoadingScreen message="Loading..." />}>{children}</Suspense>
      </div>
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
      "/subscriptions": "Subscriptions",
      "/nptel": "NPTEL Courses",
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
    <Suspense fallback={<LoadingScreen message="Loading..." />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/view" element={<ViewOnlyEntry />} />
        <Route path="/view/:token" element={<ViewOnly />} />
        <Route path="/" element={<ProtectedShell><Dashboard /></ProtectedShell>} />
        <Route path="/attendance" element={<ProtectedShell><Attendance /></ProtectedShell>} />
        <Route path="/todos" element={<ProtectedShell><Todos /></ProtectedShell>} />
        <Route path="/subscriptions" element={<ProtectedShell><Subscriptions /></ProtectedShell>} />
        <Route path="/nptel" element={<ProtectedShell><Nptel /></ProtectedShell>} />
        <Route path="/timetable" element={<ProtectedShell><Timetable /></ProtectedShell>} />
        <Route path="/exams" element={<ProtectedShell><ExamTimetable /></ProtectedShell>} />
        <Route path="/grades" element={<ProtectedShell><Grades /></ProtectedShell>} />
        <Route path="/finance" element={<ProtectedShell><Finance /></ProtectedShell>} />
        <Route path="/debts" element={<ProtectedShell><Debts /></ProtectedShell>} />
        <Route path="/pomodoro" element={<ProtectedShell><Pomodoro /></ProtectedShell>} />
        <Route path="/profile" element={<ProtectedShell><Profile /></ProtectedShell>} />
      </Routes>
    </Suspense>
  );
}
