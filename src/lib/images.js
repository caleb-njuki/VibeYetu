// Photos are shrunk in the browser and kept in the browser for the demo.
// File storage on the backend replaces this later; the pages keep calling the same functions.
const KEY = "vibeyetu_images";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    cache = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

export function imageSrc(id) {
  return id ? load()[id] || "" : "";
}

export function saveImage(dataUrl) {
  const map = load();
  const id = "img" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  map[id] = dataUrl;
  if (!persist()) {
    delete map[id];
    throw new Error("There is not enough space to save this photo. Remove some photos and try again.");
  }
  return id;
}

export function deleteImage(id) {
  const map = load();
  if (id in map) {
    delete map[id];
    persist();
  }
}

// Shrinks a photo so it is quick to load: at most `maxSize` pixels on the long side.
export async function compressImage(file, maxSize = 640, quality = 0.72) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > MAX_FILE_BYTES) throw new Error("This image is too large. Choose one under 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("We could not read this image. Try a JPG or PNG."));
      el.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
