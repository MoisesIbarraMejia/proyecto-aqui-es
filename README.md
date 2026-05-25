# 🗺️ Nombre de tu Proyecto Espacial

Una aplicación web completa para el análisis espacial y manejo de datos geográficos.

##  Arquitectura del Proyecto

Este proyecto está dividido en dos partes totalmente independientes (arquitectura desacoplada):

*   **/frontend**: Interfaz de usuario construida con **React, TypeScript y Tailwind CSS**, utilizando **Vite** como empaquetador y **React Map GL (MapLibre)** para la visualización de mapas.
*   **/backend**: API REST construida con **Python y Django (GeoDjango)**, conectada a una base de datos **PostgreSQL con la extensión PostGIS**.

---

##  Requisitos Previos

Antes de iniciar, asegúrate de tener instalado en tu equipo:
*   [Node.js](https://nodejs.org) (versión 18 o superior)
*   [Python](https://python.org) (versión 3.10 o superior)
*   [PostgreSQL](https://postgresql.org) con la extensión [PostGIS](https://postgis.net) activa.

---

##  Configuración Local

### 1. Clonar el repositorio
```bash
git clone https://github.com
cd tu-repositorio
```

### 2. Levantar el Backend (Django)
```bash
cd backend
# Crear entorno virtual
python -m venv .venv
# Activar entorno (Windows)
.venv\Scripts\activate
# Activar entorno (Mac/Linux)
source .venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt
# Ejecutar servidor
python manage.py runserver
```
*El servidor correrá en: http://127.0.0*

### 3. Levantar el Frontend (React + Vite)
```bash
cd ../frontend
# Instalar dependencias
npm install
# Ejecutar en modo desarrollo
npm run dev
```
*La aplicación web correrá en: http://localhost:5173/*

---

##  Configuración de la Base de Datos

Recuerda activar la extensión espacial en tu consola de PostgreSQL antes de correr las migraciones de Django:
```sql
CREATE EXTENSION postgis;
```
