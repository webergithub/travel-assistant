// 地图导航深链（PR-P2-3）：高德（国内）+ Google Maps（海外）
// 高德 URI API：https://uri.amap.com/marker?position=lng,lat&name=xxx
export function amapUrl(lat: number, lng: number, name: string): string {
  return `https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(name)}&src=tripmate&coordinate=wgs84`;
}
// Google Maps 搜索/定位
export function gmapUrl(lat: number, lng: number, name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(name)}`;
}
