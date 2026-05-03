'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import { useAuth } from '@/hooks';

type ServiceItem = {
  name: string;
  description: string;
  price: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type SettingsContext = {
  business_description: string;
  services: ServiceItem[];
  schedule: string;
  contact_info: string;
  bot_instructions: string;
  faq: FaqItem[];
};

type ToastState = {
  type: 'success' | 'error';
  message: string;
};

const EMPTY_SERVICE: ServiceItem = {
  name: '',
  description: '',
  price: '',
};

const EMPTY_FAQ: FaqItem = {
  question: '',
  answer: '',
};

const EMPTY_CONTEXT: SettingsContext = {
  business_description: '',
  services: [],
  schedule: '',
  contact_info: '',
  bot_instructions: '',
  faq: [],
};

function normalizeService(value: unknown): ServiceItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_SERVICE };
  }

  const service = value as Partial<ServiceItem>;
  return {
    name: typeof service.name === 'string' ? service.name : '',
    description: typeof service.description === 'string' ? service.description : '',
    price: typeof service.price === 'string' ? service.price : '',
  };
}

function normalizeFaq(value: unknown): FaqItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_FAQ };
  }

  const faq = value as Partial<FaqItem>;
  return {
    question: typeof faq.question === 'string' ? faq.question : '',
    answer: typeof faq.answer === 'string' ? faq.answer : '',
  };
}

function normalizeContext(value: unknown): SettingsContext {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_CONTEXT };
  }

  const context = value as Partial<SettingsContext>;

  return {
    business_description: typeof context.business_description === 'string' ? context.business_description : '',
    services: Array.isArray(context.services) ? context.services.map(normalizeService) : [],
    schedule: typeof context.schedule === 'string' ? context.schedule : '',
    contact_info: typeof context.contact_info === 'string' ? context.contact_info : '',
    bot_instructions: typeof context.bot_instructions === 'string' ? context.bot_instructions : '',
    faq: Array.isArray(context.faq) ? context.faq.map(normalizeFaq) : [],
  };
}

function cleanServiceList(services: ServiceItem[]) {
  return services
    .map((service) => ({
      name: service.name.trim(),
      description: service.description.trim(),
      price: service.price.trim(),
    }))
    .filter((service) => service.name || service.description || service.price);
}

function cleanFaqList(faq: FaqItem[]) {
  return faq
    .map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    }))
    .filter((item) => item.question || item.answer);
}

function buildEndpoint(searchParams: ReturnType<typeof useSearchParams>) {
  const businessId = searchParams.get('businessId')?.trim();
  return businessId ? `/api/settings/context?businessId=${encodeURIComponent(businessId)}` : '/api/settings/context';
}

export default function BotSettingsPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const endpoint = useMemo(() => buildEndpoint(searchParams), [searchParams]);
  const isPlatformAdmin = user?.platformRole === 'PLATFORM_ADMIN';

  const [context, setContext] = useState<SettingsContext>({ ...EMPTY_CONTEXT });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((type: ToastState['type'], message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let active = true;

    async function loadContext() {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient(endpoint);
        const nextContext = normalizeContext(response?.context ?? response);

        if (!active) return;
        setContext(nextContext);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el contexto del bot');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadContext();

    return () => {
      active = false;
    };
  }, [endpoint]);

  const updateService = useCallback((index: number, field: keyof ServiceItem, value: string) => {
    setContext((current) => ({
      ...current,
      services: current.services.map((service, serviceIndex) => (
        serviceIndex === index ? { ...service, [field]: value } : service
      )),
    }));
  }, []);

  const addService = useCallback(() => {
    setContext((current) => ({
      ...current,
      services: [...current.services, { ...EMPTY_SERVICE }],
    }));
  }, []);

  const removeService = useCallback((index: number) => {
    setContext((current) => ({
      ...current,
      services: current.services.filter((_, serviceIndex) => serviceIndex !== index),
    }));
  }, []);

  const updateFaq = useCallback((index: number, field: keyof FaqItem, value: string) => {
    setContext((current) => ({
      ...current,
      faq: current.faq.map((item, faqIndex) => (
        faqIndex === index ? { ...item, [field]: value } : item
      )),
    }));
  }, []);

  const addFaq = useCallback(() => {
    setContext((current) => ({
      ...current,
      faq: [...current.faq, { ...EMPTY_FAQ }],
    }));
  }, []);

  const removeFaq = useCallback((index: number) => {
    setContext((current) => ({
      ...current,
      faq: current.faq.filter((_, faqIndex) => faqIndex !== index),
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);

    const payload = {
      business_description: context.business_description,
      services: cleanServiceList(context.services),
      schedule: context.schedule,
      contact_info: context.contact_info,
      bot_instructions: context.bot_instructions,
      faq: cleanFaqList(context.faq),
    };

    try {
      const response = await apiClient(endpoint, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setContext(normalizeContext(response?.context ?? payload));
      showToast('success', 'Configuración guardada correctamente');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'No se pudo guardar la configuración';
      setError(message);
      showToast('error', message);
    } finally {
      setSaving(false);
    }
  }, [context, endpoint, showToast]);

  return (
    <main className="min-h-screen bg-[var(--background-tertiary)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between border-b-[0.5px] border-[#D5DFEA] pb-4">
          <Link href="/" className="flex items-center gap-3 text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white text-[15px] font-medium text-[#185FA5]">
              R
            </span>
            <span className="text-[15px] font-medium tracking-[0.02em]">Replai</span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white px-4 py-2 text-[14px] font-medium text-slate-700 transition-none"
          >
            ← Inicio
          </Link>
        </header>

        <section className="mb-6">
          <h1 className="text-[28px] font-medium leading-tight text-slate-900">Configuración del bot</h1>
          <p className="mt-1 text-[14px] font-normal text-slate-600">Define el contexto que usará tu asistente virtual</p>
          {isPlatformAdmin ? (
            <p className="mt-2 text-[13px] font-normal text-slate-500">
              Estás editando la configuración del negocio seleccionado desde el panel de administración.
            </p>
          ) : null}
        </section>

        {loading ? (
          <div className="flex flex-1 items-center justify-center rounded-[12px] border-[0.5px] border-[#D5DFEA] bg-white px-6 py-10 text-[14px] font-normal text-slate-600">
            Cargando configuración...
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 pb-28">
            {error ? (
              <div className="rounded-[12px] border-[0.5px] border-[#F2C0C0] bg-[#FFF6F6] px-4 py-3 text-[14px] font-normal text-[#A94442]">
                {error}
              </div>
            ) : null}

            <section className="rounded-[12px] border-[0.5px] border-[#D5DFEA] bg-white p-4">
              <h2 className="text-[13px] font-medium text-slate-600">Sobre el negocio</h2>
              <textarea
                value={context.business_description}
                onChange={(event) => setContext((current) => ({ ...current, business_description: event.target.value }))}
                placeholder="Ej: Somos una clínica dental con 10 años de experiencia, especializada en ortodoncia y estética dental..."
                className="mt-3 min-h-[100px] w-full resize-y rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white px-3 py-2 text-[14px] font-normal text-slate-900 outline-none placeholder:text-slate-400"
              />
            </section>

            <section className="rounded-[12px] border-[0.5px] border-[#D5DFEA] bg-white p-4">
              <h2 className="text-[13px] font-medium text-slate-600">Servicios y precios</h2>
              <div className="mt-3 flex flex-col gap-3">
                {context.services.map((service, index) => (
                  <div key={`service-${index}`} className="grid gap-3 rounded-[8px] border-[0.5px] border-[#E3EAF2] bg-[#FBFCFE] p-3 lg:grid-cols-[1fr_1.4fr_0.6fr_auto]">
                    <input
                      value={service.name}
                      onChange={(event) => updateService(index, 'name', event.target.value)}
                      placeholder="Nombre del servicio"
                      className="w-full rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white px-3 py-2 text-[14px] font-normal text-slate-900 outline-none placeholder:text-slate-400"
                    />
                    <input
                      value={service.description}
                      onChange={(event) => updateService(index, 'description', event.target.value)}
                      placeholder="Descripción"
                      className="w-full rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white px-3 py-2 text-[14px] font-normal text-slate-900 outline-none placeholder:text-slate-400"
                    />
                    <input
                      value={service.price}
                      onChange={(event) => updateService(index, 'price', event.target.value)}
                      placeholder="Precio"
                      className="w-full rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white px-3 py-2 text-[14px] font-normal text-slate-900 outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => removeService(index)}
                      className="h-10 rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white px-3 text-[14px] font-medium text-slate-500 transition-none lg:self-start"
                      aria-label="Eliminar servicio"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addService}
                  className="rounded-[8px] border-[0.5px] border-dashed border-[#B9C7D8] bg-white px-4 py-3 text-left text-[14px] font-medium text-[#185FA5] transition-none"
                >
                  + Agregar servicio
                </button>
              </div>
            </section>

            <section className="rounded-[12px] border-[0.5px] border-[#D5DFEA] bg-white p-4">
              <h2 className="text-[13px] font-medium text-slate-600">Horarios y contacto</h2>
              <div className="mt-3 grid gap-3">
                <textarea
                  value={context.schedule}
                  onChange={(event) => setContext((current) => ({ ...current, schedule: event.target.value }))}
                  placeholder="Ej: Lunes a viernes 8am-6pm, Sábados 8am-1pm"
                  className="min-h-[96px] w-full resize-y rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white px-3 py-2 text-[14px] font-normal text-slate-900 outline-none placeholder:text-slate-400"
                />
                <textarea
                  value={context.contact_info}
                  onChange={(event) => setContext((current) => ({ ...current, contact_info: event.target.value }))}
                  placeholder="Ej: WhatsApp principal, dirección, sitio web..."
                  className="min-h-[96px] w-full resize-y rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white px-3 py-2 text-[14px] font-normal text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
            </section>

            <section className="rounded-[12px] border-[0.5px] border-[#D5DFEA] bg-white p-4">
              <h2 className="text-[13px] font-medium text-slate-600">Preguntas frecuentes</h2>
              <div className="mt-3 flex flex-col gap-3">
                {context.faq.map((item, index) => (
                  <div key={`faq-${index}`} className="rounded-[8px] border-[0.5px] border-[#E3EAF2] bg-[#FBFCFE] p-3">
                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                      <input
                        value={item.question}
                        onChange={(event) => updateFaq(index, 'question', event.target.value)}
                        placeholder="Pregunta"
                        className="w-full rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white px-3 py-2 text-[14px] font-normal text-slate-900 outline-none placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => removeFaq(index)}
                        className="h-10 rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white px-3 text-[14px] font-medium text-slate-500 transition-none"
                        aria-label="Eliminar pregunta frecuente"
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      value={item.answer}
                      onChange={(event) => updateFaq(index, 'answer', event.target.value)}
                      placeholder="Respuesta"
                      className="mt-3 min-h-[96px] w-full resize-y rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white px-3 py-2 text-[14px] font-normal text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addFaq}
                  className="rounded-[8px] border-[0.5px] border-dashed border-[#B9C7D8] bg-white px-4 py-3 text-left text-[14px] font-medium text-[#185FA5] transition-none"
                >
                  + Agregar pregunta
                </button>
              </div>
            </section>

            <section className="rounded-[12px] border-[0.5px] border-[#D5DFEA] bg-white p-4">
              <h2 className="text-[13px] font-medium text-slate-600">Instrucciones especiales</h2>
              <textarea
                value={context.bot_instructions}
                onChange={(event) => setContext((current) => ({ ...current, bot_instructions: event.target.value }))}
                placeholder="Ej: No ofrecer descuentos sin autorización. Siempre solicitar nombre antes de dar precios. Derivar urgencias médicas inmediatamente a un agente..."
                className="mt-3 min-h-[120px] w-full resize-y rounded-[8px] border-[0.5px] border-[#D5DFEA] bg-white px-3 py-2 text-[14px] font-normal text-slate-900 outline-none placeholder:text-slate-400"
              />
            </section>
          </div>
        )}
      </div>

      <div className="fixed bottom-5 right-5 z-20">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || saving}
          className="inline-flex items-center rounded-[8px] bg-[#185FA5] px-5 py-3 text-[14px] font-medium text-white transition-none disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>

      {toast ? (
        <div
          className={`fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-[8px] border-[0.5px] px-4 py-3 text-[14px] font-medium ${
            toast.type === 'success'
              ? 'border-[#BFDCCF] bg-[#EAF7EF] text-[#1D9E75]'
              : 'border-[#F2C0C0] bg-[#FFF6F6] text-[#A94442]'
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}
