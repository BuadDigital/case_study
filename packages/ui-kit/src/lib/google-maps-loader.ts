let loadPromise: Promise<typeof google> | null = null;

export function googleMapsApiKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return key || undefined;
}

export function parseCoord(value: string): number | null {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

export function googleMapsSearchUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export type ReverseGeocodeDetail = {
  lat: number;
  lng: number;
  formattedAddress?: string;
  city?: string;
  district?: string;
};

/**
 * Client-side reverse geocode (no Google Geocoding API — avoids requiring that
 * billed/enabled product on the Maps key). Uses BigDataCloud's free client endpoint.
 */
export async function reverseGeocodeLocation(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeDetail> {
  const base: ReverseGeocodeDetail = { lat, lng };
  try {
    const url = new URL(
      "https://api.bigdatacloud.net/data/reverse-geocode-client",
    );
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("localityLanguage", "ar");
    const res = await fetch(url.toString());
    if (!res.ok) return base;
    const data = (await res.json()) as {
      locality?: string;
      city?: string;
      principalSubdivision?: string;
      localityInfo?: {
        administrative?: Array<{ name?: string; adminLevel?: number }>;
      };
      plusCode?: string;
    };
    const admin = data.localityInfo?.administrative ?? [];
    const byLevel = (level: number) =>
      admin.find((a) => a.adminLevel === level)?.name?.trim() || "";

    const city =
      data.city?.trim() ||
      byLevel(8) ||
      byLevel(6) ||
      data.principalSubdivision?.trim() ||
      "";
    const district =
      data.locality?.trim() ||
      byLevel(9) ||
      byLevel(10) ||
      "";
    const formattedAddress = [district, city, data.principalSubdivision]
      .filter((p, i, arr) => p && arr.indexOf(p) === i)
      .join("، ");

    return {
      lat,
      lng,
      formattedAddress: formattedAddress || data.plusCode || undefined,
      city: city || undefined,
      district: district && district !== city ? district : undefined,
    };
  } catch {
    return base;
  }
}

export function loadGoogleMapsApi(): Promise<typeof google> {
  const key = googleMapsApiKey();
  if (!key) {
    return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  }

  if (typeof window !== "undefined" && window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const callbackName = `__ejadaGmapsInit_${Date.now()}`;
      const script = document.createElement("script");
      // `loading=async` is required by Google's current loader guidance.
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=${callbackName}`;
      script.async = true;
      script.defer = true;

      const finishOk = () => {
        if (window.google?.maps) {
          resolve(window.google);
        } else {
          loadPromise = null;
          reject(new Error("Google Maps failed to load"));
        }
      };

      (window as unknown as Record<string, unknown>)[callbackName] = () => {
        delete (window as unknown as Record<string, unknown>)[callbackName];
        finishOk();
      };

      script.onerror = () => {
        delete (window as unknown as Record<string, unknown>)[callbackName];
        loadPromise = null;
        reject(new Error("Google Maps script error"));
      };
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}
