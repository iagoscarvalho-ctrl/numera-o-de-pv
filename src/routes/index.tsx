import { createFileRoute } from "@tanstack/react-router";
import { PVCanvas } from "@/components/pv/PVCanvas";
import { ControlsPanel } from "@/components/pv/ControlsPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Numeração de PVs — Rede de Esgoto" },
      {
        name: "description",
        content:
          "Ferramenta para numeração sequencial de poços de visita (PVs) em polylines de redes de esgoto, com zoom, pan e exportação CSV.",
      },
      { property: "og:title", content: "Numeração de PVs — Rede de Esgoto" },
      {
        property: "og:description",
        content:
          "Numeração sequencial de PVs em polylines, com reaproveitamento de nós compartilhados e exportação em UTM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex h-screen w-screen bg-slate-100">
      <main className="flex-1 p-4">
        <h1 className="sr-only">Numeração de PVs em rede de esgoto</h1>
        <div className="w-full h-full">
          <PVCanvas />
        </div>
      </main>
      <ControlsPanel />
    </div>
  );
}
