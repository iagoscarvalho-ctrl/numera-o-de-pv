import { useRef, useState } from "react";
import { usePVStore } from "@/lib/pv/store";
import { parseDxf } from "@/lib/pv/dxfParser";

export function DxfUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    dataSource,
    dxfFileName,
    dxfWarnings,
    availablePolylineLayers,
    availableFaceLayers,
    selectedPolylineLayers,
    selectedFaceLayers,
    setPolylineLayers,
    setFaceLayers,
    loadDxf,
    loadMockData,
  } = usePVStore();

  const onPickFile = () => inputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsParsing(true);
    try {
      const text = await file.text();
      const parsed = parseDxf(text);
      if (parsed.polylines.length === 0 && parsed.faces.length === 0) {
        setError(
          "Não encontrei entidades reconhecidas no arquivo (LWPOLYLINE/POLYLINE/LINE/3DFACE). Confirme se o DXF foi exportado com essas entidades (não como blocos ou splines).",
        );
      }
      loadDxf(parsed, file.name);
    } catch (err) {
      setError("Falha ao ler o arquivo DXF. Verifique se é um DXF ASCII válido.");
      console.error(err);
    } finally {
      setIsParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const toggleLayer = (
    layer: string,
    selected: string[],
    setter: (layers: string[]) => void,
  ) => {
    if (selected.includes(layer)) setter(selected.filter((l) => l !== layer));
    else setter([...selected, layer]);
  };

  return (
    <section className="space-y-3 border-b border-slate-200 pb-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Arquivo DXF</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Importa a rede (polylines) e a superfície/TIN (faces 3D) direto do DXF.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".dxf"
        onChange={onFileChange}
        className="hidden"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={onPickFile}
          disabled={isParsing}
          className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-sm rounded px-3 py-1.5"
        >
          {isParsing ? "Lendo arquivo..." : "Carregar DXF"}
        </button>
        {dataSource === "dxf" && (
          <button
            onClick={loadMockData}
            title="Voltar para os dados de exemplo"
            className="text-xs border border-slate-300 rounded px-2 py-1.5 hover:bg-slate-100"
          >
            Usar exemplo
          </button>
        )}
      </div>

      {dataSource === "dxf" && dxfFileName && (
        <p className="text-xs text-slate-600">
          Arquivo: <span className="font-mono">{dxfFileName}</span>
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </p>
      )}

      {dataSource === "dxf" && dxfWarnings.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 space-y-1">
          {dxfWarnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      {dataSource === "dxf" && availablePolylineLayers.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-600">
            Camadas de rede (polylines) — {selectedPolylineLayers.length}/
            {availablePolylineLayers.length} ativas
          </p>
          <div className="max-h-28 overflow-y-auto border border-slate-200 rounded p-1.5 space-y-1">
            {availablePolylineLayers.map((layer) => (
              <label key={layer} className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedPolylineLayers.includes(layer)}
                  onChange={() => toggleLayer(layer, selectedPolylineLayers, setPolylineLayers)}
                />
                <span className="font-mono">{layer}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {dataSource === "dxf" && availableFaceLayers.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-600">
            Camadas de superfície (3DFACE) — {selectedFaceLayers.length}/
            {availableFaceLayers.length} ativas
          </p>
          <div className="max-h-28 overflow-y-auto border border-slate-200 rounded p-1.5 space-y-1">
            {availableFaceLayers.map((layer) => (
              <label key={layer} className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedFaceLayers.includes(layer)}
                  onChange={() => toggleLayer(layer, selectedFaceLayers, setFaceLayers)}
                />
                <span className="font-mono">{layer}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
