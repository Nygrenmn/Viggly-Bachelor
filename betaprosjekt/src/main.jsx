/*
  Main.jsx er filen som fungerer som applikasjonens startpunkt.
  Filen har blant annet ansvar for å:
  - Finne den tomme boksen i HTML-filen (id="root") der appen skal ligge.
  - Sette inn hele Viggly-appen vår der, slik at den vises på skjermen.
  - Pakke inn appen i to hjelpere:
      - BrowserRouter, som gjør at man kan bytte side uten å laste inn nettleseren på nytt.
      - StrictMode, som advarer oss med feilmeldinger i konsollen dersom noe kodes feil.
*/
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);