// Photos live on Cloudinary. The seller's browser uploads straight to Cloudinary using a
// signature made here, so the secret never leaves the server and photos never pass through it.
import { createHash } from 'node:crypto';
import { config } from '../config/env.js';
import { httpError } from '../utils/httpError.js';

const ALLOWED_FORMATS = 'jpg,jpeg,png,webp';
// Cloudinary shrinks anything bigger than this on upload, so storage stays small.
const INCOMING_TRANSFORMATION = 'c_limit,w_1600,h_1600';

export const isConfigured = () => config.cloudinary.enabled;

// Every photo of a shop lives in its own folder. A seller may only use photos from their own shop's folder.
export const shopFolder = (shopId) => `vibeyetu/shops/${shopId}`;
export const isOwnImage = (shopId, publicId) =>
  new RegExp(`^vibeyetu/shops/${shopId}/[A-Za-z0-9_-]{1,100}$`).test(String(publicId));

// Cloudinary's rule: sort the parameters, join them as a=1&b=2, add the secret, SHA-1.
function sign(params) {
  const text = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(text + config.cloudinary.apiSecret).digest('hex');
}

function requireConfigured() {
  if (!isConfigured()) {
    throw httpError(503, 'Photo uploads are not set up yet. Please try again later.');
  }
}

// What the browser needs to upload ONE photo. The folder and limits are part of the signature,
// so they cannot be changed by the seller.
export function createUploadSignature(shopId) {
  requireConfigured();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    allowed_formats: ALLOWED_FORMATS,
    folder: shopFolder(shopId),
    timestamp,
    transformation: INCOMING_TRANSFORMATION,
  };
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/image/upload`,
    apiKey: config.cloudinary.apiKey,
    signature: sign(params),
    // Send these fields back to Cloudinary exactly as given, plus the file:
    fields: params,
    expiresInSeconds: 3600,
  };
}

// A link to a photo, resized. Returns null when Cloudinary is not set up.
export function imageUrl(publicId, width = 800) {
  if (!config.cloudinary.cloudName || !publicId) return null;
  return `https://res.cloudinary.com/${config.cloudinary.cloudName}/image/upload/c_limit,w_${width},q_auto,f_auto/${publicId}`;
}

// Removes photos nobody uses any more. Never throws: a failure is only logged, because the
// person's change has already been saved.
export async function deleteImages(publicIds) {
  if (!isConfigured()) return;
  for (const publicId of publicIds) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const body = new URLSearchParams({
        public_id: publicId,
        timestamp: String(timestamp),
        api_key: config.cloudinary.apiKey,
        signature: sign({ public_id: publicId, timestamp }),
      });
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/image/destroy`,
        { method: 'POST', body, signal: AbortSignal.timeout(10000) }
      );
      if (!response.ok) console.error('Cloudinary could not delete a photo. HTTP status:', response.status);
    } catch (err) {
      console.error('Cloudinary delete failed:', err.message);
    }
  }
}
