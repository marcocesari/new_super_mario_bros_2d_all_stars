#!/usr/bin/env python3
"""Dev HTTP server that sends aggressive no-cache headers on every response.

Prevents iPhone Safari / A2HS PWA from showing stale builds between reloads.
Use only during development — the published GitHub Pages site is fine with
normal caching.
"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


with ReusableTCPServer(('0.0.0.0', PORT), NoCacheHandler) as httpd:
    print(f'Dev server (no-cache) listening on http://0.0.0.0:{PORT}')
    httpd.serve_forever()
