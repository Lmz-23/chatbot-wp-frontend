"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/apiClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "email") setEmail(value);
    if (name === "password") setPassword(value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Email y password son requeridos");
      return;
    }

    if (isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!response) {
        throw new Error("No response from server");
      }

      if (!response.token) {
        throw new Error("No token in response");
      }

      localStorage.setItem("token", response.token);
      router.replace("/");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al intentar login";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen w-full"
      style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
        <section className="relative hidden md:flex md:flex-col md:justify-between bg-[#185FA5] px-11 py-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect x="5" y="6" width="14" height="2" rx="1" fill="#185FA5" />
                <rect x="5" y="11" width="10" height="2" rx="1" fill="#185FA5" />
                <rect x="5" y="16" width="7" height="2" rx="1" fill="#185FA5" />
              </svg>
            </div>
            <span className="text-[36px] leading-none text-white font-medium">Replai</span>
          </div>

          <div className="max-w-[460px]">
            <h1 className="text-[52px] leading-[1.12] tracking-[-0.02em] text-white font-medium">
              Convierte cada mensaje de WhatsApp en una oportunidad de venta.
            </h1>
            <p className="mt-8 text-[18px] leading-[1.45] text-[#B5D4F4] font-normal max-w-[430px]">
              Automatiza respuestas, gestiona conversaciones y nunca pierdas un cliente por no responder a tiempo.
            </p>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#2A74B9] px-4 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#5DCAA5] animate-pulse" />
              <span className="text-[16px] leading-none text-white font-medium">Bot activo · responde en segundos</span>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-[#F8F9FB] px-6 py-10 md:bg-[#FAFAFA]">
          <div className="w-full max-w-[420px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#DDE3EA] bg-white px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#5DCAA5]" />
              <span className="text-[13px] leading-none text-[#6D7580] font-normal">Plataforma segura</span>
            </div>

            <h2 className="mt-7 text-[22px] leading-[1.2] text-[#1A1A1A] font-medium">Bienvenido de nuevo</h2>
            <p className="mt-2 text-[13px] leading-[1.45] text-[#7D8793] font-normal">
              Ingresa tus credenciales para continuar
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-[12px] leading-none text-[#5F6873] font-normal">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={handleChange}
                  disabled={isLoading}
                  placeholder="tu@empresa.com"
                  className="h-10 w-full rounded-[8px] border-[0.5px] border-[#CFD7E2] bg-white px-3 text-[13px] text-[#1A1A1A] font-normal outline-none transition-colors placeholder:text-[#A1A9B3] hover:bg-[#F5F7FA] focus:bg-[#F5F7FA]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-[12px] leading-none text-[#5F6873] font-normal">
                  Contraseña
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="h-10 w-full rounded-[8px] border-[0.5px] border-[#CFD7E2] bg-white px-3 text-[13px] text-[#1A1A1A] font-normal outline-none transition-colors placeholder:text-[#A1A9B3] hover:bg-[#F5F7FA] focus:bg-[#F5F7FA]"
                />
              </div>

              {error && (
                <p className="text-[12px] leading-[1.35] text-[#B42318] font-normal">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="h-10 w-full rounded-[8px] bg-[#185FA5] text-[14px] leading-none text-white font-medium disabled:opacity-70"
              >
                {isLoading ? "Cargando..." : "Iniciar sesión"}
              </button>
            </form>

            <p className="mt-6 text-center text-[12px] leading-[1.35] text-[#8B93A0] font-normal">
              ¿Problemas para acceder? Contacta a tu administrador
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}