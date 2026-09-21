# Nuestro jardín 🌷

Ramo de flores 3D interactivo que se convierte en un jardín que crece al regarlo cada día.
Hecho con **Three.js** (3D), **Netlify Functions** (servidor) y **MongoDB Atlas** (base de datos).

## Estructura

```
index.html                      Página principal
styles.css                      Estilos
js/models.js                    Modelos 3D hechos con código (9 flores, 12 decoraciones, regadera)
js/game.js                      Lógica: ramo, jardín, XP, monedas, tienda, mochila, guardado
netlify/functions/garden.mjs    API /api/garden que lee y guarda en MongoDB
netlify.toml                    Configuración de Netlify
package.json                    Dependencia del driver de MongoDB
```

## 1. Crear la base de datos (MongoDB Atlas, gratis)

1. Entra a https://www.mongodb.com/cloud/atlas y crea un clúster **M0 (Free)**.
2. En **Database Access** crea un usuario con contraseña.
3. En **Network Access** agrega `0.0.0.0/0` (Netlify no tiene una IP fija).
4. En **Connect → Drivers** copia la cadena de conexión, algo como:
   `mongodb+srv://usuario:contraseña@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

No necesitas crear colecciones: la función crea `jardin.gardens` sola.

## 2. Subir a Netlify

> Importante: **arrastrar la carpeta** en Netlify Drop no instala dependencias, así que la
> función no funcionaría. Usa GitHub (opción A) o la terminal (opción B).

**Opción A, con GitHub (recomendada)**
1. Sube esta carpeta a un repositorio de GitHub.
2. En Netlify: *Add new site → Import an existing project* y elige el repo.
   Deja el comando de build vacío; el directorio de publicación es `.` (ya viene en `netlify.toml`).
3. En *Site configuration → Environment variables* agrega:
   - `MONGODB_URI` = tu cadena de conexión
   - `MONGODB_DB` = `jardin` (opcional)
4. Vuelve a desplegar (*Deploys → Trigger deploy*).

**Opción B, con la terminal**
```bash
npm install
npm install -g netlify-cli
netlify login
netlify init            # crea o enlaza el sitio
netlify env:set MONGODB_URI "mongodb+srv://..."
netlify deploy --prod
```

Para probar en tu computadora: `netlify dev` (usa las mismas variables).

## Cómo funciona el guardado

- Cada jardín tiene un id que viaja en el enlace: `https://tu-sitio.netlify.app/?jardin=j-abc123`.
- En la tienda, **Compartir jardín** manda ese enlace; quien lo abra ve y riega el **mismo** jardín
  desde su iPhone o iPad.
- Todo se guarda en MongoDB y también en el dispositivo. Si no hay internet o la base no responde,
  el juego sigue funcionando y guarda localmente.
- Si dos dispositivos cambian el jardín, gana el cambio más reciente y el otro se actualiza al volver a la app.

## Reglas del juego

- Cada flor da XP y monedas **una vez al día** al regarla. Regar días seguidos sube una racha
  (+10% de XP por día, hasta +60%).
- Cada riego hace crecer la flor; con 4 riegos llega a tamaño adulto.
- Al subir de nivel brota una flor nueva en un cuadro libre. Cuando ya no hay cuadros libres,
  las flores pueden crecer más alto (hasta 4 niveles extra).
- Las semillas se compran en la tienda, van a la mochila (abajo a la izquierda) y se plantan tocando un cuadro vacío.
- El terreno se amplía de 4 × 4 hasta 6 × 6.
- Las decoraciones se colocan tocando el suelo; tócalas después para moverlas, girarlas o guardarlas.

## Personalizar

Todo lo ajustable está al inicio de `js/game.js`:

- `CFG`: tamaño inicial y máximo, rangos de XP y monedas, velocidad de crecimiento, monedas iniciales.
- `LAND_PRICE`: precio de cada ampliación.
- `SEEDS` y `DECOR`: nombres, precios y descripciones de la tienda.
- `BOUQUET_TYPES`: qué flores trae el ramo inicial.

El texto del letrero está en `js/models.js` (busca `Nuestro jardín`). Los colores de cada flor
están en el objeto `FLOWERS` del mismo archivo.
