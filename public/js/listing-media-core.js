// Validation and structured feature helpers shared by the property listing form and tests.
export const LISTING_MEDIA_LIMITS = Object.freeze({
  photos: 30,
  videos: 1,
  imageBytes: 10 * 1024 * 1024,
  videoBytes: 250 * 1024 * 1024
});

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

export function validateListingMedia(imageFiles = [], videoFiles = [], linkedImages = 0, linkedVideos = 0) {
  const images = Array.from(imageFiles || []).filter(Boolean);
  const videos = Array.from(videoFiles || []).filter(Boolean);
  const totalImages = Math.max(0, Number(linkedImages) || 0) + images.length;
  const totalVideos = Math.max(0, Number(linkedVideos) || 0) + videos.length;

  if (totalImages > LISTING_MEDIA_LIMITS.photos) return "Use up to 30 photos in total, including uploaded files and links.";
  if (totalVideos > LISTING_MEDIA_LIMITS.videos) return "Add only one property video, either as an upload or a link.";
  for (const file of images) {
    if (!IMAGE_TYPES.has(file.type)) return "Photos must be JPG, PNG or WebP files.";
    if (file.size > LISTING_MEDIA_LIMITS.imageBytes) return "Each photo must be 10 MB or smaller.";
  }
  for (const file of videos) {
    if (!VIDEO_TYPES.has(file.type)) return "Videos must be MP4 or WebM files.";
    if (file.size > LISTING_MEDIA_LIMITS.videoBytes) return "The property video must be 250 MB or smaller.";
  }
  return "";
}

export function validatePropertyVideoDuration(seconds) {
  return Number.isFinite(seconds) && seconds > 90
    ? ""
    : "The property video must be longer than 1 minute 30 seconds.";
}

export function readPropertyVideoDuration(file) {
  if (!file || typeof document === "undefined" || typeof URL?.createObjectURL !== "function") {
    return Promise.reject(new Error("This browser cannot check the video duration."));
  }
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    const cleanup = () => { video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url); };
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (!Number.isFinite(duration)) reject(new Error("Could not read this video's duration. Try another MP4 or WebM file."));
      else resolve(duration);
    };
    video.onerror = () => { cleanup(); reject(new Error("Could not read this video's duration. Try another MP4 or WebM file.")); };
    video.src = url;
  });
}

export function collectListingFeatures(counts = {}, customRows = []) {
  const builtIns = [
    ["Bedrooms", counts.bedrooms],
    ["Bathrooms", counts.bathrooms],
    ["Kitchen", counts.kitchens],
    ["Parlour", counts.parlours],
    ["Swimming pool", counts.swimmingPools],
    ["Garden", counts.gardens],
    ["Parking spaces", counts.parking]
  ];
  const rows = [...builtIns, ...customRows.map((item) => [item?.name, item?.count])];
  const byName = new Map();
  for (const [rawName, rawCount] of rows) {
    const name = String(rawName ?? "").trim().slice(0, 40);
    const count = Number(rawCount);
    if (!name || !Number.isFinite(count) || count <= 0) continue;
    const safeCount = Math.min(99, Math.floor(count));
    const key = name.toLocaleLowerCase();
    const current = byName.get(key);
    byName.set(key, { name: current?.name || name, count: Math.min(99, (current?.count || 0) + safeCount) });
    if (byName.size > 25) throw new Error("Add no more than 25 countable features.");
  }
  return [...byName.values()];
}
