/*
  Denne filen fungerer som applikasjonens hovedinngang og definerer
  systemets ruting-struktur ved bruk av React Router.
  Det er lagt inn to tilgjengelige ruter i App-funksjonen nedenfor, basert
  på de to grensesnittene vi har laget:
  - Survey: Viser studentsiden for utfylling av spørreundersøkelsen.
  - Teacher: Viser resultatsiden/dashbordet ment for foreleser/lærer.
*/
import { Routes, Route } from "react-router-dom";
import Survey from "./components/Survey";
import Results from "./components/Results";
import "./css/App.css";

function App() {
  return (
    <Routes>
      <Route path="/survey" element={<Survey />} />
      <Route path="/teacher" element={<Results />} />
    </Routes>
  );
}

export default App;