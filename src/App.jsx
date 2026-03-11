import React, { useMemo, useState } from "react";
import "./App.css";
import { API_HOST, loginFromBrowser, loginFromTelegram, logoutAdmin } from "./api";
import AdminDashboard from "./components/AdminDashboard";
import { getTelegramUser } from "./telegramWebApp";

const STORAGE_KEY = "coinflip_admin_session";

function App() {
  const telegramUser = useMemo(() => getTelegramUser(), []);
  const isTelegramMode = Boolean(telegramUser?.id);

  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [telegramId, setTelegramId] = useState(() => (isTelegramMode ? String(telegramUser.id) : ""));
  const [login, setLogin] = useState("admin");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const onLogin = async () => {
    if (!API_HOST) {
      setError("Missing REACT_APP_SERVER_HOST.");
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const response = isTelegramMode
        ? await loginFromTelegram(password)
        : await loginFromBrowser({ telegramId, login, password });

      if (!response?.sessionToken) {
        setError("Login failed. Check credentials and admin rights.");
        return;
      }

      localStorage.setItem(STORAGE_KEY, response.sessionToken);
      setSessionToken(response.sessionToken);
      setPassword("");
    } finally {
      setIsLoading(false);
    }
  };

  const onLogout = async () => {
    await logoutAdmin(sessionToken);
    localStorage.removeItem(STORAGE_KEY);
    setSessionToken("");
  };

  return (
    <div className="app">
      <div className="headerRow">
        <h1 style={{ margin: 0 }}>CoinFlip Admin</h1>
        {sessionToken && (
          <button className="button" onClick={onLogout}>
            Logout
          </button>
        )}
      </div>

      {!sessionToken ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{isTelegramMode ? "Telegram Admin Login" : "Browser Admin Login"}</h3>

          {isTelegramMode ? (
            <div className="field">
              <label>Telegram ID</label>
              <input value={String(telegramUser.id)} readOnly />
            </div>
          ) : (
            <>
              <div className="field">
                <label>Telegram ID</label>
                <input
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="321082727"
                />
              </div>
              <div className="field">
                <label>Login</label>
                <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="admin" />
              </div>
            </>
          )}

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="WALLET_ADMIN_PASSWORD"
            />
          </div>

          {error && <div className="loginError">{error}</div>}

          <button className="button" onClick={onLogin} disabled={isLoading || !password.trim()}>
            {isLoading ? "Checking..." : "Login"}
          </button>
        </div>
      ) : (
        <AdminDashboard sessionToken={sessionToken} />
      )}
    </div>
  );
}

export default App;
