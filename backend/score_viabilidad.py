"""
╔══════════════════════════════════════════════════════════════════════════════╗
║         MOTOR DE SCORE DE VIABILIDAD DE NEGOCIO - v1.0                     ║
║         Desarrollado para integración con DENUE (INEGI)                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

Arquitectura modular de 4 pilares:
    1. Competencia      (30%) — Penaliza densidad y proximidad de rivales
    2. Anclas/Atracción (30%) — Suma por negocios ancla y complementarios
    3. NSE/Demográfico  (25%) — Multiplicador por coincidencia de target
    4. Accesibilidad    (15%) — Bono por esquina y vialidad favorable

Para activar datos reales, sustituye los métodos prefijados con
`_mock_` por tus propias llamadas a la API del DENUE con credenciales.
"""
import os
import requests
import math
import json
import logging
from dataclasses import dataclass, field, asdict
from typing import Optional
from enum import Enum

# ─── Configuración de logging ─────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 1 — CONSTANTES Y CONFIGURACIÓN
# ══════════════════════════════════════════════════════════════════════════════

RADIO_ANALISIS_M = 500          # Radio de análisis en metros
PENALIZACION_ALTA_DENSIDAD = 8  # Puntos extra a restar si >3 competidores
UMBRAL_COMPETENCIA_CERCANA = 50 # Metros para penalización máxima de proximidad

# Puntajes de anclas principales y secundarias
PUNTAJE_ANCLA_PRINCIPAL   = 10  # Banco, Supermercado, Metro/Transporte
PUNTAJE_ANCLA_SECUNDARIA  = 5   # Escuela, Parque, Farmacia

# NSE (Nivel Socioeconómico): etiquetas estándar AMAI
class NSE(str, Enum):
    A_B  = "A/B"   # Alto
    C_PLUS = "C+"  # Medio alto
    C    = "C"     # Medio
    C_MINUS = "C-" # Medio bajo
    D_PLUS = "D+"  # Bajo alto
    D    = "D"     # Bajo
    E    = "E"     # Muy bajo

# Mapa de compatibilidad NSE: qué niveles acepta cada target de giro
# Clave = NSE del target del negocio, Valor = NSEs de zona compatibles
COMPATIBILIDAD_NSE: dict[str, list[str]] = {
    NSE.A_B:    [NSE.A_B, NSE.C_PLUS],
    NSE.C_PLUS: [NSE.A_B, NSE.C_PLUS, NSE.C],
    NSE.C:      [NSE.C_PLUS, NSE.C, NSE.C_MINUS],
    NSE.C_MINUS:[NSE.C, NSE.C_MINUS, NSE.D_PLUS],
    NSE.D_PLUS: [NSE.C_MINUS, NSE.D_PLUS, NSE.D],
    NSE.D:      [NSE.D_PLUS, NSE.D, NSE.E],
    NSE.E:      [NSE.D, NSE.E],
}

# Catálogo de giros: define target NSE, anclas sinérgicas y competidores clave
# EXTIENDE este diccionario con los giros de tu catálogo real
CATALOGO_GIROS: dict[str, dict] = {
    "cafeteria": {
        "nse_target": NSE.C_PLUS,
        "codigo_scian": ["722515"],          # SCIAN de competidores directos
        "anclas_sinergicas": ["oficinas", "coworking", "universidad"],
        "descripcion": "Cafetería / Coffee Shop",
    },
    "farmacia": {
        "nse_target": NSE.C,
        "codigo_scian": ["464111", "464112"],
        "anclas_sinergicas": ["clinica", "hospital", "consultorio"],
        "descripcion": "Farmacia",
    },
    "restaurante": {
        "nse_target": NSE.C,
        "codigo_scian": ["722511", "722512", "722519"],
        "anclas_sinergicas": ["oficinas", "plaza_comercial", "escuela"],
        "descripcion": "Restaurante",
    },
    "gym": {
        "nse_target": NSE.C_PLUS,
        "codigo_scian": ["713940"],
        "anclas_sinergicas": ["parque", "escuela", "tienda_deportiva"],
        "descripcion": "Gimnasio / Centro de acondicionamiento",
    },
    "papeleria": {
        "nse_target": NSE.C_MINUS,
        "codigo_scian": ["453210"],
        "anclas_sinergicas": ["escuela", "universidad", "oficinas"],
        "descripcion": "Papelería / Artículos de oficina",
    },
    # ── Agrega más giros aquí siguiendo el mismo esquema ──────────────────
}


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 2 — MODELOS DE DATOS
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class Negocio:
    """Representa un negocio encontrado en el radio de análisis."""
    nombre: str
    lat: float
    lon: float
    giro: str
    distancia_m: float = 0.0  # Calculada dinámicamente


@dataclass
class DatosZona:
    """Datos geográficos y sociodemográficos de la zona analizada."""
    nse_zona: str = NSE.C
    en_esquina: bool = False
    sentido_vial_favorable: bool = False
    # Listas de negocios cercanos por categoría
    competidores: list[Negocio] = field(default_factory=list)
    anclas_principales: list[Negocio] = field(default_factory=list)
    anclas_secundarias: list[Negocio] = field(default_factory=list)
    negocios_complementarios: list[Negocio] = field(default_factory=list)


@dataclass
class DesglosePilar:
    """Puntaje y detalle de un pilar individual."""
    nombre: str
    peso_pct: int
    puntaje_bruto: float       # Puntaje antes de aplicar peso
    puntaje_ponderado: float   # Puntaje × peso
    factores: list[str] = field(default_factory=list)  # Razones en texto


@dataclass
class ResultadoScore:
    """Resultado completo del cálculo de viabilidad."""
    score_final: float
    clasificacion: str
    pilares: list[DesglosePilar]
    explicacion: str
    recomendaciones: list[str]
    metadata: dict


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 3 — CAPA DE DATOS (MOCKS → Reemplazar con API real)
# ══════════════════════════════════════════════════════════════════════════════

def _mock_obtener_negocios_denue(lat: float, lon: float, codigos_scian: list[str]) -> list[dict]:
    """
    Sustitución de MOCK por consulta real a la API del DENUE (INEGI).
    Mantiene el nombre original para no romper mapa_calor_viabilidad.py.
    """
    logger.info(f"Consultando DENUE REAL — lat={lat}, lon={lon}, SCIAN={codigos_scian}")
    
    # 1. Creamos la lista vacía donde guardaremos los resultados de la API
    results = []

    try:
        # 2. Inyectamos el bloque de código de la FASE 2
        for codigo in codigos_scian[:2]:  # limitar peticiones para no saturar la API
            url = (
                f"https://www.inegi.org.mx/app/api/denue/v1/consulta/"
                f"Buscar/{codigo}/{lat},{lon}/{RADIO_ANALISIS_M}/"
                f"{os.getenv('DENUE_TOKEN')}/"
            )
            
            resp = requests.get(url, timeout=8)
            items = resp.json() if resp.ok else []
            
            # Procesamos cada establecimiento regresado por el INEGI
            for item in (items if isinstance(items, list) else []):
                results.append({
                    "nombre": item.get("nom_estab"),
                    "latitud": float(item.get("latitud", lat)),
                    "longitud": float(item.get("longitud", lon)),
                    "clave_actividad": item.get("codigo_act", codigos_scian[0])
                })
                
    except Exception as e:
        logger.error(f"Error al consultar la API del DENUE: {str(e)}")
        # Si algo falla en la conexión, regresa lo que se haya alcanzado a acumular
    
    # 3. Regresamos la lista final con los comercios reales mapeados
    return results


def _mock_obtener_anclas(lat: float, lon: float, tipo: str) -> list[dict]:
    """
      MOCK — Reemplazar con consultas reales a DENUE o Google Places API.

    `tipo` puede ser: 'banco', 'supermercado', 'metro', 'escuela', 'parque'

    Returns:
        Lista de dicts con keys: nombre, latitud, longitud, tipo
    """
    logger.info(f"[MOCK] Buscando anclas tipo='{tipo}' cerca de ({lat}, {lon})")
    mocks = {
        "banco":        [{"nombre": "BBVA Sucursal", "latitud": lat + 0.003, "longitud": lon - 0.001, "tipo": "banco"}],
        "supermercado": [{"nombre": "Walmart Express", "latitud": lat - 0.002, "longitud": lon + 0.002, "tipo": "supermercado"}],
        "metro":        [{"nombre": "Metro Balderas", "latitud": lat + 0.001, "longitud": lon + 0.001, "tipo": "metro"}],
        "escuela":      [{"nombre": "Primaria Benito Juárez", "latitud": lat - 0.003, "longitud": lon - 0.002, "tipo": "escuela"}],
        "parque":       [],  # Sin parques en este mock
    }
    return mocks.get(tipo, [])


def _mock_obtener_nse_zona(lat: float, lon: float) -> str:
    """
      MOCK — Reemplazar con consulta a tu base de datos de AGEBs del INEGI
    o a un servicio de NSE geolocalizado (ej. AMAI, Nielsen, etc.).

    Returns:
        Clave NSE de la zona (ej. 'C+', 'A/B', 'D+')
    """
    logger.info(f"[MOCK] Consultando NSE zona ({lat}, {lon})")
    return NSE.C_PLUS  # Zona C+ simulada


def _mock_obtener_accesibilidad(lat: float, lon: float) -> dict:
    """
      MOCK — Reemplazar con datos de OpenStreetMap (Overpass API)
    o tu propio catastro para detectar esquinas y sentido vial.

    Returns:
        Dict con 'en_esquina' (bool) y 'sentido_favorable' (bool)
    """
    logger.info(f"[MOCK] Evaluando accesibilidad vial ({lat}, {lon})")
    return {"en_esquina": True, "sentido_favorable": False}


def _mock_obtener_complementarios(lat: float, lon: float, giro: str) -> list[dict]:
    """
      MOCK — Reemplazar con consulta DENUE filtrando los giros sinérgicos
    definidos en CATALOGO_GIROS[giro]['anclas_sinergicas'].
    """
    logger.info(f"[MOCK] Buscando negocios complementarios para '{giro}'")
    return [
        {"nombre": "Coworking HUB", "latitud": lat + 0.001, "longitud": lon - 0.001, "tipo": "coworking"},
    ]


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 4 — UTILIDADES GEOGRÁFICAS
# ══════════════════════════════════════════════════════════════════════════════

def _haversine_metros(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calcula la distancia en metros entre dos coordenadas geográficas
    usando la fórmula de Haversine.
    """
    R = 6_371_000  # Radio de la Tierra en metros
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi  = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _dict_a_negocio(data: dict, lat_ref: float, lon_ref: float) -> Negocio:
    """Convierte un dict de API a objeto Negocio con distancia calculada."""
    lat = data.get("latitud", data.get("lat", 0.0))
    lon = data.get("longitud", data.get("lon", 0.0))
    distancia = _haversine_metros(lat_ref, lon_ref, lat, lon)
    return Negocio(
        nombre=data.get("nombre", "Desconocido"),
        lat=lat,
        lon=lon,
        giro=data.get("clave_actividad", data.get("tipo", "")),
        distancia_m=round(distancia, 1)
    )


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 5 — CALCULADORES POR PILAR
# ══════════════════════════════════════════════════════════════════════════════

def _calcular_pilar_competencia(competidores: list[Negocio]) -> DesglosePilar:
    """
    Pilar 1 — COMPETENCIA (peso 30%, penaliza).

    Lógica:
      - Puntaje base: 100 (sin competencia = perfecto)
      - Por cada competidor se restan puntos según distancia:
          < 50m   → -20 pts  (impacto crítico)
          50-200m → -12 pts  (impacto alto)
          200-500m→ -6 pts   (impacto moderado)
      - Si total de competidores > 3 → penalización extra de 8 pts
    """
    puntaje = 100.0
    factores = []

    if not competidores:
        factores.append(" Sin competidores directos en el radio de 500m.")
        return DesglosePilar("Competencia", 30, puntaje, puntaje * 0.30, factores)

    for negocio in competidores:
        d = negocio.distancia_m
        if d < UMBRAL_COMPETENCIA_CERCANA:
            resta = 20
            nivel = "CRÍTICO"
        elif d < 200:
            resta = 12
            nivel = "ALTO"
        else:
            resta = 6
            nivel = "MODERADO"

        puntaje -= resta
        factores.append(
            f"  {negocio.nombre} a {d:.0f}m → impacto {nivel} (-{resta} pts)"
        )

    if len(competidores) > 3:
        puntaje -= PENALIZACION_ALTA_DENSIDAD
        factores.append(
            f" Alta densidad: {len(competidores)} competidores → penalización extra (-{PENALIZACION_ALTA_DENSIDAD} pts)"
        )

    puntaje = max(0.0, puntaje)
    return DesglosePilar("Competencia", 30, round(puntaje, 1), round(puntaje * 0.30, 2), factores)


def _calcular_pilar_anclas(
    anclas_principales: list[Negocio],
    anclas_secundarias: list[Negocio],
    complementarios: list[Negocio]
) -> DesglosePilar:
    """
    Pilar 2 — ATRACCIÓN / ANCLAS (peso 30%, suma).

    Lógica:
      - Puntaje base: 0
      - +10 pts por cada ancla principal (banco, super, metro/transporte)
      - +5 pts por cada ancla secundaria (escuela, parque)
      - +5 pts por cada negocio complementario / sinérgico
      - Tope máximo: 100 pts
    """
    puntaje = 0.0
    factores = []

    for ancla in anclas_principales:
        puntaje += PUNTAJE_ANCLA_PRINCIPAL
        factores.append(f" Ancla principal: {ancla.nombre} (+{PUNTAJE_ANCLA_PRINCIPAL} pts)")

    for ancla in anclas_secundarias:
        puntaje += PUNTAJE_ANCLA_SECUNDARIA
        factores.append(f" Ancla secundaria: {ancla.nombre} (+{PUNTAJE_ANCLA_SECUNDARIA} pts)")

    for comp in complementarios:
        puntaje += 5
        factores.append(f" Sinergia: {comp.nombre} (+5 pts)")

    if not factores:
        factores.append("  Sin anclas ni negocios sinérgicos detectados en el radio.")

    puntaje = min(100.0, puntaje)
    return DesglosePilar("Atracción / Anclas", 30, round(puntaje, 1), round(puntaje * 0.30, 2), factores)


def _calcular_pilar_nse(nse_zona: str, nse_target: str) -> DesglosePilar:
    """
    Pilar 3 — PERFIL NSE / DEMOGRÁFICO (peso 25%, multiplicador).

    Lógica:
      - Puntaje base: 50 (neutral)
      - Si NSE de zona es compatible con target → +15 pts
      - Si no es compatible → -10 pts
    """
    puntaje = 50.0
    factores = [f" NSE de la zona: {nse_zona} | Target del negocio: {nse_target}"]

    compatibles = COMPATIBILIDAD_NSE.get(nse_target, [])
    if nse_zona in compatibles:
        puntaje += 15
        factores.append(f" NSE compatible: el perfil de la zona coincide con tu cliente objetivo (+15 pts)")
    else:
        puntaje -= 10
        factores.append(
            f"❌ NSE incompatible: la zona ({nse_zona}) no coincide con tu target ({nse_target}) (-10 pts). "
            f"Niveles compatibles: {', '.join(compatibles)}"
        )

    puntaje = max(0.0, min(100.0, puntaje))
    return DesglosePilar("Perfil NSE / Demográfico", 25, round(puntaje, 1), round(puntaje * 0.25, 2), factores)


def _calcular_pilar_accesibilidad(en_esquina: bool, sentido_favorable: bool) -> DesglosePilar:
    """
    Pilar 4 — ACCESIBILIDAD (peso 15%, bono).

    Lógica:
      - Puntaje base: 60
      - +20 pts si está en esquina (mayor visibilidad y flujo peatonal)
      - +20 pts si el sentido vial es favorable (acceso fácil desde avenida)
    """
    puntaje = 60.0
    factores = []

    if en_esquina:
        puntaje += 20
        factores.append(" Ubicación en esquina: mayor visibilidad y acceso peatonal (+20 pts)")
    else:
        factores.append("  No está en esquina: visibilidad estándar.")

    if sentido_favorable:
        puntaje += 20
        factores.append(" Sentido vial favorable: acceso vehicular sencillo (+20 pts)")
    else:
        factores.append("  Sentido vial no óptimo: acceso vehicular limitado.")

    puntaje = min(100.0, puntaje)
    return DesglosePilar("Accesibilidad Vial", 15, round(puntaje, 1), round(puntaje * 0.15, 2), factores)


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 6 — GENERADOR DE EXPLICACIÓN Y RECOMENDACIONES
# ══════════════════════════════════════════════════════════════════════════════

def _clasificar_score(score: float) -> str:
    """Clasifica el score en un nivel cualitativo."""
    if score >= 80: return "EXCELENTE"
    if score >= 65: return "BUENO"
    if score >= 50: return "REGULAR"
    if score >= 35: return "DEFICIENTE"
    return "MUY BAJO"


def _generar_explicacion(score: float, pilares: list[DesglosePilar], giro: str) -> str:
    """
    Genera una explicación en lenguaje natural del score,
    destacando los factores más determinantes (los de mayor
    diferencia respecto al máximo posible de cada pilar).
    """
    clasificacion = _clasificar_score(score)
    frases_positivas, frases_negativas = [], []

    for p in pilares:
        # Determinar si el pilar contribuyó bien o mal
        max_posible = p.peso_pct  # Puntaje máximo ponderado = peso%
        eficiencia  = p.puntaje_ponderado / max_posible if max_posible else 0

        if eficiencia >= 0.75:
            frases_positivas.append(p.nombre.lower())
        elif eficiencia < 0.5:
            frases_negativas.append(p.nombre.lower())

    partes = [f"Tu score de viabilidad es {score:.0f}/100 — nivel {clasificacion}."]

    if frases_positivas:
        partes.append(
            f"Los factores que más suman son: {', '.join(frases_positivas)}."
        )
    if frases_negativas:
        partes.append(
            f"Los factores que más restan son: {', '.join(frases_negativas)}."
        )

    # Mensaje motivacional según clasificación
    mensajes = {
        "EXCELENTE":  "Esta ubicación tiene condiciones excepcionales para abrir un negocio de este giro. ¡Adelante!",
        "BUENO":      "La ubicación tiene buen potencial. Con algunos ajustes estratégicos puede ser muy rentable.",
        "REGULAR":    "La ubicación es viable, pero presenta retos que debes evaluar antes de invertir.",
        "DEFICIENTE": "Existen factores que reducen significativamente la viabilidad. Considera alternativas cercanas.",
        "MUY BAJO":   "Esta ubicación no es recomendable para este giro en este momento.",
    }
    partes.append(mensajes[clasificacion])
    return " ".join(partes)


def _generar_recomendaciones(pilares: list[DesglosePilar], giro_info: dict) -> list[str]:
    """Genera recomendaciones accionables basadas en los pilares débiles."""
    recomendaciones = []
    pesos = {p.nombre: p for p in pilares}

    p_competencia = pesos.get("Competencia")
    if p_competencia and p_competencia.puntaje_bruto < 60:
        recomendaciones.append(
            " Alta competencia: diferénciate con especialización de producto, "
            "precio o experiencia de cliente superior."
        )

    p_anclas = pesos.get("Atracción / Anclas")
    if p_anclas and p_anclas.puntaje_bruto < 30:
        recomendaciones.append(
            " Pocas anclas cercanas: evalúa estrategias de atracción propias "
            "(rótulo visible, redes sociales locales, app de delivery)."
        )

    p_nse = pesos.get("Perfil NSE / Demográfico")
    if p_nse and p_nse.puntaje_bruto < 50:
        recomendaciones.append(
            f" Desalineación NSE: considera ajustar tu propuesta de valor o ticket promedio "
            f"al perfil socioeconómico de la zona."
        )

    p_accesibilidad = pesos.get("Accesibilidad Vial")
    if p_accesibilidad and p_accesibilidad.puntaje_bruto < 70:
        recomendaciones.append(
            " Accesibilidad limitada: prioriza señalización exterior y presencia "
            "en Google Maps / Waze para compensar visibilidad."
        )

    if not recomendaciones:
        recomendaciones.append(
            " La ubicación presenta condiciones favorables en todos los pilares. "
            "Asegura un plan de apertura sólido para aprovechar el potencial."
        )

    return recomendaciones


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 7 — FUNCIÓN PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════════

def calcular_score_viabilidad(
    lat: float,
    lon: float,
    giro_negocio: str,
    *,
    debug: bool = False
) -> dict:
    """
    Calcula el Score de Viabilidad de Negocio para una ubicación dada.

    Args:
        lat           : Latitud de la ubicación a analizar.
        lon           : Longitud de la ubicación a analizar.
        giro_negocio  : Clave del giro (ver CATALOGO_GIROS, ej. 'cafeteria').
        debug         : Si True, incluye datos internos en el JSON de salida.

    Returns:
        dict con score_final (0-100), desglose por pilares, explicación
        en lenguaje natural y recomendaciones accionables.

    Raises:
        ValueError: Si las coordenadas están fuera de rango o el giro no existe.
    """

    # ── 1. VALIDACIONES ───────────────────────────────────────────────────────
    if not (-90 <= lat <= 90):
        raise ValueError(f"Latitud inválida: {lat}. Debe estar entre -90 y 90.")
    if not (-180 <= lon <= 180):
        raise ValueError(f"Longitud inválida: {lon}. Debe estar entre -180 y 180.")

    giro_clave = giro_negocio.strip().lower()
    if giro_clave not in CATALOGO_GIROS:
        giros_disponibles = ", ".join(CATALOGO_GIROS.keys())
        raise ValueError(
            f"Giro '{giro_negocio}' no encontrado en catálogo. "
            f"Opciones disponibles: {giros_disponibles}"
        )

    giro_info = CATALOGO_GIROS[giro_clave]
    logger.info(f"Iniciando análisis: giro='{giro_clave}' | coords=({lat}, {lon})")

    # ── 2. RECOPILACIÓN DE DATOS (llamadas a API / mocks) ────────────────────

    # 2a. Competidores directos
    raw_competidores = _mock_obtener_negocios_denue(lat, lon, giro_info["codigo_scian"])
    competidores = [
        _dict_a_negocio(n, lat, lon)
        for n in raw_competidores
        if _haversine_metros(lat, lon, n.get("latitud", 0), n.get("longitud", 0)) <= RADIO_ANALISIS_M
    ]

    # 2b. Anclas principales: banco, supermercado, metro
    anclas_principales = []
    for tipo in ["banco", "supermercado", "metro"]:
        for raw in _mock_obtener_anclas(lat, lon, tipo):
            negocio = _dict_a_negocio(raw, lat, lon)
            if negocio.distancia_m <= RADIO_ANALISIS_M:
                anclas_principales.append(negocio)

    # 2c. Anclas secundarias: escuela, parque
    anclas_secundarias = []
    for tipo in ["escuela", "parque"]:
        for raw in _mock_obtener_anclas(lat, lon, tipo):
            negocio = _dict_a_negocio(raw, lat, lon)
            if negocio.distancia_m <= RADIO_ANALISIS_M:
                anclas_secundarias.append(negocio)

    # 2d. Negocios complementarios / sinérgicos
    raw_comp = _mock_obtener_complementarios(lat, lon, giro_clave)
    complementarios = [
        _dict_a_negocio(n, lat, lon)
        for n in raw_comp
        if _haversine_metros(lat, lon, n.get("latitud", 0), n.get("longitud", 0)) <= RADIO_ANALISIS_M
    ]

    # 2e. NSE de la zona
    nse_zona = _mock_obtener_nse_zona(lat, lon)

    # 2f. Accesibilidad vial
    accesibilidad = _mock_obtener_accesibilidad(lat, lon)

    # ── 3. CÁLCULO DE PILARES ─────────────────────────────────────────────────
    pilar_competencia   = _calcular_pilar_competencia(competidores)
    pilar_anclas        = _calcular_pilar_anclas(anclas_principales, anclas_secundarias, complementarios)
    pilar_nse           = _calcular_pilar_nse(nse_zona, giro_info["nse_target"])
    pilar_accesibilidad = _calcular_pilar_accesibilidad(
        accesibilidad["en_esquina"],
        accesibilidad["sentido_favorable"]
    )

    pilares = [pilar_competencia, pilar_anclas, pilar_nse, pilar_accesibilidad]

    # ── 4. SCORE FINAL (suma de ponderados, forzado entre 0-100) ─────────────
    score_raw = sum(p.puntaje_ponderado for p in pilares)
    score_final = round(max(0.0, min(100.0, score_raw)), 1)

    # ── 5. EXPLICACIÓN Y RECOMENDACIONES ─────────────────────────────────────
    clasificacion    = _clasificar_score(score_final)
    explicacion      = _generar_explicacion(score_final, pilares, giro_info)
    recomendaciones  = _generar_recomendaciones(pilares, giro_info)

    # ── 6. CONSTRUCCIÓN DEL JSON DE SALIDA ───────────────────────────────────
    resultado = {
        "score_final": score_final,
        "clasificacion": clasificacion,
        "giro": giro_info["descripcion"],
        "coordenadas": {"latitud": lat, "longitud": lon},
        "explicacion": explicacion,
        "recomendaciones": recomendaciones,
        "desglose_pilares": [
            {
                "nombre": p.nombre,
                "peso_pct": p.peso_pct,
                "puntaje_bruto": p.puntaje_bruto,
                "puntaje_ponderado": round(p.puntaje_ponderado, 2),
                "factores": p.factores,
            }
            for p in pilares
        ],
        "metadata": {
            "radio_analisis_m": RADIO_ANALISIS_M,
            "total_competidores": len(competidores),
            "total_anclas_principales": len(anclas_principales),
            "total_anclas_secundarias": len(anclas_secundarias),
            "total_complementarios": len(complementarios),
            "nse_zona": nse_zona,
            "nse_target": giro_info["nse_target"],
            "en_esquina": accesibilidad["en_esquina"],
            "sentido_vial_favorable": accesibilidad["sentido_favorable"],
        }
    }

    if debug:
        resultado["debug"] = {
            "competidores_raw": [vars(c) for c in competidores],
            "anclas_principales_raw": [vars(a) for a in anclas_principales],
            "anclas_secundarias_raw": [vars(a) for a in anclas_secundarias],
        }

    logger.info(f"Score calculado: {score_final}/100 ({clasificacion})")
    return resultado


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 8 — PUNTO DE ENTRADA / DEMO
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # ── Ejemplo de uso: Cafetería en Colonia Roma Norte, CDMX ─────────────────
    resultado = calcular_score_viabilidad(
        lat=19.4180,
        lon=-99.1590,
        giro_negocio="cafeteria",
        debug=False
    )

    print("\n" + "═" * 70)
    print("  REPORTE DE VIABILIDAD DE NEGOCIO")
    print("═" * 70)
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    print("═" * 70)
