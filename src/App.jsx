import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Search, Edit2, Trash2, Phone, Mail, X, MessageCircle, Hammer,
  Filter, ChevronDown, ChevronRight, StickyNote, Users, LayoutList,
  LayoutGrid, ArrowUpDown, Upload, Download, Sun, Moon, GitCompare, TrendingDown,
  Copy, Check, CheckCircle2,
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
  { value: "status", label: "Por status (funil)" },
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "name", label: "Nome (A-Z)" },
  { value: "budget_desc", label: "Orçamento (maior)" },
  { value: "budget_asc", label: "Orçamento (menor)" },
];

const STATUS_PRIORITY = {
  contratado: 0,
  em_negociacao: 1,
  orcamento_recebido: 2,
  aguardando_orcamento: 3,
  contato_inicial: 4,
  descartado: 5,
};

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
  hasBudget: false,
  recent: false, hideDescartado: true, hideContratado: false, onlyContratado: false,
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
  const [comparing, setComparing] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) return saved === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

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

  const markAsContratado = async (provider) => {
    await upsert({ ...provider, status: "contratado" });
  };

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
      if (k === "hideDescartado" || k === "hideContratado") return false;
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
      if (filters.hasBudget && !(parseFloat(p.budget) > 0)) return false;
      if (filters.recent && daysSince(p.createdAt) > 7) return false;
      if (filters.hideDescartado && p.status === "descartado") return false;
      if (filters.hideContratado && p.status === "contratado") return false;
      if (filters.onlyContratado && p.status !== "contratado") return false;
      return true;
    });
    const cmp = {
      status: (a, b) => {
        const pa = STATUS_PRIORITY[a.status] ?? 99;
        const pb = STATUS_PRIORITY[b.status] ?? 99;
        if (pa !== pb) return pa - pb;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      },
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
    <div className="min-h-screen w-full bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Geist:wght@400;500;600&display=swap');
        .font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
        .font-body { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }
      `}</style>

      <div className="font-body mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
              <Hammer className="h-3.5 w-3.5" />
              Obra do apartamento
            </div>
            <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-tight text-stone-900 dark:text-stone-50 sm:text-5xl">
              Prestadores
            </h1>
            <p className="mt-2 max-w-md text-sm text-stone-500 dark:text-stone-400">
              Cadastro simples pra não perder o fio dos contatos, orçamentos e indicações.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? "Modo claro" : "Modo escuro"}
              className="rounded-full border border-stone-200 bg-white p-3 text-stone-600 transition hover:border-stone-400 hover:text-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-100"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
            >
              <Plus className="h-4 w-4" />
              Novo prestador
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <strong>Erro ao conectar com o banco:</strong> {error}
            <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">Verifique as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</div>
          </div>
        )}

        {importStatus && (
          <div className={`mb-6 rounded-2xl border p-4 text-sm ${
            importStatus.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300" :
            importStatus.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" :
            "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300"
          }`}>
            {importStatus.message}
          </div>
        )}

        <section className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-stone-200 dark:bg-stone-800 sm:grid-cols-4">
          <StatCard label="Total cadastrados" value={stats.total} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Em aberto" value={stats.aguardando} />
          <StatCard label="Contratados" value={stats.contratados} accent />
          <StatCard label="Total contratado" value={fmtBRL(stats.totalContratado)} />
        </section>

        <section className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome, empresa, serviço, indicação, notas..."
                className="w-full rounded-full border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm placeholder:text-stone-400 focus:border-stone-900 focus:outline-none dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-300"
              />
            </div>

            <div className="flex rounded-full border border-stone-200 bg-white p-1 dark:border-stone-800 dark:bg-stone-900">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition ${
                  viewMode === "list"
                    ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"
                    : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lista</span>
              </button>
              <button
                onClick={() => setViewMode("grouped")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition ${
                  viewMode === "grouped"
                    ? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"
                    : "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Por serviço</span>
              </button>
            </div>

            <button
              onClick={() => {
                if (activeFilterCount > 0) {
                  setFilters(defaultFilters);
                  setShowFilters(false);
                } else {
                  setShowFilters((s) => !s);
                }
              }}
              title={activeFilterCount > 0 ? "Limpar filtros" : "Abrir filtros"}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-3 text-sm transition ${
                showFilters || activeFilterCount > 0
                  ? "border-stone-900 bg-stone-900 text-stone-50 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-stone-600"
              }`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className={`rounded-full px-1.5 text-xs ${
                  showFilters || activeFilterCount > 0
                    ? "bg-stone-50 text-stone-900 dark:bg-stone-900 dark:text-stone-100"
                    : "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"
                }`}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip active={filters.hideDescartado} onClick={() => toggleFilter("hideDescartado")} label="Ocultar descartados" />
            <Chip active={filters.hideContratado} onClick={() => setFilters((f) => ({ ...f, hideContratado: !f.hideContratado, onlyContratado: false }))} label="Ocultar contratados" />
            <Chip active={filters.recent} onClick={() => toggleFilter("recent")} label="Recentes (7d)" />
            <Chip active={filters.hasBudget} onClick={() => toggleFilter("hasBudget")} label="Com orçamento" />
            <Chip active={filters.onlyContratado} onClick={() => setFilters((f) => ({ ...f, onlyContratado: !f.onlyContratado, hideContratado: false }))} label="Contratados" />

            <div className="ml-auto flex items-center gap-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-full border border-stone-200 bg-white py-1.5 pl-3 pr-7 text-xs text-stone-700 focus:border-stone-900 focus:outline-none dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300 dark:focus:border-stone-300"
              >
                {SORT_OPTIONS.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
              </select>
            </div>
          </div>

          {showFilters && (
            <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
              <div className="grid gap-3 sm:grid-cols-3">
                <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilter("status", v)}
                  options={[{ value: "", label: "Todos" }, ...STATUS_OPTIONS]} />
                <FilterSelect label="Tipo de serviço" value={filters.service} onChange={(v) => setFilter("service", v)}
                  options={[{ value: "", label: "Todos" }, ...SERVICE_TYPES.map((s) => ({ value: s, label: s }))]} />
                <FilterSelect label="Cadastrado em" value={filters.period} onChange={(v) => setFilter("period", v)} options={PERIOD_OPTIONS} />
              </div>
              {(activeFilterCount > 0 || search) && (
                <button onClick={clearFilters} className="text-left text-xs uppercase tracking-wider text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100">
                  Limpar tudo
                </button>
              )}
            </div>
          )}

          {!loading && (search || activeFilterCount > 0) && (
            <div className="text-xs text-stone-500 dark:text-stone-400">{filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}</div>
          )}
        </section>

        <section>
          {loading ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center text-sm text-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-500">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState hasAny={providers.length > 0}
              onAdd={() => { setEditing(null); setShowForm(true); }}
              onClear={clearFilters} onImport={() => fileInputRef.current?.click()} />
          ) : viewMode === "list" ? (
            <div className="space-y-3">
              {filtered.map((p) => (
                <ProviderCard key={p.id} provider={p}
                  searchTerm={search}
                  onEdit={() => { setEditing(p); setShowForm(true); }}
                  onDelete={() => remove(p)}
                  onMarkContratado={() => markAsContratado(p)} />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((g) => {
                const collapsed = collapsedGroups[g.service];
                const comparableCount = g.items.filter((i) => i.status !== "descartado").length;
                return (
                  <div key={g.service}>
                    <div className="mb-3 flex items-center justify-between gap-3 border-b border-stone-200 pb-2 dark:border-stone-800">
                      <button onClick={() => toggleGroup(g.service)} className="flex flex-1 items-center gap-2 text-left">
                        {collapsed
                          ? <ChevronRight className="h-4 w-4 text-stone-400 dark:text-stone-500" />
                          : <ChevronDown className="h-4 w-4 text-stone-400 dark:text-stone-500" />}
                        <h3 className="font-display text-xl font-medium tracking-tight">{g.service}</h3>
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">{g.items.length}</span>
                        <div className="ml-3 hidden items-center gap-3 text-xs text-stone-500 sm:flex dark:text-stone-400">
                          {g.contratados > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                              {g.contratados} contratado{g.contratados > 1 ? "s" : ""}
                            </span>
                          )}
                          {g.totalBudget > 0 && <span>Total: {fmtBRL(g.totalBudget)}</span>}
                        </div>
                      </button>
                      {comparableCount >= 2 && (
                        <button
                          onClick={() => setComparing(g.service)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:text-stone-100"
                        >
                          <GitCompare className="h-3.5 w-3.5" />
                          Comparar
                        </button>
                      )}
                    </div>
                    {!collapsed && (
                      <div className="space-y-3">
                        {g.items.map((p) => (
                          <ProviderCard key={p.id} provider={p} hideServiceType
                            searchTerm={search}
                            onEdit={() => { setEditing(p); setShowForm(true); }}
                            onDelete={() => remove(p)}
                            onMarkContratado={() => markAsContratado(p)} />
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

        <footer className="mt-12 space-y-2 text-center text-xs text-stone-400 dark:text-stone-500">
          <div>Sincronizado em todos os dispositivos. {providers.length} prestador{providers.length === 1 ? "" : "es"} no total.</div>
          <div className="flex justify-center gap-4">
            {providers.length > 0 && (
              <button onClick={exportData} className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-stone-600 dark:hover:text-stone-300">
                <Download className="h-3 w-3" />
                Exportar
              </button>
            )}
            <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-stone-600 dark:hover:text-stone-300">
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

      {comparing && (
        <ComparisonView
          serviceType={comparing}
          providers={providers.filter((p) => p.serviceType === comparing && p.status !== "descartado")}
          onClose={() => setComparing(null)}
        />
      )}
    </div>
  );
}

function ComparisonView({ serviceType, providers, onClose }) {
  const items = useMemo(() => {
    return [...providers].sort((a, b) => {
      const av = parseFloat(a.budget) || Infinity;
      const bv = parseFloat(b.budget) || Infinity;
      return av - bv;
    });
  }, [providers]);

  const withBudget = items.filter((p) => parseFloat(p.budget) > 0);
  const cheapest = withBudget[0];
  const range = withBudget.length >= 2
    ? parseFloat(withBudget[withBudget.length - 1].budget) - parseFloat(withBudget[0].budget)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="font-body relative flex max-h-[92vh] w-full max-w-6xl flex-col rounded-t-3xl bg-stone-50 shadow-2xl dark:bg-stone-950 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-stone-200 p-6 dark:border-stone-800">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">
              <GitCompare className="h-3.5 w-3.5" />
              Comparativo
            </div>
            <h2 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
              {serviceType}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
              <span>{items.length} prestador{items.length === 1 ? "" : "es"}</span>
              {cheapest && (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <TrendingDown className="h-3 w-3" />
                  Menor orçamento: {cheapest.name} · {fmtBRL(cheapest.budget)}
                </span>
              )}
              {range > 0 && (
                <span>Diferença entre menor e maior: {fmtBRL(range)}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="flex-shrink-0 rounded-full p-2 text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
          <div className="flex gap-4">
            {items.map((p) => (
              <ComparisonCard
                key={p.id}
                provider={p}
                isCheapest={cheapest && p.id === cheapest.id}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonCard({ provider, isCheapest }) {
  const status = statusMeta(provider.status);
  const wa = waLink(provider.phone);
  const hasBudget = parseFloat(provider.budget) > 0;
  const isContratado = provider.status === "contratado";

  return (
    <div className={`flex w-72 flex-shrink-0 flex-col rounded-2xl border bg-white p-4 dark:bg-stone-900 ${
      isCheapest
        ? "border-emerald-300 ring-2 ring-emerald-200 dark:border-emerald-700 dark:ring-emerald-900/50"
        : isContratado
        ? "border-stone-300 dark:border-stone-700"
        : "border-stone-200 dark:border-stone-800"
    }`}>
      {(isCheapest || isContratado) && (
        <div className="mb-2 flex flex-wrap gap-1">
          {isCheapest && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <TrendingDown className="h-3 w-3" />
              Menor preço
            </span>
          )}
          {isContratado && (
            <span className="rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-50 dark:bg-stone-100 dark:text-stone-900">
              Contratado
            </span>
          )}
        </div>
      )}

      <div className="mb-3">
        <h4 className="font-display text-lg font-medium leading-tight tracking-tight">{provider.name || "Sem nome"}</h4>
        {provider.company && <p className="mt-0.5 truncate text-xs text-stone-500 dark:text-stone-400">{provider.company}</p>}
      </div>

      <div className="mb-3 border-y border-stone-200 py-3 dark:border-stone-800">
        <div className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Orçamento</div>
        <div className={`font-display mt-0.5 text-2xl font-medium leading-tight tracking-tight ${
          hasBudget
            ? isCheapest ? "text-emerald-700 dark:text-emerald-400" : "text-stone-900 dark:text-stone-100"
            : "text-stone-400 dark:text-stone-600"
        }`}>
          {hasBudget ? fmtBRL(provider.budget) : "Sem orçamento"}
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Status</div>
          <div className="mt-0.5 inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            <span className="text-stone-700 dark:text-stone-300">{status.label}</span>
          </div>
        </div>

        {provider.phone && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Contato</div>
            <div className="mt-0.5 flex items-center gap-2 text-stone-700 dark:text-stone-300">
              <a href={`tel:${onlyDigits(provider.phone)}`} className="hover:underline">{fmtPhone(provider.phone)}</a>
              <CopyButton text={fmtPhone(provider.phone)} label="telefone" />
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60">
                  <MessageCircle className="h-2.5 w-2.5" />
                  WA
                </a>
              )}
            </div>
          </div>
        )}

        {provider.email && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">E-mail</div>
            <div className="mt-0.5 flex items-center gap-2">
              <a href={`mailto:${provider.email}`} className="block truncate text-stone-700 hover:underline dark:text-stone-300">{provider.email}</a>
              <CopyButton text={provider.email} label="e-mail" />
            </div>
          </div>
        )}

        {provider.referredBy && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Indicado por</div>
            <div className="mt-0.5 text-stone-700 dark:text-stone-300">{provider.referredBy}</div>
          </div>
        )}

        <div>
          <div className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Adicionado em</div>
          <div className="mt-0.5 text-stone-700 dark:text-stone-300">{fmtDate(provider.createdAt)}</div>
        </div>

        {provider.notes && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400">Observações</div>
            <p className="mt-0.5 whitespace-pre-wrap text-stone-600 dark:text-stone-400">{provider.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel = "Confirmar", onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()}
        className="font-body relative w-full max-w-md rounded-3xl bg-stone-50 p-6 shadow-2xl dark:bg-stone-900 sm:p-7">
        <h3 className="font-display text-2xl font-medium tracking-tight">{title}</h3>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{message}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={onCancel} className="rounded-full px-5 py-3 text-sm font-medium text-stone-600 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800">Cancelar</button>
          <button onClick={onConfirm} className="rounded-full bg-rose-600 px-6 py-3 text-sm font-medium text-stone-50 hover:bg-rose-700">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function Highlight({ text, term }) {
  if (!text) return null;
  if (!term || !term.trim()) return <>{text}</>;

  const t = term.toLowerCase();
  const lower = text.toLowerCase();
  const parts = [];
  let lastIndex = 0;
  let idx = lower.indexOf(t);

  while (idx !== -1) {
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
    parts.push(
      <mark key={parts.length} className="rounded bg-amber-200 px-0.5 text-stone-900 dark:bg-amber-500/40 dark:text-stone-100">
        {text.slice(idx, idx + t.length)}
      </mark>
    );
    lastIndex = idx + t.length;
    idx = lower.indexOf(t, lastIndex);
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <>{parts}</>;
}

function CopyButton({ text, label = "" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Erro ao copiar:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? "Copiado!" : `Copiar ${label}`}
      className={`rounded-full p-1 transition ${
        copied
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-300"
      }`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div className={`bg-white p-5 dark:bg-stone-900 ${accent ? "bg-emerald-50/60 dark:bg-emerald-950/30" : ""}`}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">{icon}{label}</div>
      <div className="font-display mt-1.5 text-3xl font-medium leading-none tracking-tight">{value}</div>
    </div>
  );
}

function Chip({ active, onClick, label }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-stone-900 bg-stone-900 text-stone-50 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
          : "border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-900 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-100"
      }`}>{label}</button>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">{label}</span>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-stone-200 bg-white px-3 py-2.5 pr-9 text-sm focus:border-stone-900 focus:outline-none dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-stone-300">
          {options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
      </div>
    </label>
  );
}

function ProviderCard({ provider, onEdit, onDelete, onMarkContratado, hideServiceType, searchTerm }) {
  const status = statusMeta(provider.status);
  const wa = waLink(provider.phone);
  const canPromote = provider.status === "em_negociacao" || provider.status === "orcamento_recebido";
  return (
    <article className="group rounded-2xl border border-stone-200 bg-white p-5 transition hover:border-stone-300 hover:shadow-sm dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="font-display text-xl font-medium leading-tight tracking-tight">
              <Highlight text={provider.name || "Sem nome"} term={searchTerm} />
            </h3>
            {provider.company && (
              <span className="text-sm text-stone-500 dark:text-stone-400">
                · <Highlight text={provider.company} term={searchTerm} />
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
            {!hideServiceType && provider.serviceType && (
              <span><Highlight text={provider.serviceType} term={searchTerm} /></span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
            {provider.createdAt && <span className="text-stone-400 dark:text-stone-500">Adicionado em {fmtDate(provider.createdAt)}</span>}
          </div>
        </div>
        <div className="flex items-start gap-2">
          {canPromote && onMarkContratado && (
            <button
              onClick={onMarkContratado}
              title="Marcar como contratado"
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Contratar</span>
            </button>
          )}
          <div className="flex gap-1 opacity-60 transition group-hover:opacity-100">
            <button onClick={onEdit} className="rounded-full p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"><Edit2 className="h-4 w-4" /></button>
            <button onClick={onDelete} className="rounded-full p-2 text-stone-500 hover:bg-rose-50 hover:text-rose-600 dark:text-stone-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {(provider.phone || provider.email || provider.budget || provider.referredBy) && (
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {provider.phone && (
            <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
              <Phone className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
              <a href={`tel:${onlyDigits(provider.phone)}`} className="hover:underline">{fmtPhone(provider.phone)}</a>
              <CopyButton text={fmtPhone(provider.phone)} label="telefone" />
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60">
                  <MessageCircle className="h-3 w-3" />WhatsApp
                </a>
              )}
            </div>
          )}
          {provider.email && (
            <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
              <Mail className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" />
              <a href={`mailto:${provider.email}`} className="truncate hover:underline">{provider.email}</a>
              <CopyButton text={provider.email} label="e-mail" />
            </div>
          )}
          {provider.budget && (
            <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
              <span className="text-xs uppercase tracking-wider text-stone-400 dark:text-stone-500">Orçamento</span>
              <span className="font-medium">{fmtBRL(provider.budget)}</span>
            </div>
          )}
          {provider.referredBy && (
            <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
              <span className="text-xs uppercase tracking-wider text-stone-400 dark:text-stone-500">Indicado por</span>
              <span><Highlight text={provider.referredBy} term={searchTerm} /></span>
            </div>
          )}
        </div>
      )}

      {provider.notes && (
        <div className="mt-4 flex gap-2 rounded-lg bg-stone-50 p-3 text-sm text-stone-600 dark:bg-stone-950/50 dark:text-stone-400">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-stone-400 dark:text-stone-500" />
          <p className="whitespace-pre-wrap"><Highlight text={provider.notes} term={searchTerm} /></p>
        </div>
      )}
    </article>
  );
}

function EmptyState({ hasAny, onAdd, onClear, onImport }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center dark:border-stone-800 dark:bg-stone-900">
      <div className="font-display text-xl text-stone-700 dark:text-stone-200">
        {hasAny ? "Nenhum prestador com esses filtros" : "Sem prestadores ainda"}
      </div>
      <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500 dark:text-stone-400">
        {hasAny ? "Tente limpar os filtros ou ajustar a busca." : "Cadastre um contato ou importe seu backup (JSON)."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {hasAny ? (
          <button onClick={onClear} className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800">
            Limpar filtros
          </button>
        ) : (
          <>
            <button onClick={onAdd} className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300">
              <Plus className="h-4 w-4" />Cadastrar prestador
            </button>
            <button onClick={onImport} className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800">
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 backdrop-blur-sm sm:items-center">
      <div
        className="font-body relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-stone-50 p-6 shadow-2xl dark:bg-stone-900 sm:rounded-3xl sm:p-8">
        <button onClick={onClose} className="absolute right-5 top-5 rounded-full p-2 text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800"><X className="h-4 w-4" /></button>
        <h2 className="font-display text-3xl font-medium tracking-tight">{initial ? "Editar prestador" : "Novo prestador"}</h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Só o nome é obrigatório. O resto preenche depois.</p>

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
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">Observações</span>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)}
              placeholder="Detalhes do orçamento, prazo, condições, primeiras impressões..." rows={4}
              className="w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm placeholder:text-stone-400 focus:border-stone-900 focus:outline-none dark:border-stone-800 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-300" />
          </div>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="rounded-full px-5 py-3 text-sm font-medium text-stone-600 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800">Cancelar</button>
          <button onClick={handleSubmit} className="rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300">{initial ? "Salvar alterações" : "Cadastrar"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, error, placeholder, type = "text", inputMode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">{label}</span>
      <input type={type} inputMode={inputMode} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm placeholder:text-stone-400 focus:outline-none dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-500 ${
          error
            ? "border-rose-400 focus:border-rose-500 dark:border-rose-700"
            : "border-stone-200 focus:border-stone-900 dark:border-stone-800 dark:focus:border-stone-300"
        }`} />
      {error && <span className="mt-1 block text-xs text-rose-500 dark:text-rose-400">{error}</span>}
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-500 dark:text-stone-400">{label}</span>
      <div className="relative">
        <select value={value || ""} onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border border-stone-200 bg-white px-3 py-2.5 pr-9 text-sm focus:border-stone-900 focus:outline-none dark:border-stone-800 dark:bg-stone-950 dark:text-stone-100 dark:focus:border-stone-300">
          {options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
      </div>
    </label>
  );
}
