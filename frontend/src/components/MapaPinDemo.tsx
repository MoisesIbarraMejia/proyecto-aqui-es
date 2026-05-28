/**
 * MapaPinDemo.tsx
 * Coloca en: frontend/src/components/MapaPinDemo.tsx
 *
 * Dependencias a instalar:
 *   npm install react-map-gl maplibre-gl
 */

import { useState, useCallback, useRef } from 'react';
import Map, { Marker, Source, Layer, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Search, MapPin, X, Building2, Phone, Globe, Mail, AlertCircle, Loader2 } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface NegocioDenue {
  clee: string;
  id: string;
  nombre: string;
  razon_social: string;
  clase_actividad: string;
  estrato: string;
  tipo_vialidad: string;
  calle: string;
  num_exterior: string;
  num_interior: string;
  colonia: string;
  cp: string;
  ubicacion: string;
  telefono: string;
  correo_e: string;
  sitio_internet: string;
  tipo: string;
  lon: number;
  lat: number;
  centro_comercial: string;
  tipo_centro_comercial: string;
  num_local: string;
}

interface Pin {
  lat: number;
  lon: number;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Construye el polígono del círculo buffer en coordenadas WGS84 */
function construirCirculo(lat: number, lon: number, radioM: number, pasos = 64) {
  const R = 6371000;
  const coords = Array.from({ length: pasos + 1 }, (_, i) => {
    const angulo = (i / pasos) * 2 * Math.PI;
    const dLat = (radioM / R) * (180 / Math.PI);
    const dLon = (radioM / R) * (180 / Math.PI) / Math.cos((lat * Math.PI) / 180);
    return [lon + dLon * Math.cos(angulo), lat + dLat * Math.sin(angulo)] as [number, number];
  });
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [coords] },
        properties: {},
      },
    ],
  };
}

/** Color del marcador según estrato (tamaño del negocio) */
function colorEstrato(estrato: string): string {
  const e = parseInt(estrato);
  if (e <= 1) return '#10b981'; // micro
  if (e <= 3) return '#f59e0b'; // pequeño/mediano
  return '#ef4444';             // grande
}

/** Etiqueta legible del estrato */
function etiquetaEstrato(estrato: string): string {
  const map: Record<string, string> = {
    '1': 'Micro (0-2)',
    '2': 'Pequeño (3-5)',
    '3': 'Pequeño (6-10)',
    '4': 'Mediano (11-30)',
    '5': 'Mediano (31-50)',
    '6': 'Grande (51-100)',
    '7': 'Grande (101-250)',
    '8': 'Grande (251+)',
  };
  return map[estrato] || `Estrato ${estrato}`;
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function MapaPinDemo() {
  const [pin, setPin]               = useState<Pin | null>(null);
  const [giro, setGiro]             = useState('');
  const [inputGiro, setInputGiro]   = useState('');
  const [negocios, setNegocios]     = useState<NegocioDenue[]>([]);
  const [popupNegocio, setPopupNegocio] = useState<NegocioDenue | null>(null);
  const [cargando, setCargando]     = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [hayBusqueda, setHayBusqueda] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const RADIO   = 500;

  // ── Búsqueda en DENUE ──────────────────────────────────────────────────────
  const buscarNegocios = useCallback(
    async (lat: number, lon: number, giroActual: string) => {
      if (!giroActual.trim()) return;
      setCargando(true);
      setError(null);
      setNegocios([]);
      setPopupNegocio(null);
      setHayBusqueda(true);

      try {
        const res = await fetch(
          `${API_URL}/api/denue/buscar?lat=${lat}&lon=${lon}&giro=${encodeURIComponent(giroActual)}&radio=${RADIO}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        // Filtrar puntos sin coordenadas válidas
        const validos = (data.negocios || []).filter(
          (n: NegocioDenue) => n.lat !== 0 && n.lon !== 0
        );
        setNegocios(validos);
      } catch (e: any) {
        setError(
          e.message.includes('fetch')
            ? 'No se pudo conectar con el servicio de base de datos territorial. Por favor, asegúrate de que el servidor de datos esté en funcionamiento o inténtalo más tarde.'
            : e.message
        );
      } finally {
        setCargando(false);
      }
    },
    [API_URL]
  );

  // ── Click en el mapa ───────────────────────────────────────────────────────
  const handleMapClick = useCallback(
    (evt: any) => {
      const { lng, lat } = evt.lngLat;
      setPin({ lat, lon: lng });
      setPopupNegocio(null);
      if (giro.trim()) {
        buscarNegocios(lat, lng, giro);
      }
    },
    [giro, buscarNegocios]
  );

  // ── Submit del buscador ────────────────────────────────────────────────────
  const handleBuscarSubmit = () => {
    const g = inputGiro.trim();
    if (!g) return;
    setGiro(g);
    if (pin) buscarNegocios(pin.lat, pin.lon, g);
  };

  const circuloGeoJSON = pin ? construirCirculo(pin.lat, pin.lon, RADIO) : null;

  // ── Leyenda de estratos ────────────────────────────────────────────────────
  const estratosSummary = negocios.reduce<Record<string, number>>((acc, n) => {
    const e = parseInt(n.estrato) <= 1 ? 'Micro' : parseInt(n.estrato) <= 3 ? 'Pequeño' : 'Mediano/Grande';
    acc[e] = (acc[e] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">

      {/* ── Buscador de giro ─────────────────────────────────────────────── */}
      <div className="bg-white border border-brand-border rounded-2xl p-4">
        <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-3">
          Paso 1 — Escribe el tipo de negocio que quieres analizar
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex flex-1 min-w-[220px] gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="ej: tacos, farmacia, gym, papelería..."
              className="flex-1 bg-slate-50 border border-brand-border rounded-xl px-4 py-2.5 text-sm font-medium text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary"
              value={inputGiro}
              onChange={e => setInputGiro(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBuscarSubmit()}
            />
            <button
              onClick={handleBuscarSubmit}
              disabled={!inputGiro.trim()}
              className="bg-brand-primary hover:bg-brand-text disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {pin ? 'Buscar' : 'Listo'}
            </button>
          </div>

          {/* Sugerencias rápidas */}
          <div className="flex flex-wrap gap-1.5">
            {['tacos', 'farmacia', 'gym', 'cafetería', 'ropa'].map(s => (
              <button
                key={s}
                onClick={() => { setInputGiro(s); setGiro(s); if (pin) buscarNegocios(pin.lat, pin.lon, s); }}
                className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border border-brand-border bg-slate-50 hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-all text-brand-muted"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {giro && (
          <p className="text-xs text-brand-muted mt-2">
            <span className="font-black text-brand-primary">Paso 2</span> — Haz clic en el mapa donde quieres colocar tu negocio
          </p>
        )}
      </div>

      {/* ── Mapa ─────────────────────────────────────────────────────────── */}
      <div
        className="rounded-[24px] overflow-hidden border border-brand-border shadow-premium relative"
        style={{ height: 480 }}
      >
        <Map
          initialViewState={{ longitude: -99.1332, latitude: 19.4326, zoom: 13 }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          onClick={handleMapClick}
          cursor={giro ? 'crosshair' : 'default'}
        >
          {/* Buffer circular */}
          {circuloGeoJSON && (
            <Source id="buffer" type="geojson" data={circuloGeoJSON}>
              <Layer
                id="buffer-fill"
                type="fill"
                paint={{ 'fill-color': '#004b93', 'fill-opacity': 0.06 }}
              />
              <Layer
                id="buffer-line"
                type="line"
                paint={{ 'line-color': '#004b93', 'line-width': 2, 'line-dasharray': [5, 3] }}
              />
            </Source>
          )}

          {/* Pin del usuario — ANCLA EN BOTTOM para que la punta quede en la coord */}
          {pin && (
            <Marker longitude={pin.lon} latitude={pin.lat} anchor="bottom" offset={[0, 0]}>
              <div className="flex flex-col items-center">
                <div className="w-9 h-9 bg-brand-primary rounded-full border-[3px] border-white shadow-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-white fill-white" />
                </div>
                {/* Punta del pin */}
                <div
                  style={{
                    width: 0, height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '10px solid #004b93',
                    marginTop: -1,
                  }}
                />
              </div>
            </Marker>
          )}

          {/* Marcadores DENUE */}
          {negocios.map(n => (
            <Marker
              key={n.clee || n.id}
              longitude={n.lon}
              latitude={n.lat}
              anchor="center"
              onClick={e => { e.originalEvent.stopPropagation(); setPopupNegocio(n); }}
            >
              <div
                className="cursor-pointer transition-transform hover:scale-150 hover:z-50"
                title={n.nombre}
              >
                <div
                  className="w-3 h-3 rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: colorEstrato(n.estrato) }}
                />
              </div>
            </Marker>
          ))}

          {/* Popup / Tooltip al hacer click en un negocio */}
          {popupNegocio && (
            <Popup
              longitude={popupNegocio.lon}
              latitude={popupNegocio.lat}
              anchor="bottom"
              offset={[0, -8]}
              closeButton={false}
              onClose={() => setPopupNegocio(null)}
              maxWidth="280px"
            >
              <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 min-w-[220px]">
                {/* Header */}
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-brand-primary mb-0.5">
                      {popupNegocio.clase_actividad}
                    </p>
                    <p className="text-sm font-extrabold text-brand-text leading-tight">
                      {popupNegocio.nombre || popupNegocio.razon_social}
                    </p>
                  </div>
                  <button
                    onClick={() => setPopupNegocio(null)}
                    className="text-slate-400 hover:text-slate-700 mt-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Datos */}
                <div className="space-y-1.5 text-xs text-brand-muted">
                  {/* Dirección */}
                  {(popupNegocio.calle || popupNegocio.colonia) && (
                    <div className="flex gap-1.5 items-start">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-brand-primary" />
                      <span>
                        {[
                          popupNegocio.tipo_vialidad,
                          popupNegocio.calle,
                          popupNegocio.num_exterior && `#${popupNegocio.num_exterior}`,
                          popupNegocio.colonia,
                          popupNegocio.cp && `CP ${popupNegocio.cp}`,
                        ].filter(Boolean).join(' ')}
                      </span>
                    </div>
                  )}

                  {/* Estrato */}
                  <div className="flex gap-1.5 items-center">
                    <Building2 className="w-3 h-3 flex-shrink-0 text-brand-secondary" />
                    <span>
                      <span className="font-bold">Tamaño:</span>{' '}
                      {etiquetaEstrato(popupNegocio.estrato)} empleados
                    </span>
                  </div>

                  {/* Teléfono */}
                  {popupNegocio.telefono && (
                    <div className="flex gap-1.5 items-center">
                      <Phone className="w-3 h-3 flex-shrink-0 text-brand-secondary" />
                      <span>{popupNegocio.telefono}</span>
                    </div>
                  )}

                  {/* Web */}
                  {popupNegocio.sitio_internet && (
                    <div className="flex gap-1.5 items-center">
                      <Globe className="w-3 h-3 flex-shrink-0 text-brand-secondary" />
                      <a
                        href={popupNegocio.sitio_internet}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-primary underline truncate max-w-[180px]"
                      >
                        {popupNegocio.sitio_internet}
                      </a>
                    </div>
                  )}

                  {/* Email */}
                  {popupNegocio.correo_e && (
                    <div className="flex gap-1.5 items-center">
                      <Mail className="w-3 h-3 flex-shrink-0 text-brand-secondary" />
                      <span className="truncate max-w-[180px]">{popupNegocio.correo_e}</span>
                    </div>
                  )}

                  {/* Centro comercial */}
                  {popupNegocio.centro_comercial && (
                    <div className="bg-brand-accent/60 rounded-lg px-2 py-1 text-[10px] font-bold text-brand-primary">
                      📍 {popupNegocio.centro_comercial}
                      {popupNegocio.num_local && ` — Local ${popupNegocio.num_local}`}
                    </div>
                  )}
                </div>

                {/* Badge estrato */}
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: colorEstrato(popupNegocio.estrato) }}
                  />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {etiquetaEstrato(popupNegocio.estrato)}
                  </span>
                </div>
              </div>
            </Popup>
          )}
        </Map>

        {/* Overlay de instrucciones cuando no hay pin */}
        {!pin && giro && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm border border-brand-border rounded-2xl px-6 py-4 shadow-premium text-center">
              <MapPin className="w-8 h-8 text-brand-primary mx-auto mb-2" />
              <p className="text-sm font-extrabold text-brand-text">Haz clic en el mapa</p>
              <p className="text-xs text-brand-muted mt-1">
                Marca el punto donde quieres analizar
              </p>
            </div>
          </div>
        )}

        {/* Overlay inicial sin giro */}
        {!giro && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm border border-brand-border rounded-2xl px-6 py-4 shadow-premium text-center">
              <Search className="w-8 h-8 text-brand-primary mx-auto mb-2" />
              <p className="text-sm font-extrabold text-brand-text">Escribe tu tipo de negocio</p>
              <p className="text-xs text-brand-muted mt-1">
                Usa el buscador de arriba para comenzar
              </p>
            </div>
          </div>
        )}

        {/* Leyenda de colores en esquina inferior izquierda */}
        {negocios.length > 0 && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Tamaño del negocio</p>
            <div className="space-y-1">
              {[
                { color: '#10b981', label: 'Micro (0-2 emp.)' },
                { color: '#f59e0b', label: 'Pequeño (3-10 emp.)' },
                { color: '#ef4444', label: 'Mediano/Grande (11+)' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] text-slate-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loader spinner sobre el mapa */}
        {cargando && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center">
            <div className="bg-white rounded-2xl px-6 py-4 shadow-premium flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-brand-primary animate-spin" />
              <p className="text-sm font-bold text-brand-text">Consultando DENUE...</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm p-4 rounded-2xl flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-xs uppercase tracking-wider mb-1">Error de conexión</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* ── Resultados ───────────────────────────────────────────────────── */}
      {hayBusqueda && !cargando && !error && (
        <div className="bg-white border border-brand-border rounded-2xl p-5">
          {negocios.length === 0 ? (
            <p className="text-sm text-brand-muted text-center py-4">
              No se encontraron negocios de <strong>"{giro}"</strong> en 500m. Intenta con otro término.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-black text-brand-primary uppercase tracking-wider">
                    {negocios.length} establecimientos de "{giro}" en 500m
                  </p>
                  <p className="text-[10px] text-brand-muted mt-0.5">
                    Haz clic sobre cualquier punto del mapa para ver el detalle
                  </p>
                </div>
                {/* Mini resumen estratos */}
                <div className="flex gap-2">
                  {Object.entries(estratosSummary).map(([label, count]) => (
                    <div key={label} className="text-center">
                      <p className="text-sm font-black text-brand-text">{count}</p>
                      <p className="text-[9px] text-brand-muted uppercase">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lista de negocios (máx 12 en demo) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                {negocios.slice(0, 12).map(n => (
                  <button
                    key={n.clee || n.id}
                    onClick={() => setPopupNegocio(n)}
                    className="text-left text-xs bg-slate-50 hover:bg-brand-accent/50 rounded-xl p-2.5 border border-brand-border transition-colors group"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: colorEstrato(n.estrato) }}
                      />
                      <p className="font-bold text-brand-text truncate group-hover:text-brand-primary transition-colors">
                        {n.nombre || n.razon_social}
                      </p>
                    </div>
                    <p className="text-brand-muted truncate pl-4">{n.clase_actividad}</p>
                  </button>
                ))}
              </div>

              {/* CTA si hay más resultados */}
              {negocios.length > 12 && (
                <div className="mt-4 pt-4 border-t border-brand-border text-center">
                  <p className="text-xs text-brand-muted mb-2">
                    Mostrando 12 de {negocios.length} establecimientos encontrados
                  </p>
                  <button className="bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl hover:bg-brand-text transition-all">
                    Ver análisis completo — Contratar servicio
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}