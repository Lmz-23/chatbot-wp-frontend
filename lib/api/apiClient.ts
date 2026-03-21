const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

export async function apiClient(
  endpoint: string,
  options: RequestInit = {}
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token")
      : null

  const url = `${API_URL}${endpoint}`
  console.log("API Request:", { url, method: options.method })

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token")
      window.location.href = "/login"
    }
    return
  }

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.message || "Error en la petición")
  }

  return data
}