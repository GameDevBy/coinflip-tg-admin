import { AdminHeaders, TelegramAuth } from "./constants";
import { getTelegramInitData, getTelegramUserId } from "./telegramWebApp";

export const API_HOST = process.env.REACT_APP_SERVER_HOST || "";

const apiFetch = (path, options = {}) => {
  const responseHeaders = { ...(options.headers || {}) };
  return fetch(`${API_HOST}${path}`, { ...options, headers: responseHeaders });
};

const toQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

export const loginFromBrowser = async ({ telegramId, login, password }) => {
  const response = await apiFetch("/api/admin/auth/browser-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegramId: Number(telegramId), login, password }),
  });
  return response.ok ? response.json() : null;
};

export const loginFromTelegram = async (password) => {
  const initData = getTelegramInitData();
  const telegramId = getTelegramUserId();
  if (!initData || !telegramId) {
    return null;
  }
  const response = await apiFetch("/api/admin/auth/tg-login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [TelegramAuth.headers.initData]: initData,
      [TelegramAuth.headers.userId]: String(telegramId),
    },
    body: JSON.stringify({ password }),
  });
  return response.ok ? response.json() : null;
};

export const logoutAdmin = async (sessionToken) => {
  await apiFetch("/api/admin/auth/logout", {
    method: "POST",
    headers: { [AdminHeaders.session]: sessionToken || "" },
  });
};

export const fetchPendingWalletTransactions = async (sessionToken) => {
  const response = await apiFetch("/api/admin/wallet/transactions/pending", {
    headers: { [AdminHeaders.session]: sessionToken || "" },
  });
  return response.ok ? response.json() : null;
};

export const updateWalletTransactionStatus = async (sessionToken, transactionId, status) => {
  const response = await apiFetch(`/api/admin/wallet/transactions/${transactionId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      [AdminHeaders.session]: sessionToken || "",
    },
    body: JSON.stringify({
      status,
      txHash: "",
      note: status === "COMPLETED" ? "Processed by admin" : "Rejected by admin",
    }),
  });
  return response.ok ? response.json() : null;
};

export const fetchOpenWalletSupportRequests = async (sessionToken) => {
  const response = await apiFetch("/api/admin/wallet/support-requests/open", {
    headers: { [AdminHeaders.session]: sessionToken || "" },
  });
  return response.ok ? response.json() : null;
};

export const updateWalletSupportRequestStatus = async (sessionToken, requestId, status) => {
  const response = await apiFetch(`/api/admin/wallet/support-requests/${requestId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      [AdminHeaders.session]: sessionToken || "",
    },
    body: JSON.stringify({
      status,
      adminNote: status === "RESOLVED" ? "Resolved by admin" : "Rejected by admin",
    }),
  });
  return response.ok ? response.json() : null;
};

export const fetchWalletSupportRequestsHistory = async (sessionToken, filters = {}) => {
  const response = await apiFetch(`/api/admin/wallet/support-requests${toQueryString(filters)}`, {
    headers: { [AdminHeaders.session]: sessionToken || "" },
  });
  return response.ok ? response.json() : null;
};

export const fetchWalletTransactionsHistory = async (sessionToken, filters = {}) => {
  const response = await apiFetch(`/api/admin/wallet/transactions${toQueryString(filters)}`, {
    headers: { [AdminHeaders.session]: sessionToken || "" },
  });
  return response.ok ? response.json() : null;
};

export const reprocessPendingDeposits = async (sessionToken, { limit, note } = {}) => {
  const response = await apiFetch(`/api/admin/wallet/reprocess-pending${toQueryString({ limit, note })}`, {
    method: "POST",
    headers: { [AdminHeaders.session]: sessionToken || "" },
  });
  return response.ok ? response.json() : null;
};

export const fetchUnrecognizedWebhookEvents = async (sessionToken, { limit } = {}) => {
  const response = await apiFetch(`/api/admin/wallet/webhook-events/unrecognized${toQueryString({ limit })}`, {
    headers: { [AdminHeaders.session]: sessionToken || "" },
  });
  return response.ok ? response.json() : null;
};

export const linkWebhookEventToTransaction = async (sessionToken, eventId, transactionId, note = "") => {
  const response = await apiFetch(`/api/admin/wallet/webhook-events/${eventId}/link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [AdminHeaders.session]: sessionToken || "",
    },
    body: JSON.stringify({ transactionId, note }),
  });
  return response.ok ? response.json() : null;
};

export const requestWebhookResend = async (sessionToken, transactionId) => {
  const response = await apiFetch(`/api/admin/wallet/transactions/${transactionId}/request-webhook-resend`, {
    method: "POST",
    headers: { [AdminHeaders.session]: sessionToken || "" },
  });
  return response.ok ? response.json() : null;
};

export const fetchGamesHistory = async (sessionToken, filters = {}) => {
  const response = await apiFetch(`/api/admin/games/history${toQueryString(filters)}`, {
    headers: { [AdminHeaders.session]: sessionToken || "" },
  });
  return response.ok ? response.json() : null;
};

export const fetchUsersScoreRating = async (sessionToken, filters = {}) => {
  const response = await apiFetch(`/api/admin/users/score-rating${toQueryString(filters)}`, {
    headers: { [AdminHeaders.session]: sessionToken || "" },
  });
  return response.ok ? response.json() : null;
};

export const fetchShopStats = async (sessionToken, filters = {}) => {
  const response = await apiFetch(`/api/admin/shop/stats${toQueryString(filters)}`, {
    headers: { [AdminHeaders.session]: sessionToken || "" },
  });
  return response.ok ? response.json() : null;
};
