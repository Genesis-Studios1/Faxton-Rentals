import { apiGet, apiPatch, apiPut } from "./api-client.js";
import { toProfileViewModel } from "./api-property-mapper.js";

export async function getBackendProfile({ signal } = {}) {
  return toProfileViewModel(await apiGet("/v1/me/profile", { signal }));
}

export async function updateBackendProfile(changes, { signal } = {}) {
  return toProfileViewModel(await apiPatch("/v1/me/profile", changes, { signal }));
}

export async function updateBackendSettings(changes, { signal } = {}) {
  return toProfileViewModel(await apiPatch("/v1/me/settings", changes, { signal }));
}

export async function setBackendAvatar(uploadId, { signal } = {}) {
  if (uploadId !== null && !/^[0-9a-f-]{36}$/i.test(String(uploadId))) throw new TypeError("Invalid profile image upload identifier.");
  return toProfileViewModel(await apiPut("/v1/me/profile/image", { uploadId }, { signal }));
}
