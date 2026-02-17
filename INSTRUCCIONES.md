# devChat - Instrucciones super simples

Si sigues estos pasos en orden, la app corre sin problema.

## 0) Tener el proyecto en tu PC

Si aun no tienes el proyecto:

1) Descargalo (ZIP) o clona con Git.
2) Deja la carpeta en un lugar simple (por ejemplo: `Projects/devChat`).

## 1) Requisitos

- Python 3.10 o mas nuevo.
- Pip (viene con Python).
- Cuenta de Cloudinary (para subir archivos).
- (Opcional) Firebase si quieres guardar mensajes en la nube.

Comprobar que Python funciona:

```bash
python --version
```

Si en macOS/Linux no funciona `python`, usa:

```bash
python3 --version
```

## 2) Instalar dependencias (una sola vez)

Abre una terminal y pega los comandos de tu sistema.

### macOS / Linux

```bash
cd /Users/sebastianeligio/Projects/devChat/server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Windows (PowerShell)

```powershell
cd C:\Users\TU_USUARIO\Projects\devChat\server
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Si PowerShell no deja activar el entorno:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Windows (CMD)

```bat
cd C:\Users\TU_USUARIO\Projects\devChat\server
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
```

## 3) Ejecutar la app (cada vez que quieras usarla)

### macOS / Linux

```bash
cd /Users/sebastianeligio/Projects/devChat/server
source venv/bin/activate
python3 app.py
```

### Windows (PowerShell)

```powershell
cd C:\Users\TU_USUARIO\Projects\devChat\server
venv\Scripts\Activate.ps1
python app.py
```

### Windows (CMD)

```bat
cd C:\Users\TU_USUARIO\Projects\devChat\server
venv\Scripts\activate.bat
python app.py
```

Luego abre en tu navegador:

```
http://localhost:5001
```

## 4) Hacerla publica con ngrok (opcional)

Si quieres compartir la app con alguien fuera de tu red:

1) Instala ngrok:

### macOS

```bash
brew install ngrok/ngrok/ngrok
```

### Windows

- Descarga ngrok desde https://ngrok.com/download
- Descomprime y agrega la carpeta a tu PATH (o ejecuta desde esa carpeta)

2) Configura tu token (solo una vez):

```bash
ngrok config add-authtoken TU_TOKEN
```

3) Ejecuta el tunel:

```bash
ngrok http 5001
```

Copia la URL https que te muestre y compartela.

## 5) Donde poner credenciales

- Cloudinary: edita [server/cloudinary_config.py](server/cloudinary_config.py).
- Firebase: edita [server/firebase_config.py](server/firebase_config.py) y el archivo de servicio.

Si no configuras Firebase, la app funciona igual pero sin guardar historial en la nube.

## 6) Primer uso (pasos dentro de la app)

1) Escribe tu nombre y pulsa "Establecer".
2) Escribe el nombre de la sala y pulsa "Unirse".
3) Ya puedes chatear, enviar archivos o iniciar videollamada.

## 7) Que puedes hacer en la app

- Chat en tiempo real con salas.
- Indicador de "escribiendo".
- Enviar emojis.
- Subir imagenes, audio, video y archivos.
- Vista previa de PDF y documentos.
- Videollamadas con WebRTC.

## 8) Notas importantes

- Para camara y microfono necesitas HTTPS o localhost.
- Si algo falla, cierra todo y vuelve a ejecutar los pasos del punto 3.

## 9) Solucion de problemas rapida

- "No se encuentra el comando python": instala Python o usa `python3`.
- "Permission denied" al activar venv en Windows: usa PowerShell y ejecuta el comando de politica (ver paso 2).
- "Port 5001 in use": cierra el otro proceso o cambia el puerto en `app.py`.
- Camara/microfono no funcionan: revisa permisos del navegador y usa HTTPS o localhost.
- Ngrok no abre: verifica el token y que el puerto 5001 este activo.

## 10) Detener la app

- En la terminal del servidor, presiona `Ctrl + C`.
- Si usas ngrok, tambien cierra esa terminal con `Ctrl + C`.
