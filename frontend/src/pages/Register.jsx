import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Eye, EyeOff, Check, X } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const hasMinLength = password.length >= 6;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9]/.test(password) || /[^a-zA-Z0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasLetter && hasNumberOrSymbol;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isPasswordValid) {
      setError("Please fulfill all password requirements before submitting.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">Create your account</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
          Track attendance, tasks and classes in one place.
        </p>
        <label className="label" htmlFor="name">Name</label>
        <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required style={{ marginBottom: 16 }} />
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ marginBottom: 16 }} />
        <label className="label" htmlFor="password">Password</label>
        <div className="password-input-wrap">
          <input
            id="password"
            className="input"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ paddingRight: 40 }}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
            title={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Live Password Requirements Checklist */}
        <div className="password-requirements">
          <div className={`req-item ${hasMinLength ? "valid" : "invalid"}`}>
            <span className="req-icon">
              {hasMinLength ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
            </span>
            <span>At least 6 characters</span>
          </div>
          <div className={`req-item ${hasLetter ? "valid" : "invalid"}`}>
            <span className="req-icon">
              {hasLetter ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
            </span>
            <span>Contains letters (A-Z, a-z)</span>
          </div>
          <div className={`req-item ${hasNumberOrSymbol ? "valid" : "invalid"}`}>
            <span className="req-icon">
              {hasNumberOrSymbol ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
            </span>
            <span>Contains numbers (0-9) or symbols (!@#$)</span>
          </div>
        </div>

        {error && <div className="error-text">{error}</div>}
        <button className="btn" type="submit" disabled={loading} style={{ width: "100%", marginTop: 12 }}>
          {loading ? "Creating account…" : "Create account"}
        </button>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 16, textAlign: "center" }}>
          Already have an account? <Link to="/login" style={{ color: "var(--accent)" }}>Log in</Link>
        </p>
      </form>
    </div>
  );
}
