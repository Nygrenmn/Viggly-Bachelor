/*
RESULTSCHARTS.JSX HÅNDTERER VISNING AV DIAGRAMMER OG SKRIFTLIGE TILBAKEMELDINGER

Denne filen er en underkomponent til Results.jsx og har som oppgave i å 
presentere de innsamlede dataene visuelt. Noen av ResultsCharts sine funksjoner inkluderer:
- Hjelpekomponent for å tegne sektordiagrammer.
- Å vise nøkkeltall som antall vurderinger og gjennomsnittskår i egne statistikkkort.
- Å tegne et stolpediagram som viser snittet for forståelse og formidling.
- Å tegne sektordiagrammer som viser fordelingen av svaralternativer fra "Svært vanskelig" til "Svært lett"
  ved bruk av det tidligere hjelpekomponentet.
- Å filtrere, sortere etter dato, og liste opp alle skriftlige kommentarer fra studentene.
*/

/*
  Importerer nødvendige diagramkomponenter fra recharts-biblioteket for å bygge grafene.
*/
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Legend, Cell
} from "recharts";

/*
  Globale konstanter for farger og tekst.
  Kobler tallverdiene mellom 1-5 fra databasen til fargene valgt nedenfor i sektordiagrammene.
*/
const VALUE_COLORS = { 1: "#1A2480", 2: "#2C3DAE", 3: "#4C73E6", 4: "#7A91F0", 5: "#B0C0E6" };
const VALUE_LABELS = { 1: "Svært vanskelig", 2: "Vanskelig", 3: "Nøytral", 4: "Lett", 5: "Svært lett" };

/*
  Hjelpekomponent for å brukes flere ganger.
  Denne komponenten tar imot en tittel og formaterte data, og genererer et sirkeldiagram.
  Den regner så ut prosentandeler dynamisk og tilpasser fargene (gjennom map) på området og 
  tekst (som er legend) i diagrammet.
*/
const PieCard = ({ title, data }) => (
  <div className="card">
    <h3>{title}</h3>
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          outerRadius={60}
          label={({ value }) => {
            const total = data.reduce((acc, curr) => acc + curr.value, 0);
            return total > 0 && value > 0 ? `${Math.round((value / total) * 100)}%` : '';
          }}
        >
          {data.map((entry) => <Cell key={entry.name} fill={VALUE_COLORS[entry.name]} />)}
        </Pie>
        <Tooltip />
        <Legend 
          formatter={(value, entry) => (
            <span style={{ color: '#666' }}>
              {`${VALUE_LABELS[entry.payload.name]} (${entry.payload.value})`}
            </span>
          )} 
        />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

/*
  Koden for selve ResultsCharts-komponenten.
  Den tar imot ferdig prosesserte data som props fra Results.jsx og rendrer hele statistikksiden.
  Filter beholder kun besvarelser som faktisk har tekst og sort sorterer tilbakemeldingene 
  etter dato, slik at de nyeste kommer øverst.
*/
function ResultsCharts({ submissions, barData, pieDataQ1, pieDataQ2, avgQ1, avgQ2 }) {
  const validComments = submissions
    .filter((s) => s.text?.trim())
    .sort((a, b) => new Date(b.TM_Dato) - new Date(a.TM_Dato));

  /*
  Her bygges brukergrensesnittet for resultatvisningen i Results.jsx i tre seksjoner:
  - 1: Rekke med statistikkkort for antall svar, snitt forståelse, og snitt formidling.
  - 2: En grid med:
    - Stolpediagram for gjennomsnittlig skår per spørsmål med verdier mellom 1-5.
    - To sektordiagrammer som viser til svarfordeling som bruker hjelpekomponenten over og parametere fra results.jsx.
  - 3: Liste over skriftlige tilbakemeldinger, bruker map for å vise hver enkelt kommentar. Viser en 
       forklaring dersom listen er tom.
  */
  return (
    <>
      <div className="stats-container">
        <div className="card"><h3>Antall vurderinger</h3><p>{submissions.length}</p></div>
        <div className="card"><h3>Snitt forståelse</h3><p>{avgQ1}</p></div>
        <div className="card"><h3>Snitt formidling</h3><p>{avgQ2}</p></div>
      </div>

      <div className="charts-grid">
        <div className="card">
          <h3>Gjennomsnitt per spørsmål</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData}>
              <XAxis dataKey="name" />
              <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} />
              <Tooltip />
              <Bar dataKey="value">
                {barData.map((e) => <Cell key={e.name} fill={e.name === "Forståelse" ? "#4C73E6" : "#2C3DAE"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <PieCard title="Fordeling – Forståelse" data={pieDataQ1} />
        <PieCard title="Fordeling – Formidling" data={pieDataQ2} />
      </div>

      <div className="comments">
        <h2>Skriftlige tilbakemeldinger</h2>
        <div className="comments-list">
          {validComments.length > 0 ? (
            validComments.map((s) => (
              <div key={s.TM_ID} className="comment">
                <p className="date"><strong>{s.Tema}</strong> – {new Date(s.TM_Dato).toLocaleString()}</p>
                <p>{s.text}</p>
              </div>
            ))
          ) : (
            <p>{submissions.length === 0 ? "Ingen svar ennå" : "Ingen tekstlige kommentarer er lagt til ennå."}</p>
          )}
        </div>
      </div>
    </>
  );
}

export default ResultsCharts;