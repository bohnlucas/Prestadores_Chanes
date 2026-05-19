import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "Faltam variáveis VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY. Configure no .env (local) e nas Environment Variables do Vercel (produção)."
  );
}

export const supabase = createClient(url, key);

// Conversores entre o formato do app (camelCase) e o do banco (snake_case)
export const toDb = (p) => ({
  id: p.id,
  name: p.name,
  company: p.company || null,
  service_type: p.serviceType || null,
  phone: p.phone || null,
  email: p.email || null,
  budget: p.budget ? parseFloat(p.budget) : null,
  status: p.status || "contato_inicial",
  referred_by: p.referredBy || null,
  notes: p.notes || null,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

export const fromDb = (r) => ({
  id: r.id,
  name: r.name || "",
  company: r.company || "",
  serviceType: r.service_type || "",
  phone: r.phone || "",
  email: r.email || "",
  budget: r.budget != null ? String(r.budget) : "",
  status: r.status || "contato_inicial",
  referredBy: r.referred_by || "",
  notes: r.notes || "",
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
