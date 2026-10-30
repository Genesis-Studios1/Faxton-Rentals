// Direct-to-Storage property media uploads. Files never pass through Firestore documents.
import { storage } from "./firebase.js";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { LISTING_MEDIA_LIMITS, validateListingMedia } from "./listing-media-core.js";

const safeName = (name) => String(name || "upload")
  .normalize("NFKD")
  .replace(/[^a-zA-Z0-9._-]+/g, "-")
  .replace(/-+/g, "-")
  .slice(-90) || "upload";

const uploadOne = (file, uid, listingId, kind, index, onProgress, progressState) => new Promise((resolve, reject) => {
  const folder = kind === "image" ? "images" : "videos";
  const path = `listing-media/${uid}/${listingId}/${folder}/${Date.now()}-${index}-${safeName(file.name)}`;
  const fileRef = ref(storage, path);
  const task = uploadBytesResumable(fileRef, file, {
    contentType: file.type,
    customMetadata: { ownerUid: uid, listingId, mediaKind: kind }
  });
  task.on("state_changed", (snapshot) => {
    progressState.currentBytes = progressState.completedBytes + snapshot.bytesTransferred;
    const pct = progressState.totalBytes
      ? Math.min(99, Math.round(progressState.currentBytes / progressState.totalBytes * 100))
      : 0;
    onProgress?.(pct, file.name);
  }, reject, async () => {
    try {
      const url = await getDownloadURL(task.snapshot.ref);
      progressState.completedBytes += file.size;
      progressState.currentBytes = progressState.completedBytes;
      onProgress?.(Math.min(99, Math.round(progressState.completedBytes / progressState.totalBytes * 100)), file.name);
      resolve({ url, path });
    } catch (error) {
      reject(error);
    }
  });
});

export async function removeListingMedia(paths = []) {
  await Promise.allSettled(paths.filter((p) => typeof p === "string" && p.startsWith("listing-media/"))
    .map((path) => deleteObject(ref(storage, path))));
}

export async function uploadListingMedia({ uid, listingId, images = [], videos = [], linkedImages = 0, linkedVideos = 0, onProgress } = {}) {
  if (!uid || !listingId) throw new Error("Sign in before uploading property media.");
  const photoFiles = Array.from(images || []).filter(Boolean);
  const videoFiles = Array.from(videos || []).filter(Boolean);
  const invalid = validateListingMedia(photoFiles, videoFiles, linkedImages, linkedVideos);
  if (invalid) throw new Error(invalid);
  const totalBytes = [...photoFiles, ...videoFiles].reduce((sum, file) => sum + file.size, 0);
  const progressState = { totalBytes, completedBytes: 0, currentBytes: 0 };
  const uploaded = [];
  try {
    for (let i = 0; i < photoFiles.length; i++) {
      uploaded.push({ kind: "image", ...await uploadOne(photoFiles[i], uid, listingId, "image", i, onProgress, progressState) });
    }
    for (let i = 0; i < videoFiles.length; i++) {
      uploaded.push({ kind: "video", ...await uploadOne(videoFiles[i], uid, listingId, "video", i, onProgress, progressState) });
    }
    onProgress?.(100, "");
    return {
      images: uploaded.filter((x) => x.kind === "image").map((x) => x.url),
      videos: uploaded.filter((x) => x.kind === "video").map((x) => x.url),
      paths: uploaded.map((x) => x.path)
    };
  } catch (error) {
    await removeListingMedia(uploaded.map((x) => x.path));
    throw error;
  }
}

export { LISTING_MEDIA_LIMITS, validateListingMedia };
