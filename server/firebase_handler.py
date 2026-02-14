from firebase_admin import firestore, storage
from datetime import datetime
import uuid
import base64

class FirebaseHandler: 
    def __init__(self, db, bucket):
        self.db = db
        self.bucket = bucket

    # ============ MENSAJES ============

    def save_message(self, room, username, msg_type, content, timestamp=None):
        """Guarda un mensaje en Firestore"""
        try: 
            if timestamp is None: 
                timestamp = datetime.now()
            
            message_data = {
                'username': username, 
                'type': msg_type, 
                'content': content,
                'timestamp': timestamp,
                'room': room
            }

            # Si es multimedia, guarda en Storage
            if msg_type in ['image', 'audio', 'video'] and isinstance(content, str) and content.startswith('data:'):
                url = self.save_media(room, msg_type, content, username)
                if url:
                    message_data['content'] = url

            # Guardar en Firestore
            doc_ref = self.db.collection('rooms').document(room).collection('messages').document()
            doc_ref.set(message_data)

            return {
                'success': True,
                'message_id': doc_ref.id,
                'data': message_data
            } 
        
        except Exception as e: 
            print(f" Error al guardar mensaje: {e}")
            return {'success': False, 'error': str(e)}

    def get_messages(self, room, limit=50):
        """Obtiene mensajes de una sala"""
        try: 
            messages = []
            query = (self.db.collection('rooms')
                    .document(room)
                    .collection('messages')
                    .order_by('timestamp', direction=firestore.Query.DESCENDING)
                    .limit(limit))
            docs = query.stream()
            
            for doc in docs: 
                msg = doc.to_dict()
                msg['id'] = doc.id
                messages.append(msg)

            messages.reverse()
            return messages
        
        except Exception as e: 
            print(f" Error al obtener mensajes: {e}")
            return []

    # ============ MULTIMEDIA ============

    def save_media(self, room, media_type, base64_content, username):
        """Guarda multimedia en Firebase Storage"""
        try: 
            # Decodifica base64
            if base64_content.startswith('data:'):
                base64_content = base64_content.split(',')[1]
            
            media_bytes = base64.b64decode(base64_content)

            # Determina extensión
            extensions = {
                'image': 'jpg',
                'audio': 'webm',
                'video': 'webm'
            }
            ext = extensions.get(media_type, 'bin')

            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"{timestamp}_{username}_{uuid.uuid4().hex[:8]}.{ext}"
            path = f"rooms/{room}/{media_type}/{filename}"

            blob = self.bucket.blob(path)
            blob.upload_from_string(media_bytes, content_type=self._get_mime_type(media_type))
            blob.make_public() 
            url = blob.public_url

            print(f" Media guardada: {path}")
            return url
        
        except Exception as e:
            print(f" Error al guardar media: {e}")
            return None
    
    @staticmethod
    def _get_mime_type(media_type):
        """Retorna MIME type según tipo de media"""
        types = {
            'image': 'image/jpeg',
            'audio': 'audio/webm',
            'video': 'video/webm'
        }
        return types.get(media_type, 'application/octet-stream')

    # ============ USUARIOS ============

    def add_user_to_room(self, room, username): 
        """Agrega un usuario a una sala"""
        try: 
            user_data = {
                'joined_at': datetime.now(),
                'last_seen': datetime.now()
            }

            self.db.collection('rooms').document(room).collection('users').document(username).set(user_data, merge=True)
            print(f"Usuario {username} agregado a {room}")
            return True
        
        except Exception as e:
            print(f" Error al agregar usuario: {e}")
            return False

    def remove_user_from_room(self, room, username):
        """Elimina un usuario de una sala"""
        try: 
            self.db.collection('rooms').document(room).collection('users').document(username).delete()
            print(f" Usuario {username} removido de {room}")
            return True
        
        except Exception as e:
            print(f" Error al remover usuario: {e}")
            return False
        
    def get_room_users(self, room):
        """Obtiene la lista de usuarios en una sala"""
        try: 
            users = []
            docs = self.db.collection('rooms').document(room).collection('users').stream()
            for doc in docs: 
                users.append(doc.id)
            return users
        
        except Exception as e:
            print(f" Error al obtener usuarios: {e}")
            return []

    # ============ ESTADÍSTICAS ============

    def get_room_stats(self, room):
        """Obtiene estadísticas de una sala"""
        try:
            messages = self.get_messages(room, limit=1000)
            messages_count = len(messages)
            users = self.get_room_users(room)

            stats = {
                'room': room,
                'total_messages': messages_count,
                'active_users': len(users),
                'users': users,
                'last_updated': datetime.now()
            }
            return stats
        
        except Exception as e:
            print(f" Error al obtener estadísticas: {e}")
            return None
