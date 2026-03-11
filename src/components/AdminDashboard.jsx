import React, { useEffect, useMemo, useState } from "react";
import moment from "moment";
import {
  fetchAdminWalletBalanceSnapshot,
  fetchUnrecognizedWebhookEvents,
  fetchGamesHistory,
  fetchShopStats,
  fetchUsersScoreRating,
  fetchWalletSupportRequestsHistory,
  fetchWalletTransactionsHistory,
  linkWebhookEventToTransaction,
  requestWebhookResend,
  reprocessPendingDeposits,
  updateWalletSupportRequestStatus,
  updateWalletTransactionStatus,
} from "../api";

const Tabs = {
  walletIssues: "Wallet Issues",
  transactions: "Transactions",
  webhookInbox: "Webhook Inbox",
  games: "Games",
  users: "Users",
  shop: "Shop",
};

const allTabs = Object.values(Tabs);

const toDateTimeLocalValue = (date) => {
  const pad = (v) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toApiDateTime = (value) => (value ? `${value}:00` : "");

const usdtFromMicros = (micros) => (Number(micros || 0) / 1_000_000).toFixed(6);
const flipkyFromCents = (cents) => (Number(cents || 0) / 100).toFixed(2);
const formatAdminDateTime = (value) => {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  if (Array.isArray(value)) {
    const [year, month = 1, day = 1, hour = 0, minute = 0, second = 0, nanos = 0] = value.map((v) => Number(v));
    const parsed = moment({
      year,
      month: Math.max(1, month) - 1,
      day,
      hour,
      minute,
      second,
      millisecond: Math.floor((Number.isFinite(nanos) ? nanos : 0) / 1_000_000),
    });
    return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm") : String(value);
  }

  if (typeof value === "number") {
    const parsed = moment(value);
    return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm") : String(value);
  }

  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) {
      return "-";
    }

    const isoParsed = moment(raw, moment.ISO_8601, true);
    if (isoParsed.isValid()) {
      return isoParsed.format("YYYY-MM-DD HH:mm");
    }

    // Supports compact payloads like 20263101845865000000 from legacy date serialization.
    const compactMatch = raw.match(/^(\d{4})(\d{1,2})(\d{1,2})(\d{1,2})(\d{2})(?:([0-5]?\d))?(?:\d{1,9})?$/);
    if (compactMatch) {
      const [, y, m, d, h, min, sec] = compactMatch;
      const compactParsed = moment({
        year: Number(y),
        month: Number(m) - 1,
        day: Number(d),
        hour: Number(h),
        minute: Number(min),
        second: Number(sec || 0),
      });
      if (compactParsed.isValid()) {
        return compactParsed.format("YYYY-MM-DD HH:mm");
      }
    }

    return raw;
  }

  return String(value);
};

const AdminDashboard = ({ sessionToken }) => {
  const now = useMemo(() => new Date(), []);
  const dayAgo = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000), []);

  const [activeTab, setActiveTab] = useState(Tabs.walletIssues);
  const [from, setFrom] = useState(toDateTimeLocalValue(dayAgo));
  const [to, setTo] = useState(toDateTimeLocalValue(now));
  const [loading, setLoading] = useState(false);

  const [walletIssues, setWalletIssues] = useState([]);
  const [walletIssueFilters, setWalletIssueFilters] = useState({
    telegramId: "",
    username: "",
    requestType: "",
    status: "",
  });

  const [transactions, setTransactions] = useState([]);
  const [reprocessLimit, setReprocessLimit] = useState("200");
  const [reprocessNote, setReprocessNote] = useState("Admin reprocess pending deposits");
  const [reprocessResult, setReprocessResult] = useState(null);
  const [transactionFilters, setTransactionFilters] = useState({
    telegramId: "",
    username: "",
    type: "",
    status: "",
    minFlipkyCents: "",
    maxFlipkyCents: "",
  });

  const [games, setGames] = useState([]);
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [webhookLimit, setWebhookLimit] = useState("200");
  const [linkTxByEvent, setLinkTxByEvent] = useState({});
  const [linkNote, setLinkNote] = useState("Linked by admin from unrecognized inbox");
  const [gameFilters, setGameFilters] = useState({
    telegramId: "",
    username: "",
    minBet: "",
    maxBet: "",
    enhanced: "",
    initiatorChoice: "",
    outcome: "",
  });

  const [users, setUsers] = useState([]);
  const [walletBalanceSnapshot, setWalletBalanceSnapshot] = useState(null);
  const [userFilters, setUserFilters] = useState({
    telegramId: "",
    username: "",
  });
  const [shopStats, setShopStats] = useState({ buffs: [], users: [] });
  const [shopFilters, setShopFilters] = useState({
    telegramId: "",
    username: "",
  });

  const baseDateFilters = {
    from: toApiDateTime(from),
    to: toApiDateTime(to),
  };

  const loadWalletIssues = async () => {
    setLoading(true);
    try {
      const data = await fetchWalletSupportRequestsHistory(sessionToken, {
        ...baseDateFilters,
        ...walletIssueFilters,
      });
      setWalletIssues(data || []);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await fetchWalletTransactionsHistory(sessionToken, {
        ...baseDateFilters,
        ...transactionFilters,
      });
      setTransactions(data || []);
    } finally {
      setLoading(false);
    }
  };

  const loadGames = async () => {
    setLoading(true);
    try {
      const data = await fetchGamesHistory(sessionToken, {
        ...baseDateFilters,
        ...gameFilters,
      });
      setGames(data || []);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const [usersData, walletBalanceData] = await Promise.all([
        fetchUsersScoreRating(sessionToken, {
          ...userFilters,
        }),
        fetchAdminWalletBalanceSnapshot(sessionToken),
      ]);
      setUsers(usersData || []);
      setWalletBalanceSnapshot(walletBalanceData || null);
    } finally {
      setLoading(false);
    }
  };

  const loadWebhookEvents = async () => {
    setLoading(true);
    try {
      const data = await fetchUnrecognizedWebhookEvents(sessionToken, {
        limit: Number(webhookLimit || 0) || 200,
      });
      setWebhookEvents(data || []);
    } finally {
      setLoading(false);
    }
  };

  const loadShopStats = async () => {
    setLoading(true);
    try {
      const data = await fetchShopStats(sessionToken, {
        ...shopFilters,
      });
      setShopStats(data || { buffs: [], users: [] });
    } finally {
      setLoading(false);
    }
  };

  const updateIssueStatus = async (requestId, status) => {
    setLoading(true);
    try {
      const updated = await updateWalletSupportRequestStatus(sessionToken, requestId, status);
      if (!updated) {
        alert("Failed to update support request status.");
        return;
      }
      await loadWalletIssues();
    } finally {
      setLoading(false);
    }
  };

  const updateTxStatus = async (txId, status) => {
    setLoading(true);
    try {
      const updated = await updateWalletTransactionStatus(sessionToken, txId, status);
      if (!updated) {
        alert("Failed to update transaction status.");
        return;
      }
      await loadTransactions();
    } finally {
      setLoading(false);
    }
  };

  const triggerWebhookResend = async (txId) => {
    setLoading(true);
    try {
      const result = await requestWebhookResend(sessionToken, txId);
      if (!result) {
        alert("Failed to request webhook resend.");
        return;
      }
      alert(result.message || "Webhook resend requested.");
    } finally {
      setLoading(false);
    }
  };

  const runReprocessPending = async () => {
    setLoading(true);
    setReprocessResult(null);
    try {
      const result = await reprocessPendingDeposits(sessionToken, {
        limit: Number(reprocessLimit || 0) || undefined,
        note: reprocessNote?.trim() || undefined,
      });
      if (!result) {
        alert("Failed to reprocess pending deposits.");
        return;
      }
      setReprocessResult(result);
      await loadTransactions();
    } finally {
      setLoading(false);
    }
  };

  const linkWebhookEvent = async (eventId) => {
    const txId = (linkTxByEvent[eventId] || "").trim();
    if (!txId) {
      alert("Enter target transaction id.");
      return;
    }
    setLoading(true);
    try {
      const linked = await linkWebhookEventToTransaction(sessionToken, eventId, txId, linkNote);
      if (!linked) {
        alert("Failed to link webhook event.");
        return;
      }
      await loadWebhookEvents();
      await loadTransactions();
    } finally {
      setLoading(false);
    }
  };

  const usersSummary = useMemo(
    () =>
      users.reduce(
        (acc, item) => {
          acc.balanceCents += Number(item.score?.flipkyBalance || 0);
          acc.withdrawCents += Number(item.withdrawFlipkyCents || 0);
          acc.depositCents += Number(item.depositFlipkyCents || 0);
          acc.purchasedCents += Number(item.purchasedFlipkyCents || 0);
          acc.wins += Number(item.score?.wins || 0);
          acc.losses += Number(item.score?.losses || 0);
          acc.played += Number(item.score?.playedGames || 0);
          return acc;
        },
        {
          balanceCents: 0,
          withdrawCents: 0,
          depositCents: 0,
          purchasedCents: 0,
          wins: 0,
          losses: 0,
          played: 0,
        },
      ),
    [users],
  );

  const cryptoWalletHeaderText = useMemo(() => {
    if (!walletBalanceSnapshot) {
      return "Crypto wallet: loading...";
    }
    if (!walletBalanceSnapshot.cryptoWalletBalanceAvailable) {
      return "Crypto wallet: unavailable";
    }
    return `Crypto wallet: ${usdtFromMicros(walletBalanceSnapshot.cryptoWalletUsdtMicros)} USDT`;
  }, [walletBalanceSnapshot]);

  const shopSummaryByBuff = useMemo(() => {
    const totals = {};
    (shopStats.buffs || []).forEach((buff) => {
      totals[buff.id] = {
        boughtPieces: 0,
        boughtFlipkyCents: 0,
        playedPieces: 0,
        playedFlipkyCents: 0,
        inGamePieces: 0,
        inGameFlipkyCents: 0,
      };
    });

    (shopStats.users || []).forEach((item) => {
      (shopStats.buffs || []).forEach((buff) => {
        const stats = item.buffStats?.[buff.id] || {};
        const total = totals[buff.id];
        if (!total) return;
        total.boughtPieces += Number(stats.boughtPieces || 0);
        total.boughtFlipkyCents += Number(stats.boughtFlipkyCents || 0);
        total.playedPieces += Number(stats.playedPieces || 0);
        total.playedFlipkyCents += Number(stats.playedFlipkyCents || 0);
        total.inGamePieces += Number(stats.inGamePieces || 0);
        total.inGameFlipkyCents += Number(stats.inGameFlipkyCents || 0);
      });
    });

    return totals;
  }, [shopStats]);

  const renderWalletIssues = () => (
    <>
      <div className="filterGrid">
        <input
          placeholder="tg_id"
          value={walletIssueFilters.telegramId}
          onChange={(e) => setWalletIssueFilters((prev) => ({ ...prev, telegramId: e.target.value.replace(/[^0-9]/g, "") }))}
        />
        <input
          placeholder="username"
          value={walletIssueFilters.username}
          onChange={(e) => setWalletIssueFilters((prev) => ({ ...prev, username: e.target.value }))}
        />
        <select
          value={walletIssueFilters.requestType}
          onChange={(e) => setWalletIssueFilters((prev) => ({ ...prev, requestType: e.target.value }))}
        >
          <option value="">Request Type</option>
          <option value="DEPOSIT">DEPOSIT</option>
          <option value="WITHDRAWAL">WITHDRAWAL</option>
        </select>
        <select
          value={walletIssueFilters.status}
          onChange={(e) => setWalletIssueFilters((prev) => ({ ...prev, status: e.target.value }))}
        >
          <option value="">Status</option>
          <option value="OPEN">OPEN</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </div>
      <button className="button" disabled={loading} onClick={loadWalletIssues}>
        Load Wallet Issues
      </button>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th className="dateTimeCell">Created</th>
              <th>tg_id</th>
              <th>User</th>
              <th>Type</th>
              <th>Status</th>
              <th>Reason</th>
              <th>Message</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {walletIssues.map((item) => (
              <tr key={item.id}>
                <td className="dateTimeCell">{formatAdminDateTime(item.createdAt)}</td>
                <td>{item.telegramId || "-"}</td>
                <td>{item.username || "-"}</td>
                <td>{item.requestType || "-"}</td>
                <td>{item.status || "-"}</td>
                <td>{item.reasonCode || "-"}</td>
                <td>{item.message || "-"}</td>
                <td>
                  {item.status === "OPEN" && (
                    <div className="actions">
                      <button className="button" disabled={loading} onClick={() => updateIssueStatus(item.id, "RESOLVED")}>
                        Resolve
                      </button>
                      <button className="button danger" disabled={loading} onClick={() => updateIssueStatus(item.id, "REJECTED")}>
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderTransactions = () => (
    <>
      <div className="filterGrid">
        <input
          placeholder="tg_id"
          value={transactionFilters.telegramId}
          onChange={(e) => setTransactionFilters((prev) => ({ ...prev, telegramId: e.target.value.replace(/[^0-9]/g, "") }))}
        />
        <input
          placeholder="username"
          value={transactionFilters.username}
          onChange={(e) => setTransactionFilters((prev) => ({ ...prev, username: e.target.value }))}
        />
        <select value={transactionFilters.type} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, type: e.target.value }))}>
          <option value="">Mode</option>
          <option value="DEPOSIT">DEPOSIT</option>
          <option value="WITHDRAWAL">WITHDRAWAL</option>
        </select>
        <select value={transactionFilters.status} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, status: e.target.value }))}>
          <option value="">Status</option>
          <option value="PENDING">PENDING</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
        <input
          placeholder="Min amount (flipky cents)"
          value={transactionFilters.minFlipkyCents}
          onChange={(e) => setTransactionFilters((prev) => ({ ...prev, minFlipkyCents: e.target.value.replace(/[^0-9]/g, "") }))}
        />
        <input
          placeholder="Max amount (flipky cents)"
          value={transactionFilters.maxFlipkyCents}
          onChange={(e) => setTransactionFilters((prev) => ({ ...prev, maxFlipkyCents: e.target.value.replace(/[^0-9]/g, "") }))}
        />
      </div>
      <button className="button" disabled={loading} onClick={loadTransactions}>
        Load Transactions
      </button>
      <div className="filterGrid" style={{ marginTop: 10 }}>
        <input
          placeholder="Reprocess limit"
          value={reprocessLimit}
          onChange={(e) => setReprocessLimit(e.target.value.replace(/[^0-9]/g, ""))}
        />
        <input
          placeholder="Reprocess note"
          value={reprocessNote}
          onChange={(e) => setReprocessNote(e.target.value)}
        />
      </div>
      <button className="button" disabled={loading} onClick={runReprocessPending}>
        Reprocess Pending Deposits
      </button>
      {reprocessResult && (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          Reprocess result: attempted={reprocessResult.attempted}, completed={reprocessResult.completed}, failed={reprocessResult.failed}
        </div>
      )}
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th className="dateTimeCell">Created</th>
              <th>tg_id</th>
              <th>User</th>
              <th>Mode</th>
              <th>Status</th>
              <th>USDT</th>
              <th>Flipky</th>
              <th>TxHash</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => (
              <tr key={item.id}>
                <td className="dateTimeCell">{formatAdminDateTime(item.createdAt)}</td>
                <td>{item.telegramId || "-"}</td>
                <td>{item.username || "-"}</td>
                <td>{item.type || "-"}</td>
                <td>{item.status || "-"}</td>
                <td>{usdtFromMicros(item.usdtMicros)}</td>
                <td>{flipkyFromCents(item.flipkyCents)}</td>
                <td>{item.txHash || "-"}</td>
                <td>
                  {item.status === "PENDING" && (
                    <div className="actions">
                      {item.type === "DEPOSIT" && (
                        <button className="button ghost" disabled={loading} onClick={() => triggerWebhookResend(item.id)}>
                          Request Webhook Resend
                        </button>
                      )}
                      <button className="button" disabled={loading} onClick={() => updateTxStatus(item.id, "COMPLETED")}>
                        Complete
                      </button>
                      <button className="button danger" disabled={loading} onClick={() => updateTxStatus(item.id, "REJECTED")}>
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderGames = () => (
    <>
      <div className="filterGrid">
        <input
          placeholder="tg_id"
          value={gameFilters.telegramId}
          onChange={(e) => setGameFilters((prev) => ({ ...prev, telegramId: e.target.value.replace(/[^0-9]/g, "") }))}
        />
        <input
          placeholder="username"
          value={gameFilters.username}
          onChange={(e) => setGameFilters((prev) => ({ ...prev, username: e.target.value }))}
        />
        <input
          placeholder="Min bet (cents)"
          value={gameFilters.minBet}
          onChange={(e) => setGameFilters((prev) => ({ ...prev, minBet: e.target.value.replace(/[^0-9]/g, "") }))}
        />
        <input
          placeholder="Max bet (cents)"
          value={gameFilters.maxBet}
          onChange={(e) => setGameFilters((prev) => ({ ...prev, maxBet: e.target.value.replace(/[^0-9]/g, "") }))}
        />
        <select value={gameFilters.enhanced} onChange={(e) => setGameFilters((prev) => ({ ...prev, enhanced: e.target.value }))}>
          <option value="">Enhanced</option>
          <option value="true">YES</option>
          <option value="false">NO</option>
        </select>
        <select
          value={gameFilters.initiatorChoice}
          onChange={(e) => setGameFilters((prev) => ({ ...prev, initiatorChoice: e.target.value }))}
        >
          <option value="">Initiator Choice</option>
          <option value="HEADS">HEADS</option>
          <option value="TAILS">TAILS</option>
        </select>
        <select value={gameFilters.outcome} onChange={(e) => setGameFilters((prev) => ({ ...prev, outcome: e.target.value }))}>
          <option value="">Outcome</option>
          <option value="WIN">WIN</option>
          <option value="LOSE">LOSE</option>
        </select>
      </div>
      <button className="button" disabled={loading} onClick={loadGames}>
        Load Games History
      </button>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Played</th>
              <th>Initiator</th>
              <th>Opponent</th>
              <th>Bet</th>
              <th>Enhanced</th>
              <th>Initiator Choice</th>
              <th>Initiator Result</th>
            </tr>
          </thead>
          <tbody>
            {games.map((item) => (
              <tr key={item.id}>
                <td>{item.playedAt || item.createdAt || "-"}</td>
                <td>{item.initiatorUsername || "-"} ({item.initiatorTelegramId || "-"})</td>
                <td>{item.opponentUsername || "-"} ({item.opponentTelegramId || "-"})</td>
                <td>{flipkyFromCents(item.bet)}</td>
                <td>{item.enhanced ? "YES" : "NO"}</td>
                <td>{item.initiatorChoice || "-"}</td>
                <td>
                  {item.initiatorWins === null || item.initiatorWins === undefined
                    ? "-"
                    : item.initiatorWins
                      ? "WIN"
                      : "LOSE"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderWebhookInbox = () => (
    <>
      <div className="filterGrid">
        <input
          placeholder="Limit"
          value={webhookLimit}
          onChange={(e) => setWebhookLimit(e.target.value.replace(/[^0-9]/g, ""))}
        />
        <input
          placeholder="Link note"
          value={linkNote}
          onChange={(e) => setLinkNote(e.target.value)}
        />
      </div>
      <button className="button" disabled={loading} onClick={loadWebhookEvents}>
        Load Unrecognized Webhooks
      </button>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Received</th>
              <th>TxHash</th>
              <th>Memo</th>
              <th>USDT</th>
              <th>Address</th>
              <th>Error</th>
              <th>Attempts</th>
              <th>Link TxId</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {webhookEvents.map((item) => (
              <tr key={item.id}>
                <td className="dateTimeCell">{formatAdminDateTime(item.receivedAt)}</td>
                <td style={{ maxWidth: 210, wordBreak: "break-all" }}>{item.txHash || "-"}</td>
                <td style={{ maxWidth: 210, wordBreak: "break-all" }}>{item.memo || "-"}</td>
                <td>{usdtFromMicros(item.usdtMicros)}</td>
                <td style={{ maxWidth: 210, wordBreak: "break-all" }}>{item.toAddress || "-"}</td>
                <td style={{ maxWidth: 220, wordBreak: "break-all" }}>{item.processingError || "-"}</td>
                <td>{item.attempts ?? 1}</td>
                <td>
                  <input
                    value={linkTxByEvent[item.id] || ""}
                    onChange={(e) => setLinkTxByEvent((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="wallet transaction id"
                    style={{ minWidth: 200 }}
                  />
                </td>
                <td>
                  <button className="button" disabled={loading} onClick={() => linkWebhookEvent(item.id)}>
                    Link & Complete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const renderUsers = () => (
    <>
      <div className="filterGrid">
        <input
          placeholder="tg_id"
          value={userFilters.telegramId}
          onChange={(e) => setUserFilters((prev) => ({ ...prev, telegramId: e.target.value.replace(/[^0-9]/g, "") }))}
        />
        <input
          placeholder="username"
          value={userFilters.username}
          onChange={(e) => setUserFilters((prev) => ({ ...prev, username: e.target.value }))}
        />
      </div>
      <button className="button" disabled={loading} onClick={loadUsers}>
        Load Users Score/Rate
      </button>
      {walletBalanceSnapshot && (
        <div className="item" style={{ marginTop: 10, display: "grid", gap: 4 }}>
          <strong>Balance Section</strong>
          <div>
            1. Crypto wallet balance:{" "}
            {walletBalanceSnapshot.cryptoWalletBalanceAvailable
              ? `${usdtFromMicros(walletBalanceSnapshot.cryptoWalletUsdtMicros)} USDT (Ⓕ${flipkyFromCents(
                  walletBalanceSnapshot.cryptoWalletFlipkyCents,
                )})`
              : `Unavailable${walletBalanceSnapshot.cryptoWalletBalanceError ? ` (${walletBalanceSnapshot.cryptoWalletBalanceError})` : ""}`}
          </div>
          <div>
            2. Calculated API balance: Ⓕ{flipkyFromCents(walletBalanceSnapshot.calculatedApiBalanceFlipkyCents)} (Deposit Ⓕ
            {flipkyFromCents(walletBalanceSnapshot.depositFlipkyCents)} - Withdraw Ⓕ
            {flipkyFromCents(walletBalanceSnapshot.withdrawFlipkyCents)} - Purchased Ⓕ
            {flipkyFromCents(walletBalanceSnapshot.purchasedFlipkyCents)})
          </div>
          <div>3. Full users balances: Ⓕ{flipkyFromCents(walletBalanceSnapshot.totalUsersBalanceFlipkyCents)}</div>
          <div>Loaded users balances (current filters): Ⓕ{flipkyFromCents(usersSummary.balanceCents)}</div>
        </div>
      )}
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>tg_id</th>
              <th>User</th>
              <th>Rating</th>
              <th>Win Rate %</th>
              <th>Balance Ⓕ</th>
              <th>Withdraw Ⓕ</th>
              <th>Deposit Ⓕ</th>
              <th>Purchased Ⓕ</th>
              <th>Wins</th>
              <th>Losses</th>
              <th>Played</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id}>
                <td>{item.rank ?? "-"}</td>
                <td>{item.telegramId || "-"}</td>
                <td>{item.username || "-"}</td>
                <td>{item.rating ?? "-"}</td>
                <td>{item.winRate ?? "-"}</td>
                <td>{flipkyFromCents(item.score?.flipkyBalance || 0)}</td>
                <td>{flipkyFromCents(item.withdrawFlipkyCents || 0)}</td>
                <td>{flipkyFromCents(item.depositFlipkyCents || 0)}</td>
                <td>{flipkyFromCents(item.purchasedFlipkyCents || 0)}</td>
                <td>{item.score?.wins ?? 0}</td>
                <td>{item.score?.losses ?? 0}</td>
                <td>{item.score?.playedGames ?? 0}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={5}>Summary</th>
              <th>{flipkyFromCents(usersSummary.balanceCents)}</th>
              <th>{flipkyFromCents(usersSummary.withdrawCents)}</th>
              <th>{flipkyFromCents(usersSummary.depositCents)}</th>
              <th>{flipkyFromCents(usersSummary.purchasedCents)}</th>
              <th>{usersSummary.wins}</th>
              <th>{usersSummary.losses}</th>
              <th>{usersSummary.played}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );

  const renderShop = () => (
    <>
      <div className="filterGrid">
        <input
          placeholder="tg_id"
          value={shopFilters.telegramId}
          onChange={(e) => setShopFilters((prev) => ({ ...prev, telegramId: e.target.value.replace(/[^0-9]/g, "") }))}
        />
        <input
          placeholder="username"
          value={shopFilters.username}
          onChange={(e) => setShopFilters((prev) => ({ ...prev, username: e.target.value }))}
        />
      </div>
      <button className="button" disabled={loading} onClick={loadShopStats}>
        Load Shop Stats
      </button>
      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th rowSpan={3}>tg_id</th>
              <th rowSpan={3}>User</th>
              {(shopStats.buffs || []).map((buff) => (
                <th key={`${buff.id}-group`} colSpan={6}>
                  {buff.name || buff.id} ({buff.percent || 0}% | Ⓕ{flipkyFromCents(buff.priceCents || 0)})
                </th>
              ))}
            </tr>
            <tr>
              {(shopStats.buffs || []).map((buff) => (
                <React.Fragment key={`${buff.id}-metrics`}>
                  <th colSpan={2}>Bought</th>
                  <th colSpan={2}>Played</th>
                  <th colSpan={2}>In Games</th>
                </React.Fragment>
              ))}
            </tr>
            <tr>
              {(shopStats.buffs || []).map((buff) => (
                <React.Fragment key={`${buff.id}-units`}>
                  <th>Pieces</th>
                  <th>Ⓕ</th>
                  <th>Pieces</th>
                  <th>Ⓕ</th>
                  <th>Pieces</th>
                  <th>Ⓕ</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {(shopStats.users || []).map((item) => (
              <tr key={item.id}>
                <td>{item.telegramId || "-"}</td>
                <td>{item.username || "-"}</td>
                {(shopStats.buffs || []).map((buff) => {
                  const stats = item.buffStats?.[buff.id] || {};
                  return (
                    <React.Fragment key={`${item.id}-${buff.id}`}>
                      <td>{stats.boughtPieces ?? 0}</td>
                      <td>{flipkyFromCents(stats.boughtFlipkyCents || 0)}</td>
                      <td>{stats.playedPieces ?? 0}</td>
                      <td>{flipkyFromCents(stats.playedFlipkyCents || 0)}</td>
                      <td>{stats.inGamePieces ?? 0}</td>
                      <td>{flipkyFromCents(stats.inGameFlipkyCents || 0)}</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={2}>Summary</th>
              {(shopStats.buffs || []).map((buff) => {
                const summary = shopSummaryByBuff[buff.id] || {};
                return (
                  <React.Fragment key={`${buff.id}-summary`}>
                    <th>{summary.boughtPieces ?? 0}</th>
                    <th>{flipkyFromCents(summary.boughtFlipkyCents || 0)}</th>
                    <th>{summary.playedPieces ?? 0}</th>
                    <th>{flipkyFromCents(summary.playedFlipkyCents || 0)}</th>
                    <th>{summary.inGamePieces ?? 0}</th>
                    <th>{flipkyFromCents(summary.inGameFlipkyCents || 0)}</th>
                  </React.Fragment>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );

  useEffect(() => {
    if (activeTab === Tabs.walletIssues && walletIssues.length === 0) {
      loadWalletIssues();
    }
    if (activeTab === Tabs.transactions && transactions.length === 0) {
      loadTransactions();
    }
    if (activeTab === Tabs.webhookInbox && webhookEvents.length === 0) {
      loadWebhookEvents();
    }
    if (activeTab === Tabs.games && games.length === 0) {
      loadGames();
    }
    if (activeTab === Tabs.users && users.length === 0) {
      loadUsers();
    }
    if (activeTab === Tabs.shop && (shopStats.users || []).length === 0) {
      loadShopStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAdminWalletBalanceSnapshot(sessionToken);
        if (!cancelled) {
          setWalletBalanceSnapshot(data || null);
        }
      } catch (error) {
        if (!cancelled) {
          setWalletBalanceSnapshot(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  return (
    <div className="card">
      <div className="headerRow">
        <h2 style={{ margin: 0 }}>Admin Dashboard</h2>
        <div className="headerMetric">{cryptoWalletHeaderText}</div>
      </div>

      <div className="tabsRow">
        {allTabs.map((tab) => (
          <button key={tab} className={`button ${activeTab === tab ? "activeTab" : "ghost"}`} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab !== Tabs.users && activeTab !== Tabs.shop && (
        <div className="filterGrid" style={{ marginTop: 8 }}>
          <div className="fieldInline">
            <label>From</label>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="fieldInline">
            <label>To</label>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {activeTab === Tabs.walletIssues && renderWalletIssues()}
        {activeTab === Tabs.transactions && renderTransactions()}
        {activeTab === Tabs.webhookInbox && renderWebhookInbox()}
        {activeTab === Tabs.games && renderGames()}
        {activeTab === Tabs.users && renderUsers()}
        {activeTab === Tabs.shop && renderShop()}
      </div>
    </div>
  );
};

export default AdminDashboard;
