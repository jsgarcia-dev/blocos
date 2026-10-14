import { createRoot } from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./styles/app.css";
import "./styles/doc.css";
import { initPlatform } from "./lib/platform";
import { handles } from "./lib/handles";
import { useApp } from "./store/store";
import App from "./App";

if (import.meta.env.DEV) Object.assign(window, { __blocos: { handles, useApp } });

void initPlatform().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
