import { useState, useCallback } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl/maplibre';
// @ts-ignore - Evita que TypeScript busque tipos en el archivo CSS
import 'maplibre-gl/dist/maplibre-gl.css';

const GIROS_DEMO = [
  { label: 'Cafetería / Restaurante', value: 'cafe' },
  { label: 'Farmacia', value: 'farmacia' },
  { label: 'Gimnasio', value: 'gym' },
  { label: 'Papelería', value: 'papeleria' },
  { label: 'Tienda de ropa', value: 'ropa' },
];

interface NegocioDenue {
  id: string;
  nombre: string;
  actividad: string;
  lat: number;
  lon: number;
  calle: string;
  colonia: string;
}

export default function MapaPinDemo() {
  const [pin, setPin] = useState<{lat: number; lon: number} | null>(null);
  const [giro, setGiro] = useState('cafe');
  const [negocios, setNegocios] = useState<NegocioDenue[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMapClick = useCallback(async (evt: any) => {
    const { lng, lat } = evt.lngLat;
    setPin({ lat, lon: lng });
    setNegocios([]);
    setError(null);
    setCargando(true);

    try {
      const res = await fetch(
        `http://localhost:5000/api/denue/buscar?lat=${lat}&lon=${lng}&giro=${giro}&radio=500`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNegocios(data.negocios || []);
    } catch (e: any) {
      setError('No se pudo conectar. Verifica que el servidor esté activo.');
    } finally {
      setCargando(false);
    }
  }, [giro]);

  // GeoJSON del círculo buffer (aproximación con 64 puntos)
  const circuloGeoJSON = pin ? {
    type: 'FeatureCollection' as const,
    features: [{
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [Array.from({ length: 65 }, (_, i) => {
          const angle = (i / 64) * 2 * Math.PI;
          const R = 6371000;
          const dLat = (500 / R) * (180 / Math.PI);
          const dLon = (500 / R) * (180 / Math.PI) / Math.cos(pin.lat * Math.PI / 180);
          return [pin.lon + dLon * Math.cos(angle), pin.lat + dLat * Math.sin(angle)];
        })]
      },
      properties: {}
    }]
  } : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de giro */}
      <div className="bg-white border border-brand-border rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <span className="text-xs font-black text-brand-text uppercase tracking-wider">
          ¿Qué tipo de negocio quieres abrir?
        </span>
        <select
          value={giro}
          onChange={e => setGiro(e.target.value)}
          className="bg-slate-50 border border-brand-border rounded-xl px-3 py-2 text-sm font-bold text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          {GIROS_DEMO.map(g => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
        <span className="text-xs text-brand-muted">
          → Haz clic en el mapa para colocar tu pin
        </span>
      </div>

      {/* Mapa */}
      <div className="rounded-[24px] overflow-hidden border border-brand-border shadow-premium" style={{ height: 480 }}>
        <Map
          initialViewState={{ longitude: -99.1332, latitude: 19.4326, zoom: 13 }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          onClick={handleMapClick}
          cursor="crosshair"
        >
          {/* Círculo buffer */}
          {circuloGeoJSON && (
            <Source id="buffer" type="geojson" data={circuloGeoJSON}>
              <Layer id="buffer-fill" type="fill" paint={{ 'fill-color': '#004b93', 'fill-opacity': 0.08 }} />
              <Layer id="buffer-line" type="line" paint={{ 'line-color': '#004b93', 'line-width': 2, 'line-dasharray': [4, 2] }} />
            </Source>
          )}

          {/* Pin del usuario */}
          {pin && (
            <Marker longitude={pin.lon} latitude={pin.lat} anchor="bottom">
              <div className="w-8 h-8 bg-brand-primary rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                <span className="text-white text-xs"></span>
              </div>
            </Marker>
          )}

          {/* Puntos DENUE */}
          {negocios.map(n => (
            <Marker key={n.id} longitude={n.lon} latitude={n.lat} anchor="center">
              <div
                title={`${n.nombre}\n${n.actividad}\n${n.calle}, ${n.colonia}`}
                className="w-3 h-3 bg-red-500 rounded-full border border-white shadow cursor-pointer hover:scale-150 transition-transform"
              />
            </Marker>
          ))}
        </Map>
      </div>

      {/* Estado y resultados */}
      {cargando && (
        <div className="text-center text-sm text-brand-muted py-4 animate-pulse">
          Consultando negocios del DENUE en 500m...
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm p-4 rounded-2xl">{error}</div>
      )}
      {negocios.length > 0 && (
        <div className="bg-white border border-brand-border rounded-2xl p-4">
          <p className="text-xs font-black text-brand-primary uppercase tracking-wider mb-3">
            {negocios.length} establecimientos encontrados en 500m
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {negocios.slice(0, 20).map(n => (
              <div key={n.id} className="text-xs bg-slate-50 rounded-xl p-2 border border-brand-border">
                <p className="font-bold text-brand-text truncate">{n.nombre}</p>
                <p className="text-brand-muted truncate">{n.actividad}</p>
              </div>
            ))}
          </div>
          {negocios.length > 20 && (
            <p className="text-xs text-brand-muted mt-2 text-center">
              + {negocios.length - 20} más · <span className="text-brand-primary font-bold cursor-pointer">Contratar análisis completo →</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}