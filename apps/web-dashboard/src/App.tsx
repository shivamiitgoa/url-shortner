import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, loginWithGoogle, logout } from "./firebase";
import { createUrl, deleteUrl, fetchAnalytics, listUrls, updateUrl } from "./api";
import { AnalyticsResponse, UrlItem } from "./types";
import "./style.css";

function toDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function normalizeBaseUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

export default function App(): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>("");
  const [items, setItems] = useState<UrlItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const [longUrl, setLongUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [analyticsCode, setAnalyticsCode] = useState("");
  const [analyticsFrom, setAnalyticsFrom] = useState(toDateInput(new Date(Date.now() - 30 * 86400000)));
  const [analyticsTo, setAnalyticsTo] = useState(toDateInput(new Date()));
  const [guideCode, setGuideCode] = useState("");

  const configuredRedirectBaseUrl = useMemo(
    () => normalizeBaseUrl(import.meta.env.VITE_REDIRECT_BASE_URL),
    []
  );

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

  const redirectBaseUrl = useMemo(() => {
    if (configuredRedirectBaseUrl) {
      return configuredRedirectBaseUrl;
    }

    const firstShortUrl = items.find((item) => item.shortUrl)?.shortUrl;
    if (!firstShortUrl) {
      return "";
    }

    try {
      return normalizeBaseUrl(new URL(firstShortUrl).origin);
    } catch {
      return "";
    }
  }, [configuredRedirectBaseUrl, items]);

  function getShortUrl(item: UrlItem): string | null {
    if (item.shortUrl) {
      return item.shortUrl;
    }
    if (redirectBaseUrl) {
      return `${redirectBaseUrl}/${item.code}`;
    }
    return null;
  }

  function openShortUrl(shortUrl: string): void {
    window.open(shortUrl, "_blank", "noopener,noreferrer");
  }

  async function copyShortUrl(shortUrl: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setSuccess("Short URL copied to clipboard.");
      setError("");
    } catch (err) {
      setError(`Copy failed: ${String(err)}`);
    }
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!token) {
      return;
    }

    setError("");
    setSuccess("");
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
      setGuideCode(created.code);
      const shortUrl = getShortUrl(created);
      setSuccess(shortUrl ? `Short URL created: ${shortUrl}` : `Short code created: ${created.code}`);
      setError("");
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
      setSuccess(`Updated ${updated.code} to ${updated.status}.`);
      setError("");
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
      setSuccess(`Deleted ${code}.`);
      setError("");
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
      setSuccess(`Fetched analytics for ${analyticsCode}.`);
      setError("");
    } catch (err) {
      setError(String(err));
    }
  }

  const exampleRedirectUrl = redirectBaseUrl
    ? `${redirectBaseUrl}/${guideCode || sortedItems[0]?.code || "yourCode"}`
    : "";

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
      {success ? <p className="success">{success}</p> : null}

      <section className="card guide-card">
        <h2>How To Use This Dashboard</h2>
        <div className="guide-grid">
          <article>
            <h3>1. Create</h3>
            <p>Paste your long URL and click Create. Optional: add a custom alias and expiry date.</p>
          </article>
          <article>
            <h3>2. Open Short URL</h3>
            <p>Use the full short URL shown in the table (Copy/Open buttons are next to each link).</p>
          </article>
          <article>
            <h3>3. Track & Manage</h3>
            <p>Use Analytics for click counts and Disable/Delete to control link availability.</p>
          </article>
        </div>
        <p className="guide-note">
          Important: short links are served by the redirect service domain, not by the dashboard domain.
        </p>
        {exampleRedirectUrl ? (
          <p className="guide-example">
            Example redirect URL:{" "}
            <a href={exampleRedirectUrl} target="_blank" rel="noreferrer">
              {exampleRedirectUrl}
            </a>
          </p>
        ) : (
          <p className="guide-example">The redirect base URL will appear after your first link is loaded.</p>
        )}
      </section>

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
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Short URL</th>
                    <th>Destination</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.length > 0 ? (
                    sortedItems.map((item) => {
                      const shortUrl = getShortUrl(item);
                      return (
                        <tr key={item.code}>
                          <td className="code-cell">{item.code}</td>
                          <td className="short-url-cell">
                            {shortUrl ? (
                              <>
                                <a href={shortUrl} target="_blank" rel="noreferrer">
                                  {shortUrl}
                                </a>
                                <div className="row-actions">
                                  <button type="button" className="secondary" onClick={() => openShortUrl(shortUrl)}>
                                    Open
                                  </button>
                                  <button type="button" className="secondary" onClick={() => copyShortUrl(shortUrl)}>
                                    Copy
                                  </button>
                                </div>
                              </>
                            ) : (
                              <span className="muted">Unavailable until redirect base URL is configured.</span>
                            )}
                          </td>
                          <td className="destination-cell">
                            <a href={item.longUrl} target="_blank" rel="noreferrer">
                              {item.longUrl}
                            </a>
                          </td>
                          <td>{item.status}</td>
                          <td>{new Date(item.createdAt).toLocaleString()}</td>
                          <td>
                            <button type="button" onClick={() => handleToggle(item)}>
                              {item.status === "ACTIVE" ? "Disable" : "Enable"}
                            </button>
                            <button type="button" onClick={() => handleDelete(item.code)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty-row">
                        No links yet. Create your first short URL above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
              <div className="table-wrap">
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
              </div>
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
