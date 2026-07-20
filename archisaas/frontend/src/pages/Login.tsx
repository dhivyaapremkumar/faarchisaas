import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Email or password is incorrect.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: blueprint grid panel, signature element */}
      <div className="hidden lg:flex lg:w-1/2 bg-blueprint relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-blueprint-grid bg-grid opacity-40" />
        <div className="relative z-10 max-w-md px-12 text-paper-light">
          <p className="font-mono text-xs tracking-widest text-amber uppercase mb-4">DWG · A-000 · Site Overview</p>
          <h1 className="font-display text-4xl font-semibold leading-tight mb-4">
            Every drawing, every task,<br />one project record.
          </h1>
          <p className="text-paper/70 font-body text-sm leading-relaxed">
            Track revisions, assign work from site meetings automatically, and keep
            architects, vendors, and clients working from the same source of truth.
          </p>
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex-1 flex items-center justify-center bg-paper-light px-8">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <p className="font-mono text-xs tracking-widest text-line uppercase mb-2">Sign in</p>
          <h2 className="font-display text-2xl font-semibold text-ink mb-8">Welcome back</h2>

          <label className="block text-sm font-medium text-ink mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mb-4 px-3.5 py-2.5 rounded-md border border-line/30 bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent"
            placeholder="you@yourfirm.com"
          />

          <label className="block text-sm font-medium text-ink mb-1.5">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-2 px-3.5 py-2.5 rounded-md border border-line/30 bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent"
            placeholder="••••••••"
          />

          {error && <p className="text-site-rust text-sm mt-2">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-blueprint hover:bg-blueprint-light text-white font-medium text-sm py-2.5 rounded-md transition-colors disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
