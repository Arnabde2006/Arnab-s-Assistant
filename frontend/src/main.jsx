import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { AnnouncerProvider } from "./context/AnnouncerContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        {/* AnnouncerProvider is outermost of the two surfaces so anything below it,
            including auth, can announce. Its live region must stay mounted for the
            app's lifetime — see the note in AnnouncerContext. */}
        <AnnouncerProvider>
          {/* ToastProvider sits above AuthProvider: session-expiry notices are
              raised from inside auth handling, so the surface must already exist. */}
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </AnnouncerProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
