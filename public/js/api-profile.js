import { apiGet, apiPatch, apiPut, apiPost } from "./api-client.js";
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


export async function uploadBackendProfileImage(file, { signal } = {}) {
  if (!(file instanceof Blob)) throw new TypeError("Choose a profile image file to upload.");
  const form = new FormData();
  form.append("file", file, file.name || "profile-image");
  const upload = await apiPost("/v1/uploads/profile-image", form, { signal });
  if (!upload || typeof upload.uploadId !== "string" || !/^[0-9a-f-]{36}$/i.test(upload.uploadId)) {
    throw new TypeError("Faxton API returned an invalid profile image upload.");
  }
  return setBackendAvatar(upload.uploadId, { signal });
}
