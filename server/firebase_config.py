import firebase_admin
from firebase_admin import credentials, firestore, storage
import os

# Ruta del archivo de credenciales
CREDENTIALS_PATH = os.path.join(
    os.path.dirname(__file__),
    'serviceAccountKey.json'
)

def init_firebase(): 
    """Inicializa Firebase Admin SDK"""
    try: 
        # Verifica si existe el archivo
        if not os.path.exists(CREDENTIALS_PATH):
            print(" ADVERTENCIA: No se encontró serviceAccountKey.json")
            print(" Descárgalo desde Firebase Console:")
            print("   1. Ve a https://console.firebase.google.com/")
            print("   2. Selecciona tu proyecto 'devChat'")
            print("   3. Configuración → Cuentas de servicio")
            print("   4. Generar nueva clave privada")
            print("   5. Guárdalo como 'serviceAccountKey.json' en /server/")
            return None, None
        
        # Inicializa Firebase con credenciales
        cred = credentials.Certificate(CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred, {
            'storageBucket': 'devchat-3c503.appspot.com'
        })

        # Obtiene referencias a Firestore y Storage
        db = firestore.client()
        bucket = storage.bucket()

        print(" Firebase inicializado correctamente")
        return db, bucket
    
    except FileNotFoundError: 
        print(" Error: No se encontró serviceAccountKey.json")
        return None, None
    
    except Exception as e:
        print(f" Error al inicializar Firebase: {e}")
        return None, None
    
# Inicializa al importar
db, bucket = init_firebase()