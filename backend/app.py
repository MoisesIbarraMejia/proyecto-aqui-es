import os
from dotenv import load_dotenv
from flask import Flask, jsonify
import psycopg
from shapely.geometry import Point

load_dotenv() # Carga el archivo .env automaticamente

app = Flask(__name__)

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

if __name__ == '__main__':
    app.run(debug=True, port=5000)