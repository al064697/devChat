import cloudinary, cloudinary.uploader, os

"""  C O N F I G U R A C I O N  D E  C L O U D I N A R Y  """

# Creedenciales para conectar API
cloudinary.config(
    cloud_name="do2nh4ehq",        # Tu Cloud Name
    api_key="354111759542327",     # Tu API Key
    api_secret="8U89uYirUHYRauy_wl2rvjS2f4A"  # Tu API Secret (GUÁRDALO EN SECRETO)
)

def upload_to_cloudinary(file, media_type, room, username): 
    """
    Sube un archivo a Cloudinary y retorna la URL pública.

    Args:
    - file: El archivo a subir 
    - media_type: El tipo de archivo (e.g., 'image', 'video')
    - room: La sala a la que pertenece el mensaje
    - username: El usuario que envía el mensaje

    Returns: 
    - La URL pública del archivo subido a Cloudinary
    """
    try: 
        # Determina el tipo de recurso para Cloudinary
        resource_type_map = {
            'image': 'image',      # Fotos/imágenes
            'video': 'video',      # Videos
            'audio': 'raw'         # Audio (archivos sin procesar)
        }
        resource_type = resource_type_map.get(media_type, 'raw') # Por defecto, trata como 'raw' si no es imagen o video

        """
        Nombre único para el archivo en Cloudinary.
        Ejemplo: "devChat/sala123/image/2026-02-15_usuario1_abc123.jpg"
        """
        public_id = f"devChat/{room}/{media_type}/{username}_{os.urandom(8).hex()}"

        # Se sube el archivo a Cloudinary
        result = cloudinary.uploader.upload(
            file,
            resource_type=resource_type,
            public_id=public_id,
            folder=f"devChat/{room}", # Organización por carpeta
            overwrite=False, # No sobrescribir archivos con el mismo nombre
            transformation=[
                {'quality': 'auto'}, # Optimización automática de calidad
                {'fetch_format': 'auto'} # Formato automático para mejor rendimiento
            ]
        )
        return {
            'success': True,
            'url': result['secure_url'], # URL segura (HTTPS) del archivo subido
            'public_id': result['public_id'], # ID público del archivo en Cloudinary
            'media_type': media_type
        }
    except Exception as e:
        print(f"Error al subir a Cloudinary: {e}")
        return {
            'success': False,
            'error': str(e)
        }