"use client";
import { useState } from "react";

export default function WaitlistForm({ id = "wl" }) {
  const [email, setEmail] = useState(""), [state, setState] = useState({ busy: false, ok: false, error: null });
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, ok: false, error: null });
    try {
      const r = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setState({ busy: false, ok: true, error: null });
    } catch (err) { setState({ busy: false, ok: false, error: err.message || "Couldn't save your email. Try again." }); }
  };
  if (state.ok) return <p className="lp-ok" role="status">You&apos;re on the list. We&apos;ll email you when accounts open.</p>;
  return (
    <form className="lp-form" onSubmit={submit}>
      <label htmlFor={id} className="sr-only">Email address</label>
      <input id={id} type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <button className="btn primary" disabled={state.busy}>{state.busy ? "Joining…" : "Join the waitlist"}</button>
      {state.error && <p className="err" role="alert">{state.error}</p>}
    </form>
  );
}
