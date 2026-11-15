#!/usr/bin/env python3
"""Static file server for SOLO mode (no Node.js needed).

    python3 serve.py          -> http://localhost:5173   (python3 serve.py 8080 picks another port)

It only serves the files in public/. Without the Node server (server.mjs) the game starts in solo mode:
the rules run inside the browser, progress is saved in that browser, and bots keep you company.
"""
import functools
import http.server
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")  # edits show up on reload
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    first = int(args[0]) if args else int(os.environ.get("PORT", 5173))
    httpd = None
    for port in range(first, first + 10):  # if the port is taken (another game server?), try the next few
        try:
            httpd = http.server.ThreadingHTTPServer(("", port), functools.partial(Handler, directory=ROOT))
            break
        except OSError:
            print(f"port {port} is in use, trying {port + 1}")
    if httpd is None:
        sys.exit("No free port found.")
    url = f"http://localhost:{port}"
    print(f"Top 1 Server (solo mode) on {url}  -  Ctrl+C to stop")
    if "--open" in sys.argv:
        import webbrowser
        webbrowser.open(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
