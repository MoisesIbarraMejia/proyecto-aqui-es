import React, { useState, useEffect } from 'react';
import MapaPinDemo from './components/MapaPinDemo.tsx';
import MapaHeroEstatico from './components/MapaHeroEstatico.tsx';
import { 
  Compass, 
  MapPin, 
  Layers, 
  Activity, 
  Navigation, 
  ShieldCheck, 
  CheckCheck, 
  ChevronRight, 
  Globe, 
  Search, 
  FileText, 
  AlertCircle, 
  RefreshCw, 
  Wifi, 
  TrendingUp,
  Sliders,
  DollarSign
} from 'lucide-react';

// ==========================================
// TYPES & SCHEMAS FOR CUSTOM USER API
// ==========================================

export interface GISLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  trafficIndex: number; // Scale 1 - 100
  competitionDensity: number; // Scale 1 - 100
  targetMatchScore: number; // Percentage Match (0 - 100)
  revenueProjection: number; // Projected annual revenue in USD
  demographicGroup: string; // e.g. "Pre-Family", "High-Net Worth", "Young Professional"
  category: string; // e.g. "Retail", "Logistics", "Office"
}

export interface GISApiResponse {
  success: boolean;
  city: string;
  timestamp: string;
  source: "live-api" | "local-simulated";
  data: GISLocation[];
  summary: {
    totalLocations: number;
    averageTraffic: number;
    overallRecommendation: string;
  };
}

// ==========================================
// MEXICAN STATES & DEFAULT DENUE DATA
// ==========================================

const MEXICAN_STATES = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas"
];

// Estados por defecto mostrados
const DEFAULT_STATES = ["Aguascalientes", "Ciudad de México", "Jalisco", "Veracruz", "Estado de México"];

// Mock data de ejemplo - estructura similar a DENUE
const MOCK_DENUE = {
  "Aguascalientes": [
    { id: "ags-01", name: "COCINA MEXICANA", latitude: 21.85885443, longitude: -102.28254550, Clase_actividad: "Restaurantes que preparan otro tipo de alimentos para llevar", Estrato: "0 a 5 personas", Ubicacion: "AGUASCALIENTES, Aguascalientes, AGUASCALIENTES", Colonia: "MÉXICO", trafficIndex: 75, competitionDensity: 60, targetMatchScore: 85, revenueProjection: 350000, demographicGroup: "Alimentos", category: "Restaurante" },
    { id: "ags-02", name: "TIENDA ABARROTES", latitude: 21.86100000, longitude: -102.27950000, Clase_actividad: "Tiendas de abarrotes", Estrato: "0 a 5 personas", Ubicacion: "AGUASCALIENTES, Aguascalientes, AGUASCALIENTES", Colonia: "CENTRO", trafficIndex: 68, competitionDensity: 70, targetMatchScore: 80, revenueProjection: 280000, demographicGroup: "Retail", category: "Comercio" }
  ],
  "Ciudad de México": [
    { id: "cdmx-01", name: "PASEO DE LA REFORMA FINANCE", latitude: 19.4271, longitude: -99.1676, Clase_actividad: "Servicios Financieros", Estrato: "10 a 50 personas", Ubicacion: "CIUDAD DE MÉXICO, Cuauhtémoc, MÉXICO", Colonia: "CUAUHTÉMOC", trafficIndex: 98, competitionDensity: 85, targetMatchScore: 94, revenueProjection: 810000, demographicGroup: "Corporativo", category: "Finanzas" },
    { id: "cdmx-02", name: "RESTAURANT POLANCO", latitude: 19.4312, longitude: -99.2007, Clase_actividad: "Restaurantes con servicio de comidas", Estrato: "10 a 50 personas", Ubicacion: "CIUDAD DE MÉXICO, Miguel Hidalgo, MÉXICO", Colonia: "POLANCO", trafficIndex: 91, competitionDensity: 80, targetMatchScore: 97, revenueProjection: 920000, demographicGroup: "Premium", category: "Alimentos" }
  ],
  "Jalisco": [
    { id: "jal-01", name: "COMERCIO GUADALAJARA", latitude: 20.6596, longitude: -103.2497, Clase_actividad: "Comercio al por menor", Estrato: "5 a 10 personas", Ubicacion: "JALISCO, Guadalajara, MÉXICO", Colonia: "CENTRO", trafficIndex: 80, competitionDensity: 75, targetMatchScore: 88, revenueProjection: 420000, demographicGroup: "Retail", category: "Comercio" }
  ],
  "Veracruz": [
    { id: "ver-01", name: "NEGOCIOS VERACRUZ", latitude: 19.2000, longitude: -96.1333, Clase_actividad: "Servicios varios", Estrato: "0 a 5 personas", Ubicacion: "VERACRUZ, Veracruz, MÉXICO", Colonia: "PUERTO", trafficIndex: 70, competitionDensity: 55, targetMatchScore: 75, revenueProjection: 300000, demographicGroup: "General", category: "Servicios" }
  ],
  "Estado de México": [
    { id: "edomx-01", name: "PLAZA COMERCIAL TOLUCA", latitude: 19.2887, longitude: -99.6547, Clase_actividad: "Comercio al por menor", Estrato: "10 a 50 personas", Ubicacion: "ESTADO DE MÉXICO, Toluca, MÉXICO", Colonia: "CENTRO", trafficIndex: 76, competitionDensity: 68, targetMatchScore: 82, revenueProjection: 380000, demographicGroup: "Retail", category: "Comercio" }
  ]
};

export default function App() {
  // Navigation active tab
  const [activeMenu, setActiveMenu] = useState<'home' | 'simulator' | 'api' | 'setup'>('home');
  
  // Carga de datos personalizados
  const [apiUrl, setApiUrl] = useState<string>('https://datos.geoanalitica.io/ejemplo_locales_candidatos.json');
  const [apiHeaderName, setApiHeaderName] = useState<string>('');
  const [apiHeaderVal, setApiHeaderVal] = useState<string>('');
  const [isApiLoading, setIsApiLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Loaded Dataset (Can come from Live API or our simulated data)
  const [currentStateName, setCurrentStateName] = useState<string>("Aguascalientes");
  const [dataset, setDataset] = useState<GISLocation[]>(MOCK_DENUE["Aguascalientes"]);
  const [dataSource, setDataSource] = useState<"live-api" | "local-simulated">("local-simulated");
  const [apiResponseFull, setApiResponseFull] = useState<any | null>(null);

  // State search filter
  const [stateSearchQuery, setStateSearchQuery] = useState<string>("");
  
  // Selector filters
  const [selectedLocation, setSelectedLocation] = useState<GISLocation | null>(MOCK_DENUE["Aguascalientes"][0]);
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [mapLayer, setMapLayer] = useState<'traffic' | 'competition' | 'demographics'>('traffic');

  // Contact Form Feedback
  const [contactSubmitted, setContactSubmitted] = useState<boolean>(false);
  const [auditoriaForm, setAuditoriaForm] = useState({
    nombre: '',
    email: '',
    marca: '',
    sector: 'retail',
    mensaje: ''
  });

  // Automatically update selected location when city changes
  useEffect(() => {
    if (dataset.length > 0) {
      setSelectedLocation(dataset[0]);
    } else {
      setSelectedLocation(null);
    }
  }, [dataset]);

  // Handle local state simulation selection
  const handleSelectState = (stateName: string) => {
    setCurrentStateName(stateName);
    setDataset(MOCK_DENUE[stateName as keyof typeof MOCK_DENUE] || []);
    setDataSource("local-simulated");
    setApiResponseFull(null);
    setApiError(null);
    setStateSearchQuery("");
  };
  
  // Filter states based on search query
  const filteredStates = MEXICAN_STATES.filter((state) =>
    state.toLowerCase().includes(stateSearchQuery.toLowerCase())
  );
  
  // Get visible states (default + search results)
  const visibleStates = stateSearchQuery.length > 0 ? filteredStates : DEFAULT_STATES;

  // Test Fetch API Client
  const handleTestApiFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsApiLoading(true);
    setApiError(null);
    setApiResponseFull(null);

    const headersObj: { [key: string]: string } = {};
    if (apiHeaderName && apiHeaderVal) {
      headersObj[apiHeaderName] = apiHeaderVal;
    }

    try {
      // Create a reasonable abort timeout of 5s
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(apiUrl, {
        headers: headersObj,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Error Status: ${response.status} (${response.statusText})`);
      }

      const json = await response.json();
      setApiResponseFull(json);

      // Validate if the JSON format contains geo data
      let parsedLocations: GISLocation[] = [];

      if (Array.isArray(json)) {
        parsedLocations = json;
      } else if (json.data && Array.isArray(json.data)) {
        parsedLocations = json.data;
      } else if (json.locations && Array.isArray(json.locations)) {
        parsedLocations = json.locations;
      } else {
        throw new Error("El JSON no tiene un array de localizaciones detectable en la raíz o en una propiedad '.data' o '.locations'.");
      }

      // Ensure locations have basic schema
      const santized = parsedLocations.map((item: any, idx: number) => ({
        id: item.id || `api-${idx}`,
        name: item.name || `Punto ${idx + 1}`,
        latitude: Number(item.latitude || item.lat || 40.4168),
        longitude: Number(item.longitude || item.lng || -3.7038),
        trafficIndex: Number(item.trafficIndex || item.traffic || 70),
        competitionDensity: Number(item.competitionDensity || item.competition || 50),
        targetMatchScore: Number(item.targetMatchScore || item.score || item.fit || 80),
        revenueProjection: Number(item.revenueProjection || item.projectedSales || item.sales || 250000),
        demographicGroup: item.demographicGroup || item.demographics || "Público General",
        category: item.category || "Retail"
      }));

      setDataset(santized);
      setDataSource("live-api");
      setCurrentStateName("Archivo de Datos");
      
    } catch (err: any) {
      console.error(err);
      if (err.name === 'AbortError') {
        setApiError("La carga superó el tiempo límite de 5 segundos. Puedes usar la simulación comercial para pruebas.");
      } else {
        setApiError("Error al cargar el archivo de datos. Por favor, asegúrate de que el enlace sea válido y el archivo esté en formato de coordenadas públicas.");
      }
      setDataSource("local-simulated");
    } finally {
      setIsApiLoading(false);
    }
  };

  // Generate Sample JSON structure string for user reference
  const expectedJsonExample = JSON.stringify({
    success: true,
    city: "Madrid, ES",
    timestamp: "2026-05-25T22:15:00Z",
    data: [
      {
        id: "loc-01",
        name: "Gran Vía Premium Core",
        latitude: 40.4200,
        longitude: -3.7038,
        trafficIndex: 94,
        competitionDensity: 75,
        targetMatchScore: 92,
        revenueProjection: 450000,
        demographicGroup: "Premium Retail",
        category: "Retail"
      },
      {
        id: "loc-02",
        name: "Atocha Logistics Hub",
        latitude: 40.4069,
        longitude: -3.6901,
        trafficIndex: 85,
        competitionDensity: 30,
        targetMatchScore: 80,
        revenueProjection: 520000,
        demographicGroup: "High Mobility",
        category: "Logistics"
      }
    ]
  }, null, 2);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans selection:bg-brand-primary/20 antialiased flex flex-col justify-between">
      
      {/* ================= HEADER & NAV ================= */}
      <nav id="navbar" className="fixed top-0 left-0 right-0 z-50 glass border-b border-brand-border px-6 md:px-12 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveMenu('home')}>
            <div className="w-10 h-10 bg-brand-primary rounded-xl shadow-md flex items-center justify-center text-white transition-transform hover:rotate-12">
              <Compass className="w-6 h-6" />
            </div>
            <span className="font-sans font-extrabold text-2xl uppercase tracking-tight">
              Geo<span className="text-brand-primary italic">Analítica</span>
            </span>
          </div>

          {/* Nav items */}
          <div className="flex items-center gap-2 md:gap-8">
            <div className="hidden lg:flex items-center gap-8 text-[11px] font-black uppercase tracking-[0.2em] text-brand-text/70 mr-4">
              <button 
                onClick={() => setActiveMenu('home')} 
                className={`transition-colors py-2 hover:text-brand-primary ${activeMenu === 'home' ? 'text-brand-primary border-b-2 border-brand-primary' : ''}`}
              >
                Inicio
              </button>
              <button 
                onClick={() => setActiveMenu('simulator')} 
                className={`transition-colors py-2 hover:text-brand-primary ${activeMenu === 'simulator' ? 'text-brand-primary border-b-2 border-brand-primary' : ''}`}
              >
                Simulador de Ubicación
              </button>
              <button 
                onClick={() => setActiveMenu('api')} 
                className={`transition-colors py-2 hover:text-brand-primary ${activeMenu === 'api' ? 'text-brand-primary border-b-2 border-brand-primary' : ''}`}
              >
                Estudios de Viabilidad
              </button>
              <button 
                onClick={() => setActiveMenu('setup')} 
                className={`transition-colors py-2 hover:text-brand-primary ${activeMenu === 'setup' ? 'text-brand-primary border-b-2 border-brand-primary' : ''}`}
              >
                Guías de Expansión
              </button>
            </div>

            {/* CTA action buttons */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveMenu('simulator')}
                className="bg-brand-primary hover:bg-brand-text text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-premium"
              >
                Explorar Zonas
              </button>
              <button 
                onClick={() => setActiveMenu('api')}
                className="bg-zinc-100 hover:bg-brand-primary/10 text-brand-text border border-brand-border px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hidden sm:inline"
              >
                Analizar Ubicación
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ================= MAIN WRAPPER ================= */}
      <main className="flex-grow pt-24">

        {/* SECTION 1: LANDING PAGE & ECOSYSTEM (HOME) */}
        {activeMenu === 'home' && (
          <div>
            
            {/* Hero Banner */}
            <section className="relative pt-24 pb-28 px-6 md:px-12 overflow-hidden flex flex-col justify-center bg-white border-b border-brand-border">
              <div className="absolute inset-0 opacity-40 pointer-events-none">
                <div className="absolute inset-0 immersive-grid opacity-30"></div>
                <div className="absolute top-1/4 left-1/4 w-[700px] h-[700px] bg-brand-primary/5 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-brand-secondary/5 blur-[120px] rounded-full"></div>
              </div>
              
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10 w-full">
                <div className="lg:col-span-6">
                  {/* Badge */}
                  <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-brand-primary/5 border border-brand-primary/10 rounded-full mb-8">
                    <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-primary">INTELIGENCIA TERRITORIAL Y GEOMARKETING</span>
                  </div>
                  
                  <h1 className="text-4xl sm:text-6xl lg:text-7xl font-sans font-black text-brand-text leading-[0.95] mb-8 tracking-tight">
                    Encuentra la mejor <br />
                    <span className="text-brand-primary bg-clip-text">ubicación para tu negocio</span>
                  </h1>
                  
                  <p className="text-lg md:text-xl text-brand-muted mb-10 leading-relaxed max-w-xl font-medium">
                    Analizamos información espacial, movilidad y características territoriales para ayudarte a elegir la zona ideal.
                  </p>
                  
                  <div className="flex flex-wrap gap-4 mb-16">
                    <button 
                      onClick={() => setActiveMenu('simulator')}
                      className="bg-brand-text text-white px-8 py-4.5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-primary transition-all shadow-premium flex items-center gap-3"
                    >
                      Explorar zonas <ChevronRight className="w-4 h-4 text-brand-secondary" />
                    </button>
                    <button 
                      onClick={() => setActiveMenu('api')}
                      className="bg-white border border-brand-border text-brand-text hover:bg-brand-accent/30 px-8 py-4.5 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
                    >
                      Analizar ubicación
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-6 border-t border-brand-border pt-8 max-w-md">
                    <div>
                      <div className="text-3xl font-black text-brand-text tracking-tight">98.4%</div>
                      <div className="text-[9px] uppercase tracking-[0.2em] text-brand-muted font-black mt-1">Precisión Comercial</div>
                    </div>
                    <div>
                      <div className="text-3xl font-black text-brand-text tracking-tight">3.2M+</div>
                      <div className="text-[9px] uppercase tracking-[0.2em] text-brand-muted font-black mt-1">Comercios Mapeados</div>
                    </div>
                    <div>
                      <div className="text-3xl font-black text-brand-text tracking-tight">INEGI</div>
                      <div className="text-[9px] uppercase tracking-[0.2em] text-brand-muted font-black mt-1">Datos Oficiales DENUE</div>
                    </div>
                  </div>
                </div>
                
                {/* Visual Premium Mockup on Right */}
                <div className="lg:col-span-6 relative h-[520px] md:h-[580px]">
                  <MapaHeroEstatico />
                </div>
              </div>
            </section>

            {/* Trusted Brands Slider */}
            <div className="bg-white py-12 border-b border-brand-border overflow-hidden">
              <div className="max-w-7xl mx-auto px-6">
                <p className="text-center text-[10px] font-black text-brand-muted/50 uppercase tracking-[0.4em] mb-8">
                  CONFIANZA TOTAL EN LA AUDITORÍA DE EXPANSIÓN COMERCIAL
                </p>
                <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 grayscale opacity-50">
                  <div className="flex items-center gap-2 font-black text-xl tracking-tight">RETAIL<span className="text-brand-primary">CORP</span></div>
                  <div className="flex items-center gap-2 font-black text-xl tracking-tight">CITY<span className="text-brand-primary">LOGIX</span></div>
                  <div className="flex items-center gap-2 font-black text-xl tracking-tight">GLOBAL<span className="text-[#0088cc]">ESTATES</span></div>
                  <div className="flex items-center gap-2 font-black text-xl tracking-tight">SMART<span className="text-brand-primary">URBAN</span></div>
                </div>
              </div>
            </div>

            {/* Interactive Section Intro */}
            <section id="features" className="py-24 px-6 bg-brand-accent/10">
              <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
                  <div className="lg:col-span-5">
                    <span className="text-[11px] font-black text-brand-primary uppercase tracking-[0.3em]">DECISIONES CON CERTEZA CIENTÍFICA</span>
                    <h2 className="text-3xl sm:text-5xl font-black text-brand-text leading-tight mt-4 mb-6">
                      ¿Por qué es clave el análisis territorial?
                    </h2>
                    <p className="text-brand-muted leading-relaxed mb-8">
                      Más del 80% de los negocios locales fracasan en sus primeros dos años debido a una mala ubicación. GeoAnalítica mapea científicamente la movilidad urbana, la densidad de competidores y el perfil demográfico para asegurar el éxito de tu inversión.
                    </p>

                    <div className="space-y-6">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary flex-shrink-0">
                          <CheckCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-brand-text mb-1">Flujo y Movilidad Peatonal</h4>
                          <p className="text-sm text-brand-muted">Análisis verificado de afluencia peatonal y accesibilidad en cada tramo de calle.</p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary flex-shrink-0">
                          <CheckCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-brand-text mb-1">Estudio de Competencia Real</h4>
                          <p className="text-sm text-brand-muted">Mapeo del tamaño de negocios competidores para evitar la saturación comercial de la zona.</p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary flex-shrink-0">
                          <CheckCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-brand-text mb-1">Perfil Sociodemográfico</h4>
                          <p className="text-sm text-brand-muted">Información detallada sobre nivel de ingresos, edad y hábitos de consumo del vecindario.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Core capabilities list cards */}
                  <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-[32px] border border-brand-border hover:shadow-premium transition-shadow group">
                      <div className="w-12 h-12 rounded-xl bg-brand-accent flex items-center justify-center text-brand-primary mb-6 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <h3 className="font-extrabold text-xl text-brand-text mb-3">Análisis de Ubicación</h3>
                      <p className="text-sm text-brand-muted leading-relaxed">
                        Evaluación comercial integral de locales considerando factores de visibilidad, accesos y compatibilidad con el entorno urbano.
                      </p>
                    </div>

                    <div className="bg-white p-8 rounded-[32px] border border-brand-border hover:shadow-premium transition-shadow group">
                      <div className="w-12 h-12 rounded-xl bg-brand-accent flex items-center justify-center text-brand-primary mb-6 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                        <Layers className="w-6 h-6" />
                      </div>
                      <h3 className="font-extrabold text-xl text-brand-text mb-3">Estudios Demográficos</h3>
                      <p className="text-sm text-brand-muted leading-relaxed">
                        Acceso a datos cruzados de población local y flotante, distribución de edades y capacidad de compra promedio por manzana.
                      </p>
                    </div>

                    <div className="bg-white p-8 rounded-[32px] border border-brand-border hover:shadow-premium transition-shadow group">
                      <div className="w-12 h-12 rounded-xl bg-brand-accent flex items-center justify-center text-brand-primary mb-6 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                        <Navigation className="w-6 h-6" />
                      </div>
                      <h3 className="font-extrabold text-xl text-brand-text mb-3">Movilidad y Conectividad</h3>
                      <p className="text-sm text-brand-muted leading-relaxed">
                        Visualización de flujos peatonales, cercanía al transporte público y conectividad vial para entender la accesibilidad.
                      </p>
                    </div>

                    <div className="bg-white p-8 rounded-[32px] border border-brand-border hover:shadow-premium transition-shadow group">
                      <div className="w-12 h-12 rounded-xl bg-brand-accent flex items-center justify-center text-brand-primary mb-6 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <h3 className="font-extrabold text-xl text-brand-text mb-3">Potencial Comercial</h3>
                      <p className="text-sm text-brand-muted leading-relaxed">
                        Modelado geoespacial predictivo para estimar la viabilidad y demanda del giro de tu negocio en la zona elegida.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Testimonials and Proof Banner */}
            <section className="bg-brand-text text-white py-24 px-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-1/3 h-full opacity-5 pointer-events-none">
                <ShieldCheck className="w-full h-full text-white" />
              </div>
              <div className="max-w-5xl mx-auto text-center relative z-10">
                <span className="text-[11px] font-black text-brand-secondary uppercase tracking-[0.3em]">CLIENT SUCCESS CASE</span>
                <blockquote className="text-2xl sm:text-4xl font-light italic leading-relaxed mt-6 mb-8 max-w-4xl mx-auto">
                  "Gracias a la precisión predictiva de GeoAnalítica Pro, identificamos ubicaciones alternativas en las que proyectábamos un flujo de caja un 35% superior, reduciendo el riesgo de inversión a cero en nuestra expansión."
                </blockquote>
                <div className="h-0.5 w-16 bg-brand-secondary mx-auto mb-6"></div>
                <p className="font-black text-xs uppercase tracking-widest text-[#0088cc]">DIRECTOR DE EXPANSIÓN ESTRATÉGICA // MULTINACIONAL DE RETAIL</p>
              </div>
            </section>

            {/* Auditoria / Contact form */}
            <section id="contacto" className="py-24 px-6 bg-white">
              <div className="max-w-3xl mx-auto border border-brand-border rounded-[40px] p-8 md:p-14 shadow-premium">
                <div className="text-center mb-10">
                  <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.3em]">ANÁLISIS PRIVADO</span>
                  <h3 className="text-3xl font-black text-brand-text mt-2 font-sans tracking-tight">Solicita una Auditoría Técnica</h3>
                  <p className="text-brand-muted text-sm mt-3">Introduce detalles básicos y nuestro arquitecto GIS diseñará un modelado demo sin costo para tu negocio.</p>
                </div>

                {contactSubmitted ? (
                  <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-3xl text-center">
                    <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4">
                      <CheckCheck className="w-6 h-6" />
                    </div>
                    <h4 className="font-extrabold text-emerald-950 text-lg">¡Solicitud Registrada con Éxito!</h4>
                    <p className="text-emerald-800 text-sm mt-2">Nuestro equipo técnico te contactará en las próximas 4 horas hábiles para coordinar la entrega espacial.</p>
                    <button 
                      onClick={() => setContactSubmitted(false)}
                      className="mt-6 text-xs text-brand-primary font-black uppercase tracking-widest hover:underline"
                    >
                      Enviar otra consulta
                    </button>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); setContactSubmitted(true); }} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-brand-text">Tu Nombre completo</label>
                        <input 
                          type="text" 
                          required
                          placeholder="p. ej. Carlos Mendoza" 
                          className="w-full bg-slate-50 border border-brand-border rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                          value={auditoriaForm.nombre}
                          onChange={e => setAuditoriaForm({...auditoriaForm, nombre: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-brand-text">Correo Profesional</label>
                        <input 
                          type="email" 
                          required
                          placeholder="carlos@mimunicipio.com" 
                          className="w-full bg-slate-50 border border-brand-border rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                          value={auditoriaForm.email}
                          onChange={e => setAuditoriaForm({...auditoriaForm, email: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-brand-text">Nombre de Empresa / Marca</label>
                        <input 
                          type="text" 
                          required
                          placeholder="p. ej. RetailCorp España" 
                          className="w-full bg-slate-50 border border-brand-border rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                          value={auditoriaForm.marca}
                          onChange={e => setAuditoriaForm({...auditoriaForm, marca: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-brand-text">Sector Comercial Primario</label>
                        <select 
                          className="w-full bg-slate-50 border border-brand-border rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                          value={auditoriaForm.sector}
                          onChange={e => setAuditoriaForm({...auditoriaForm, sector: e.target.value})}
                        >
                          <option value="retail">Supermercados y Retail General</option>
                          <option value="logistica">Logística y Bodegas</option>
                          <option value="alimentos">Alimentos y Franquicias</option>
                          <option value="gobierno">Gobierno / Urbanismo</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-brand-text">Mensaje o Pregunta Espacial</label>
                      <textarea 
                        rows={3}
                        placeholder="Menciona las ciudades de tu interés o tus dudas sobre los reportes geoespaciales" 
                        className="w-full bg-slate-50 border border-brand-border rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        value={auditoriaForm.mensaje}
                        onChange={e => setAuditoriaForm({...auditoriaForm, mensaje: e.target.value})}
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full bg-brand-primary hover:bg-brand-text text-white p-4.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-premium"
                    >
                      SOLICITAR AUDITORÍA GEOESPACIAL GRATIS
                    </button>
                  </form>
                )}
              </div>
            </section>

          </div>
        )}

        {/* SECTION 2: THE INTERACTIVE GIS WORKBENCH (SIMULATOR) */}
        {activeMenu === 'simulator' && (
          <section className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-10 pb-8 border-b border-brand-border">
              <div>
                <div className="flex items-center gap-2 text-brand-primary">
                  <Compass className="w-5 h-5 text-brand-primary" />
                  <span className="text-xs font-black uppercase tracking-widest">Panel de Control Territorial</span>
                </div>
                <h2 className="text-4xl font-extrabold text-brand-text tracking-tight mt-2">Explora los negocios cercanos a tu área de análisis</h2>
                <p className="text-brand-muted mt-2 text-sm max-w-2xl">
                  Explora analíticas territoriales. Elige una de nuestras ciudades demo o carga tu propio archivo de coordenadas para visualizar tus locales candidatos en vivo.
                </p>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-3 bg-white border border-brand-border p-3.5 rounded-2xl shadow-sm">
                <span className={`w-3 h-3 rounded-full ${dataSource === 'live-api' ? 'bg-emerald-500 animate-pulse' : 'bg-brand-primary animate-pulse'}`}></span>
                <div>
                  <p className="text-[9px] font-black uppercase text-brand-muted tracking-wider">Origen de la Información</p>
                  <p className="text-xs font-extrabold text-brand-text">
                    {dataSource === 'live-api' ? 'DATOS DE CLIENTE CARGADOS' : `SIMULACIÓN COMERCIAL: "${currentStateName}"`}
                  </p>
                </div>
              </div>
            </div>

            {/* Grid Layout: Map Box Left, Control Panel Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Interactive GIS Map Canvas Container */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                

                {/* <div className="bg-slate-950 border border-slate-900 rounded-[32px] h-[550px] relative overflow-hidden shadow-premium flex flex-col justify-between p-6">
                  
                  <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                  }}></div>

                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30 select-none">
                    <div className="w-[120%] h-[120%] border-2 border-slate-850/50 rounded-full flex items-center justify-center">
                      <div className="w-[80%] h-[80%] border-2 border-slate-800/30 rounded-full flex items-center justify-center">
                        <div className="w-[50%] h-[50%] border-2 border-slate-750/30 rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 flex flex-wrap justify-between items-center gap-3 bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-zinc-500 font-extrabold uppercase tracking-widest">Capas Activas:</span>
                      <div className="flex gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                        <button 
                          onClick={() => setMapLayer('traffic')}
                          className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg transition-colors ${mapLayer === 'traffic' ? 'bg-brand-primary text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                          Tráfico Peatonal
                        </button>
                        <button 
                          onClick={() => setMapLayer('competition')}
                          className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg transition-colors ${mapLayer === 'competition' ? 'bg-brand-secondary text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                          Competencia
                        </button>
                        <button 
                          onClick={() => setMapLayer('demographics')}
                          className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg transition-colors ${mapLayer === 'demographics' ? 'bg-[#9333ea] text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                          Demografía
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <span className="text-[9px] bg-slate-800 text-slate-300 font-mono px-2 py-1 rounded">COORD_REF: EPSG:4326</span>
                    </div>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-full h-full max-w-[450px] max-h-[350px]">
                      {dataset.map((loc, index) => {
                        // Spread them slightly based on key info
                        const xOffset = ((loc.longitude * 1000) % 90) + 5; // offset 5% - 95%
                        const yOffset = ((loc.latitude * 1000) % 70) + 15; // offset 15% - 85%

                        // Determine size based on active layer index value
                        let metricVal = loc.trafficIndex;
                        let metricColor = "bg-brand-primary shadow-[0_0_20px_#004b93]";
                        if (mapLayer === 'competition') {
                          metricVal = loc.competitionDensity;
                          metricColor = "bg-brand-secondary shadow-[0_0_20px_#0088cc]";
                        } else if (mapLayer === 'demographics') {
                          metricVal = loc.targetMatchScore;
                          metricColor = "bg-purple-600 shadow-[0_0_20px_#9333ea]";
                        }

                        // Determine circle dimensions based on values
                        const dimensions = Math.max(16, Math.min(48, metricVal / 2));

                        return (
                          <div 
                            key={loc.id}
                            className="absolute pointer-events-auto transition-transform hover:scale-125 cursor-pointer flex flex-col items-center justify-center group"
                            style={{ 
                              left: `${xOffset}%`, 
                              top: `${yOffset}%` 
                            }}
                            onClick={() => setSelectedLocation(loc)}
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className={`absolute w-12 h-12 rounded-full opacity-10 animate-ping ${metricColor}`}></span>
                            </div>
                            <div 
                              className={`rounded-full transition-transform border border-white flex items-center justify-center text-[8px] text-white font-extrabold ${metricColor} ${selectedLocation?.id === loc.id ? 'ring-4 ring-white' : ''}`}
                              style={{ 
                                width: `${dimensions}px`, 
                                height: `${dimensions}px`
                              }}
                            >
                              {metricVal}%
                            </div>
                            
                            <div className="absolute -bottom-8 scale-0 group-hover:scale-100 transition-transform bg-zinc-900 border border-zinc-800 text-[9px] font-black text-white px-2 py-1 rounded shadow-xl whitespace-nowrap z-30">
                              {loc.name}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="relative z-10 bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-slate-800 flex flex-wrap justify-between items-center gap-3">
                    <div className="flex gap-6 text-[10px] text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-primary inline-block"></span>
                        <span>Flujo Elevado (&gt;80%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-secondary inline-block"></span>
                        <span>Saturación Comercial</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block"></span>
                        <span>Coincidencia Target</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-1.5 rounded-lg text-[10px] font-bold text-zinc-400">
                      <Wifi className="w-3.5 h-3.5 text-brand-secondary" />
                      <span>{dataset.length} locales mapeados</span>
                    </div>
                  </div>

                </div> */}
                <MapaPinDemo />

                {/* Visual statistics card for custom data loaded from API */}
                {dataSource === 'live-api' && (
                  <div className="bg-white border border-brand-border p-6 rounded-[32px] shadow-premium">
                    <div className="flex justify-between items-center border-b border-brand-border pb-3 mb-4">
                      <span className="text-[10px] font-black text-brand-primary uppercase tracking-wider flex items-center gap-2">
                        <CheckCheck className="w-4 h-4 text-brand-green" /> locales candidatos cargados con éxito
                      </span>
                      <span className="text-[9px] bg-emerald-50 text-brand-green border border-brand-green/20 px-2.5 py-0.5 rounded-full font-black uppercase">Activo</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-brand-text">
                      <div>
                        <p className="text-[9px] text-brand-muted uppercase font-black tracking-wider">Total Locales</p>
                        <p className="text-xl font-extrabold text-brand-text mt-1">{dataset.length} puntos</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-brand-muted uppercase font-black tracking-wider">Promedio de Tráfico</p>
                        <p className="text-xl font-extrabold text-brand-text mt-1">
                          {dataset.length > 0 ? Math.round(dataset.reduce((sum, item) => sum + item.trafficIndex, 0) / dataset.length) : 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-brand-muted uppercase font-black tracking-wider">Saturación Promedio</p>
                        <p className="text-xl font-extrabold text-brand-text mt-1">
                          {dataset.length > 0 ? Math.round(dataset.reduce((sum, item) => sum + item.competitionDensity, 0) / dataset.length) : 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-brand-muted uppercase font-black tracking-wider">Origen de Datos</p>
                        <p className="text-xl font-extrabold text-brand-primary mt-1 truncate" title={apiUrl}>
                          Personalizado
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Location stats, filters and selectors */}
              <div className="lg:col-span-4 flex flex-col gap-6">

                {/* Switch Data source dropdown selector */}
                <div className="bg-white border border-brand-border p-6 rounded-[32px] shadow-sm">
                  <h4 className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] mb-4">Zona de Análisis</h4>
                  
                  <div className="space-y-3">
                    <label className="text-[11px] font-bold text-brand-muted uppercase block">Seleccionar Estado:</label>
                    
                    {/* Search Input */}
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-brand-muted" />
                      <input 
                        type="text" 
                        placeholder="Buscar estado..." 
                        value={stateSearchQuery}
                        onChange={(e) => setStateSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 text-sm border border-brand-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary bg-slate-50"
                      />
                    </div>
                    
                    {/* States Grid */}
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {visibleStates.map((state) => (
                        <button
                          key={state}
                          onClick={() => handleSelectState(state)}
                          className={`text-xs font-black p-3 rounded-xl border text-left transition-all ${currentStateName === state && dataSource === 'local-simulated' ? 'bg-brand-primary border-brand-primary text-white shadow-premium' : 'bg-slate-50 border-brand-border text-brand-text hover:bg-brand-accent/50'}`}
                        >
                          {state}
                        </button>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-brand-border mt-3 flex justify-between items-center">
                      <span className="text-[9px] text-brand-muted uppercase font-black">¿Analizar tus propios locales?</span>
                      <button 
                        onClick={() => setActiveMenu('api')}
                        className="text-[9px] bg-brand-accent hover:bg-brand-primary hover:text-white transition-all text-brand-primary font-black px-2.5 py-1.5 rounded-lg flex items-center gap-1 uppercase"
                      >
                        <Sliders className="w-3 h-3" /> Cargar locales
                      </button>
                    </div>
                  </div>
                </div>

                {/* Selected Node Details Profile */}
                {selectedLocation ? (
                  <div className="bg-white border border-brand-border p-6 rounded-[32px] shadow-premium">
                    <div className="flex justify-between items-start border-b border-brand-border pb-4 mb-4">
                      <div>
                        <span className="text-[9px] font-black bg-brand-primary/10 text-brand-primary px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          {selectedLocation.category}
                        </span>
                        <h4 className="text-xl font-extrabold text-brand-text mt-2">{selectedLocation.name}</h4>
                        <p className="text-[10px] text-brand-muted font-mono mt-1 font-bold">
                          LAT: {selectedLocation.latitude.toFixed(4)} | LNG: {selectedLocation.longitude.toFixed(4)}
                        </p>
                      </div>
                    </div>

                    {/* Indicators list */}
                    <div className="space-y-4">
                      
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-black text-brand-text">
                          <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-brand-primary" /> Índice de Tráfico Peatonal</span>
                          <span>{selectedLocation.trafficIndex}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-primary" style={{ width: `${selectedLocation.trafficIndex}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-black text-brand-text">
                          <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-brand-secondary" /> Co-saturación de Competencia</span>
                          <span>{selectedLocation.competitionDensity}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-secondary" style={{ width: `${selectedLocation.competitionDensity}%` }}></div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-black text-brand-text">
                          <span className="flex items-center gap-1.5"><CheckCheck className="w-3.5 h-3.5 text-purple-600" /> Compatibilidad con Perfiles Target</span>
                          <span>{selectedLocation.targetMatchScore}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-600" style={{ width: `${selectedLocation.targetMatchScore}%` }}></div>
                        </div>
                      </div>

                      <div className="p-4 bg-brand-accent/50 rounded-2xl border border-brand-primary/10 mt-6">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[9px] text-brand-muted uppercase font-black tracking-wider">Ingreso de Venta Proyectado</p>
                            <p className="text-2xl font-black text-brand-primary mt-1">${selectedLocation.revenueProjection.toLocaleString()} <span className="text-[10px] text-brand-muted font-normal">USD/Año</span></p>
                          </div>
                          <div className="p-3 bg-white rounded-xl shadow-sm text-brand-primary">
                            <DollarSign className="w-6 h-6" />
                          </div>
                        </div>
                        <p className="text-[10px] text-brand-muted mt-3 italic font-semibold">
                          *Calculado a partir de demográficos de perfiles para: <strong>{selectedLocation.demographicGroup}</strong>.
                        </p>
                      </div>

                      <button 
                        onClick={() => setActiveMenu('api')}
                        className="w-full mt-4 bg-zinc-900 border border-zinc-950 text-white font-extrabold text-[10px] uppercase tracking-widest py-3.5 rounded-xl transition-all hover:bg-brand-primary shadow-sm flex items-center justify-center gap-2"
                      >
                        <FileText className="w-4 h-4" /> Ver viabilidad de {selectedLocation.category}
                      </button>

                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-brand-border p-6 rounded-[32px] text-center text-brand-muted py-12">
                    <p>No hay localizaciones cargadas en el mapa.</p>
                  </div>
                )}

              </div>

            </div>
          </section>
        )}

        {/* SECTION 3: THE LIVE API GATEWAY CONNECTOR (INTEGRAR API) */}
        {activeMenu === 'api' && (
          <section className="max-w-7xl mx-auto px-6 py-12">
            
            {/* Header of section */}
            <div className="mb-12 pb-8 border-b border-brand-border flex items-center justify-between flex-wrap gap-4">
              <div>
                <span className="text-[11px] font-black text-brand-primary uppercase tracking-[0.3em]">ESTUDIO DE EXPANSIÓN COMERCIAL</span>
                <h2 className="text-4xl font-extrabold text-brand-text tracking-tight mt-2">Estudio de Viabilidad y Carga de Locales Candidatos</h2>
                <p className="text-brand-muted text-sm mt-2 max-w-2xl">
                  Carga tus propios conjuntos de datos territoriales, locales candidatos o zonas de interés en el mapa interactivo para evaluar su viabilidad comercial.
                </p>
              </div>

              {/* Back to map button */}
              <button 
                onClick={() => setActiveMenu('simulator')}
                className="bg-brand-primary text-white hover:bg-brand-text transition-colors px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-center"
              >
                Volver al Simulador
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              
              {/* Left Form: Edit API settings */}
              <div className="lg:col-span-6 space-y-6">
                
                <div className="bg-white border border-brand-border p-8 rounded-[32px] shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-brand-green">
                      <Wifi className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-brand-text">Cargar Locales Candidatos</h3>
                      <p className="text-[11px] text-brand-muted font-bold">Carga y evalúa tu lista de direcciones y coordenadas geográficas en vivo.</p>
                    </div>
                  </div>

                  <form onSubmit={handleTestApiFetch} className="space-y-6">
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-brand-text uppercase tracking-wider block">Dirección del archivo de locales candidatos (JSON)</label>
                      <input 
                        type="url" 
                        required
                        className="w-full bg-slate-50 border border-brand-border rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono text-xs text-brand-text"
                        placeholder="https://tus-datos.com/locales-candidatos.json" 
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                      />
                      <p className="text-[10px] text-brand-muted italic mt-1 leading-normal">
                        *El archivo debe proveer un formato de coordenadas geográficas estándar con una lista pública de locales candidatos. Asegúrate de que el enlace sea accesible de manera pública.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-brand-text uppercase tracking-wider block">Clave de campo o parámetro (Opcional)</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border border-brand-border rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono text-xs"
                          placeholder="p. ej. api_key o token" 
                          value={apiHeaderName}
                          onChange={(e) => setApiHeaderName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-brand-text uppercase tracking-wider block">Token de Acceso Privado</label>
                        <input 
                          type="text" 
                          className="w-full bg-slate-50 border border-brand-border rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary font-mono text-xs"
                          placeholder="p. ej. token_de_seguridad..." 
                          value={apiHeaderVal}
                          onChange={(e) => setApiHeaderVal(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Dynamic Error Messaging */}
                    {apiError && (
                      <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex gap-3 text-red-800 text-xs">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <div>
                          <p className="font-extrabold uppercase text-[9px] tracking-wider text-red-700">Error de Carga</p>
                          <p className="mt-1 leading-relaxed">{apiError}</p>
                        </div>
                      </div>
                    )}

                    {dataset && dataSource === 'live-api' && (
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex gap-3 text-emerald-800 text-xs">
                        <CheckCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <div>
                          <p className="font-extrabold uppercase text-[9px] tracking-wider text-emerald-700">Carga Exitosa</p>
                          <p className="mt-1 leading-relaxed">Se han procesado e integrado {dataset.length} puntos geográficos procedentes de tu archivo de locales.</p>
                        </div>
                      </div>
                    )}

                    {/* Loader button */}
                    <div className="flex gap-4">
                      <button 
                        type="submit"
                        disabled={isApiLoading}
                        className="flex-grow bg-brand-primary hover:bg-brand-text text-white p-4.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-premium flex items-center justify-center gap-2"
                      >
                        {isApiLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" /> PROCESANDO ARCHIVO GEOGRÁFICO...
                          </>
                        ) : (
                          <>
                            <Wifi className="w-4 h-4" /> CARGAR LOCALES EN EL SIMULADOR
                          </>
                        )}
                      </button>

                      {dataSource === 'live-api' && (
                        <button 
                          type="button"
                          onClick={() => {
                            handleSelectState("Aguascalientes");
                          }}
                          className="bg-white border border-brand-border hover:bg-slate-50 text-brand-text p-4.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all"
                        >
                          Resetear Simulador
                        </button>
                      )}
                    </div>

                  </form>
                </div>

                {/* Property list schema description */}
                <div className="bg-brand-text text-white p-8 rounded-[32px] space-y-6">
                  <div className="flex items-center gap-3">
                    <Compass className="w-6 h-6 text-brand-secondary" />
                    <h4 className="font-extrabold uppercase tracking-widest text-xs">Campos y Propiedades Requeridos</h4>
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed">
                    Para que el simulador geográfico de GeoAnalítica pueda trazar y analizar correctamente tus locales candidatos, tu archivo o feed de datos debe incluir los siguientes campos por cada local:
                  </p>
                  
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-3 gap-2 border-b border-white/10 pb-2">
                      <span className="font-extrabold text-brand-secondary">Campo</span>
                      <span className="font-extrabold text-brand-secondary">Tipo de Dato</span>
                      <span className="font-extrabold text-brand-secondary">Descripción</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
                      <span className="font-mono">id</span>
                      <span>Texto único</span>
                      <span className="text-white/70">Identificador del local (ej. local-01).</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
                      <span className="font-mono">name</span>
                      <span>Texto</span>
                      <span className="text-white/70">Nombre descriptivo de la sucursal.</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
                      <span className="font-mono">latitude, longitude</span>
                      <span>Coordenada</span>
                      <span className="text-white/70">Coordenadas geográficas decimales en formato estándar.</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
                      <span className="font-mono">trafficIndex</span>
                      <span>Número (1-100)</span>
                      <span className="text-white/70">Índice estimado de flujo o tráfico peatonal.</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-2">
                      <span className="font-mono">competitionDensity</span>
                      <span>Número (1-100)</span>
                      <span className="text-white/70">Saturación o cantidad de competidores cercanos.</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pb-2">
                      <span className="font-mono">revenueProjection</span>
                      <span>Moneda (USD)</span>
                      <span className="text-white/70">Venta anual proyectada para el local analizado.</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right panel: Sample expected JSON representation */}
              <div className="lg:col-span-6 space-y-6">
                
                <div className="bg-slate-900 border border-zinc-800 p-8 rounded-[32px] text-white space-y-4 shadow-xl">
                  <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Compass className="w-5 h-5 text-emerald-400" />
                      <p className="text-xs font-mono font-extrabold uppercase text-slate-300">lista_locales_candidatos.json</p>
                    </div>
                    <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded uppercase font-mono font-bold">VISTA_PREVIA_DATOS</span>
                  </div>

                  <p className="text-xs text-slate-400 font-light leading-relaxed">
                    Los locales geolocalizados que cargues deben estructurarse de esta forma para visualizar y contrastar sus indicadores de tráfico y competencia automáticamente en el simulador espacial:
                  </p>

                  <pre className="p-4 bg-zinc-950 rounded-2xl border border-zinc-900 text-zinc-300 font-mono text-[11px] leading-relaxed max-h-[380px] overflow-y-auto custom-scrollbar">
                    {expectedJsonExample}
                  </pre>
                </div>

                <div className="bg-white border border-brand-border p-6 rounded-[32px] space-y-3 shadow-premium">
                  <h4 className="font-extrabold text-sm text-brand-text flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-brand-primary" /> ¿Cómo se protegen tus datos?
                  </h4>
                  <p className="text-xs text-brand-muted leading-relaxed">
                    En GeoAnalítica, la seguridad de tu estrategia de expansión comercial es nuestra máxima prioridad. Los archivos de locales que cargas se procesan de manera local e inmediata en tu navegador web.
                  </p>
                  <p className="text-xs text-brand-muted leading-relaxed">
                    Toda la información permanece privada y nunca se almacena en nuestros servidores de manera permanente. Si tu corporación requiere integraciones directas seguras con bases de datos internas, ponte en contacto con nuestro equipo de ingenieros para estructurar un canal privado dedicado.
                  </p>
                </div>

              </div>

            </div>

          </section>
        )}

        {/* SECTION 4: LOCAL DEVELOPMENT INSTRUCTIONS PANEL (INSTALACIÓN LOCAL) */}
        {activeMenu === 'setup' && (
          <section className="max-w-7xl mx-auto px-6 py-12">
            
            <div className="mb-12 pb-8 border-b border-brand-border">
              <span className="text-[11px] font-black text-brand-primary uppercase tracking-[0.3em]">METODOLOGÍA DE ANÁLISIS URBANO</span>
              <h2 className="text-4xl font-extrabold text-brand-text tracking-tight mt-2">Guía de Evaluación y Criterios de Selección de Locales</h2>
              <p className="text-brand-muted text-sm mt-2 max-w-2xl">
                Aprende a interpretar los datos geoespaciales y flujos de tránsito urbano para tomar decisiones de ubicación inteligentes y de bajo riesgo.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              
              {/* Steps overview */}
              <div className="lg:col-span-7 space-y-8">
                
                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center font-black text-lg flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-brand-text mb-2">Definir el Giro y Público Objetivo</h3>
                    <p className="text-brand-muted text-sm leading-relaxed">
                      Identifica el tipo de negocio que deseas abrir y las características de tu cliente ideal. Esto define el radio de influencia demográfico ideal (generalmente entre 300 y 500 metros para peatones).
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center font-black text-lg flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-brand-text mb-2">Analizar la Saturación de Competidores</h3>
                    <p className="text-brand-muted text-sm leading-relaxed">
                      Usa el simulador para localizar competidores directos e indirectos. Una concentración excesiva de marcas del mismo giro incrementa la competencia por el mismo cliente, lo que reduce la rentabilidad por local.
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center font-black text-lg flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-brand-text mb-2">Evaluar Flujos y Movilidad Peatonal</h3>
                    <p className="text-brand-muted text-sm leading-relaxed">
                      El local ideal debe contar con un volumen alto de tráfico peatonal de paso (personas circulando habitualmente) y una excelente cercanía a paradas de transporte público o estacionamientos.
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center font-black text-lg flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-brand-text mb-2">Calcular Proyección Financiera Espacial</h3>
                    <p className="text-brand-muted text-sm leading-relaxed">
                      Estima los ingresos comerciales basados en la afluencia de la zona y la tasa de conversión media de tu sector. Contrasta esto con los costos operativos y de alquiler para proyectar un ROI preciso antes de firmar el contrato.
                    </p>
                  </div>
                </div>

              </div>

              {/* Package dependencies & summary on right */}
              <div className="lg:col-span-5 space-y-6">
                
                <div className="bg-white border border-brand-border p-8 rounded-[32px] shadow-sm space-y-6">
                  <h4 className="font-extrabold text-base text-brand-text pb-3 border-b border-brand-border">Indicadores Geográficos Clave</h4>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-brand-text font-bold uppercase tracking-wider">Tráfico Flotante</span>
                      <span className="text-xs bg-brand-accent text-brand-primary px-3 py-1 rounded-lg font-black font-mono">Peatones / Hora</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-brand-text font-bold uppercase tracking-wider">Densidad Comercial</span>
                      <span className="text-xs bg-brand-accent text-brand-primary px-3 py-1 rounded-lg font-black font-mono">Competidores / Km²</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-brand-text font-bold uppercase tracking-wider">Afinidad Demográfica</span>
                      <span className="text-xs bg-brand-accent text-brand-primary px-3 py-1 rounded-lg font-black font-mono">Match Sociodemográfico</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-brand-text font-bold uppercase tracking-wider">Accesibilidad Urbana</span>
                      <span className="text-xs bg-brand-accent text-brand-primary px-3 py-1 rounded-lg font-black font-mono">Transporte & Conectividad</span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-brand-border rounded-2xl flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-brand-primary flex-shrink-0" />
                    <p className="text-xs text-brand-muted leading-snug">
                      Nuestros algoritmos cruzan la base de datos nacional del INEGI DENUE con registros de flujos urbanos para proporcionarte la mayor precisión en tus proyecciones de expansión.
                    </p>
                  </div>
                </div>

                <div className="bg-zinc-950 text-white p-6 rounded-[32px] border border-zinc-800 space-y-4">
                  <h5 className="font-bold text-sm tracking-wider uppercase text-zinc-400 flex items-center gap-2">
                    <Compass className="w-5 h-5 text-brand-secondary" /> Parámetros de Éxito
                  </h5>
                  <div className="font-mono text-xs space-y-3">
                    <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 space-y-1">
                      <p className="text-brand-secondary font-bold uppercase text-[9px] tracking-wider">Giros Peatonales (Cafés, Comida, Retail)</p>
                      <p className="text-zinc-300">Radio ideal de análisis: 300m - 500m.</p>
                      <p className="text-zinc-400 leading-relaxed mt-1">Requiere alto volumen de transeúntes, visibilidad a nivel de calle y aceras amplias.</p>
                    </div>
                    <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 space-y-1">
                      <p className="text-brand-secondary font-bold uppercase text-[9px] tracking-wider">Giros de Destino (Servicios, Bodegas, Oficinas)</p>
                      <p className="text-zinc-300">Radio ideal de análisis: 1km - 3km.</p>
                      <p className="text-zinc-400 leading-relaxed mt-1">Requiere vías rápidas de acceso, facilidades de carga/descarga y estacionamiento.</p>
                    </div>
                  </div>
                </div>

              </div>

            </div>

          </section>
        )}

      </main>

      {/* ================= FOOTER ================= */}
      <footer className="bg-brand-text text-white/90 border-t border-brand-border pt-20 pb-12 px-6 md:px-12 mt-12 bg-zinc-950">
        <div className="max-w-7xl mx-auto">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-16">
            
            {/* Nav logo / Brand brief */}
            <div className="md:col-span-2 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-brand-primary rounded-lg flex items-center justify-center text-white">
                  <Compass className="w-5 h-5" />
                </div>
                <span className="font-sans font-extrabold text-xl uppercase tracking-tighter text-white">
                  Geo<span className="text-brand-secondary italic">Analítica</span>
                </span>
              </div>
              <p className="text-sm text-zinc-400 max-w-sm leading-relaxed font-medium">
                Sistemas de Inteligencia Territorial y geomarketing comercial de grado profesional. Ayudamos a emprendedores, pequeños comercios y franquicias a elegir el local comercial ideal reduciendo el riesgo de inversión a cero.
              </p>
            </div>

            {/* Quick Links Column */}
            <div>
              <h4 className="font-black text-xs uppercase tracking-widest text-[#0088cc] mb-6">Navegación</h4>
              <ul className="space-y-4 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <li><button onClick={() => { setActiveMenu('home'); window.scrollTo(0,0); }} className="hover:text-white transition-colors">Inicio</button></li>
                <li><button onClick={() => { setActiveMenu('simulator'); window.scrollTo(0,0); }} className="hover:text-white transition-colors">Simulador de Ubicación</button></li>
                <li><button onClick={() => { setActiveMenu('api'); window.scrollTo(0,0); }} className="hover:text-white transition-colors">Estudios de Viabilidad</button></li>
                <li><button onClick={() => { setActiveMenu('setup'); window.scrollTo(0,0); }} className="hover:text-white transition-colors">Guías de Expansión</button></li>
              </ul>
            </div>

            {/* Tech Specs Column */}
            <div>
              <h4 className="font-black text-xs uppercase tracking-widest text-[#0088cc] mb-6">Servicios y Soporte</h4>
              <ul className="space-y-4 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <li><a href="#contacto" className="hover:text-white transition-colors">Solicitar Auditoría</a></li>
                <li><span className="text-zinc-500">Consultoría Estratégica: </span><span className="text-emerald-400 font-mono font-bold">DISPONIBLE</span></li>
                <li><span className="text-zinc-500">Datos INEGI DENUE: </span><span className="text-brand-secondary font-mono font-bold">ACTUALIZADOS</span></li>
              </ul>
            </div>

          </div>

          {/* Lower footer note */}
          <div className="pt-10 border-t border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-6">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">
              © 2026 GeoAnalítica SIG // Diseñado para la toma de decisiones con certeza científica.
            </p>
            <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <span className="hover:text-white cursor-pointer transition-colors">POLÍTICA DE PRIVACIDAD</span>
              <span className="hover:text-white cursor-pointer transition-colors">TÉRMINOS Y SERVICIOS</span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}
