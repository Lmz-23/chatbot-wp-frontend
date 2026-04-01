# Replai — Frontend Context

## Proyecto
Panel de agentes para gestión de conversaciones y leads de WhatsApp.
Nombre del producto: Replai.
Stack: Next.js (App Router), React, TypeScript.
Desplegado en Vercel.

## Arquitectura
- hooks por dominio: useConversations, useConversationMessages, useLeads, useAuth
- Cliente HTTP centralizado en lib/api/apiClient.ts
- Componentes desacoplados con utils compartidos en shared/
- Polling cada 5s (pendiente migrar a SSE o WebSocket)

## Sistema de diseño Replai
- Color primario: #185FA5 (azul)
- Acento verde para estados activos: #1D9E75
- Tipografía: sans-serif sistema o Inter, solo pesos 400 y 500, nunca 600 ni 700
- Sin gradientes, sin sombras decorativas, todo flat y limpio
- Border-radius: 8px componentes, 12px cards
- Bordes: 0.5px solid, nunca gruesos

## Páginas existentes
- /login — formulario de acceso con layout dos columnas
- / — Navigation Hub con cards por módulo
- /conversations — panel principal con lista + chat, responsive móvil
- /leads — gestión de prospectos con filtros y estados

## Comportamiento responsive
- Desktop (768px+): layout dos columnas en conversations
- Móvil (<768px): una sola columna, lista O chat, nunca los dos juntos
- Input de mensaje fijo al fondo en móvil con safe-area-inset-bottom

## Reglas de código
- Sin lógica de negocio fuera de hooks
- Sin llamadas directas a fetch, siempre usar apiClient
- Sin hardcodeo de URLs, usar variables de entorno
- Token JWT en memoria o httpOnly cookie, no localStorage
- Roles traducidos al español en UI: OWNER → Administrador, AGENT → Agente

## Deuda técnica conocida
- useConversations tiene ~600 líneas, pendiente dividir
- Polling agresivo en múltiples hooks, pendiente estrategia híbrida
- Redirect de auth en render de layout, pendiente mover a useEffect o middleware

## Lo que NO hacer
- No romper el sistema de prioridad visual existente (🔴 cliente espera, 🟠 bot respondió)
- No cambiar lógica de hooks sin entender dependencias cruzadas
- No agregar librerías de UI externas sin consultar (Tailwind ya está, no agregar shadcn ni MUI)