import { useState } from "react";
import { usePVStore } from "@/lib/pv/store";
import { exportPVs, downloadText } from "@/lib/pv/export";
import { DxfUpload } from "./DxfUpload";

export function ControlsPanel() {
  const { tolerance, setTolerance, counter, setCounter, resetAll, undo, history, pvs, lastMessage } = usePVStore();

  const [sep, setSep] = useState<"," | ";">(",");
  const [header, setHeader] = useState(true);
  const pvList = Object.values(pvs).sort((a, b) => a.number - b.number);

  const doExport = () => {
    const text = exportPVs(pvList, { separator: sep, header });
    downloadText("pvs.csv", text);
  };

  return (
    <div className="w-80 shrink-0 border-l border-slate-200 bg-white p-4 flex flex-col gap-4 overflow-y-auto">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Numeração de PVs</h2>
        <p className="text-xs text-slate-500 mt-1">Rede de esgoto — MVP com dados de exemplo.</p>
      </div>

      <DxfUpload />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Contador</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 w-24">Próximo Nº</label>
          <input
            type="number"
            min={1}
            value={counter}
            onChange={(e) => setCounter(parseInt(e.target.value || "1", 10))}
            className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 w-24">Tolerância nó (m)</label>
          <input
            type="number"
            step={0.01}
            min={0}
            value={tolerance}
            onChange={(e) => setTolerance(parseFloat(e.target.value || "0"))}
            className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <p className="text-[11px] text-slate-400 leading-snug">
          Raio usado para reconhecer que um clique caiu num nó já numerado (evita duplicar PV em nós compartilhados
          entre quadras).
        </p>
      </section>

      <section className="space-y-2 rounded border border-slate-200 p-3 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700">Como numerar</h3>
        <p className="text-xs text-slate-600">
          Clique num nó (vértice) no canvas para atribuir o próximo número da sequência a ele. A ordem dos PVs segue
          exatamente a ordem dos seus cliques.
        </p>
        {lastMessage && (
          <p className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
            {lastMessage}
          </p>
        )}
      </section>

      <section className="flex gap-2">
        <button
          disabled={history.length === 0}
          onClick={undo}
          className="flex-1 text-sm border border-slate-300 rounded px-3 py-1.5 hover:bg-slate-100 disabled:opacity-50"
        >
          Desfazer
        </button>
        <button
          onClick={() => {
            if (confirm("Resetar todos os PVs e contador?")) resetAll();
          }}
          className="flex-1 text-sm border border-red-300 text-red-700 rounded px-3 py-1.5 hover:bg-red-50"
        >
          Resetar
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">PVs numerados ({pvList.length})</h3>
        <div className="max-h-48 overflow-y-auto border border-slate-200 rounded text-xs font-mono">
          {pvList.length === 0 ? (
            <div className="p-2 text-slate-400">Nenhum PV ainda.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="text-left px-2 py-1">PV</th>
                  <th className="text-right px-2 py-1">E</th>
                  <th className="text-right px-2 py-1">N</th>
                  <th className="text-right px-2 py-1">Z</th>
                </tr>
              </thead>
              <tbody>
                {pvList.map((pv) => (
                  <tr key={pv.label} className="border-t border-slate-100">
                    <td className="px-2 py-0.5">{pv.label}</td>
                    <td className="px-2 py-0.5 text-right">{pv.x.toFixed(2)}</td>
                    <td className="px-2 py-0.5 text-right">{pv.y.toFixed(2)}</td>
                    <td className="px-2 py-0.5 text-right">{pv.z.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="space-y-2 border-t border-slate-200 pt-3">
        <h3 className="text-sm font-semibold text-slate-700">Exportar</h3>
        <div className="flex items-center gap-2 text-xs">
          <label className="w-24 text-slate-600">Separador</label>
          <select
            value={sep}
            onChange={(e) => setSep(e.target.value as "," | ";")}
            className="flex-1 border border-slate-300 rounded px-2 py-1"
          >
            <option value=",">Vírgula (,)</option>
            <option value=";">Ponto-e-vírgula (;)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} />
          Incluir cabeçalho
        </label>
        <button
          disabled={pvList.length === 0}
          onClick={doExport}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm rounded px-3 py-1.5"
        >
          Baixar CSV
        </button>
      </section>
    </div>
  );
}
