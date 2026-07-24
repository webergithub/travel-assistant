import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { dayColor, type Item } from "../types";

export interface MapFocus {
  lat: number;
  lng: number;
  label?: string;
}

interface Props {
  items: Item[]; // 已按 dayIndex/sortOrder 排序；有坐标的才上图
  focus?: MapFocus | null;
  onMarkerClick?: (itemId: string) => void;
  onTileFallback?: () => void; // 主瓦片源不可达、已切换备用底图时回调（G-MAP-1）
}

// 主源 Carto 暗色（贴主题）；备用 OSM 官方瓦片（可达性兜底）
const PRIMARY_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const FALLBACK_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

export default function MapPanel({ items, focus, onMarkerClick, onTileFallback }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const focusMarkerRef = useRef<L.Marker | null>(null);
  const lastFitKeyRef = useRef("");
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;
  const onTileFallbackRef = useRef(onTileFallback);
  onTileFallbackRef.current = onTileFallback;

  // 初始化地图（暗色底图，与 OPC 主题一致）+ 瓦片健康检测（G-MAP-1）：
  // 首屏没有任何瓦片成功且出现失败 → 切换备用源并通知；成功过一次即不再干预
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { zoomControl: true, worldCopyJump: true }).setView([32, 110], 3);
    const primary = L.tileLayer(PRIMARY_TILES, { maxZoom: 19, attribution: TILE_ATTR }).addTo(map);

    let anyLoaded = false;
    let errors = 0;
    let switched = false;
    const switchToFallback = () => {
      if (switched || anyLoaded) return;
      switched = true;
      map.removeLayer(primary);
      L.tileLayer(FALLBACK_TILES, { maxZoom: 19, attribution: TILE_ATTR }).addTo(map);
      onTileFallbackRef.current?.();
    };
    primary.on("tileload", () => { anyLoaded = true; });
    primary.on("tileerror", () => {
      errors++;
      if (errors >= 3) switchToFallback();
    });
    const timer = setTimeout(() => { if (errors > 0) switchToFallback(); }, 8000);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // 渲染标记与连线
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const located = items.filter((it) => it.lat != null && it.lng != null);
    const byDay = new Map<number, Item[]>();
    for (const it of located) {
      if (!byDay.has(it.dayIndex)) byDay.set(it.dayIndex, []);
      byDay.get(it.dayIndex)!.push(it);
    }

    for (const [day, list] of byDay) {
      const color = dayColor(day);
      list.forEach((it, idx) => {
        const icon = L.divIcon({
          className: "",
          html: `<div class="tm-marker" style="background:${color}">${day < 0 ? "★" : idx + 1}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 24],
        });
        const marker = L.marker([it.lat!, it.lng!], { icon }).addTo(layer);
        const popup = document.createElement("div");
        popup.style.cssText = "font-size:13px;max-width:220px";
        const b = document.createElement("b");
        b.textContent = it.title;
        popup.appendChild(b);
        if (it.address) {
          const p = document.createElement("div");
          p.style.cssText = "color:#666;font-size:11px;margin-top:2px";
          p.textContent = it.address;
          popup.appendChild(p);
        }
        marker.bindPopup(popup);
        marker.on("click", () => clickRef.current?.(it.id));
      });
      if (day >= 0 && list.length > 1) {
        L.polyline(
          list.map((it) => [it.lat!, it.lng!] as [number, number]),
          { color, weight: 3, opacity: 0.65 }
        ).addTo(layer);
      }
    }

    // 地点集合变化时才自动缩放，避免编辑文字时地图乱跳
    const fitKey = located.map((it) => `${it.id}:${it.lat},${it.lng}`).join("|");
    if (located.length > 0 && fitKey !== lastFitKeyRef.current) {
      lastFitKeyRef.current = fitKey;
      const bounds = L.latLngBounds(located.map((it) => [it.lat!, it.lng!] as [number, number]));
      map.fitBounds(bounds.pad(0.25), { maxZoom: 15 });
    }
  }, [items]);

  // 搜索定位
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    if (focusMarkerRef.current) focusMarkerRef.current.remove();
    const icon = L.divIcon({
      className: "",
      html: `<div class="tm-marker" style="background:#fff">📍</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 24],
    });
    const m = L.marker([focus.lat, focus.lng], { icon }).addTo(map);
    if (focus.label) {
      const el = document.createElement("div");
      el.style.cssText = "font-size:13px";
      el.textContent = focus.label;
      m.bindPopup(el).openPopup();
    }
    focusMarkerRef.current = m;
    map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), 14));
  }, [focus]);

  return <div ref={divRef} className="w-full h-full" />;
}
