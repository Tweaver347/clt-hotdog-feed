import {
  config,
  getLikedPhotoIds,
  getOrCreateDeviceId,
  markPhotoLiked,
  randomId,
  sha256,
  unmarkPhotoLiked
} from "./utils.js";

const DEMO_PHOTOS_KEY = "clt-hotdog-demo-photos-v1";
const DEMO_LIKES_KEY = "clt-hotdog-demo-likes-v1";
const DEMO_REPORTS_KEY = "clt-hotdog-demo-reports-v1";

const demoSeed = [
  {
    id: "demo-photo-1",
    image_url: "./assets/demo-plaza.svg",
    latitude: 35.2206,
    longitude: -80.8109,
    place_name: "Plaza Midwood",
    location_detail: "Central Avenue",
    location_source: "search",
    hotdog_code: "DEMO42",
    hotdog_number: 42,
    like_count: 18,
    created_at: new Date(Date.now() - 14 * 60 * 1000).toISOString()
  },
  {
    id: "demo-photo-2",
    image_url: "./assets/demo-uptown.svg",
    latitude: 35.2272,
    longitude: -80.8431,
    place_name: "Uptown Charlotte",
    location_detail: "Trade & Tryon",
    location_source: "search",
    hotdog_code: "QUEEN07",
    hotdog_number: 7,
    like_count: 11,
    created_at: new Date(Date.now() - 47 * 60 * 1000).toISOString()
  },
  {
    id: "demo-photo-3",
    image_url: "./assets/demo-southend.svg",
    latitude: 35.2104,
    longitude: -80.8602,
    place_name: "South End",
    location_detail: "Rail Trail",
    location_source: "gps",
    hotdog_code: "CLTDOG9",
    hotdog_number: 9,
    like_count: 6,
    created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString()
  }
];

export function isDemoMode() {
  return Boolean(
    config.forceDemoMode ||
    !config.supabaseUrl ||
    !config.supabaseAnonKey
  );
}

function getDemoPhotos() {
  let stored = [];
  let extraLikes = {};
  try {
    stored = JSON.parse(localStorage.getItem(DEMO_PHOTOS_KEY) || "[]");
  } catch {
    stored = [];
  }
  try {
    extraLikes = JSON.parse(localStorage.getItem(DEMO_LIKES_KEY) || "{}");
  } catch {
    extraLikes = {};
  }
  return [...stored, ...demoSeed].map((photo) => ({
    ...photo,
    like_count: Number(photo.like_count || 0) + Number(extraLikes[photo.id] || 0)
  }));
}

function saveDemoPhoto(photo) {
  const current = getDemoPhotos().filter((item) => !item.id.startsWith("demo-photo-"));
  current.unshift(photo);
  const candidates = current.slice(0, 3);
  while (candidates.length) {
    try {
      localStorage.setItem(DEMO_PHOTOS_KEY, JSON.stringify(candidates));
      return;
    } catch {
      candidates.pop();
    }
  }
  throw new Error("This browser does not have enough local demo storage for the photo. Connect Supabase or choose a smaller image.");
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    ...extra
  };
}

async function rest(path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: supabaseHeaders(options.headers || {})
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const detail = await response.json();
      message = detail.message || detail.error_description || detail.hint || message;
    } catch {
      // Use status fallback.
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;

  // Supabase may return HTTP 201 with an empty body for successful
  // inserts that use Prefer: return=minimal. Avoid trying to parse
  // an empty response as JSON.
  const responseText = await response.text();
  if (!responseText.trim()) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error("The server returned an invalid response.");
  }
}

function normalizeLivePhoto(photo) {
  return {
    ...photo,
    latitude: Number(photo.latitude),
    longitude: Number(photo.longitude),
    like_count: Number(photo.like_count || 0),
    image_url: `${config.supabaseUrl}/storage/v1/object/public/photos/${photo.image_path}`,
    hotdog_code: photo.hotdogs?.public_code || null,
    hotdog_number: photo.hotdogs?.printed_number ?? null
  };
}

export async function getPhotos(sort = "newest") {
  if (isDemoMode()) {
    const photos = getDemoPhotos();
    return photos.sort((a, b) => {
      if (sort === "top") return b.like_count - a.like_count || new Date(b.created_at) - new Date(a.created_at);
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  const order = sort === "top" ? "like_count.desc,created_at.desc" : "created_at.desc";
  const select = "id,image_path,latitude,longitude,place_name,location_detail,location_source,like_count,created_at,hotdogs(public_code,printed_number)";
  const photos = await rest(`photos?select=${encodeURIComponent(select)}&order=${encodeURIComponent(order)}&limit=250`);
  return photos.map(normalizeLivePhoto);
}


export async function getPhotoById(photoId) {
  if (!photoId) return null;
  if (isDemoMode()) return getDemoPhotos().find((photo) => photo.id === photoId) || null;

  const select = "id,image_path,latitude,longitude,place_name,location_detail,location_source,like_count,created_at,hotdogs(public_code,printed_number)";
  const photos = await rest(`photos?select=${encodeURIComponent(select)}&id=eq.${encodeURIComponent(photoId)}&limit=1`);
  return photos[0] ? normalizeLivePhoto(photos[0]) : null;
}

export async function getNewPhotoCount(sinceIso) {
  if (!sinceIso) return 0;
  if (isDemoMode()) {
    const since = new Date(sinceIso).getTime();
    return getDemoPhotos().filter((photo) => new Date(photo.created_at).getTime() > since).length;
  }

  const rows = await rest(`photos?select=id&created_at=gt.${encodeURIComponent(sinceIso)}&limit=100`);
  return rows.length;
}

export async function getHotdog(code) {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (isDemoMode()) {
    const known = {
      DEMO42: { id: "demo-dog-42", public_code: "DEMO42", printed_number: 42, is_active: true },
      QUEEN07: { id: "demo-dog-7", public_code: "QUEEN07", printed_number: 7, is_active: true },
      CLTDOG9: { id: "demo-dog-9", public_code: "CLTDOG9", printed_number: 9, is_active: true }
    };
    return known[normalized] || { id: `demo-${normalized}`, public_code: normalized, printed_number: null, is_active: true };
  }

  const result = await rest(`hotdogs?select=id,public_code,printed_number,is_active&public_code=eq.${encodeURIComponent(normalized)}&is_active=eq.true&limit=1`);
  return result[0] || null;
}


export async function getPhotosForHotdog(code, sort = "oldest") {
  const dog = await getHotdog(code);
  if (!dog) return { dog: null, photos: [] };

  if (isDemoMode()) {
    const photos = getDemoPhotos()
      .filter((photo) => photo.hotdog_code === dog.public_code)
      .sort((a, b) => {
        if (sort === "top") return b.like_count - a.like_count || new Date(b.created_at) - new Date(a.created_at);
        if (sort === "newest") return new Date(b.created_at) - new Date(a.created_at);
        return new Date(a.created_at) - new Date(b.created_at);
      });
    return { dog, photos };
  }

  const order = sort === "top"
    ? "like_count.desc,created_at.desc"
    : sort === "newest" ? "created_at.desc" : "created_at.asc";
  const select = "id,image_path,latitude,longitude,place_name,location_detail,location_source,like_count,created_at,hotdogs(public_code,printed_number)";
  const photos = await rest(`photos?select=${encodeURIComponent(select)}&hotdog_id=eq.${encodeURIComponent(dog.id)}&order=${encodeURIComponent(order)}&limit=250`);
  return { dog, photos: photos.map(normalizeLivePhoto) };
}

export async function createPhoto({
  blob,
  dataUrl,
  latitude,
  longitude,
  placeName,
  locationDetail,
  locationSource,
  hotdogCode
}) {
  const hotdog = hotdogCode ? await getHotdog(hotdogCode) : null;
  if (hotdogCode && !hotdog) throw new Error("That hot dog code is not active.");

  if (isDemoMode()) {
    const photo = {
      id: randomId(),
      image_url: dataUrl,
      latitude,
      longitude,
      place_name: placeName,
      location_detail: locationDetail,
      location_source: locationSource,
      hotdog_code: hotdog?.public_code || hotdogCode || null,
      hotdog_number: hotdog?.printed_number ?? null,
      like_count: 0,
      created_at: new Date().toISOString()
    };
    saveDemoPhoto(photo);
    return photo;
  }

  const now = new Date();
  const dateFolder = now.toISOString().slice(0, 10);
  const objectPath = `uploads/${dateFolder}/${randomId()}.jpg`;
  const uploadUrl = `${config.supabaseUrl}/storage/v1/object/photos/${objectPath}`;
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: supabaseHeaders({
      "Content-Type": "image/jpeg",
      "x-upsert": "false"
    }),
    body: blob
  });
  if (!uploadResponse.ok) {
    let message = "Photo upload failed.";
    try {
      const detail = await uploadResponse.json();
      message = detail.message || detail.error || message;
    } catch {
      // Use fallback.
    }
    throw new Error(message);
  }

  const payload = {
    hotdog_id: hotdog?.id || null,
    image_path: objectPath,
    latitude,
    longitude,
    place_name: placeName,
    location_detail: locationDetail || "Charlotte",
    location_source: locationSource || "search"
  };
  const inserted = await rest("photos?select=id,image_path,latitude,longitude,place_name,location_detail,location_source,like_count,created_at,hotdogs(public_code,printed_number)", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });
  return normalizeLivePhoto(inserted[0]);
}

export async function likePhoto(photoId) {
  const alreadyLiked = getLikedPhotoIds().has(photoId);
  if (alreadyLiked) return { duplicate: true };

  if (isDemoMode()) {
    let counts = {};
    try {
      counts = JSON.parse(localStorage.getItem(DEMO_LIKES_KEY) || "{}");
    } catch {
      counts = {};
    }
    counts[photoId] = (counts[photoId] || 0) + 1;
    localStorage.setItem(DEMO_LIKES_KEY, JSON.stringify(counts));

    markPhotoLiked(photoId);
    return { duplicate: false };
  }

  const deviceHash = await sha256(getOrCreateDeviceId());
  try {
    await rest("likes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ photo_id: photoId, device_hash: deviceHash })
    });
    markPhotoLiked(photoId);
    return { duplicate: false };
  } catch (error) {
    if (error.status === 409 || /duplicate/i.test(error.message)) {
      markPhotoLiked(photoId);
      return { duplicate: true };
    }
    throw error;
  }
}

export async function unlikePhoto(photoId) {
  const alreadyLiked = getLikedPhotoIds().has(photoId);
  if (!alreadyLiked) return { removed: false };

  if (isDemoMode()) {
    let counts = {};
    try {
      counts = JSON.parse(localStorage.getItem(DEMO_LIKES_KEY) || "{}");
    } catch {
      counts = {};
    }
    counts[photoId] = Math.max(0, Number(counts[photoId] || 0) - 1);
    if (counts[photoId] === 0) delete counts[photoId];
    localStorage.setItem(DEMO_LIKES_KEY, JSON.stringify(counts));
    unmarkPhotoLiked(photoId);
    return { removed: true };
  }

  const deviceHash = await sha256(getOrCreateDeviceId());
  const result = await rest("rpc/remove_photo_like", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({ p_photo_id: photoId, p_device_hash: deviceHash })
  });
  unmarkPhotoLiked(photoId);
  return { removed: result === true };
}


export async function reportPhoto(photoId, reason) {
  const allowedReasons = new Set(["inappropriate", "consent", "spam", "wrong_location", "other"]);
  if (!photoId) throw new Error("No photo was selected.");
  if (!allowedReasons.has(reason)) throw new Error("Choose a report reason.");

  const deviceHash = await sha256(getOrCreateDeviceId());
  if (isDemoMode()) {
    let reports = [];
    try {
      reports = JSON.parse(localStorage.getItem(DEMO_REPORTS_KEY) || "[]");
    } catch {
      reports = [];
    }
    if (reports.some((report) => report.photo_id === photoId && report.device_hash === deviceHash)) {
      return { duplicate: true };
    }
    reports.push({ photo_id: photoId, device_hash: deviceHash, reason, created_at: new Date().toISOString() });
    localStorage.setItem(DEMO_REPORTS_KEY, JSON.stringify(reports));
    return { duplicate: false };
  }

  try {
    await rest("reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ photo_id: photoId, device_hash: deviceHash, reason })
    });
    return { duplicate: false };
  } catch (error) {
    if (error.status === 409 || /duplicate/i.test(error.message)) return { duplicate: true };
    throw error;
  }
}
