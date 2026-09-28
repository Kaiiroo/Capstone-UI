import json
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).parent
ROBOFLOW_ENDPOINT = 'https://serverless.roboflow.com/infer/workflows'


def read_config_value(name):
    config = (ROOT / 'js' / 'config' / 'roboflow.js').read_text(encoding='utf-8')
    match = re.search(rf"export const {name}\s*=\s*['\"]([^'\"]*)['\"]", config)
    return match.group(1) if match else ''


class AppHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:8000')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:8000')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path != '/api/roboflow':
            self.send_error(404)
            return

        content_length = int(self.headers.get('Content-Length', '0'))
        request_body = self.rfile.read(content_length)
        workspace = read_config_value('ROBOFLOW_WORKSPACE')
        workflow = read_config_value('ROBOFLOW_WORKFLOW')
        api_key = read_config_value('ROBOFLOW_API_KEY')

        if not all((workspace, workflow, api_key)):
            self.send_json(500, {'error': 'Roboflow is not configured in js/config/roboflow.js.'})
            return

        request = Request(
            f'{ROBOFLOW_ENDPOINT}/{workspace}/{workflow}',
            data=request_body,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            method='POST',
        )

        try:
            with urlopen(request, timeout=30) as response:
                self.send_json(response.status, json.loads(response.read()))
        except HTTPError as error:
            try:
                body = json.loads(error.read())
            except json.JSONDecodeError:
                body = {'error': error.reason}
            self.send_json(error.code, body)
        except (URLError, TimeoutError) as error:
            self.send_json(502, {'error': f'Unable to reach Roboflow: {error.reason}'})

    def send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    server = ThreadingHTTPServer(('localhost', 8000), AppHandler)
    print('Serving GuadaHealth at http://localhost:8000')
    server.serve_forever()
