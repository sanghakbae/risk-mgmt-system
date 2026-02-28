import React, { useEffect, useId, useState } from "react";
import mermaid from "mermaid";

export default function MermaidChart({ code }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
    (async () => {
      const { svg } = await mermaid.render(`m-${id}`, code);
      setSvg(svg);
    })();
  }, [code, id]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 overflow-x-auto">
      <div className="text-sm font-semibold text-slate-900 mb-2">프로세스 흐름</div>
      <div className="min-w-[720px]" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
