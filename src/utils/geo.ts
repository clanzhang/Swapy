export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_KM = 6371
const toRad = (deg: number) => (deg * Math.PI) / 180

/** 球面距离（km） */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/**
 * 距离展示。
 *
 * 筛选走的是同城，但卡片上显示具体距离更友好。
 * 拿不到双方定位时就回退显示城市。
 */
export function formatDistance(km: number | undefined, city?: string): string {
  if (km === undefined || !Number.isFinite(km)) return city || '同城'
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))}m`
  if (km < 10) return `${km.toFixed(1)}km`
  return `${Math.round(km)}km`
}
