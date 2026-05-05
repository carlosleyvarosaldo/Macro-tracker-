/**
 * Resolve a coordinate to a street address using OpenStreetMap Nominatim.
 * Returns null on any failure — caller should treat address as optional.
 *
 * Usage policy: max 1 request per second, identifying User-Agent required.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data: unknown = await res.json();
    if (!data || typeof data !== "object") return null;

    const obj = data as { display_name?: string; address?: Record<string, string> };

    // Prefer a clean "house_number street, city" if available
    const a = obj.address;
    if (a) {
      const parts: string[] = [];
      const street = [a.house_number, a.road].filter(Boolean).join(" ").trim();
      if (street) parts.push(street);
      const city = a.city || a.town || a.village || a.hamlet || a.suburb;
      if (city) parts.push(city);
      if (a.state) parts.push(a.state);
      if (parts.length > 0) return parts.join(", ");
    }

    return obj.display_name?.trim() || null;
  } catch {
    return null;
  }
}