# devChat - Instrucciones y funciones

## Requisitos
- Python 3.10+
- Virtualenv
- Cuenta de Cloudinary (para uploads)
- (Opcional) Firebase (Firestore/Storage)

## Estructura del proyecto
- server/app.py: servidor Flask + Socket.IO
- server/requirements.txt: dependencias
- templates/index.html: UI del chat
- static/js/chat.js: logica del cliente

## Instalacion
1) Crear y activar entorno virtual
```bash
cd /Users/sebastianeligio/Projects/devChat/server
python3 -m venv venv
source venv/bin/activate
```

2) Instalar dependencias
```bash
pip install -r requirements.txt

```

## Ejecucion local
```bash
cd /Users/sebastianeligio/Projects/devChat/server
source venv/bin/activate
python3 app.py
```
Abrir en el navegador:
```
http://localhost:5001
```

## HTTPS publico con Ngrok (opcional)
1) Instalar Ngrok
```bash
brew install ngrok/ngrok/ngrok
```

2) Configurar token (no compartir en chats)
```bash
ngrok config add-authtoken TU_TOKEN
```

3) Ejecutar tunel
```bash
ngrok http 5001
```
Comparte la URL https://xxxx.ngrok-free.app

## Variables y configuracion
- server/cloudinary_config.py: credenciales de Cloudinary
- server/firebase_config.py: credenciales de Firebase

## Funciones principales del programa
### Chat en tiempo real
- Enviar mensajes de texto
- Indicador de "escribiendo"
- Unirse y salir de salas
- Lista de usuarios conectados por sala
- Historial local y persistencia en Firebase (si esta configurado)

### Multimedia
- Boton unico para adjuntar (clip)
- Subida a Cloudinary
- Tipos soportados:
  - Imagenes: jpg, jpeg, png, gif, webp, bmp
  - Videos: mp4, mov, webm, mkv, avi
  - Audio: mp3, wav, ogg, m4a, aac
  - Archivos: pdf, doc, docx, xls, xlsx, ppt, pptx, zip, rar

### Renderizado en el chat
- Imagenes: miniatura con bordes redondeados
- Video: reproductor HTML5
- Audio: reproductor HTML5
- PDF: visor embebido
- Office: enlaces a ver online y descarga
- Otros archivos: descarga con nombre original

### Descarga con nombre original
- Endpoint /download para descargar desde Cloudinary con nombre correcto

## Limites de tamano (cliente)
- Imagen: 25 MB
- Audio: 30 MB
- Video: 100 MB
- Otros: 50 MB

## Limite de subida (servidor)
- MAX_CONTENT_LENGTH = 120 MB

## Endpoints principales
- GET / : pagina principal
- POST /upload : subida a Cloudinary
- GET /download : descarga con nombre original

## Notas
- Para camara/microfono en navegador se requiere HTTPS o localhost.
- WebRTC es la opcion recomendada para llamadas y videollamadas.
