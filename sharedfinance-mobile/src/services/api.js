import axios from "axios";
import Constants from "expo-constants";

const MANUAL_LAN_HOST = "192.168.68.50";

function resolveDevHost() {
  if (process.env.EXPO_PUBLIC_API_HOST) {
    return process.env.EXPO_PUBLIC_API_HOST;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost;

  if (!hostUri) {
    return MANUAL_LAN_HOST;
  }

  const detectedHost = hostUri.split(":")[0];

  // Tunnel domains (exp.direct, ngrok) cannot proxy local Django ports.
  if (detectedHost.includes("exp.direct") || detectedHost.includes("ngrok")) {
    return MANUAL_LAN_HOST;
  }

  return detectedHost;
}

const DEV_HOST = resolveDevHost();
const AUTH_BASE_URL = `http://${DEV_HOST}:8001/api`;
const FINANCE_BASE_URL = `http://${DEV_HOST}:8002/api`;

export const authApi = axios.create({
  baseURL: AUTH_BASE_URL,
  timeout: 12000,
});

export const financeApi = axios.create({
  baseURL: FINANCE_BASE_URL,
  timeout: 12000,
});

let authToken = null;

export function setApiAuthToken(token) {
  authToken = token || null;
}

const attachAuthHeader = (config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
};

authApi.interceptors.request.use(attachAuthHeader, (error) => Promise.reject(error));
// Finance service currently runs as open dev API. Do not attach auth-service JWT,
// because finance validates tokens with a different signing key in this setup.

export const API_DEBUG = {
  host: DEV_HOST,
  authBaseUrl: AUTH_BASE_URL,
  financeBaseUrl: FINANCE_BASE_URL,
};
