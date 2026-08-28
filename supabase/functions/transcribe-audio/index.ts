import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2.111.0"

const BUCKET = "quicknotes-resources"
const PROVIDER_ID = "openai-whisper-file-v1"
const MODEL_ID = "whisper-1"
const MODEL_VERSION = "provider-managed-alias"
const MAX_AUDIO_BYTES = 24 * 1024 * 1024
const MAX_SEGMENTS = 2_000
const MAX_TRANSCRIPT_CHARACTERS = 200_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/flac",
])

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
})

const safeFileName = (value: unknown, mimeType: string) => {
  const fallbackExtension: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/aac": "aac",
    "audio/flac": "flac",
  }
  const cleaned = String(value || "Recording")
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_")
    .trim()
    .slice(0, 180) || "Recording"
  return /\.[a-z0-9]{2,5}$/i.test(cleaned)
    ? cleaned
    : `${cleaned}.${fallbackExtension[mimeType] || "audio"}`
}

const providerAvailable = async (apiKey: string) => {
  if (!apiKey) return false
  try {
    const response = await fetch(`https://api.openai.com/v1/models/${MODEL_ID}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    })
    return response.ok
  } catch {
    return false
  }
}

const sha256 = async (blob: Blob) => {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
  return `sha256:${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("")}`
}

const boundedSegments = (payload: Record<string, unknown>, durationMs: number | null) => {
  const source = Array.isArray(payload.segments) ? payload.segments : []
  const fallbackText = String(payload.text || "").trim()
  const values = source.length > 0 ? source : fallbackText ? [{ text: fallbackText, start: 0, end: (durationMs || 0) / 1000 }] : []
  if (values.length === 0 || values.length > MAX_SEGMENTS) throw new Error("invalid_result")
  let characterCount = 0
  return values.map((entry) => {
    const row = entry && typeof entry === "object" ? entry as Record<string, unknown> : {}
    const text = String(row.text || "").trim()
    characterCount += text.length
    const startMs = Math.max(0, Math.round(Number(row.start || 0) * 1000))
    const rawEndMs = Math.max(startMs, Math.round(Number(row.end || row.start || 0) * 1000))
    const endMs = durationMs == null ? rawEndMs : Math.min(durationMs, rawEndMs)
    if (!text || characterCount > MAX_TRANSCRIPT_CHARACTERS || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      throw new Error("invalid_result")
    }
    return { text, startMs, endMs }
  })
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  const authorization = request.headers.get("Authorization") || ""
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY") || ""
  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "unauthorized" }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: "unauthorized" }, 401)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return json({ error: "invalid_request" }, 400)
  }

  if (body.action === "capability") {
    const available = await providerAvailable(openAiApiKey)
    return json({
      available,
      providerId: PROVIDER_ID,
      modelId: MODEL_ID,
      modelVersion: MODEL_VERSION,
      processingLocation: "external",
      maxBytes: MAX_AUDIO_BYTES,
      reason: available ? null : "Audio-file transcription is not configured for this deployment.",
    })
  }

  if (body.action !== "transcribe") return json({ error: "invalid_request" }, 400)
  if (!await providerAvailable(openAiApiKey)) return json({ error: "provider_unavailable" }, 503)

  const noteId = String(body.noteId || "")
  const resourceId = String(body.resourceId || "")
  if (!UUID.test(noteId) || !UUID.test(resourceId)) return json({ error: "invalid_request" }, 400)

  const { data: resource, error: resourceError } = await userClient
    .from("resources")
    .select("id,user_id,kind,mime_type,file_name,byte_size,checksum,duration_ms,storage_path")
    .eq("id", resourceId)
    .eq("user_id", authData.user.id)
    .maybeSingle()
  if (resourceError || !resource || resource.kind !== "audio") return json({ error: "source_unavailable" }, 404)

  const { data: link, error: linkError } = await userClient
    .from("note_resources")
    .select("id")
    .eq("note_id", noteId)
    .eq("resource_id", resourceId)
    .eq("resource_user_id", authData.user.id)
    .maybeSingle()
  if (linkError || !link) return json({ error: "source_unavailable" }, 404)

  const byteSize = Number(resource.byte_size)
  if (!Number.isInteger(byteSize) || byteSize < 1 || byteSize > MAX_AUDIO_BYTES || !AUDIO_TYPES.has(resource.mime_type)) {
    return json({ error: "source_too_large" }, 413)
  }
  if (resource.storage_path !== `${authData.user.id}/${resourceId}`) return json({ error: "source_unavailable" }, 404)

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: claimed, error: capacityError } = await serviceClient.rpc("claim_audio_transcription_capacity", {
    p_user_id: authData.user.id,
    p_byte_count: byteSize,
  })
  if (capacityError) return json({ error: "provider_unavailable" }, 503)
  if (!claimed) return json({ error: "rate_limited" }, 429)

  const { data: audio, error: downloadError } = await userClient.storage.from(BUCKET).download(resource.storage_path)
  if (downloadError || !audio || audio.size !== byteSize) return json({ error: "source_unavailable" }, 404)
  if (String(resource.checksum || "").startsWith("sha256:") && await sha256(audio) !== resource.checksum) {
    return json({ error: "source_changed" }, 409)
  }

  const form = new FormData()
  form.append("file", new File([audio], safeFileName(resource.file_name, resource.mime_type), { type: resource.mime_type }))
  form.append("model", MODEL_ID)
  form.append("response_format", "verbose_json")
  form.append("timestamp_granularities[]", "segment")
  const language = String(body.language || "").trim().toLowerCase()
  if (/^[a-z]{2}$/.test(language)) form.append("language", language)

  let providerResponse: Response
  try {
    providerResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiApiKey}` },
      body: form,
      signal: AbortSignal.timeout(150_000),
    })
  } catch {
    return json({ error: "provider_timeout" }, 504)
  }
  if (!providerResponse.ok) {
    return json({ error: providerResponse.status === 429 ? "rate_limited" : "provider_failed" }, providerResponse.status === 429 ? 429 : 502)
  }

  let providerPayload: Record<string, unknown>
  try {
    providerPayload = await providerResponse.json()
  } catch {
    return json({ error: "provider_failed" }, 502)
  }

  const durationMs = Number.isFinite(Number(providerPayload.duration))
    ? Math.max(0, Math.round(Number(providerPayload.duration) * 1000))
    : resource.duration_ms == null ? null : Number(resource.duration_ms)
  try {
    return json({
      providerId: PROVIDER_ID,
      modelId: MODEL_ID,
      modelVersion: MODEL_VERSION,
      processingLocation: "external",
      language: /^[a-z]{2}$/.test(language) ? language : null,
      sourceFingerprint: resource.checksum,
      durationMs,
      segments: boundedSegments(providerPayload, durationMs),
    })
  } catch {
    return json({ error: "provider_result_invalid" }, 502)
  }
})
