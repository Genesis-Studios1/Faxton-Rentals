import { auth } from "./firebase.js";
import { API_CONFIG } from "./api-config.js";

export class ApiError extends Error {
  constructor(message, { status = 0, code = "API_ERROR", requestId = "" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export const apiConfigured = () => typeof API_CONFIG.baseUrl === "string" && API_CONFIG.baseUrl.trim().length > 0;

function apiUrl(path) {
  if (!apiConfigured()) throw new ApiError("The Faxton backend is not configured on this build.", { code: "API_NOT_CONFIGURED" });
  const base = API_CONFIG.baseUrl.trim();
  let origin;
  try { origin = new URL(base); } catch { throw new ApiError("The Faxton backend URL is invalid.", { code: "API_CONFIG_INVALID" }); }
  if (origin.protocol !== "https:" && origin.hostname !== "localhost") {
    throw new ApiError("The Faxton backend must use HTTPS.", { code: "API_CONFIG_INSECURE" });
  }
  if (origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) {
    throw new ApiError("Configure the backend using its origin only.", { code: "API_CONFIG_INVALID" });
  }
  const cleanPath = String(path || "");
  if (!cleanPath.startsWith("/v1/") || cleanPath.startsWith("//")) {
    throw new ApiError("Invalid backend API path.", { code: "API_PATH_INVALID" });
  }
  return new URL(cleanPath, origin);
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET", body, headers = {}, authenticated = true,
    signal, forceRefresh = false
  } = options;
  const requestHeaders = new Headers(headers);
  if (authenticated) {
    const user = auth.currentUser;
    if (!user) throw new ApiError("Sign in is required to continue.", { status: 401, code: "AUTH_REQUIRED" });
    try {
      requestHeaders.set("Authorization", `Bearer ${await user.getIdToken(forceRefresh)}`);
    } catch {
      throw new ApiError("Your session could not be verified. Please sign in again.", { status: 401, code: "TOKEN_UNAVAILABLE" });
    }
  }

  let requestBody = body;
  if (body !== undefined && !(body instanceof FormData) && !(body instanceof Blob) && typeof body !== "string") {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers: requestHeaders,
      body: requestBody,
      credentials: "omit",
      cache: "no-store",
      signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("Faxton could not reach the backend. Check your connection and try again.", { code: "NETWORK_ERROR" });
  }

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `The backend request failed (${response.status}).`;
    throw new ApiError(message, {
      status: response.status,
      code: payload?.code || `HTTP_${response.status}`,
      requestId: typeof payload?.requestId === "string" ? payload.requestId : ""
    });
  }
  if (!payload || typeof payload !== "object") throw new ApiError("The backend returned an invalid response.", { status: response.status, code: "INVALID_RESPONSE" });
  return Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
}

export const apiGet = (path, options = {}) => apiRequest(path, { ...options, method: "GET" });
export const apiPost = (path, body, options = {}) => apiRequest(path, { ...options, method: "POST", body });
export const apiPatch = (path, body, options = {}) => apiRequest(path, { ...options, method: "PATCH", body });
export const apiPut = (path, body, options = {}) => apiRequest(path, { ...options, method: "PUT", body });
export const apiDelete = (path, options = {}) => apiRequest(path, { ...options, method: "DELETE" });
