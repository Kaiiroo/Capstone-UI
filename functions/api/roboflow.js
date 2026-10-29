// Cloudflare Pages Function: relays POST /api/roboflow to the Roboflow workflow.
// Same job as server.py, which remains for running the app locally with Python.

const ROBOFLOW_TIMEOUT_MS = 90_000;

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Only signed-in GuadaHealth users may spend Roboflow credits.
async function isSignedIn(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return false;
  }

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: env.SUPABASE_ANON_KEY },
  });
  return response.ok;
}

export async function onRequestPost({ request, env }) {
  if (!env.ROBOFLOW_API_KEY || !env.ROBOFLOW_WORKSPACE || !env.ROBOFLOW_WORKFLOW) {
    return json(500, { error: 'Roboflow is not configured. Set the ROBOFLOW_API_KEY secret in Cloudflare.' });
  }

  if (!(await isSignedIn(request, env))) {
    return json(401, { error: 'Your session has expired. Sign in again to transcribe.' });
  }

  const startedAt = Date.now();
  try {
    const response = await fetch(
      `https://serverless.roboflow.com/${env.ROBOFLOW_WORKSPACE}/workflows/${env.ROBOFLOW_WORKFLOW}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.ROBOFLOW_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: request.body,
        signal: AbortSignal.timeout(ROBOFLOW_TIMEOUT_MS),
      },
    );

    console.log('Roboflow request:', {
      elapsedMs: Date.now() - startedAt,
      status: response.status,
      processingTime: response.headers.get('x-processing-time'),
      coldStart: response.headers.get('x-model-cold-start'),
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'x-processing-time': response.headers.get('x-processing-time') || '',
        'x-model-cold-start': response.headers.get('x-model-cold-start') || '',
      },
    });
  } catch (error) {
    console.log('Roboflow request failed:', { elapsedMs: Date.now() - startedAt, error: error.message });
    const reason = error.name === 'TimeoutError' ? 'the request timed out' : error.message;
    return json(502, { error: `Unable to reach Roboflow: ${reason}` });
  }
}

export function onRequest() {
  return json(405, { error: 'Use POST for transcription requests.' });
}
