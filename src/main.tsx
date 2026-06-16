import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Portal standalone de una sola pantalla — no necesita router.
createRoot(document.getElementById("root")!).render(<App />);
