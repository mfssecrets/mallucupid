// Legacy unauthenticated profile bootstrap — disabled.
// Profile creation is owned exclusively by auth `/verify`.
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'

serve((_req) =>
  new Response(JSON.stringify({ error: 'welcome function disabled' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json' },
  }),
)
