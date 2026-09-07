export const CITY_ZOOM = 0.64;
export const MAX_ZOOM = 1.16;
export const normalizeLon = (lon) => ((lon + 540) % 360) - 180;
export function unwrapRing(ring) {
  let previous = ring[0][0];
  return ring.map(([lon, lat]) => {
    while (lon - previous > 180) lon -= 360;
    while (lon - previous < -180) lon += 360;
    previous = lon;
    return [lon, lat];
  });
}
export function insideRing(lon, lat, rawRing) {
  const ring = rawRing;
  const minLon = ring.minLon ?? Math.min(...ring.map((p) => p[0]));
  const maxLon = ring.maxLon ?? Math.max(...ring.map((p) => p[0]));
  const middle = (minLon + maxLon) / 2;
  lon += Math.round((middle - lon) / 360) * 360;
  if (lon < minLon || lon > maxLon) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    )
      inside = !inside;
  }
  return inside;
}
export function prepareCountries(countries) {
  return countries.map((country) => ({
    ...country,
    polygons: country.geometry.coordinates.map((poly) => {
      const rings = poly.map((raw) => {
          const ring = unwrapRing(raw);
          ring.minLon = Math.min(...ring.map((p) => p[0]));
          ring.maxLon = Math.max(...ring.map((p) => p[0]));
          return ring;
        }),
        points = rings[0];
      return {
        rings,
        minLat: Math.min(...points.map((p) => p[1])),
        maxLat: Math.max(...points.map((p) => p[1])),
      };
    }),
  }));
}
export function countryAt(countries, lon, lat) {
  return countries.find((country) =>
    country.polygons.some(
      (poly) =>
        lat >= poly.minLat &&
        lat <= poly.maxLat &&
        insideRing(lon, lat, poly.rings[0]) &&
        !poly.rings.slice(1).some((r) => insideRing(lon, lat, r)),
    ),
  );
}
export function distanceKm(a, b) {
  const r = Math.PI / 180,
    dLat = (b.lat - a.lat) * r,
    dLon = (b.lon - a.lon) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function cityVisible(city, zoom) {
  if (zoom < CITY_ZOOM) return false;
  if (zoom >= 1.06) return true;
  if (zoom >= 0.94) return city.population >= 20000 || city.capital;
  if (zoom >= 0.83) return city.population >= 100000 || city.capital;
  if (zoom >= 0.74) return city.population >= 500000 || city.capital;
  return city.population >= 1500000 || city.capital;
}
export function isPlaceClick(start, end) {
  return (
    !!start &&
    !start.multitouch &&
    Math.hypot(start.x - end.x, start.y - end.y) < 7
  );
}
export function raySphere(origin, direction, radius) {
  const b =
    origin.x * direction.x + origin.y * direction.y + origin.z * direction.z;
  const c = origin.x ** 2 + origin.y ** 2 + origin.z ** 2 - radius ** 2,
    discriminant = b * b - c;
  if (discriminant < 0) return null;
  const t = -b - Math.sqrt(discriminant);
  return t >= 0 ? t : null;
}
