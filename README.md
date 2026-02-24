# Sesión 4 — Práctica web (Exacto vs Heurístico)

App estática (HTML/CSS/JS) pensada para GitHub Pages.

## Qué incluye
- Mochila (Knapsack): exacto (DP) vs heurística (Greedy ratio)
- Ruta (TSP pequeño): heurística (Nearest Neighbor) vs exacto (brute force, n<=10)
- Medición: tiempo, calidad y gap
- Export: JSON con estado y resultados

## Ejecutar en local (recomendado para probar antes de publicar)
En la carpeta del proyecto:
- Con Python:
  - `python -m http.server 8000`
  - abre `http://localhost:8000`

## Publicar en GitHub Pages (Deploy from branch)
1. Sube este proyecto a un repo (p.ej. `sesion4-practica`)
2. Repo → Settings → Pages
3. Source: Deploy from a branch
4. Branch: main · Folder: /(root)
5. Guarda. GitHub te dará la URL: `https://TUUSUARIO.github.io/sesion4-practica/`

## Nota importante
Usa rutas relativas (ya lo hace el proyecto). No uses `/assets/...` sino `assets/...`.
