import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Viewer } from "./Viewer";
import "./index.css";

async function bootstrap() {
  const root = createRoot(document.getElementById("root")!);
  try {
    const res = await fetch("/graph.json");
    if (!res.ok) throw new Error(`graph.json ${res.status}`);
    const ir: unknown = await res.json();
    root.render(
      <StrictMode>
        <Viewer ir={ir} />
      </StrictMode>,
    );
  } catch {
    root.render(
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        graph.json을 찾을 수 없습니다. 분석기 출력(IR JSON)을 <code>packages/viewer/public/graph.json</code> 에 두세요.
      </div>,
    );
  }
}
void bootstrap();
