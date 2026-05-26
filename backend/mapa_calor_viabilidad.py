"""
╔══════════════════════════════════════════════════════════════════════════════╗
║      MOTOR DE MAPA DE CALOR DE OPORTUNIDAD DE NEGOCIO - v1.0               ║
║      Integrado con Score de Viabilidad (score_viabilidad.py)               ║
╚══════════════════════════════════════════════════════════════════════════════╝

Flujo de procesamiento:
    1. Recibe pin central + radio + giro
    2. Genera rejilla (grid) de coordenadas dentro del radio
    3. Calcula Score de Viabilidad para cada punto del grid
    4. Aplica caché LRU para no duplicar peticiones a la API
    5. Devuelve JSON listo para Google Maps HeatmapLayer / Leaflet.heat

Dependencias: numpy (stdlib), math, json, hashlib, functools
No requiere librerías externas adicionales.
"""

import math
import json
import time
import hashlib
import logging
import numpy as np
from typing import Optional
from functools import lru_cache
from dataclasses import dataclass, asdict, field
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Importar el motor de viabilidad (mismo directorio) ───────────────────────
# Si tu proyecto tiene otra estructura, ajusta este import.
from score_viabilidad import calcular_score_viabilidad, CATALOGO_GIROS

# ─── Configuración de logging ─────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 1 — CONSTANTES Y CONFIGURACIÓN
# ══════════════════════════════════════════════════════════════════════════════

# Resolución del grid: distancia entre puntos muestreados (metros)
RESOLUCIONES_DISPONIBLES = {
    "alta":  50,    # Grid denso  — ~314 puntos en radio 500m
    "media": 100,   # Grid normal — ~78 puntos  en radio 500m  (recomendado)
    "baja":  200,   # Grid suave  — ~20 puntos  en radio 500m  (desarrollo)
}

# Umbrales de calificación para zonas del mapa
UMBRAL_PUNTO_CALIENTE  = 80   # Score >= 80 → zona verde/caliente
UMBRAL_PUNTO_TIBIO     = 55   # Score 55-79 → zona amarilla
# Score < 55 → zona roja/fría

# Máximo de workers para procesamiento paralelo
MAX_WORKERS = 8

# Radio de la Tierra (metros) — para proyección esférica local
RADIO_TIERRA_M = 6_371_000


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 2 — MODELOS DE DATOS
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class PuntoGrid:
    """Un punto muestreado en la rejilla de análisis."""
    lat: float
    lng: float
    distancia_centro_m: float
    score: float = 0.0
    weight: float = 0.0         # Score normalizado 0.0–1.0 para el heatmap
    clasificacion: str = ""
    zona_calor: str = ""        # "caliente" | "tibio" | "frio"
    procesado: bool = False


@dataclass
class MejorCoordenada:
    """El punto con mayor score dentro del radio analizado."""
    lat: float
    lng: float
    score: float
    clasificacion: str
    distancia_al_pin_m: float
    explicacion: str
    recomendaciones: list[str] = field(default_factory=list)


@dataclass
class ResumenMapa:
    """Estadísticas globales del análisis del mapa de calor."""
    total_puntos_analizados: int
    puntos_calientes: int       # Score >= 80
    puntos_tibios: int          # Score 55–79
    puntos_frios: int           # Score < 55
    score_promedio: float
    score_maximo: float
    score_minimo: float
    cobertura_pct: float        # % del radio con score >= 55


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 3 — GENERADOR DE GRID GEOGRÁFICO
# ══════════════════════════════════════════════════════════════════════════════

def _metros_a_delta_lat(metros: float) -> float:
    """
    Convierte una distancia en metros a grados de latitud.
    Aproximación válida para radios pequeños (< 10 km).
    """
    return metros / 111_320.0


def _metros_a_delta_lon(metros: float, lat_ref: float) -> float:
    """
    Convierte una distancia en metros a grados de longitud,
    corrigiendo por la latitud de referencia (los meridianos
    se acercan hacia los polos).
    """
    return metros / (111_320.0 * math.cos(math.radians(lat_ref)))


def _haversine_metros(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia real en metros entre dos coordenadas (Haversine)."""
    R = RADIO_TIERRA_M
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi    = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def generar_grid_circular(
    lat_centro: float,
    lon_centro: float,
    radio_m: float,
    paso_m: float
) -> list[PuntoGrid]:
    """
    Genera una rejilla rectangular de puntos y filtra solo aquellos
    que caen dentro del círculo de radio_m alrededor del centro.

    Estrategia:
        1. Crea un grid cuadrado que engloba el círculo (bounding box).
        2. Descarta los puntos fuera del círculo con Haversine.
        3. Incluye siempre el punto central exacto.

    Args:
        lat_centro : Latitud del pin central del usuario.
        lon_centro : Longitud del pin central del usuario.
        radio_m    : Radio de búsqueda en metros.
        paso_m     : Distancia entre puntos del grid (resolución).

    Returns:
        Lista de PuntoGrid dentro del círculo.
    """
    delta_lat = _metros_a_delta_lat(radio_m)
    delta_lon = _metros_a_delta_lon(radio_m, lat_centro)

    # Rango de latitudes y longitudes del bounding box
    lats = np.arange(lat_centro - delta_lat, lat_centro + delta_lat + 1e-9,
                     _metros_a_delta_lat(paso_m))
    lons = np.arange(lon_centro - delta_lon, lon_centro + delta_lon + 1e-9,
                     _metros_a_delta_lon(paso_m, lat_centro))

    puntos: list[PuntoGrid] = []

    # Punto central siempre incluido (distancia = 0)
    puntos.append(PuntoGrid(
        lat=round(lat_centro, 7),
        lng=round(lon_centro, 7),
        distancia_centro_m=0.0
    ))

    for lat in lats:
        for lon in lons:
            dist = _haversine_metros(lat_centro, lon_centro, lat, lon)
            if 0 < dist <= radio_m:   # 0 ya está cubierto por el centro
                puntos.append(PuntoGrid(
                    lat=round(float(lat), 7),
                    lng=round(float(lon), 7),
                    distancia_centro_m=round(dist, 1)
                ))

    logger.info(f"Grid generado: {len(puntos)} puntos | radio={radio_m}m | paso={paso_m}m")
    return puntos


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 4 — SISTEMA DE CACHÉ
# ══════════════════════════════════════════════════════════════════════════════

# Caché en memoria: clave = hash(lat_redondeada, lon_redondeada, giro)
# Evita recalcular puntos cuyas coordenadas son casi idénticas.
_CACHE_SCORES: dict[str, dict] = {}

def _clave_cache(lat: float, lon: float, giro: str, precision: int = 4) -> str:
    """
    Genera una clave de caché truncando coordenadas a `precision` decimales.

    Con 4 decimales, la precisión es ~11 metros: puntos más cercanos que eso
    comparten la misma clave y no se recalculan.

    Ajusta `precision` según la resolución de tu grid:
        - Grid 50m  → precision=4 (~11m de agrupación, bueno)
        - Grid 100m → precision=3 (~111m de agrupación, puede sobre-agrupar)
        - Grid 200m → precision=3 (adecuado)
    """
    lat_r = round(lat, precision)
    lon_r = round(lon, precision)
    raw   = f"{lat_r}:{lon_r}:{giro}"
    return hashlib.md5(raw.encode()).hexdigest()


def _obtener_score_con_cache(lat: float, lon: float, giro: str) -> dict:
    """
    Consulta el caché primero; si no existe, llama a calcular_score_viabilidad
    y almacena el resultado.

    Para producción puedes reemplazar `_CACHE_SCORES` por:
        - Redis (redis-py) para caché distribuido
        - SQLite para persistencia entre sesiones
        - Memcached para alta concurrencia
    """
    clave = _clave_cache(lat, lon, giro)

    if clave in _CACHE_SCORES:
        logger.debug(f"[CACHÉ HIT] ({lat:.4f}, {lon:.4f})")
        return _CACHE_SCORES[clave]

    try:
        resultado = calcular_score_viabilidad(lat, lon, giro)
        _CACHE_SCORES[clave] = resultado
        logger.debug(f"[CACHÉ MISS] ({lat:.4f}, {lon:.4f}) → score={resultado['score_final']}")
        return resultado
    except Exception as e:
        logger.warning(f"Error calculando score para ({lat}, {lon}): {e}")
        # Devuelve score neutro para no romper el grid
        return {"score_final": 50.0, "clasificacion": "ERROR", "explicacion": str(e), "recomendaciones": []}


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 5 — PROCESADOR DE GRID (PARALELO)
# ══════════════════════════════════════════════════════════════════════════════

def _zona_calor_desde_score(score: float) -> str:
    """Asigna la etiqueta de zona según el score."""
    if score >= UMBRAL_PUNTO_CALIENTE:
        return "caliente"
    if score >= UMBRAL_PUNTO_TIBIO:
        return "tibio"
    return "frio"


def _normalizar_weight(score: float, score_min: float, score_max: float) -> float:
    """
    Normaliza el score a un rango 0.0–1.0 para el weight del heatmap.

    Usa min-max scaling global del lote: los puntos más altos del análisis
    obtienen weight=1.0, los más bajos weight=0.0.
    Esto maximiza el contraste visual del mapa de calor.

    Si todos los puntos tienen el mismo score (edge case), retorna 0.5.
    """
    rango = score_max - score_min
    if rango < 1e-6:
        return 0.5
    return round((score - score_min) / rango, 4)


def procesar_grid_paralelo(
    puntos: list[PuntoGrid],
    giro: str,
    max_workers: int = MAX_WORKERS
) -> list[PuntoGrid]:
    """
    Calcula el score de viabilidad para cada punto del grid usando
    un ThreadPoolExecutor para paralelizar las llamadas (útil cuando
    las llamadas a la API real tienen latencia de red).

    Args:
        puntos      : Lista de PuntoGrid generados por generar_grid_circular.
        giro        : Clave del giro de negocio.
        max_workers : Número máximo de hilos concurrentes.

    Returns:
        Lista de PuntoGrid con score, weight y zona_calor rellenados.
    """
    total = len(puntos)
    logger.info(f"Procesando {total} puntos del grid con {max_workers} workers...")
    t_inicio = time.time()

    # Mapa índice → PuntoGrid para actualización thread-safe
    resultados_raw: dict[int, dict] = {}

    def _tarea(idx: int, punto: PuntoGrid) -> tuple[int, dict]:
        return idx, _obtener_score_con_cache(punto.lat, punto.lng, giro)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(_tarea, i, p): i
            for i, p in enumerate(puntos)
        }
        completados = 0
        for future in as_completed(futures):
            idx, resultado = future.result()
            resultados_raw[idx] = resultado
            completados += 1
            if completados % 20 == 0 or completados == total:
                logger.info(f"  Progreso: {completados}/{total} ({completados/total*100:.0f}%)")

    # Rellenar scores en los puntos
    for i, punto in enumerate(puntos):
        res = resultados_raw.get(i, {})
        punto.score        = res.get("score_final", 50.0)
        punto.clasificacion = res.get("clasificacion", "N/A")
        punto.zona_calor   = _zona_calor_desde_score(punto.score)
        punto.procesado    = True

    # Normalización global del weight (min-max sobre todo el lote)
    scores = [p.score for p in puntos]
    s_min, s_max = min(scores), max(scores)
    for punto in puntos:
        punto.weight = _normalizar_weight(punto.score, s_min, s_max)

    t_total = time.time() - t_inicio
    hits = sum(1 for k in _CACHE_SCORES)  # aproximación del tamaño del caché
    logger.info(
        f"Grid procesado en {t_total:.2f}s | "
        f"caché actual: {hits} entradas | "
        f"score rango: [{s_min:.1f} – {s_max:.1f}]"
    )
    return puntos


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 6 — IDENTIFICACIÓN DE MEJOR COORDENADA
# ══════════════════════════════════════════════════════════════════════════════

def _encontrar_mejor_coordenada(
    puntos: list[PuntoGrid],
    lat_centro: float,
    lon_centro: float,
    giro: str
) -> MejorCoordenada:
    """
    Identifica el punto con el score más alto del grid.
    En caso de empate, prefiere el más cercano al pin central.

    Hace una llamada final a calcular_score_viabilidad solo para ese punto
    para obtener la explicación y recomendaciones completas.
    """
    # Ordenar: primero por score desc, luego por distancia asc
    mejor = sorted(puntos, key=lambda p: (-p.score, p.distancia_centro_m))[0]

    # Obtener detalles completos del mejor punto (ya en caché, sin costo extra)
    detalles = _obtener_score_con_cache(mejor.lat, mejor.lng, giro)

    return MejorCoordenada(
        lat=mejor.lat,
        lng=mejor.lng,
        score=mejor.score,
        clasificacion=mejor.clasificacion,
        distancia_al_pin_m=mejor.distancia_centro_m,
        explicacion=detalles.get("explicacion", ""),
        recomendaciones=detalles.get("recomendaciones", [])
    )


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 7 — GENERADOR DE RESUMEN ESTADÍSTICO
# ══════════════════════════════════════════════════════════════════════════════

def _generar_resumen(puntos: list[PuntoGrid]) -> ResumenMapa:
    """Computa estadísticas globales sobre todos los puntos del grid."""
    scores = [p.score for p in puntos]
    calientes = [p for p in puntos if p.zona_calor == "caliente"]
    tibios    = [p for p in puntos if p.zona_calor == "tibio"]
    frios     = [p for p in puntos if p.zona_calor == "frio"]

    total = len(puntos)
    zonas_viables = len(calientes) + len(tibios)

    return ResumenMapa(
        total_puntos_analizados=total,
        puntos_calientes=len(calientes),
        puntos_tibios=len(tibios),
        puntos_frios=len(frios),
        score_promedio=round(sum(scores) / total, 1) if total else 0,
        score_maximo=round(max(scores), 1) if scores else 0,
        score_minimo=round(min(scores), 1) if scores else 0,
        cobertura_pct=round(zonas_viables / total * 100, 1) if total else 0,
    )


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 8 — FUNCIÓN PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════════

def generar_mapa_calor(
    punto_central: tuple[float, float],
    radio_busqueda: int,
    giro_negocio: str,
    *,
    resolucion: str = "media",
    max_workers: int = MAX_WORKERS,
    incluir_frios: bool = True,
    paso_metros_custom: Optional[int] = None
) -> dict:
    """
    Genera el JSON del mapa de calor de oportunidad de negocio.

    Args:
        punto_central      : Tupla (lat, lon) del pin del usuario.
        radio_busqueda     : Radio en metros (recomendado: 500 o 1000).
        giro_negocio       : Clave del giro (ver CATALOGO_GIROS).
        resolucion         : "alta" (50m) | "media" (100m) | "baja" (200m).
        max_workers        : Hilos paralelos para procesamiento del grid.
        incluir_frios      : Si False, omite puntos con score < 55 del output
                             (reduce payload para el frontend).
        paso_metros_custom : Sobreescribe la resolución si se especifica.

    Returns:
        Dict con:
          - heatmap_data   : Lista [{lat, lng, weight}] para el frontend
          - puntos_calientes: Lista filtrada de puntos con score >= 80
          - mejor_coordenada: El punto óptimo con detalle completo
          - resumen        : Estadísticas globales
          - configuracion  : Parámetros usados en el análisis
    """

    # ── 1. VALIDACIONES ───────────────────────────────────────────────────────
    lat, lon = punto_central
    if not (-90 <= lat <= 90):
        raise ValueError(f"Latitud inválida: {lat}")
    if not (-180 <= lon <= 180):
        raise ValueError(f"Longitud inválida: {lon}")
    if radio_busqueda not in [500, 1000, 1500, 2000]:
        logger.warning(f"Radio {radio_busqueda}m fuera de valores recomendados (500/1000/1500/2000).")
    if radio_busqueda > 2000:
        raise ValueError("Radio máximo permitido: 2000m. Para áreas mayores usa múltiples análisis.")

    giro_clave = giro_negocio.strip().lower()
    if giro_clave not in CATALOGO_GIROS:
        raise ValueError(
            f"Giro '{giro_negocio}' no existe. "
            f"Opciones: {', '.join(CATALOGO_GIROS.keys())}"
        )
    if resolucion not in RESOLUCIONES_DISPONIBLES and paso_metros_custom is None:
        raise ValueError(f"Resolución '{resolucion}' inválida. Usa: {list(RESOLUCIONES_DISPONIBLES.keys())}")

    paso_m = paso_metros_custom or RESOLUCIONES_DISPONIBLES[resolucion]

    logger.info(
        f"Iniciando mapa de calor | giro='{giro_clave}' | "
        f"centro=({lat}, {lon}) | radio={radio_busqueda}m | paso={paso_m}m"
    )

    # ── 2. GENERAR GRID ───────────────────────────────────────────────────────
    puntos = generar_grid_circular(lat, lon, radio_busqueda, paso_m)

    # Advertencia si el grid es muy grande (riesgo de throttling en API real)
    if len(puntos) > 500:
        logger.warning(
            f"Grid grande ({len(puntos)} puntos). "
            f"Considera aumentar el paso_m o reducir el radio para evitar throttling en la API real."
        )

    # ── 3. CALCULAR SCORES (PARALELO + CACHÉ) ────────────────────────────────
    puntos = procesar_grid_paralelo(puntos, giro_clave, max_workers)

    # ── 4. MEJOR COORDENADA ───────────────────────────────────────────────────
    mejor = _encontrar_mejor_coordenada(puntos, lat, lon, giro_clave)

    # ── 5. RESUMEN ESTADÍSTICO ────────────────────────────────────────────────
    resumen = _generar_resumen(puntos)

    # ── 6. CONSTRUIR JSON DE SALIDA ───────────────────────────────────────────

    # 6a. heatmap_data: lista plana para Google Maps HeatmapLayer / Leaflet.heat
    heatmap_data = [
        {"lat": p.lat, "lng": p.lng, "weight": p.weight}
        for p in puntos
        if incluir_frios or p.zona_calor != "frio"
    ]

    # 6b. puntos_calientes: detalle enriquecido de las mejores zonas
    puntos_calientes = [
        {
            "lat": p.lat,
            "lng": p.lng,
            "score": p.score,
            "weight": p.weight,
            "clasificacion": p.clasificacion,
            "distancia_al_pin_m": p.distancia_centro_m,
        }
        for p in sorted(puntos, key=lambda x: -x.score)
        if p.zona_calor == "caliente"
    ]

    # 6c. Resultado final estructurado
    resultado = {
        "heatmap_data": heatmap_data,
        "puntos_calientes": puntos_calientes,
        "mejor_coordenada": {
            "lat": mejor.lat,
            "lng": mejor.lng,
            "score": mejor.score,
            "clasificacion": mejor.clasificacion,
            "distancia_al_pin_m": mejor.distancia_al_pin_m,
            "explicacion": mejor.explicacion,
            "recomendaciones": mejor.recomendaciones,
        },
        "resumen": {
            "total_puntos_analizados": resumen.total_puntos_analizados,
            "puntos_calientes": resumen.puntos_calientes,
            "puntos_tibios": resumen.puntos_tibios,
            "puntos_frios": resumen.puntos_frios,
            "score_promedio": resumen.score_promedio,
            "score_maximo": resumen.score_maximo,
            "score_minimo": resumen.score_minimo,
            "cobertura_viable_pct": resumen.cobertura_pct,
            "interpretacion": _interpretar_resumen(resumen),
        },
        "configuracion": {
            "punto_central": {"lat": lat, "lng": lon},
            "radio_busqueda_m": radio_busqueda,
            "giro_negocio": CATALOGO_GIROS[giro_clave]["descripcion"],
            "giro_clave": giro_clave,
            "resolucion": resolucion,
            "paso_metros": paso_m,
            "umbral_caliente": UMBRAL_PUNTO_CALIENTE,
            "umbral_tibio": UMBRAL_PUNTO_TIBIO,
            "entradas_cache": len(_CACHE_SCORES),
        }
    }

    logger.info(
        f"Mapa de calor listo | "
        f"{resumen.puntos_calientes} calientes / "
        f"{resumen.puntos_tibios} tibios / "
        f"{resumen.puntos_frios} fríos | "
        f"mejor score: {mejor.score}"
    )
    return resultado


def _interpretar_resumen(resumen: ResumenMapa) -> str:
    """Genera un párrafo interpretativo del resumen estadístico."""
    if resumen.cobertura_pct >= 70:
        return (
            f"La zona analizada tiene una viabilidad general ALTA. "
            f"El {resumen.cobertura_pct:.0f}% del área presenta condiciones favorables. "
            f"Tienes múltiples opciones de ubicación dentro del radio."
        )
    elif resumen.cobertura_pct >= 40:
        return (
            f"La zona muestra viabilidad MODERADA. "
            f"Solo el {resumen.cobertura_pct:.0f}% del área es viable. "
            f"Enfócate en los puntos calientes identificados."
        )
    else:
        return (
            f"La zona analizada presenta condiciones DESFAVORABLES para este giro. "
            f"Solo el {resumen.cobertura_pct:.0f}% del área supera el umbral de viabilidad. "
            f"Considera ampliar el radio o explorar otra zona."
        )


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 9 — UTILIDAD: LIMPIAR CACHÉ
# ══════════════════════════════════════════════════════════════════════════════

def limpiar_cache() -> int:
    """
    Vacía el caché en memoria. Llama esto:
      - Al cambiar de giro o zona de análisis radicalmente
      - Al actualizar datos del DENUE (ej. cada 24h en producción)
      - Para forzar un recálculo completo

    Returns:
        Número de entradas eliminadas.
    """
    global _CACHE_SCORES
    n = len(_CACHE_SCORES)
    _CACHE_SCORES = {}
    logger.info(f"Caché limpiado: {n} entradas eliminadas.")
    return n


def estadisticas_cache() -> dict:
    """Devuelve métricas del estado actual del caché."""
    return {
        "entradas_totales": len(_CACHE_SCORES),
        "giros_en_cache": list({k.split(":")[-1] for k in _CACHE_SCORES}),
    }


# ══════════════════════════════════════════════════════════════════════════════
# SECCIÓN 10 — PUNTO DE ENTRADA / DEMO
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n" + "═" * 70)
    print("  DEMO: MAPA DE CALOR DE OPORTUNIDAD DE NEGOCIO")
    print("═" * 70)

    # ── Ejemplo: Cafetería en Colonia Roma Norte, CDMX ────────────────────────
    resultado = generar_mapa_calor(
        punto_central=(19.4180, -99.1590),
        radio_busqueda=500,
        giro_negocio="cafeteria",
        resolucion="baja",        # "baja" para demo rápida; usa "media" en prod
        max_workers=4,
        incluir_frios=True
    )

    # ── Imprimir resumen compacto ─────────────────────────────────────────────
    resumen = resultado["resumen"]
    mejor   = resultado["mejor_coordenada"]
    config  = resultado["configuracion"]

    print(f"\n Centro del análisis : ({config['punto_central']['lat']}, {config['punto_central']['lng']})")
    print(f" Giro analizado      : {config['giro_negocio']}")
    print(f" Radio / Paso        : {config['radio_busqueda_m']}m / {config['paso_metros']}m")
    print(f" Total puntos        : {resumen['total_puntos_analizados']}")
    print(f" Puntos calientes (≥{config['umbral_caliente']}) : {resumen['puntos_calientes']}")
    print(f" Puntos tibios      : {resumen['puntos_tibios']}")
    print(f" Puntos fríos       : {resumen['puntos_frios']}")
    print(f" Score promedio     : {resumen['score_promedio']}/100")
    print(f" Cobertura viable   : {resumen['cobertura_viable_pct']}%")
    print(f"\n MEJOR COORDENADA:")
    print(f"   → ({mejor['lat']}, {mejor['lng']})")
    print(f"   → Score: {mejor['score']}/100 ({mejor['clasificacion']})")
    print(f"   → Distancia al pin: {mejor['distancia_al_pin_m']}m")
    print(f"   → {mejor['explicacion']}")
    print(f"\n Interpretación zona:")
    print(f"   {resumen['interpretacion']}")

    # ── JSON completo (primeros 3 puntos del heatmap como muestra) ────────────
    muestra = {**resultado, "heatmap_data": resultado["heatmap_data"][:3]}
    print(f"\n Muestra JSON (primeros 3 puntos de {len(resultado['heatmap_data'])} en heatmap_data):")
    print(json.dumps(muestra, ensure_ascii=False, indent=2))

    print("\n" + "═" * 70)
    print(f"  Caché: {estadisticas_cache()['entradas_totales']} entradas guardadas.")
    print("═" * 70)
