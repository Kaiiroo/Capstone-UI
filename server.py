import json
import re
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).parent
ROBOFLOW_ENDPOINT = 'https://serverless.roboflow.com/infer/workflows'
ROBOFLOW_TIMEOUT_SECONDS = 90


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

        started_at = time.perf_counter()
        try:
            with urlopen(request, timeout=ROBOFLOW_TIMEOUT_SECONDS) as response:
                result = json.loads(response.read())
                elapsed_ms = round((time.perf_counter() - started_at) * 1000)
                print(
                    'Roboflow request:',
                    {
                        'elapsedMs': elapsed_ms,
                        'status': response.status,
                        'processingTime': response.headers.get('x-processing-time'),
                        'coldStart': response.headers.get('x-model-cold-start'),
                    },
                    flush=True,
                )
                self.send_json(response.status, result)
        except HTTPError as error:
            elapsed_ms = round((time.perf_counter() - started_at) * 1000)
            print(
                'Roboflow HTTP error:',
                {'elapsedMs': elapsed_ms, 'status': error.code},
                flush=True,
            )
            try:
                body = json.loads(error.read())
            except json.JSONDecodeError:
                body = {'error': error.reason}
            self.send_json(error.code, body)
        except (URLError, TimeoutError) as error:
            reason = getattr(error, 'reason', str(error))
            elapsed_ms = round((time.perf_counter() - started_at) * 1000)
            print(
                'Roboflow request failed:',
                {'elapsedMs': elapsed_ms, 'error': reason},
                flush=True,
            )
            self.send_json(502, {'error': f'Unable to reach Roboflow: {reason}'})

    def send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionAbortedError):
            self.log_message('Client disconnected before the response was sent')


if __name__ == '__main__':
    server = ThreadingHTTPServer(('localhost', 8000), AppHandler)
    print('Serving GuadaHealth at http://localhost:8000')
    server.serve_forever()
