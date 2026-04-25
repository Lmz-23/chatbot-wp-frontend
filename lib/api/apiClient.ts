import { clearAuthArtifacts, getAuthToken } from '@/lib/auth/AuthContext';

const COMPILED_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

// Resolves runtime API base URL and guards local stale builds that point to frontend port.
function resolveApiUrl() {
  // Prevent stale local builds from pointing API to frontend port 3001.
  if (typeof window !== "undefined") {
    const runtimeHost = window.location.hostname
    const isLocalHost = runtimeHost === "localhost" || runtimeHost === "127.0.0.1"

    if (isLocalHost && COMPILED_API_URL === "http://localhost:3001") {
      return "http://localhost:3000"
    }

    // If frontend is opened from phone/tablet via LAN IP, avoid calling
    // localhost from the device. Reuse the current host and keep API port.
    try {
      const compiled = new URL(COMPILED_API_URL)
      const apiHostIsLocal = compiled.hostname === "localhost" || compiled.hostname === "127.0.0.1"

      if (!isLocalHost && apiHostIsLocal) {
        return `${compiled.protocol}//${runtimeHost}:${compiled.port || "3000"}`
      }
    } catch {
      // Keep compiled URL if it is not a valid absolute URL.
    }
  }

  return COMPILED_API_URL
}

function needsNgrokBypass(apiUrl: string) {
  return apiUrl.includes("ngrok-free.dev") || apiUrl.includes("ngrok.app")
}

export async function apiClient(
  endpoint: string,
  options: RequestInit = {}
) {
  const token = getAuthToken()

  const apiUrl = resolveApiUrl()
  const url = `${apiUrl}${endpoint}`
  const includeNgrokBypass = needsNgrokBypass(apiUrl)
  console.log("API Request:", { url, method: options.method })

  // Centralized HTTP layer: auth header, JSON defaults and unified error mapping.
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(includeNgrokBypass && { "ngrok-skip-browser-warning": "true" }),
      ...options.headers,
    },
  })

  const isAuthEndpoint = endpoint.startsWith("/auth/login") || endpoint.startsWith("/auth/register")

  if (res.status === 401 && !isAuthEndpoint) {
    if (typeof window !== "undefined") {
      clearAuthArtifacts()
      window.location.href = "/login"
    }
    return
  }

  const contentType = res.headers.get("content-type") || ""
  const isJson = contentType.includes("application/json")
  const data = isJson ? await res.json() : null
  const text = isJson ? "" : await res.text()

  if (!res.ok) {
    if (data && typeof data === "object") {
      const apiError = data as { message?: string; error?: string }
      if (apiError.message) throw new Error(apiError.message)
      if (apiError.error) throw new Error(apiError.error)
    }

    if (!isJson) {
      throw new Error(
        `La API devolvió HTML/no-JSON en ${url}. Revisa NEXT_PUBLIC_API_URL y puertos.`
      )
    }

    throw new Error("Error en la petición")
  }

  return data
}