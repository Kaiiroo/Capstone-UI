# Capstone-datasets

## Run locally

Start the application server from the project directory:

```powershell
python server.py
```

Then open http://localhost:8000. The application server is required for the
`/api/roboflow` transcription endpoint; `python -m http.server` only serves
static files and cannot handle the transcription POST request.