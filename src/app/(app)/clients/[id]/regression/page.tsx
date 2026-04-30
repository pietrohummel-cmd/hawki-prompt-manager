"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface RegressionRun {
  id: string;
  response: string;
  results: { criterion: string; passed: boolean | null }[];
  status: "PENDING" | "PASSED" | "FAILED";
  runAt: string;
}

interface RegressionCase {
  id: string;
  name: string;
  input: string;
  expectedResponse?: string | null;
  criteria: string[];
  createdAt: string;
  runs: RegressionRun[];
}

const STATUS_CONFIG = {
  PENDING: { label: "Pendente",  className: "bg-zinc-500/10 text-zinc-400" },
  PASSED:  { label: "Passou",    className: "bg-emerald-500/10 text-emerald-400" },
  FAILED:  { label: "Falhou",    className: "bg-red-500/10 text-red-400" },
};

export default function RegressionPage() {
  const { id } = useParams<{ id: string }>();
  const [cases, setCases] = useState<RegressionCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal criar/editar
  const [showForm, setShowForm] = useState(false);
  const [editingCase, setEditingCase] = useState<RegressionCase | null>(null);
  const [formName, setFormName] = useState("");
  const [formInput, setFormInput] = useState("");
  const [formExpectedResponse, setFormExpectedResponse] = useState("");
  const [formCriteria, setFormCriteria] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Execução
  const [runningCase, setRunningCase] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [activeRun, setActiveRun] = useState<{ caseId: string; run: RegressionRun } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}/regression`);
      if (!res.ok) throw new Error("Erro ao carregar casos de regressão");
      setCases(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingCase(null);
    setFormName("");
    setFormInput("");
    setFormExpectedResponse("");
    setFormCriteria([""]);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(c: RegressionCase) {
    setEditingCase(c);
    setFormName(c.name);
    setFormInput(c.input);
    setFormExpectedResponse(c.expectedResponse ?? "");
    setFormCriteria([...c.criteria]);
    setFormError(null);
    setShowForm(true);
  }

  async function handleSave() {
    const criteria = formCriteria.filter((c) => c.trim());
    if (!formName.trim() || !formInput.trim() || criteria.length === 0) {
      setFormError("Nome, mensagem e ao menos um critério são obrigatórios");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body = {
        name: formName.trim(),
        input: formInput.trim(),
        expectedResponse: formExpectedResponse.trim() || null,
        criteria,
      };
      let res: Response;
      if (editingCase) {
        res = await fetch(`/api/clients/${id}/regression/${editingCase.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/clients/${id}/regression`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(caseId: string) {
    if (!confirm("Apagar este caso de teste?")) return;
    await fetch(`/api/clients/${id}/regression/${caseId}`, { method: "DELETE" });
    setCases((prev) => prev.filter((c) => c.id !== caseId));
    if (activeRun?.caseId === caseId) setActiveRun(null);
  }

  async function handleRun(regressionCase: RegressionCase) {
    setRunningCase(regressionCase.id);
    try {
      const res = await fetch(`/api/clients/${id}/regression/${regressionCase.id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao rodar");
      setActiveRun({ caseId: regressionCase.id, run: data });
      setCases((prev) => prev.map((c) => c.id === regressionCase.id ? { ...c, runs: [data, ...c.runs] } : c));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao rodar caso");
    } finally {
      setRunningCase(null);
    }
  }

  async function handleRunAll() {
    setRunningAll(true);
    try {
      const res = await fetch(`/api/clients/${id}/regression/run-all`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao rodar todos");
      }
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao rodar todos os casos");
    } finally {
      setRunningAll(false);
    }
  }

  function addCriterion() { setFormCriteria((prev) => [...prev, ""]); }
  function removeCriterion(i: number) { setFormCriteria((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateCriterion(i: number, val: string) {
    setFormCriteria((prev) => prev.map((c, idx) => idx === i ? val : c));
  }

  const totalCases = cases.length;
  const lastRunResults = cases.map((c) => c.runs[0]).filter(Boolean);
  const passed = lastRunResults.filter((r) => r.status === "PASSED").length;
  const untested = cases.filter((c) => c.runs.length === 0).length;

  if (loading) return <div className="text-[var(--text-muted)] text-sm py-8 text-center">Carregando...</div>;
  if (error) return <div className="text-red-400 text-sm">{error}</div>;

  return (
    <div>
      {/* Summary */}
      {totalCases > 0 && (
        <div className="flex items-center gap-6 mb-6 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg px-5 py-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">{totalCases}</p>
            <p className="text-xs text-[var(--text-muted)]">casos</p>
          </div>
          <div className="w-px h-8 bg-[var(--surface-border)]" />
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-400">{passed}</p>
            <p className="text-xs text-[var(--text-muted)]">passaram</p>
          </div>
          <div className="w-px h-8 bg-[var(--surface-border)]" />
          <div className="text-center">
            <p className={`text-2xl font-bold ${untested > 0 ? "text-yellow-400" : "text-[var(--text-muted)]"}`}>{untested}</p>
            <p className="text-xs text-[var(--text-muted)]">não testados</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleRunAll}
              disabled={runningAll || runningCase !== null}
              className="text-sm text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 px-4 py-2 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {runningAll ? (
                <><span className="animate-spin inline-block w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full" />Rodando todos...</>
              ) : "Rodar todos ▶▶"}
            </button>
            <button
              onClick={openCreate}
              className="bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              + Novo caso
            </button>
          </div>
        </div>
      )}

      {totalCases === 0 && (
        <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg p-12 text-center mb-4">
          <p className="text-[var(--text-muted)] text-sm mb-1">Nenhum caso de regressão cadastrado.</p>
          <p className="text-[var(--text-disabled)] text-xs mb-4">Crie casos de teste para garantir que cada nova versão do prompt não quebre comportamentos esperados.</p>
          <button
            onClick={openCreate}
            className="bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            + Criar primeiro caso
          </button>
        </div>
      )}

      {/* Lista de casos */}
      <div className="space-y-2">
        {cases.map((c) => {
          const lastRun = c.runs[0];
          return (
            <div key={c.id} className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{c.name}</span>
                    {lastRun ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[lastRun.status].className}`}>
                        {STATUS_CONFIG[lastRun.status].label}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-500">Não testado</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-1 mb-1">{c.input}</p>
                  <p className="text-xs text-[var(--text-disabled)]">{c.criteria.length} critério{c.criteria.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {lastRun && (
                    <button
                      onClick={() => setActiveRun({ caseId: c.id, run: lastRun })}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5 border border-[var(--surface-border)] rounded-md transition-colors"
                    >
                      Ver resultado
                    </button>
                  )}
                  <button
                    onClick={() => handleRun(c)}
                    disabled={runningCase === c.id || runningAll}
                    className="text-xs text-emerald-400 hover:text-emerald-300 px-3 py-1.5 border border-emerald-500/30 hover:border-emerald-500/60 rounded-md transition-colors disabled:opacity-50"
                  >
                    {runningCase === c.id ? "Rodando..." : "Rodar ▶"}
                  </button>
                  <button
                    onClick={() => openEdit(c)}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-3 py-1.5 border border-[var(--surface-border)] rounded-md transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-xs text-[var(--text-disabled)] hover:text-red-400 transition-colors px-1"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Painel de resultado de run (somente leitura) */}
      {activeRun && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl w-full max-w-2xl my-8 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)]">
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-0.5">Resultado do run</p>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  {cases.find((c) => c.id === activeRun.caseId)?.name}
                </h2>
              </div>
              <button onClick={() => setActiveRun(null)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-5">
              {/* Resposta da Sofia */}
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-2">Resposta da Sofia</p>
                <div className="bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-lg px-4 py-3 max-h-48 overflow-y-auto">
                  <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{activeRun.run.response}</p>
                </div>
              </div>

              {/* Input original */}
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-2">Mensagem enviada</p>
                <p className="text-sm text-[var(--text-secondary)] bg-[var(--surface-raised)] rounded-lg px-4 py-3">
                  {cases.find((c) => c.id === activeRun.caseId)?.input}
                </p>
              </div>

              {/* Resposta ideal (se definida) */}
              {cases.find((c) => c.id === activeRun.caseId)?.expectedResponse && (
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-2">Resposta ideal esperada</p>
                  <div className="bg-[var(--surface-raised)] border border-emerald-500/20 rounded-lg px-4 py-3 max-h-36 overflow-y-auto">
                    <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                      {cases.find((c) => c.id === activeRun.caseId)?.expectedResponse}
                    </p>
                  </div>
                </div>
              )}

              {/* Critérios — somente leitura */}
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-2">Critérios avaliados pela IA</p>
                <div className="space-y-2">
                  {activeRun.run.results.map((r) => (
                    <div key={r.criterion} className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                      r.passed === true
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : r.passed === false
                        ? "bg-red-500/10 border border-red-500/20"
                        : "bg-[var(--surface-raised)] border border-[var(--surface-border)]"
                    }`}>
                      <span className={`text-sm shrink-0 ${r.passed === true ? "text-emerald-400" : r.passed === false ? "text-red-400" : "text-zinc-500"}`}>
                        {r.passed === true ? "✓" : r.passed === false ? "✗" : "—"}
                      </span>
                      <p className="text-sm text-[var(--text-primary)] flex-1">{r.criterion}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end px-5 py-4 border-t border-[var(--surface-border)]">
              <button onClick={() => setActiveRun(null)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-4 py-2">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal criar/editar caso */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl w-full max-w-lg my-8 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {editingCase ? "Editar caso de teste" : "Novo caso de teste"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-2 block">Nome do caso <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder='Ex: "Pergunta técnica sobre protocolo"'
                  className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-2 block">Mensagem de entrada <span className="text-red-400">*</span></label>
                <textarea
                  value={formInput}
                  onChange={(e) => setFormInput(e.target.value)}
                  rows={3}
                  placeholder="Mensagem que o lead envia para a Sofia..."
                  className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded-md px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-2 block">
                  Resposta ideal <span className="text-[var(--text-disabled)]">(opcional — usada como referência na avaliação)</span>
                </label>
                <textarea
                  value={formExpectedResponse}
                  onChange={(e) => setFormExpectedResponse(e.target.value)}
                  rows={4}
                  placeholder="Descreva como a Sofia deveria responder idealmente nesse cenário..."
                  className="w-full bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded-md px-3 py-2.5 resize-none focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
                <p className="text-[11px] text-[var(--text-disabled)] mt-1">
                  Exemplo de tom, estrutura e conteúdo que o avaliador vai usar como referência para julgar os critérios.
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[var(--text-muted)]">Critérios esperados <span className="text-red-400">*</span></label>
                  <button onClick={addCriterion} className="text-xs text-emerald-400 hover:text-emerald-300">+ Adicionar</button>
                </div>
                <div className="space-y-2">
                  {formCriteria.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={c}
                        onChange={(e) => updateCriterion(i, e.target.value)}
                        placeholder={`Critério ${i + 1}...`}
                        className="flex-1 bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-primary)] text-sm rounded-md px-3 py-2 focus:outline-none focus:border-emerald-500"
                      />
                      {formCriteria.length > 1 && (
                        <button onClick={() => removeCriterion(i)} className="text-[var(--text-disabled)] hover:text-red-400 transition-colors px-1">×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-md">{formError}</div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--surface-border)]">
              <button onClick={() => setShowForm(false)} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-4 py-2">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-sm font-medium px-5 py-2 rounded-md transition-colors"
              >
                {saving ? "Salvando..." : editingCase ? "Salvar" : "Criar caso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
