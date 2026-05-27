/**
 * MapaHeroEstatico.tsx
 * Coloca en: frontend/src/components/MapaHeroEstatico.tsx
 *
 * Mapa decorativo para la sección landing (home).
 * Muestra puntos de ejemplo fijos sobre CDMX sin llamadas al backend.
 * No requiere dependencias extra si ya instalaste react-map-gl.
 */

import { useState } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// Puntos de ejemplo fijos para la demo visual del hero
const PUNTOS_EJEMPLO = [
  {
    id: '1', lon: -99.1676, lat: 19.4271,
    nombre: 'Paseo de la Reforma',
    actividad: 'Zona Financiera — Alta afluencia',
    score: 94, color: '#10b981',
  },
  {
    id: '2', lon: -99.2007, lat: 19.4312,
    nombre: 'Polanco',
    actividad: 'Zona Premium — Alta densidad comercial',
    score: 97, color: '#10b981',
  },
  {
    id: '3', lon: -99.1722, lat: 19.4121,
    nombre: 'Condesa',
    actividad: 'Zona Lifestyle — Media competencia',
    score: 89, color: '#f59e0b',
  },
  {
    id: '4', lon: -99.1590, lat: 19.4180,
    nombre: 'Roma Norte',
    actividad: 'Zona Gastronómica — Baja saturación',
    score: 82, color: '#f59e0b',
  },
  {
    id: '5', lon: -99.1450, lat: 19.4260,
    nombre: 'Centro Histórico',
    actividad: 'Alta competencia — Flujo turístico',
    score: 61, color: '#ef4444',
  },
];

export default function MapaHeroEstatico() {
  const [popupId, setPopupId] = useState<string | null>(null);
  const popup = PUNTOS_EJEMPLO.find(p => p.id === popupId);

  return (
    <div className="relative w-full h-full rounded-[40px] overflow-hidden">
      <Map
        initialViewState={{
          longitude: -99.175,
          latitude: 19.422,
          zoom: 12.5,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        interactive={false}   // Solo visual, sin interacción en el hero
        attributionControl={false}
      >
        {/* Puntos de ejemplo */}
        {PUNTOS_EJEMPLO.map(p => (
          <Marker
            key={p.id}
            longitude={p.lon}
            latitude={p.lat}
            anchor="center"
          >
            <div
              className="relative cursor-default"
              onMouseEnter={() => setPopupId(p.id)}
              onMouseLeave={() => setPopupId(null)}
            >
              {/* Anillo pulsante */}
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-30"
                style={{ backgroundColor: p.color, transform: 'scale(2)' }}
              />
              {/* Punto central */}
              <div
                className="w-4 h-4 rounded-full border-2 border-white shadow-lg relative z-10 flex items-center justify-center"
                style={{ backgroundColor: p.color }}
              >
                <span className="text-[8px] text-white font-black">{p.score}</span>
              </div>
            </div>
          </Marker>
        ))}

        {/* Popup al hover */}
        {popup && (
          <Popup
            longitude={popup.lon}
            latitude={popup.lat}
            anchor="bottom"
            offset={[0, -12]}
            closeButton={false}
            closeOnClick={false}
            maxWidth="220px"
          >
            <div className="bg-white rounded-xl p-3 shadow-lg border border-slate-100">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: popup.color }}
                />
                <p className="text-xs font-extrabold text-slate-800">{popup.nombre}</p>
              </div>
              <p className="text-[10px] text-slate-500">{popup.actividad}</p>
              <div className="mt-2 bg-slate-50 rounded-lg px-2 py-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Score de viabilidad</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${popup.score}%`, backgroundColor: popup.color }}
                    />
                  </div>
                  <span className="text-xs font-black" style={{ color: popup.color }}>
                    {popup.score}
                  </span>
                </div>
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Overlay gradiente para integrarlo con el fondo del hero */}
      <div className="absolute inset-0 pointer-events-none rounded-[40px] ring-1 ring-brand-border/50" />
    </div>
  );
}