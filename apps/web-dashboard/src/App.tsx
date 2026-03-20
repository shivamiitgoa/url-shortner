import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, loginWithGoogle, logout } from "./firebase";
import { createUrl, deleteUrl, fetchAnalytics, listUrls, updateUrl } from "./api";
import { AnalyticsResponse, UrlItem } from "./types";
import "./style.css";

function toDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default function App(): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>("");
  const [items, setItems] = useState<UrlItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [longUrl, setLongUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [analyticsCode, setAnalyticsCode] = useState("");
  const [analyticsFrom, setAnalyticsFrom] = useState(toDateInput(new Date(Date.now() - 30 * 86400000)));
  const [analyticsTo, setAnalyticsTo] = useState(toDateInput(new Date()));

  useEffect(() => {
    return onAuthStateChanged(auth, async (current) => {
      setUser(current);
      if (current) {
        const nextToken = await current.getIdToken();
        setToken(nextToken);
      } else {
        setToken("");
        setItems([]);
      }
    });
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    setLoading(true);
    listUrls(token)
      .then(setItems)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [token]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [items]
  );

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!token) {
      return;
    }

    setError("");
    try {
      const created = await createUrl(token, {
        longUrl,
        customAlias: customAlias || undefined,
        expiresAt: expiresAt ? new Date(`${expiresAt}T00:00:00.000Z`).toISOString() : null,
        redirectType: 302
      });
      setItems((prev) => [created, ...prev]);
      setLongUrl("");
      setCustomAlias("");
      setExpiresAt("");
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleToggle(item: UrlItem): Promise<void> {
    if (!token) {
      return;
    }

    const nextStatus = item.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      const updated = await updateUrl(token, item.code, { status: nextStatus });
      setItems((prev) => prev.map((candidate) => (candidate.code === updated.code ? updated : candidate)));
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDelete(code: string): Promise<void> {
    if (!token) {
      return;
    }

    try {
      await deleteUrl(token, code);
      setItems((prev) => prev.filter((item) => item.code !== code));
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleAnalytics(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!token || !analyticsCode) {
      return;
    }

    try {
      const result = await fetchAnalytics(token, analyticsCode, analyticsFrom, analyticsTo);
      setAnalytics(result);
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1>URL Shortner Dashboard</h1>
        {!user ? (
          <button onClick={() => loginWithGoogle()}>Sign in with Google</button>
        ) : (
          <div className="user-actions">
            <span>{user.email}</span>
            <button onClick={() => logout()}>Sign out</button>
          </div>
        )}
      </header>

      {error ? <p className="error">{error}</p> : null}

      {user ? (
        <>
          <section className="card">
            <h2>Create Short URL</h2>
            <form className="form" onSubmit={handleCreate}>
              <input
                required
                type="url"
                placeholder="https://example.com/page"
                value={longUrl}
                onChange={(event) => setLongUrl(event.target.value)}
              />
              <input
                type="text"
                placeholder="custom-alias (optional)"
                value={customAlias}
                onChange={(event) => setCustomAlias(event.target.value)}
              />
              <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
              <button type="submit">Create</button>
            </form>
          </section>

          <section className="card">
            <h2>Your URLs</h2>
            {loading ? <p>Loading...</p> : null}
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => (
                  <tr key={item.code}>
                    <td>{item.code}</td>
                    <td>
                      <a href={item.longUrl} target="_blank" rel="noreferrer">
                        {item.longUrl}
                      </a>
                    </td>
                    <td>{item.status}</td>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                    <td>
                      <button onClick={() => handleToggle(item)}>
                        {item.status === "ACTIVE" ? "Disable" : "Enable"}
                      </button>
                      <button onClick={() => handleDelete(item.code)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2>Analytics</h2>
            <form className="form analytics" onSubmit={handleAnalytics}>
              <input
                required
                type="text"
                placeholder="short code"
                value={analyticsCode}
                onChange={(event) => setAnalyticsCode(event.target.value)}
              />
              <input type="date" value={analyticsFrom} onChange={(event) => setAnalyticsFrom(event.target.value)} />
              <input type="date" value={analyticsTo} onChange={(event) => setAnalyticsTo(event.target.value)} />
              <button type="submit">Fetch</button>
            </form>

            {analytics ? (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.items.map((point) => (
                    <tr key={point.date}>
                      <td>{point.date}</td>
                      <td>{point.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        </>
      ) : (
        <section className="card">
          <p>Sign in to create and manage short links.</p>
        </section>
      )}
    </div>
  );
}
