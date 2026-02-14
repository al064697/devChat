from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room, emit
from datetime import datetime

# Inicializa la aplicación Flask
app = Flask(__name__, template_folder='../templates')
app.config['SECRET_KEY'] = 'tu-clave-secreta-devChat-2026'
socketio = SocketIO(app, cors_allowed_origins="*")

# Almacena usuarios y mensajes en memoria
rooms = {}  # {nombre_sala: [usuarios]}
message_history = {}  # {nombre_sala: [mensajes]}

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    """Maneja la conexión de un nuevo cliente"""
    print(f" Usuario conectado: {request.sid}")
    emit('message', "Conectado al servidor")

@socketio.on('join_room')
def handle_join_room(data):
    """Maneja cuando un usuario se une a una sala"""
    room = data['room']
    username = data['username']
    
    print(f"{username} se unió a {room}")
    
    # Agrega a la estructura local
    if room not in rooms:
        rooms[room] = []
        message_history[room] = []
    if username not in rooms[room]:
        rooms[room].append(username)
    
    # Une al usuario al socket room
    join_room(room)
    
    # Notifica a otros usuarios
    emit('message', f"{username} se ha unido a la sala", room=room)
    emit('update_user_list', {'users': rooms[room]}, room=room)
    
    # Carga mensajes previos (últimos 20)
    for msg in message_history[room][-20:]:
        emit('message', {
            'username': msg['username'],
            'type': msg['type'],
            'content': msg['content'],
            'timestamp': msg['timestamp']
        })

@socketio.on('leave_room')
def handle_leave_room(data):
    """Maneja cuando un usuario sale de una sala"""
    room = data['room']
    username = data['username']
    
    print(f"{username} salió de {room}")
    
    # Remueve de estructura local
    if room in rooms and username in rooms[room]:
        rooms[room].remove(username)
    
    # Sale del socket room
    leave_room(room)
    
    # Notifica
    emit('message', f"{username} ha salido de la sala", room=room)
    emit('update_user_list', {'users': rooms[room]}, room=room)

@socketio.on('message')
def handle_message(data):
    """Maneja el envío de mensajes (texto, emoji, multimedia)"""
    room = data['room']
    username = data['username']
    msg_type = data['type']  # 'text', 'emoji', 'image', 'audio', 'video'
    content = data['content']
    
    timestamp = datetime.now().isoformat()
    
    print(f"📨 [{room}] {username} ({msg_type}): {content[:50] if isinstance(content, str) else '<multimedia>'}...")
    
    # Guarda en historial local
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

@socketio.on('disconnect')
def handle_disconnect():
    """Maneja la desconexión de un cliente"""
    print(f" Usuario desconectado: {request.sid}")

if __name__ == "__main__":
    print("🚀 Iniciando devChat...")
    print("📍 Servidor: http://0.0.0.0:5001")
    print("⚡ Modo local (sin persistencia)")
    
    socketio.run(app, host="0.0.0.0", port=5001, debug=True)