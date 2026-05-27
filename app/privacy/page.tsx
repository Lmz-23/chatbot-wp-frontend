import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main
      className="min-h-screen bg-[#F8F9FB] text-[#1A1A1A]"
      style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <header className="border-b border-[#E3E8EF] bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4 md:px-8">
          <Link href="/login" className="inline-flex items-center gap-3" aria-label="Ir al inicio de Replai">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#185FA5] text-white">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect x="5" y="6" width="14" height="2" rx="1" fill="currentColor" />
                <rect x="5" y="11" width="10" height="2" rx="1" fill="currentColor" />
                <rect x="5" y="16" width="7" height="2" rx="1" fill="currentColor" />
              </svg>
            </div>
            <span className="text-[18px] font-medium leading-none text-[#185FA5]">Replai</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-6 py-10 md:px-8 md:py-14">
        <section className="rounded-[16px] border border-[#E3E8EF] bg-white p-6 shadow-[0_1px_0_rgba(16,24,40,0.02)] md:p-10">
          <div className="max-w-3xl">
            <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#185FA5]">
              Privacidad
            </p>
            <h1 className="mt-3 text-[32px] font-medium leading-[1.15] text-[#1A1A1A] md:text-[40px]">
              Política de privacidad de Replai
            </h1>
            <p className="mt-4 text-[15px] leading-[1.65] text-[#5F6873]">
              Replai es una plataforma SaaS de automatización de conversaciones de WhatsApp para empresas en Latinoamérica.
              Esta política explica de forma simple qué datos recopilamos, cómo los usamos y con quién podemos compartirlos.
            </p>
          </div>

          <div className="mt-10 grid gap-6">
            <section className="rounded-[12px] border border-[#E3E8EF] bg-[#FAFBFC] p-5">
              <h2 className="text-[18px] font-medium text-[#1A1A1A]">Qué datos recopilamos</h2>
              <p className="mt-3 text-[14px] leading-[1.7] text-[#5F6873]">
                Podemos recopilar información que compartes con Replai durante el uso del servicio, incluyendo nombre,
                teléfono y mensajes de WhatsApp transmitidos a través de la API de Meta. También podemos almacenar datos
                técnicos necesarios para operar la plataforma y mantener la seguridad del servicio.
              </p>
            </section>

            <section className="rounded-[12px] border border-[#E3E8EF] bg-[#FAFBFC] p-5">
              <h2 className="text-[18px] font-medium text-[#1A1A1A]">Cómo usamos los datos</h2>
              <p className="mt-3 text-[14px] leading-[1.7] text-[#5F6873]">
                Usamos los datos para operar el servicio de automatización, enviar y recibir mensajes, responder
                conversaciones, actualizar el estado de leads, ofrecer soporte y mejorar la confiabilidad de la plataforma.
                No usamos tus datos personales para fines distintos a la prestación del servicio contratado.
              </p>
            </section>

            <section className="rounded-[12px] border border-[#E3E8EF] bg-[#FAFBFC] p-5">
              <h2 className="text-[18px] font-medium text-[#1A1A1A]">Con quién compartimos los datos</h2>
              <p className="mt-3 text-[14px] leading-[1.7] text-[#5F6873]">
                Podemos compartir información únicamente con proveedores necesarios para prestar el servicio, como Meta
                y WhatsApp Cloud API para el envío y recepción de mensajes, y proveedores de infraestructura, hosting,
                bases de datos y monitoreo que nos ayudan a operar Replai.
              </p>
            </section>

            <section className="rounded-[12px] border border-[#E3E8EF] bg-[#FAFBFC] p-5">
              <h2 className="text-[18px] font-medium text-[#1A1A1A]">Retención de datos</h2>
              <p className="mt-3 text-[14px] leading-[1.7] text-[#5F6873]">
                Conservamos los datos mientras tu cuenta o tu negocio sigan activos, o durante el tiempo necesario para
                prestar el servicio, cumplir obligaciones legales, resolver incidentes y proteger la seguridad de la
                plataforma. Cuando corresponda, podremos eliminar o anonimizar la información de acuerdo con nuestros
                procesos internos y requerimientos legales aplicables.
              </p>
            </section>

            <section className="rounded-[12px] border border-[#E3E8EF] bg-[#FAFBFC] p-5">
              <h2 className="text-[18px] font-medium text-[#1A1A1A]">Contacto</h2>
              <p className="mt-3 text-[14px] leading-[1.7] text-[#5F6873]">
                Si tienes preguntas sobre esta política de privacidad o sobre el tratamiento de tus datos, puedes
                escribirnos a <a href="mailto:leox2383@gmail.com" className="text-[#185FA5] underline decoration-[#B5D4F4] underline-offset-4">leox2383@gmail.com</a>.
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
