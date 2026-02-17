# devChat

Chat web en tiempo real con salas, multimedia y videollamadas. Esta app combina mensajeria instantanea con un flujo de intercambio de archivos y una experiencia de comunicacion mas completa (audio, video e imagenes), todo desde el navegador.

## Naturaleza del proyecto

devChat es una aplicacion web de chat en tiempo real construida con Flask y Socket.IO. Su objetivo es ofrecer una experiencia de mensajeria clara y moderna, con soporte para archivos y videollamadas WebRTC, manteniendo una arquitectura sencilla para aprendizaje, prototipado y despliegues rapidos.

## Funcionalidad principal

- Chat en tiempo real por salas.
- Indicador de escritura en vivo.
- Envio de emojis.
- Subida de archivos multimedia (imagenes, audio, video) y archivos generales.
- Vista previa de archivos (PDF, Office, codigo) con opciones de descarga.
- Videollamada grupal con WebRTC y overlay en pantalla completa.
- Modo claro/oscuro/auto.

## Experiencia de uso

1. Definir un nombre de usuario.
2. Unirse a una sala.
3. Enviar mensajes de texto o emojis.
4. Adjuntar archivos o capturar foto/audio/video desde el navegador.
5. Iniciar o terminar una videollamada con los botones de control.

## Arquitectura y tecnologias

- Backend: Flask + Flask-SocketIO
- Tiempo real: Socket.IO
- Multimedia: Cloudinary (subidas), validaciones en el cliente
- Persistencia (opcional): Firebase (Firestore + Storage)
- Videollamada: WebRTC (STUN Google)
- UI: HTML, CSS, Bootstrap, Bootstrap Icons

## Configuracion rapida

> Requiere Python 3.9+.

1. Instalar dependencias:

```
cd server
pip install -r requirements.txt
```

2. Configurar credenciales:

- Cloudinary: revisar `server/cloudinary_config.py`.
- Firebase (opcional): `server/firebase_config.py` y `server/serviceAccountKey.json`.

3. Ejecutar el servidor:

```
python app.py
```

4. Abrir en el navegador:

```
http://localhost:5001
```

## Nota sobre despliegue

- Para desarrollo local, el modo `debug=True` esta activo.
- En produccion, ajustar CORS, claves y configuraciones de Firebase/Cloudinary.

## Acceso global con ngrok

Si necesitas exponer la app a internet (por ejemplo, para pruebas remotas), puedes usar ngrok.

1. Inicia el servidor:

```
python app.py
```

2. En otra terminal, crea el tunel:

```
ngrok http 5001
```

3. Copia la URL publica que te entrega ngrok (https) y compartela.

Notas:
- Mantener abierta la terminal de ngrok mientras la app este disponible.
- Si cambias el puerto local, ajusta el comando de ngrok.

## Licencia

Este proyecto es para uso educativo y de demostracion.
