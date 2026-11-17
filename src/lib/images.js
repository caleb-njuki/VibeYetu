// Photos live on Cloudinary. The browser shrinks a photo first, asks our server for permission,
// then sends the photo straight to Cloudinary. The server keeps only the photo's id.
import { post } from "../services/http.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

// The server sends a photo as { id, url, thumb }. An older plain string or a data: link also works.
export function imageSrc(photo, thumb = false) {
  if (!photo) return "";
  if (typeof photo === "string") return photo.startsWith("data:") || photo.startsWith("http") ? photo : "";
  return (thumb ? photo.thumb : photo.url) || photo.url || "";
}
// The id the server stores for a photo.
export const imageId = (photo) => (photo && typeof photo === "object" ? photo.id : photo);

// Sends one shrunk photo (a data: link from compressImage) to Cloudinary. Returns { id, url, thumb }.
// `shopId` is the shop the photo belongs to; the server only allows uploads into your own shops.
export async function uploadImage(shopId, dataUrl) {
  const sig = await post(`/seller/shops/${shopId}/images/signature`, {}, "seller");
  const blob = await (await fetch(dataUrl)).blob();
  const form = new FormData();
  Object.entries(sig.fields).forEach(([k, v]) => form.append(k, String(v)));
  form.append("api_key", sig.apiKey);
  form.append("signature", sig.signature);
  form.append("file", blob);
  let res;
  try {
    res = await fetch(sig.uploadUrl, { method: "POST", body: form });
  } catch {
    throw new Error("The photo could not be sent. Check your internet connection and try again.");
  }
  const out = await res.json().catch(() => null);
  if (!res.ok || !out?.public_id) throw new Error(out?.error?.message || "The photo could not be saved. Please try another one.");
  const base = out.secure_url.replace(/\/image\/upload\/.*$/, "/image/upload");
  const tail = out.public_id;
  return {
    id: out.public_id,
    url: `${base}/c_limit,w_800,q_auto,f_auto/${tail}`,
    thumb: `${base}/c_limit,w_200,q_auto,f_auto/${tail}`,
  };
}

// The server removes unused photos itself, so there is nothing to do here. Kept so old calls still work.
export function deleteImage() {}

// Shrinks a photo so it is quick to load: at most `maxSize` pixels on the long side.
export async function compressImage(file, maxSize = 1000, quality = 0.8) {
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
