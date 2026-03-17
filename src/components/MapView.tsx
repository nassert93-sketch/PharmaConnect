import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Correction des icônes par défaut de Leaflet (problème avec webpack)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Icônes colorées distinctes pour chaque type de marqueur
const MARKER_ICONS: Record<string, { color: string; icon: string }> = {
  patient:  { color: '#3b82f6', icon: '👤' }, // bleu
  pharmacy: { color: '#10b981', icon: '💊' }, // vert
  driver:   { color: '#f59e0b', icon: '🏍️' }, // orange
  delivery: { color: '#8b5cf6', icon: '📦' }, // violet
};

const createDivIcon = (type: string): L.DivIcon => {
  const config = MARKER_ICONS[type] || { color: '#6b7280', icon: '📍' };
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background:${config.color};
        width:36px;height:36px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:3px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="transform:rotate(45deg);font-size:14px;line-height:1">${config.icon}</span>
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38],
  });
};

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  markers?: Array<{
    position: [number, number];
    popup?: string;
    icon?: 'patient' | 'pharmacy' | 'driver' | 'delivery';
  }>;
  height?: string;
  width?: string;
}

const MapView: React.FC<MapViewProps> = ({
  center = [11.5721, 43.1456],
  zoom = 13,
  markers = [],
  height = '400px',
  width = '100%'
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapRef.current = L.map(mapContainerRef.current).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapRef.current);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setView(center, zoom);
  }, [center, zoom]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) mapRef.current?.removeLayer(layer);
    });
    markers.forEach(({ position, popup, icon }) => {
      const markerIcon = icon ? createDivIcon(icon) : undefined;
      const m = L.marker(position, { icon: markerIcon }).addTo(mapRef.current!);
      if (popup) m.bindPopup(popup);
    });
  }, [markers]);

  return <div ref={mapContainerRef} style={{ height, width }} />;
};

export default MapView;