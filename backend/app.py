import os
from flask import request
from dotenv import load_dotenv
from flask import Flask, jsonify
import psycopg
from shapely.geometry import Point
from flask_cors import CORS
import requests

load_dotenv() # Carga el archivo .env automaticamente

app = Flask(__name__)
CORS(app) # Habilita CORS para todas las rutas

DENUE_TOKEN = os.getenv("DENUE_TOKEN")

# Configuración de tu conexión a PostgreSQL
DB_CONFIG = (
    f"dbname={os.getenv('DB_NAME')} "
    f"user={os.getenv('DB_USER')} "
    f"password={os.getenv('DB_PASSWORD')} "
    f"host={os.getenv('DB_HOST')} "
    f"port={os.getenv('DB_PORT')}"
)

@app.route('/')
def home():
    return jsonify({"mensaje":"Servidor Flask Geoespacial activo y listo!"})

# Ruta de prueba para verificar que el análisis espacial y la conexión a la base de datos funcionan correctamente
@app.route('/api/prueba-espacial')
def prueba_espacial():
    try:
        # 1. Ejemplo de análisis espacial en memoria con Shapely (¡Sin errores de sistema!)
        punto_a = Point(0, 0)
        punto_b = Point(3, 4)
        distancia = punto_a.distance(punto_b) # Calcula la distancia geométrica (Pitágoras)

        # 2. Ejemplo de conexión a tu base de datos PostgreSQL con PostGIS
        with psycopg.connect(DB_CONFIG) as conn:
            with conn.cursor() as cur:
                # Una consulta SQL pura de PostGIS para comprobar que la base de datos responde
                cur.execute("SELECT ST_AsText(ST_MakePoint(-73.935242, 40.730610));")
                resultado_db = cur.fetchone()[0]

        return jsonify({
            "status": "correcto",
            "analisis_shapely_distancia": distancia,
            "conexion_postgis_resultado": resultado_db
        })
        
    except Exception as e:
        return jsonify({"status": "error", "detalle": str(e)}), 500

# ── Endpoint 1: búsqueda DENUE para demo pública (sin auth) ──────────────
@app.route('/api/denue/buscar')
def buscar_denue():
    """
    Parámetros GET:
      - lat, lon   : coordenadas del pin
      - giro       : palabra clave (ej. "cafeteria", "farmacia")
      - radio      : metros (default 500, max 500 en demo)
    """
    lat   = request.args.get('lat', type=float)
    lon   = request.args.get('lon', type=float)
    giro  = request.args.get('giro', 'comercio')
    radio = min(int(request.args.get('radio', 500)), 500)  # cap demo en 500m

    if not lat or not lon:
        return jsonify({"error": "lat y lon son requeridos"}), 400

    url = (
        f"https://www.inegi.org.mx/app/api/denue/v1/consulta/"
        f"Buscar/{giro}/{lat},{lon}/{radio}/{DENUE_TOKEN}/"
    )
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()
        
        puntos = []
        for item in (data if isinstance(data, list) else []):
            puntos.append({
                "clee": item.get("CLEE"),
                "id": item.get("Id"),
                "nombre": item.get("Nombre"),
                "razon_social": item.get("Razon_social"),
                "clase_actividad": item.get("Clase_actividad"),
                "estrato": item.get("Estrato"),
                "tipo_vialidad": item.get("Tipo_vialidad"),
                "calle": item.get("Calle"),
                "num_exterior": item.get("Num_Exterior"),
                "num_interior": item.get("Num_Interior"),
                "colonia": item.get("Colonia"),
                "cp": item.get("CP"),
                "ubicacion": item.get("Ubicacion"),
                "telefono": item.get("Telefono"),
                "correo_e": item.get("Correo_e"),
                "sitio_internet": item.get("Sitio_internet"),
                "tipo": item.get("Tipo"),
                "lon": float(item.get("Longitud", 0)) if item.get("Longitud") else 0.0,
                "lat": float(item.get("Latitud", 0)) if item.get("Latitud") else 0.0,
                "centro_comercial": item.get("CentroComercial"),
                "tipo_centro_comercial": item.get("TipoCentroComercial"),
                "num_local": item.get("NumLocal")
            })
            
        return jsonify({"total": len(puntos), "negocios": puntos})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Endpoint 2: score de viabilidad (servicio de pago) ───────────────────
@app.route('/api/viabilidad/score')
def score_viabilidad_endpoint():
    """Requiere auth futura. Por ahora retorna análisis completo."""
    from score_viabilidad import calcular_score_viabilidad
    lat  = request.args.get('lat', type=float)
    lon  = request.args.get('lon', type=float)
    giro = request.args.get('giro', 'cafeteria')

    if not lat or not lon:
        return jsonify({"error": "lat y lon son requeridos"}), 400

    resultado = calcular_score_viabilidad(lat, lon, giro)
    return jsonify(resultado)


# ── Endpoint 3: mapa de calor (servicio premium) ──────────────────────────
@app.route('/api/viabilidad/mapa-calor')
def mapa_calor_endpoint():
    from mapa_calor_viabilidad import generar_mapa_calor
    lat    = request.args.get('lat', type=float)
    lon    = request.args.get('lon', type=float)
    giro   = request.args.get('giro', 'cafeteria')
    radio  = request.args.get('radio', 500, type=int)

    resultado = generar_mapa_calor(
        punto_central=(lat, lon),
        radio_busqueda=radio,
        giro_negocio=giro,
        resolucion="baja"  # "media" cuando sea prod de pago
    )
    return jsonify(resultado)

if __name__ == '__main__':
    app.run(debug=True, port=5000)