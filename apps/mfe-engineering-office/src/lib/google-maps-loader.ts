let loadPromise: Promise<typeof google> | null = null;

export function googleMapsApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

export function parseCoord(value: string): number | null {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

export function googleMapsSearchUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
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
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google?.maps) {
          resolve(window.google);
        } else {
          loadPromise = null;
          reject(new Error("Google Maps failed to load"));
        }
      };
      script.onerror = () => {
        loadPromise = null;
        reject(new Error("Google Maps script error"));
      };
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}
