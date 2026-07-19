import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
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
        <input id="password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={{ marginBottom: 8 }} />
        {error && <div className="error-text">{error}</div>}
        <button className="btn" type="submit" disabled={loading} style={{ width: "100%", marginTop: 16 }}>
          {loading ? "Creating account…" : "Create account"}
        </button>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 16, textAlign: "center" }}>
          Already have an account? <Link to="/login" style={{ color: "var(--accent)" }}>Log in</Link>
        </p>
      </form>
    </div>
  );
}
