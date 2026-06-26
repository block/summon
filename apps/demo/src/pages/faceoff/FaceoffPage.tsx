// THROWAWAY: Arrow-vs-raw-HTML side-by-side faceoff. Dev-only research harness,
// not part of the governed product. Delete with /api/faceoff/html when done.
//
// Left  = real governed Arrow pipeline via /api/generate (arrow-control).
// Right = ungoverned raw HTML via /api/faceoff/html, dropped into a sandboxed
//         iframe. No validation, no repair — the "just works" baseline.
//
// Both arms receive the identical fingerprint brief + tokens (fair fight). The
// only variable is the runtime.

import { useEffect, useRef, useState } from "react";
import { SummonSurface, type SummonSurfaceHandle } from "@anarchitecture/summon-react";
import { consumeSurfaceStream } from "@anarchitecture/summon/browser";

const API = "http://localhost:3001";

interface Fingerprint {
  id: string;
  name?: string;
}

type ArmStatus = "idle" | "running" | "done" | "error";

export function FaceoffPage() {
  const [fingerprints, setFingerprints] = useState<Fingerprint[]>([]);
  const [fingerprintId, setFingerprintId] = useState<string>("");
  const [prompt, setPrompt] = useState<string>(
    "Build an interactive weekly habit tracker with checkboxes and a live completion percentage.",
  );

  const [arrowStatus, setArrowStatus] = useState<ArmStatus>("idle");
  const [arrowError, setArrowError] = useState<string>("");
  const [arrowMs, setArrowMs] = useState<number | null>(null);
  const [arrowRepairs, setArrowRepairs] = useState<number | null>(null);
  const [arrowBlocked, setArrowBlocked] = useState<boolean>(false);

  const [htmlStatus, setHtmlStatus] = useState<ArmStatus>("idle");
  const [htmlError, setHtmlError] = useState<string>("");
  const [htmlMs, setHtmlMs] = useState<number | null>(null);
  const [htmlDoc, setHtmlDoc] = useState<string>("");

  const surfaceRef = useRef<SummonSurfaceHandle>(null);

  useEffect(() => {
    fetch(`${API}/api/fingerprints`)
      .then((r) => r.json())
      .then((list: Fingerprint[]) => {
        setFingerprints(list);
        if (list[0]) setFingerprintId(list[0].id);
      })
      .catch(() => setFingerprints([]));
  }, []);

  async function runArrow() {
    setArrowStatus("running");
    setArrowError("");
    setArrowMs(null);
    setArrowRepairs(null);
    setArrowBlocked(false);
    const t0 = performance.now();
    try {
      const res = await fetch(`${API}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          experimentalRuntime: "arrow-control",
          fingerprint: { id: fingerprintId, targetPath: "." },
          maxRepairAttempts: 1,
        }),
      });
      if (!res.body) throw new Error("no stream body");
      await consumeSurfaceStream(res.body as never, {
        mode: "interactive",
        validationMode: "observe",
        onArtifact: (artifact) => {
          surfaceRef.current?.renderArtifact(artifact as never);
        },
        onLine: (line) => {
          if (line.op === "meta" && line.path === "/run-metrics") {
            const v = line.value as { repairs?: number; blocked?: boolean };
            if (typeof v.repairs === "number") setArrowRepairs(v.repairs);
            if (typeof v.blocked === "boolean") setArrowBlocked(v.blocked);
          }
          if (line.op === "meta" && line.path === "/error") {
            setArrowError(String(line.value));
          }
        },
      });
      setArrowMs(Math.round(performance.now() - t0));
      setArrowStatus("done");
    } catch (err) {
      setArrowError(err instanceof Error ? err.message : String(err));
      setArrowStatus("error");
    }
  }

  async function runHtml() {
    setHtmlStatus("running");
    setHtmlError("");
    setHtmlMs(null);
    setHtmlDoc("");
    const t0 = performance.now();
    try {
      const res = await fetch(`${API}/api/faceoff/html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          fingerprint: { id: fingerprintId, targetPath: "." },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "request failed");
      let doc = String(data.html || "");
      // Strip accidental markdown fences if the model added them.
      doc = doc.replace(/^```html\s*/i, "").replace(/```\s*$/i, "").trim();
      setHtmlDoc(doc);
      setHtmlMs(Math.round(performance.now() - t0));
      setHtmlStatus("done");
    } catch (err) {
      setHtmlError(err instanceof Error ? err.message : String(err));
      setHtmlStatus("error");
    }
  }

  function runBoth() {
    void runArrow();
    void runHtml();
  }

  const labelStyle: React.CSSProperties = {
    font: "11px ui-monospace, monospace",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateRows: "auto 1fr", background: "#0a0a0a", color: "#eee" }}>
      <header style={{ padding: "12px 16px", borderBottom: "1px solid #222", display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ font: "13px ui-monospace, monospace" }}>FACEOFF</strong>
          <span style={labelStyle}>arrow (governed) vs raw html (ungoverned)</span>
          <select
            value={fingerprintId}
            onChange={(e) => setFingerprintId(e.target.value)}
            style={{ background: "#111", color: "#eee", border: "1px solid #333", padding: "6px 8px", borderRadius: 6 }}
          >
            {fingerprints.map((fp) => (
              <option key={fp.id} value={fp.id}>{fp.name || fp.id}</option>
            ))}
          </select>
          <button
            onClick={runBoth}
            disabled={!fingerprintId || arrowStatus === "running" || htmlStatus === "running"}
            style={{ background: "#eee", color: "#111", border: 0, padding: "7px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
          >
            Run both
          </button>
          <button onClick={() => void runArrow()} disabled={!fingerprintId} style={{ background: "#1a1a1a", color: "#eee", border: "1px solid #333", padding: "7px 12px", borderRadius: 6, cursor: "pointer" }}>Arrow only</button>
          <button onClick={() => void runHtml()} disabled={!fingerprintId} style={{ background: "#1a1a1a", color: "#eee", border: "1px solid #333", padding: "7px 12px", borderRadius: 6, cursor: "pointer" }}>HTML only</button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          style={{ width: "100%", background: "#111", color: "#eee", border: "1px solid #333", borderRadius: 6, padding: 8, font: "13px ui-sans-serif, system-ui", resize: "vertical" }}
        />
      </header>

      <main style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 0 }}>
        {/* Arrow arm */}
        <section style={{ borderRight: "1px solid #222", display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #222", display: "flex", gap: 12, alignItems: "center" }}>
            <span style={labelStyle}>arrow-control · sandboxed</span>
            <span style={{ ...labelStyle, color: statusColor(arrowStatus) }}>{arrowStatus}</span>
            {arrowMs != null && <span style={labelStyle}>{arrowMs}ms</span>}
            {arrowRepairs != null && <span style={labelStyle}>repairs:{arrowRepairs}</span>}
            {arrowBlocked && <span style={{ ...labelStyle, color: "#f55" }}>BLOCKED</span>}
          </div>
          <div style={{ overflow: "auto", background: "#fff" }}>
            {arrowError
              ? <pre style={{ color: "#f55", padding: 16, whiteSpace: "pre-wrap" }}>{arrowError}</pre>
              : <SummonSurface ref={surfaceRef} />}
          </div>
        </section>

        {/* HTML arm */}
        <section style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #222", display: "flex", gap: 12, alignItems: "center" }}>
            <span style={labelStyle}>raw html · iframe sandbox · ungoverned</span>
            <span style={{ ...labelStyle, color: statusColor(htmlStatus) }}>{htmlStatus}</span>
            {htmlMs != null && <span style={labelStyle}>{htmlMs}ms</span>}
          </div>
          <div style={{ overflow: "auto", background: "#fff" }}>
            {htmlError
              ? <pre style={{ color: "#f55", padding: 16, whiteSpace: "pre-wrap" }}>{htmlError}</pre>
              : <iframe
                  title="raw-html-arm"
                  srcDoc={htmlDoc}
                  sandbox="allow-scripts"
                  style={{ width: "100%", height: "100%", border: 0, display: "block" }}
                />}
          </div>
        </section>
      </main>
    </div>
  );
}

function statusColor(s: ArmStatus): string {
  if (s === "running") return "#fb3";
  if (s === "done") return "#5d5";
  if (s === "error") return "#f55";
  return "#666";
}
