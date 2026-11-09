# -*- coding: utf-8 -*-
"""
Local DOM & Network Recorder Server
Menerima payload rekaman otomatis dari browser saat pengguna menjelajah website.
"""
import http.server
import socketserver
import json
import os
import re
from datetime import datetime

PORT = 8765
SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rekaman_struktur_web")
os.makedirs(SAVE_DIR, exist_ok=True)

class RecorderHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/record":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            
            try:
                data = json.loads(body)
                url = data.get("url", "unknown_page")
                title = data.get("title", "halaman")
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                
                # Sanitize nama file
                safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', url.replace("https://sehatindonesiaku.kemkes.go.id/", ""))
                if not safe_name or safe_name == "_":
                    safe_name = "dashboard"
                
                filename = f"rekaman_{timestamp}_{safe_name[:40]}.json"
                filepath = os.path.join(SAVE_DIR, filename)
                
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)
                
                print(f"\n[✓ REKAMAN DITERIMA] Halaman: {url}")
                print(f"  ↳ Judul: {title}")
                print(f"  ↳ Elemen Form: {len(data.get('inputs', []))} input/select")
                print(f"  ↳ Tombol: {len(data.get('buttons', []))} tombol")
                print(f"  ↳ Tersimpan di: {filename}")
                
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "file": filename}).encode("utf-8"))
            except Exception as e:
                print(f"[!] Error saving record: {e}")
                self.send_response(500)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Mute default HTTP request logs
        return

def run_server():
    with socketserver.TCPServer(("127.0.0.1", PORT), RecorderHandler) as httpd:
        print("=" * 70)
        print(f"   AI DOM RECORDER SERVER AKTIF DI http://127.0.0.1:{PORT}")
        print(f"   Folder Penyimpanan: {SAVE_DIR}")
        print("   Setiap halaman yang dibuka di browser akan otomatis terekam ke sini!")
        print("=" * 70)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer dihentikan.")

if __name__ == "__main__":
    run_server()

