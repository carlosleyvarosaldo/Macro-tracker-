export type Coords = { lat: number; lng: number; accuracy: number };

export type LocationResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: "denied" | "unavailable" | "timeout" | "unsupported" };

const TIMEOUT_MS = 5000;
// Stop early if we get a fix this good (in meters)
const ACCURACY_TARGET_M = 8;

/**
 * Watch geolocation for up to 5 seconds and return the most accurate fix.
 * Stops early if a sub-8m fix arrives.
 * Always resolves — never throws.
 */
export function getCurrentLocation(): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }

    let bestCoords: Coords | null = null;
    let settled = false;
    let watchId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: LocationResult) => {
      if (settled) return;
      settled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timeoutId !== null) clearTimeout(timeoutId);
      resolve(result);
    };

    timeoutId = setTimeout(() => {
      if (bestCoords) finish({ ok: true, coords: bestCoords });
      else finish({ ok: false, reason: "timeout" });
    }, TIMEOUT_MS);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const candidate: Coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 9999,
        };
        if (!bestCoords || candidate.accuracy < bestCoords.accuracy) {
          bestCoords = candidate;
        }
        // Early exit if we got an excellent fix
        if (candidate.accuracy <= ACCURACY_TARGET_M) {
          finish({ ok: true, coords: candidate });
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          finish({ ok: false, reason: "denied" });
        } else if (bestCoords) {
          // We had at least one good fix before the error — use it
          finish({ ok: true, coords: bestCoords });
        } else {
          finish({ ok: false, reason: "unavailable" });
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: TIMEOUT_MS,
      }
    );
  });
}