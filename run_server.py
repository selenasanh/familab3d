import http.server
import socketserver
import socket
import os
import urllib.request
import sys

PORT = 8000

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # No necesita conectarse realmente para obtener la IP local
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def generate_qr_code(url):
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={urllib.parse.quote(url)}"
    qr_path = "qr_conexion.png"
    try:
        print("[Servidor] Generando código QR de conexión...")
        urllib.request.urlretrieve(qr_url, qr_path)
        print(f"[Servidor] Código QR guardado como '{qr_path}'")
        return qr_path
    except Exception as e:
        print(f"[Servidor] No se pudo descargar el código QR automáticamente (requiere Internet): {e}")
        return None

def start_server():
    local_ip = get_local_ip()
    server_url = f"http://{local_ip}:{PORT}/index.html"
    
    print("\n" + "="*60)
    print(" 🚀 SERVIDOR LOCAL DE FAMILAB3D PARA TABLET")
    print("="*60)
    print(f"\n1. Conecta tu tablet al MISMO Wi-Fi que este ordenador.")
    print(f"2. Abre el navegador de tu tablet e ingresa esta dirección:\n")
    print(f"    👉  \033[1;36m{server_url}\033[0m  👈")
    print("\n" + "-"*60)
    
    # Intentar generar y abrir el código QR
    qr_file = generate_qr_code(server_url)
    if qr_file and os.path.exists(qr_file):
        print("[Servidor] Abriendo el código QR para que lo escanees con tu tablet...")
        try:
            if sys.platform.startswith('win'):
                os.startfile(qr_file)
            elif sys.platform.startswith('darwin'):
                os.system(f"open {qr_file}")
            else:
                os.system(f"xdg-open {qr_file}")
        except Exception as e:
            print(f"[Servidor] No se pudo abrir la imagen automáticamente: {e}")
    
    print("\n[Servidor] Iniciando servidor local... (Presiona Ctrl + C para detenerlo)")
    
    Handler = http.server.SimpleHTTPRequestHandler
    # Permitir reutilización de dirección para evitar error de puerto ocupado
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[Servidor] Servidor detenido por el usuario.")
            if qr_file and os.path.exists(qr_file):
                try:
                    os.remove(qr_file)
                except Exception:
                    pass

if __name__ == "__main__":
    start_server()
