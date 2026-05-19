import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Search, Edit2, Trash2, Phone, Mail, X, MessageCircle, Hammer,
  Filter, ChevronDown, ChevronRight, StickyNote, Users, LayoutList,
  LayoutGrid, ArrowUpDown, Upload, Download,
} from "lucide-react";
import { supabase, toDb, fromDb } from "./supabase";

const SERVICE_TYPES = [
  "Arquiteto / Designer", "Engenheiro", "Empreiteiro geral", "Pedreiro",
  "Eletricista", "Encanador", "Marceneiro", "Marmoraria", "Gesseiro",
  "Pintor", "Vidraçaria", "Serralheria", "Instalador (ar / persiana / piso)", "Outro",
];

const STATUS_OPTIONS = [
  { value: "contato_inicial", label: "Contato inicial", dot: "bg-stone-400" },
  { value: "aguardando_orcamento", label: "Aguardando orçamento", dot: "bg-amber-500" },
  { value: "orcamento_recebido", label: "Orçamento recebido", dot: "bg-sky-500" },
  { value: "em_negociacao", label: "Em negociação", dot: "bg-violet-500" },
  { value: "contratado", label: "Contratado", dot: "bg-emerald-600" },
  { value: "descartado", label: "Descartado", dot: "bg-rose-400" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "name", label: "Nome (A-Z)" },
  { value: "budget_desc", label: "Orçamento (maior)" },
  { value: "budget_asc", label: "Orçamento (menor)" },
];

const PERIOD_OPTIONS = [
  { value: "", label: "Qualquer data" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

const statusMeta = (v) => STATUS_OPTIONS.find((s) => s.value === v) || STATUS_OPTIONS[0];
const fmtBRL = (n) => {
  const v = parseFloat(n);
  if (!v || isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};
const onlyDigits = (s) => (s || "").replace(/\D/g, "");
const fmtPhone = (raw) => {
  const d = onlyDigits(raw);
  if (!d) return "";
  if (d.length <= 10) return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
    [a && `(${a}`, a && a.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""));
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
};
const waLink = (raw) => {
  const d = onlyDigits(raw);
  if (!d) return null;
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
};
const fmtDate = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); } catch { return ""; }
};
const daysSince = (iso) => {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
};

const emptyProvider = {
  name: "", company: "", serviceType: "", phone: "", email: "",
  budget: "", status: "contato_inicial", referredBy: "", notes: "",
};

const defaultFilters = {
  status: "", service: "", period: "",
  hasWhatsapp: false, hasBudget: false, hasReferral: false,
  recent: false, hideDescartado: true,
};

export default function App() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("recent");
  const [viewMode, setViewMode] = useState("list");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("providers")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (active) setProviders((data || []).map(fromDb));
      } catch (e) {
        console.error(e);
        if (active) setError(e.message || "Erro ao carregar dados");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const upsert = async (data) => {
    const isNew = !data.id;
    const id = data.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      ...data, id,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      const { error } = await supabase.from("providers").upsert(toDb(record));
      if (error) throw error;
      setProviders((prev) => isNew ? [record, ...prev] : prev.map((p) => p.id === id ? record : p));
      setShowForm(false);
      setEditing(null);
    } catch (e) {
      console.error(e);
      alert("Não consegui salvar: " + (e.message || "erro desconhecido"));
    }
  };

  const remove = (provider) => setPendingDelete(provider);

  const confirmRemove = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    try {
      const { error } = await supabase.from("providers").delete().eq("id", id);
      if (error) throw error;
      setProviders((prev) => prev.filter((p) => p.id !== id));
      setPendingDelete(null);
    } catch (e) {
      alert("Erro ao excluir: " + (e.message || "desconhecido"));
      setPendingDelete(null);
    }
  };

  const exportData = () => {
    if (!providers.length) return;
    const blob = new Blob([JSON.stringify(providers, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prestadores_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportStatus({ type: "loading", message: "Lendo arquivo..." });
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Arquivo inválido — esperava uma lista");

      const records = parsed.map((p) => ({
        ...p,
        id: p.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString(),
      }));

      setImportStatus({ type: "loading", message: `Importando ${records.length} prestadores...` });
      const { error } = await supabase.from("providers").upsert(records.map(toDb));
      if (error) throw error;

      // Recarrega tudo
      const { data, error: e2 } = await supabase
        .from("providers").select("*").order("created_at", { ascending: false });
      if (e2) throw e2;
      setProviders((data || []).map(fromDb));
      setImportStatus({ type: "success", message: `${records.length} prestadores importados!` });
      setTimeout(() => setImportStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setImportStatus({ type: "error", message: "Erro: " + (e.message || "arquivo inválido") });
      setTimeout(() => setImportStatus(null), 5000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));
  const toggleFilter = (key) => setFilters((f) => ({ ...f, [key]: !f[key] }));
  const clearFilters = () => { setFilters(defaultFilters); setSearch(""); };

  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([k, v]) => {
      if (k === "hideDescartado") return false;
      return typeof v === "boolean" ? v : Boolean(v);
    }).length;
  }, [filters]);

  const filtered = useMemo(() => {
    let out = providers.filter((p) => {
      if (search) {
        const s = search.toLowerCase();
        const hit = (p.name || "").toLowerCase().includes(s) ||
          (p.company || "").toLowerCase().includes(s) ||
          (p.serviceType || "").toLowerCase().includes(s) ||
          (p.referredBy || "").toLowerCase().includes(s) ||
          (p.notes || "").toLowerCase().includes(s);
        if (!hit) return false;
      }
      if (filters.status && p.status !== filters.status) return false;
      if (filters.service && p.serviceType !== filters.service) return false;
      if (filters.period && daysSince(p.createdAt) > parseInt(filters.period)) return false;
      if (filters.hasWhatsapp && !onlyDigits(p.phone)) return false;
      if (filters.hasBudget && !(parseFloat(p.budget) > 0)) return false;
      if (filters.hasReferral && !p.referredBy?.trim()) return false;
      if (filters.recent && daysSince(p.createdAt) > 7) return false;
      if (filters.hideDescartado && p.status === "descartado") return false;
      return true;
    });
    const cmp = {
      recent: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      oldest: (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
      name: (a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"),
      budget_desc: (a, b) => (parseFloat(b.budget) || 0) - (parseFloat(a.budget) || 0),
      budget_asc: (a, b) => (parseFloat(a.budget) || 0) - (parseFloat(b.budget) || 0),
    }[sortBy];
    return [...out].sort(cmp);
  }, [providers, search, filters, sortBy]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((p) => {
      const key = p.serviceType || "Sem categoria";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return Array.from(map.entries())
      .map(([service, items]) => ({
        service, items,
        contratados: items.filter((i) => i.status === "contratado").length,
        totalBudget: items.reduce((s, i) => s + (parseFloat(i.budget) || 0), 0),
      }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [filtered]);

  const stats = useMemo(() => {
    const contratados = providers.filter((p) => p.status === "contratado");
    const aguardando = providers.filter((p) => p.status === "aguardando_orcamento" || p.status === "contato_inicial");
    const totalContratado = contratados.reduce((sum, p) => sum + (parseFloat(p.budget) || 0), 0);
    return { total: providers.length, contratados: contratados.length, aguardando: aguardando.length, totalContratado };
  }, [providers]);

  const toggleGroup = (service) => setCollapsedGroups((c) => ({ ...c, [service]: !c[service] }));

  return (
    <div className="min-h-screen w-full bg-stone-50 text-stone-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Geist:wght@400;500;600&display=swap');
        .font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }
      `}</style>

      <div className="font-body mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-stone-500">
              <Hammer className="h-3.5 w-3.5" />
              Obra do apartamento
            </div>
            <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-tight text-stone-900 sm:text-5xl">
              Prestadores
            </h1>
            <p className="mt-2 max-w-md text-sm text-stone-500">
              Cadastro simples pra não perder o fio dos contatos, orçamentos e indicações.
            </p>
          </div>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800 sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Novo prestador
          </button>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <strong>Erro ao conectar com o banco:</strong> {error}
            <div className="mt-1 text-xs text-rose-600">Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</div>
          </div>
        )}

        {importStatus && (
          <div className={`mb-6 rounded-2xl border p-4 text-sm ${
            importStatus.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" :
            importStatus.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
            "border-sky-200 bg-sky-50 text-sky-700"
          }`}>
            {importStatus.message}
          </div>
        )}

        <section className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-stone-200 sm:grid-cols-4">
          <StatCard label="Total cadastrados" value={stats.total} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Em aberto" value={stats.aguardando} />
          <StatCard label="Contratados" value={stats.contratados} accent />
          <StatCard label="Total contratado" value={fmtBRL(stats.totalContratado)} />
        </section>

        <section className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome, empresa, serviço, indicação, notas..."
                className="w-full rounded-full border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm placeholder:text-stone-400 focus:border-stone-900 focus:outline-none"
              />
            </div>

            <div className="flex rounded-full border border-stone-200 bg-white p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition ${
                  viewMode === "list" ? "bg-stone-900 text-stone-50" : "text-stone-500 hover:text-stone-900"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lista</span>
              </button>
              <button
                onClick={() => setViewMode("grouped")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition ${
                  viewMode === "grouped" ? "bg-stone-900 text-stone-50" : "text-stone-500 hover:text-stone-900"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Por serviço</span>
              </button>
            </div>

            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-3 text-sm transition ${
                showFilters || activeFilterCount > 0
                  ? "border-stone-900 bg-stone-900 text-stone-50"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-400"
              }`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className={`rounded-full px-1.5 text-xs ${
                  showFilters || activeFilterCount > 0 ? "bg-stone-50 text-stone-900" : "bg-stone-900 text-stone-50"
                }`}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip active={filters.hideDescartado} onClick={() => toggleFilter("hideDescartado")} label="Ocultar descartados" />
            <Chip active={filters.recent} onClick={() => toggleFilter("recent")} label="Recentes (7d)" />
            <Chip active={filters.hasBudget} onClick={() => toggleFilter("hasBudget")} label="Com orçamento" />
            <Chip active={filters.hasWhatsapp} onClick={() => toggleFilter("hasWhatsapp")} label="Com WhatsApp" />
            <Chip active={filters.hasReferral} onClick={() => toggleFilter("hasReferral")} label="Indicados" />

            <div className="ml-auto flex items-center gap-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-stone-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-full border border-stone-200 bg-white py-1.5 pl-3 pr-7 text-xs text-stone-700 focus:border-stone-900 focus:outline-none"
              >
                {SORT_OPTIONS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
              </select>
            </div>
          </div>

          {showFilters && (
            <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter("status", v)}
                  options={[{ value: "", label: "Todos" }, ...STATUS_OPTIONS]} />
                <FilterSelect label="Tipo de serviço" value={filters.service} onChange={(v) => setFilter("service", v)}
                  options={[{ value: "", label: "Todos" }, ...SERVICE_TYPES.map((s) => ({ value: s, label: s }))]} />
                <FilterSelect label="Cadastrado em" value={filters.period} onChange={(v) => setFilter("period", v)} options={PERIOD_OPTIONS} />
              </div>
              {(activeFilterCount > 0 || search) && (
                <button onClick={clearFilters} className="text-left text-xs uppercase tracking-wider text-stone-500 hover:text-stone-900">
                  Limpar tudo
                </button>
              )}
            </div>
          )}

          {!loading && (search || activeFilterCount > 0) && (
            <div className="text-xs text-stone-500">{filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}</div>
          )}
        </section>

        <section>
          {loading ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center text-sm text-stone-400">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState hasAny={providers.length > 0}
              onAdd={() => { setEditing(null); setShowForm(true); }}
              onClear={clearFilters} onImport={() => fileInputRef.current?.click()} />
          ) : viewMode === "list" ? (
            <div className="space-y-3">
              {filtered.map((p) => (
                <ProviderCard key={p.id} provider={p}
                  onEdit={() => { setEditing(p); setShowForm(true); }}
                  onDelete={() => remove(p)} />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((g) => {
                const collapsed = collapsedGroups[g.service];
                return (
                  <div key={g.service}>
                    <button onClick={() => toggleGroup(g.service)}
                      className="mb-3 flex w-full items-center justify-between gap-3 border-b border-stone-200 pb-2 text-left">
                      <div className="flex items-center gap-2">
                        {collapsed ? <ChevronRight className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
                        <h3 className="font-display text-xl font-medium tracking-tight">{g.service}</h3>
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{g.items.length}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-stone-500">
                        {g.contratados > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            {g.contratados} contratado{g.contratados > 1 ? "s" : ""}
                          </span>
                        )}
                        {g.totalBudget > 0 && <span className="hidden sm:inline">Total: {fmtBRL(g.totalBudget)}</span>}
                      </div>
                    </button>
                    {!collapsed && (
                      <div className="space-y-3">
                        {g.items.map((p) => (
                          <ProviderCard key={p.id} provider={p} hideServiceType
                            onEdit={() => { setEditing(p); setShowForm(true); }}
                            onDelete={() => remove(p)} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={importData} className="hidden" />

        <footer className="mt-12 space-y-2 text-center text-xs text-stone-400">
          <div>Sincronizado em todos os dispositivos. {providers.length} prestador{providers.length === 1 ? "" : "es"} no total.</div>
          <div className="flex justify-center gap-4">
            {providers.length > 0 && (
              <button onClick={exportData} className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-stone-600">
                <Download className="h-3 w-3" />
                Exportar
              </button>
            )}
            <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-stone-600">
              <Upload className="h-3 w-3" />
              Importar
            </button>
          </div>
        </footer>
      </div>

      {showForm && (
        <ProviderForm initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={upsert} />
      )}

      {pendingDelete && (
        <ConfirmDialog title="Excluir prestador?"
          message={`"${pendingDelete.name}" será removido permanentemente. Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir" onConfirm={confirmRemove} onCancel={() => setPendingDelete(null)} />
      )}
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel = "Confirmar", onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()}
        className="font-body relative w-full max-w-md rounded-3xl bg-stone-50 p-6 shadow-2xl sm:p-7">
        <h3 className="font-display text-2xl font-medium tracking-tight">{title}</h3>
        <p className="mt-2 text-sm text-stone-600">{message}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={onCancel} className="rounded-full px-5 py-3 text-sm font-medium text-stone-600 hover:bg-stone-200">Cancelar</button>
          <button onClick={onConfirm} className="rounded-full bg-rose-600 px-6 py-3 text-sm font-medium text-stone-50 hover:bg-rose-700">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div className={`bg-white p-5 ${accent ? "bg-emerald-50/60" : ""}`}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-stone-500">{icon}{label}</div>
      <div className="font-display mt-1.5 text-3xl font-medium leading-none tracking-tight">{value}</div>
    </div>
  );
}

function Chip({ active, onClick, label }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active ? "border-stone-900 bg-stone-900 text-stone-50"
               : "border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-900"
      }`}>{label}</button>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-500">{label}</span>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-stone-200 bg-white px-3 py-2.5 pr-9 text-sm focus:border-stone-900 focus:outline-none">
          {options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      </div>
    </label>
  );
}

function ProviderCard({ provider, onEdit, onDelete, hideServiceType }) {
  const status = statusMeta(provider.status);
  const wa = waLink(provider.phone);
  return (
    <article className="group rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-stone-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="font-display text-xl font-medium leading-tight tracking-tight">{provider.name || "Sem nome"}</h3>
            {provider.company && <span className="text-sm text-stone-500">· {provider.company}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
            {!hideServiceType && provider.serviceType && <span>{provider.serviceType}</span>}
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
            {provider.createdAt && <span className="text-stone-400">Adicionado em {fmtDate(provider.createdAt)}</span>}
          </div>
        </div>
        <div className="flex gap-1 opacity-60 transition group-hover:opacity-100">
          <button onClick={onEdit} className="rounded-full p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900"><Edit2 className="h-4 w-4" /></button>
          <button onClick={onDelete} className="rounded-full p-2 text-stone-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      {(provider.phone || provider.email || provider.budget || provider.referredBy) && (
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {provider.phone && (
            <div className="flex items-center gap-2 text-stone-700">
              <Phone className="h-3.5 w-3.5 text-stone-400" />
              <a href={`tel:${onlyDigits(provider.phone)}`} className="hover:underline">{fmtPhone(provider.phone)}</a>
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-100">
                  <MessageCircle className="h-3 w-3" />WhatsApp
                </a>
              )}
            </div>
          )}
          {provider.email && (
            <div className="flex items-center gap-2 text-stone-700">
              <Mail className="h-3.5 w-3.5 text-stone-400" />
              <a href={`mailto:${provider.email}`} className="truncate hover:underline">{provider.email}</a>
            </div>
          )}
          {provider.budget && (
            <div className="flex items-center gap-2 text-stone-700">
              <span className="text-xs uppercase tracking-wider text-stone-400">Orçamento</span>
              <span className="font-medium">{fmtBRL(provider.budget)}</span>
            </div>
          )}
          {provider.referredBy && (
            <div className="flex items-center gap-2 text-stone-700">
              <span className="text-xs uppercase tracking-wider text-stone-400">Indicado por</span>
              <span>{provider.referredBy}</span>
            </div>
          )}
        </div>
      )}

      {provider.notes && (
        <div className="mt-4 flex gap-2 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-stone-400" />
          <p className="whitespace-pre-wrap">{provider.notes}</p>
        </div>
      )}
    </article>
  );
}

function EmptyState({ hasAny, onAdd, onClear, onImport }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center">
      <div className="font-display text-xl text-stone-700">
        {hasAny ? "Nenhum prestador com esses filtros" : "Sem prestadores ainda"}
      </div>
      <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">
        {hasAny ? "Tente limpar os filtros ou ajustar a busca." : "Cadastre um contato ou importe seu backup (JSON)."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {hasAny ? (
          <button onClick={onClear} className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100">
            Limpar filtros
          </button>
        ) : (
          <>
            <button onClick={onAdd} className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-stone-50 hover:bg-stone-800">
              <Plus className="h-4 w-4" />Cadastrar prestador
            </button>
            <button onClick={onImport} className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100">
              <Upload className="h-4 w-4" />Importar JSON
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ProviderForm({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || emptyProvider);
  const [touched, setTouched] = useState(false);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const handleSubmit = () => {
    setTouched(true);
    if (!form.name?.trim()) return;
    onSave({ ...form,
      name: form.name.trim(), company: form.company?.trim() || "",
      email: form.email?.trim() || "", referredBy: form.referredBy?.trim() || "",
      notes: form.notes?.trim() || "" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="font-body relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-stone-50 p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        <button onClick={onClose} className="absolute right-5 top-5 rounded-full p-2 text-stone-500 hover:bg-stone-200"><X className="h-4 w-4" /></button>
        <h2 className="font-display text-3xl font-medium tracking-tight">{initial ? "Editar prestador" : "Novo prestador"}</h2>
        <p className="mt-1 text-sm text-stone-500">Só o nome é obrigatório. O resto preenche depois.</p>

        <div className="mt-6 space-y-4">
          <Field label="Nome *" value={form.name} onChange={(v) => update("name", v)}
            error={touched && !form.name?.trim() ? "Coloca pelo menos o nome" : ""}
            placeholder="Ex: João Silva" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Empresa" value={form.company} onChange={(v) => update("company", v)} placeholder="Opcional" />
            <SelectField label="Tipo de serviço" value={form.serviceType} onChange={(v) => update("serviceType", v)}
              options={[{ value: "", label: "Selecione..." }, ...SERVICE_TYPES.map((s) => ({ value: s, label: s }))]} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telefone" value={fmtPhone(form.phone)} onChange={(v) => update("phone", v)}
              placeholder="(11) 91234-5678" inputMode="tel" />
            <Field label="E-mail" value={form.email} onChange={(v) => update("email", v)} placeholder="opcional" type="email" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Orçamento (R$)" value={form.budget}
              onChange={(v) => update("budget", v.replace(/[^\d.,]/g, "").replace(",", "."))}
              placeholder="0" inputMode="decimal" />
            <SelectField label="Status" value={form.status} onChange={(v) => update("status", v)} options={STATUS_OPTIONS} />
          </div>
          <Field label="Indicado por" value={form.referredBy} onChange={(v) => update("referredBy", v)} placeholder="Quem indicou? (opcional)" />
          <div>
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-500">Observações</span>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)}
              placeholder="Detalhes do orçamento, prazo, condições, primeiras impressões..." rows={4}
              className="w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm placeholder:text-stone-400 focus:border-stone-900 focus:outline-none" />
          </div>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="rounded-full px-5 py-3 text-sm font-medium text-stone-600 hover:bg-stone-200">Cancelar</button>
          <button onClick={handleSubmit} className="rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-stone-50 hover:bg-stone-800">{initial ? "Salvar alterações" : "Cadastrar"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, error, placeholder, type = "text", inputMode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-500">{label}</span>
      <input type={type} inputMode={inputMode} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm placeholder:text-stone-400 focus:outline-none ${
          error ? "border-rose-400 focus:border-rose-500" : "border-stone-200 focus:border-stone-900"
        }`} />
      {error && <span className="mt-1 block text-xs text-rose-500">{error}</span>}
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-500">{label}</span>
      <div className="relative">
        <select value={value || ""} onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-stone-200 bg-white px-3 py-2.5 pr-9 text-sm focus:border-stone-900 focus:outline-none">
          {options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      </div>
    </label>
  );
}
