# Los EMIT envían mensajes al cliente (GUI) mientras que print() notifica de los cambios en la consola

"""
- Flask crea el servidor web
- render_template permite mostrar archivos HTML
- request maneja las solicitudes del cliente
- SocketIO maneja la comunicación en tiempo real entre cliente y servidor
- join_room y leave_room permiten gestionar salas de chat
- emit envía mensajes a los clientes conectados
- datetime se usa para marcar la hora de los mensajes
- FirebaseHandler es una clase personalizada para interactuar con Firebase (Firestore y Storage)
"""

from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room, emit
from datetime import datetime
from firebase_config import db, bucket
from firebase_handler import FirebaseHandler
from cloudinary_config import upload_to_cloudinary

# Inicializa la aplicación Flask
app = Flask(__name__, template_folder='../templates', static_folder='../static') # Configura las carpetas de plantillas y archivos estáticos (CSS, JS, imágenes)
app.config['SECRET_KEY'] = 'tu-clave-secreta-devChat-2026' # Configura una clave secretas oara sesiones seguras (se puede modificar más adelante)
socketio = SocketIO(app, cors_allowed_origins="*") # Permite conexiones desde cualquier origen (útil para desarrollo, ajustar en producción)

# Inicializa Firebase Handler
firebase_handler = FirebaseHandler(db, bucket) if db and bucket else None 

# Almacena usuarios y mensajes en memoria
rooms = {}  # {nombre_sala: [usuarios]}
message_history = {}  # {nombre_sala: [mensajes]}

@app.route('/')
def index():
    return render_template('index.html') # Renderiza la página de HTML para que el programa la pueda msotrar

# Maneja la conexión de un nuevo cliente
@socketio.on('connect')
def handle_connect():
    print(f" Usuario conectado: {request.sid}")
    emit('message', "Conectado al servidor")

# Detecta cuando un usuario se ha unido a una sala
@socketio.on('join_room')
def handle_join_room(data):
    room = data['room'] # La sala a la que el usuario se va a unir
    username = data['username'] # El usuario que se va a unir a la sala
    
    print(f"{username} se unió a {room}") # Hace especificación de qué usuario y a cuál sala se ha unido 
    
    # Agrega a la estructura local 
    if room not in rooms: # Si la sala no existe, se crea 
        rooms[room] = []
        message_history[room] = [] 
    if username not in rooms[room]: # Si el usuario no está en la sala, se agrega 
        rooms[room].append(username)
    
    # Guarda en Firebase si está disponible
    if firebase_handler:
        firebase_handler.add_user_to_room(room, username)
    
    join_room(room) # Une al usuario a la sala

    # Notifica a otros usuarios 
    emit('message', f"{username} se ha unido a la sala", room=room) # Notifica que el usuario se ha unido a la sala 
    emit('update_user_list', {'users': rooms[room]}, room=room) # Actualiza la lista de usuarios en la sala para todos los clientes conectados a esa sala 
    
    # Carga mensajes previos (últimos 20)
    if firebase_handler:
        prev_messages = firebase_handler.get_messages(room, limit=20) # Obtiene los últimos 20 mensajes de la sala desde Firebase
        for msg in prev_messages: 
            emit('message', { # Muestra cada mensaje previo al usuario que se acaba de unir
                'username': msg['username'],
                'type': msg['type'],
                'content': msg['content'],
                'timestamp': msg['timestamp']
            })
    else: # Si no hay Firebase, muestra el historial local (últimos 20 mensajes)
        for msg in message_history[room][-20:]: # Muestra los últimos 20 mensajes del historial local
            emit('message', {
                'username': msg['username'],
                'type': msg['type'],
                'content': msg['content'],
                'timestamp': msg['timestamp']
            })

# Maneja cuando un usuario sale de la sala
@socketio.on('leave_room')
def handle_leave_room(data):
    room = data['room'] # La sala de la que el usuario se va a salir
    username = data['username'] # El usuario que se va a salir de la sala
    
    print(f"{username} salió de {room}") # Hace especificación de qué usuario y de cuál sala se ha salido
    
    # Remueve de estructura local
    if room in rooms and username in rooms[room]:
        rooms[room].remove(username)
    
    # Remueve de Firebase
    if firebase_handler:
        firebase_handler.remove_user_from_room(room, username)
    
    # Sale del socket room
    leave_room(room)
    
    # Notifica a otros usuarios qué usuario se ha salido de la sala y actualiza la lista de usuarios
    emit('message', f"{username} ha salido de la sala", room=room) 
    emit('update_user_list', {'users': rooms[room]}, room=room)

# Maneja el envío de mensajes (texto, emoji y multimedia)
@socketio.on('message')
def handle_message(data):
    room = data['room']
    username = data['username'] 
    msg_type = data['type']  # 'text', 'emoji', 'image', 'audio', 'video'
    content = data['content'] 
    
    timestamp = datetime.now().isoformat() 
    
    print(f" [{room}] {username} ({msg_type}): {content[:50] if isinstance(content, str) else '<multimedia>'}...")
    
    # Guarda en Firestore si Firebase está disponible
    if firebase_handler:
        firebase_handler.save_message(room, username, msg_type, content, timestamp)
    
    # Guarda también en historial local
    if room not in message_history:
        message_history[room] = []
    
    message_data = {
        'username': username,
        'type': msg_type,
        'content': content,
        'timestamp': timestamp
    }
    message_history[room].append(message_data)
    
    # Envía a todos en la sala
    emit('message', message_data, room=room)

# Avisa si el usuario del otro lado de la pantalla se encuentra escribiendo o no
@socketio.on('typing')
def handle_typing(data):
    """Maneja el indicador 'está escribiendo...'"""
    room = data['room']
    username = data['username']
    is_typing = data['is_typing']
    
    emit('user_typing', {
        'username': username,
        'is_typing': is_typing
    }, room=room)

# Maneja la desconexión de un usuario
@socketio.on('disconnect')
def handle_disconnect(): # Manejar desconexión
    print(f" Usuario desconectado: {request.sid}")

@app.route('/upload', methods=['POST'])
def upload_file():
    """
    Endpoint para subir archivos multimedia (imágenes, videos, audio) a Cloudinary.
    Recibe:
    - file: El archivo a subir
    - media_type: El tipo de archivo ('image', 'video', 'audio')
    - room: La sala a la que pertenece el mensaje
    - username: El usuario que envía el mensaje

    Retorna: 
    - JSON con el resultado de la subida (URL del archivo o error)
    """
    try: 
        # Verifica que el archivo exista
        if 'file' not in request.files: 
            return {"success": False, "error": "No se encontró el archivo"}, 400
        
        file = request.files['file']
        media_type = request.form.get('media_type', 'raw') # Por defecto, trata como 'raw' si no se especifica
        room = request.form.get('room', 'default')
        username = request.form.get('username', 'anonymous')

        if file.filename == '':
            return {"success": False, "error": "Archivo sin nombre"}, 400
        
        # Sube a Cloudinary
        result = upload_to_cloudinary(file, media_type, room, username)

        if result['success']:
            # Si se subió correctamente, envía el mensaje a la sala
            return {
                "success": True,
                "url": result['url'],
                "public_id": result['public_id'],
                "media_type": result['media_type']
            }
        else: 
            return {
                "success": False, 
                "error": result['error']
                }, 500
    except Exception as e:
        print(f"Error en /upload: {e}")
        return {"success": False, "error": str(e)}, 500

if __name__ == "__main__":
    print("Iniciando devChat...")
    print("Servidor: http://0.0.0.0:5001") # Servidor global a donde tira el servicio
    if firebase_handler:
        print("Con Firebase (Firestore + Storage)") # Avisa si Firebase está disponible
    else:
        print("⚡ Modo local (sin persistencia)") # Si no está disponible se procede con el localstorage
    
    socketio.run(app, host="0.0.0.0", port=5001, debug=True) 