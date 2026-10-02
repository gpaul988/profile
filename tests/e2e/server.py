from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class QuietRequestHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


ThreadingHTTPServer(('127.0.0.1', 4173), QuietRequestHandler).serve_forever()
