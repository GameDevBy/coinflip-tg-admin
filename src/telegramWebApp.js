const TG_WEBAPP_DATA_PARAM = "tgWebAppData";

const parseUserFromInitData = (initData) => {
  if (!initData) return null;
  try {
    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    return userRaw ? JSON.parse(userRaw) : null;
  } catch {
    return null;
  }
};

export const getTelegramWebApp = () => window.Telegram?.WebApp || null;

export const getInitDataFromUrl = () => {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const fromSearch = searchParams.get(TG_WEBAPP_DATA_PARAM);
    if (fromSearch) return fromSearch;

    const hash = window.location.hash || "";
    const hashQuery = hash.startsWith("#") ? hash.slice(1) : hash;
    const hashParams = new URLSearchParams(hashQuery);
    return hashParams.get(TG_WEBAPP_DATA_PARAM) || "";
  } catch {
    return "";
  }
};

export const getTelegramInitData = () => {
  const webApp = getTelegramWebApp();
  return webApp?.initData || getInitDataFromUrl() || "";
};

export const getTelegramUser = () => {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe?.user || parseUserFromInitData(getTelegramInitData());
};

export const getTelegramUserId = () => getTelegramUser()?.id || null;
