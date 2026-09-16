import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { useCanvasStore } from "./stores/canvasStore";
(window as any).useCanvasStore = useCanvasStore;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
