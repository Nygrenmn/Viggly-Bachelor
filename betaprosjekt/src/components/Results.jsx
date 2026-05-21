/*
RESULTS.JSX HÅNDTERER DASHBORDET SOM VISER EVALUERINGENE FRA SPØRREUNDERSØKELSEN

Denne filen inneholder alle logikkene og grensesnittet for å vise resultatene
fra spørreundersøkelsen til forelesere. Noen av Results.jsx sine hovedfunksjoner
inkluderer:
- Å hente tilgjengelige semestre fra backend, og så deretter -->
  - Hente emner basert på et valgt semester ved å kjedefiltrere
  - Hente forelesninger basert på et valgt emne ved å kjedefiltrere
- Regne ut antall vurderinger og gjennomsnittsskår for forståelse og formidling 
  som sendes videre til diagramkomponentene.
- Teller opp svarene og grupperer dem for sektordiagrammene i ResultsCharts.jsx
- En knapp for å åpne utskriftssiden som lar brukeren eksportere til PDF.
- En knapp for å åpne administratorpanel-modalen.
- Importere gjennomsnittsoversikt/diagrammer/kommentarer komponenter og modalen.
*/

/*
  Importerer nødvendige funksjoner som brukes i komponenten, samt logo og CSS.
*/
import { useState, useEffect, useCallback } from "react";
import ResultsCharts from "./ResultsCharts";
import Modal from "./Modal";
import logo from "../assets/logo.png";
import "../css/Results.css";

/*
  Nedenfor ligger koden for selve Results-komponenten hvor all logikk og UI 
  for foreleserens dashbord og resultatoversikt håndteres.
  Det vil bli forklart nærmere hvordan den kjedede filtreringen og databehandlingen gjøres.
*/
function Results() {
  /*
    State-variabler for results-siden.
    Her lagres listene over tilgjengelige semestre, emner, forelesninger og studentbesvarelsene.
  */
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  /*
    State-variabler for å holde styr på brukerens valg i dropdown-menyene,
    samt status på om administrator-modalen skal vises eller ikke.
  */
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedLecture, setSelectedLecture] = useState("");
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  /*
    Initial henting for Semestre.
    Den henter alle registrerte semestre fra backend når komponenten laster inn.
    Dersom det valgte semesteret ikke finnes i den hentede dataen nullstilles
    alle filtere og tilhørende lister.
  */
  const fetchSemesters = () => {
    fetch("/api/semesters")
      .then((res) => res.json())
      .then((data) => {
        setSemesters(data);
        const exists = data.some((s) => String(s.Sem_ID) === String(selectedSemester));

        if (selectedSemester && !exists) {
          setSelectedSemester("");
          setSelectedCourse("");
          setSelectedLecture("");
          setCourses([]);
          setLectures([]);
        }
      })
      .catch((err) => console.error("Feil ved henting av semestre:", err));
  };

  /* Hook som sørger for at listen over semestre hentes bare en gang ved oppstart. */
  useEffect(() => {
    fetchSemesters();
  }, []);

  /*
  Kjedet henting for emner, avhengig av valgt semester.
  Denne funksjonen kjøres når brukeren har valgt et semester.
  Dersom ingen semester er valgt, tømmes listene for emne og forelesning automatisk.
  Hvis emnet som var valgt fra før ikke finnes i det nye semesteret så blir valget nullstillet.
  */
  const fetchCourses = () => {
    if (!selectedSemester) {
      setCourses([]);
      setSelectedCourse("");
      setLectures([]);
      setSelectedLecture("");
      return;
    }

    fetch(`/api/courses?Sem_ID=${selectedSemester}`)
      .then((res) => res.json())
      .then((data) => {
        setCourses(data);

        const exists = data.some(
          (e) => String(e.EmneID) === String(selectedCourse),
        );

        if (!exists) {
          setSelectedCourse("");
          setLectures([]);
          setSelectedLecture("");
        }
      })
      .catch((err) => console.error("Feil ved henting av emner:", err));
  };

  /* Hook som overvåker 'selectedSemester' og henter nye emner hver gang den endres. */
  useEffect(() => {
    fetchCourses();
  }, [selectedSemester]);

  /*
    Kjedet henting for forelesninger, avhengig av valgt emne.
    Denne funksjonen henter alle forelesninger tilhørende det valgte emnet.
    Forelesningene sorteres etter dato med eldst først før de lagres i state.
    Hvis forelesning som var valgt fra før ikke finnes i det nye emnet så blir filteret nullstilt.
  */
  const fetchLectures = () => {
    if (!selectedCourse) {
      setLectures([]);
      setSelectedLecture("");
      return;
    }

    fetch(`/api/lectures?emne_id=${selectedCourse}`)
      .then((res) => res.json())
      .then((data) => {
        const sortedLectures = [...data].sort((a, b) => new Date(a.F_Dato) - new Date(b.F_Dato));
        setLectures(sortedLectures);

        const exists = sortedLectures.some((l) => String(l.F_ID) === String(selectedLecture));
        if (!exists) {
          setSelectedLecture("");
        }
      })
      .catch((err) => console.error("Feil ved henting av forelesninger:", err));
  };

  /* Hook som overvåker 'selectedEmne' og henter nye forelesninger hver gang den endres. */
  useEffect(() => {
    fetchLectures();
  }, [selectedCourse]);

  const fetchResults = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedSemester) params.append("Sem_ID", selectedSemester);
    if (selectedCourse) params.append("emne_id", selectedCourse);
    if (selectedLecture) params.append("f_id", selectedLecture);

    fetch(`/api/results?${params.toString()}`)
      .then((res) => res.json())
      .then(setSubmissions)
      .catch(() => setSubmissions([]));
  }, [selectedLecture, selectedCourse, selectedSemester]);

  /*
    Henter resultater basert på alle filtrene.
    Denne effekten henter svar fra backend basert på valgt semester, emne og forelesning ved å bygge en params liste, 
    og så oppdateres diagrammene automatisk.
  */
  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  /*
    CalculateAverage regner ut gjennomsnittskåren for et spesifikt spørsmål.
    - Sjekker om det i det hele tatt finnes innsendte svar, og hvis ikke returneres 0.
    - Slår sammen alt ved hjelp av .reduce() funksjonen.
    - Returnerer gjennomsnittet med en desimal i toFixed(1).
  */
  const calculateAverage = (field) => {
    if (submissions.length === 0) return 0;
    const sum = submissions.reduce((acc, item) => acc + Number(item[field] || 0), 0);
    return (sum / submissions.length).toFixed(1);
  };

  /*
    GetDistribution teller opp og grupperer svaralternativene fra 1 til 5.
    Brukes for å klargjøre dataene til sektordiagrammene i ResultsCharts.jsx.
    Den lager først et standardobjekt med 0 i opptelling for alle svaralternativer, så går den gjennom svarene
    mens telleren økes for hvert svar i de gitte verdiene. 
    map. blir brukt for å gjøre om resultatene for diagramkomponentene, så filtreres 0 svar vekk for
    et finere fremvisning.
  */
  const getDistribution = (field) => {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    submissions.forEach((s) => {
      const val = Number(s[field]);
      if (val >= 1 && val <= 5) dist[val]++;
    });
    return Object.keys(dist)
      .map((key) => ({ name: key, value: dist[key] }))
      .filter((item) => item.value > 0);
  };

  /*
    Data som skal vises i stolpediagrammene klargjøres her.
    Den henter ut og konverterer gjennomsnittstallene for de to spørsmålene.
  */
  const barData = [
    { name: "Forståelse", value: Number(calculateAverage("question1")) },
    { name: "Formidling", value: Number(calculateAverage("question2")) },
  ];

  /*
    Eventhandler som håndterer endring i semester-dropdownen.
    Når et nytt semester velges, må alle underliggende valg (emne og forelesning) 
    samt tilhørende lister nullstilles, da de gamle valgene ikke lenger er gyldige.
  */
  const handleSemesterChange = (e) => {
    const value = e.target.value;

    setSelectedSemester(value);
    setSelectedCourse("");
    setSelectedLecture("");
    setCourses([]);
    setLectures([]);
  };

  /*
    Eventhandler som håndterer endring i emne-dropdownen.
    Når et nytt emne velges, nullstilles valgt forelesning og listen over forelesninger,
    slik at brukeren må gjøre et nytt valg basert på det nye emnet.
  */
  const handleCourseChange = (e) => {
    const value = e.target.value;

    setSelectedCourse(value);
    setSelectedLecture("");
    setLectures([]);
  };

  /*
    Denne delen lager hele brukergrensesnittet for dashbordet.
    Her vises:
    - En topp-header med logo, sidetittel og filter-dropdowns for kjedet søk, som er:
      - Dropdown 1, valg av semester.
      - Dropdown 2, Valg av emne (deaktivert til semester er valgt).
      - Dropdown 3, Valg av forelesning (deaktivert til emne er valgt).
    - Knapp for å skrive ut/laste ned PDF via nettleserens printfunksjon
    - Knapp for å åpne administrer-panelet.
    - ResultsCharts-komponenten som tar imot ferdig prosesserte data for å tegne diagrammer fra ResultsCharts.jsx.
    - Modal-komponenten dersom 'isAdminModalOpen' er satt til true, altså trykket på.
  */
  return (
    <div className="results-page">
      <div className="results-header">
        <div className="results-title-group">
          <img src={logo} alt="Logo" className="results-logo" />
          <h1>Evaluerings-dashbord</h1>
        </div>
        <div className="header-row">
          <div className="header-left">
            <div className="selector">
              <select value={selectedSemester} onChange={handleSemesterChange}>
                <option value="">Alle semestre</option>
                {semesters.map((s) => (
                  <option key={s.Sem_ID} value={s.Sem_ID}>
                    {s.Termin} {s.Ar}
                  </option>
                ))}
              </select>

              <select
                value={selectedCourse}
                disabled={!selectedSemester}
                onChange={handleCourseChange}
              >
                <option value="">Alle emner</option>
                {courses.map((e) => (
                  <option key={e.EmneID} value={e.EmneID}>
                    {e.EmneKode} – {e.Navn}
                  </option>
                ))}
              </select>

              <select
                value={selectedLecture}
                disabled={!selectedSemester || !selectedCourse}
                onChange={(e) => setSelectedLecture(e.target.value)}
              >
                <option value="">Alle forelesninger</option>
                {lectures.map((l) => (
                  <option key={l.F_ID} value={l.F_ID}>
                    {l.Tema} ({new Date(l.F_Dato).toLocaleDateString("nb-NO")})
                  </option>
                ))}
              </select>
            </div>
            <button className="action-btn download-pdf-btn" onClick={() => window.print()}>
              ⬇ Last ned PDF
            </button>
          </div>

          <div className="header-right">
            <button className="action-btn admin-button" onClick={() => setIsAdminModalOpen(true)}>
              ⚙ Administrer
            </button>
          </div>
        </div>
      </div>

      <ResultsCharts
        submissions={submissions}
        barData={barData}
        pieDataQ1={getDistribution("question1")}
        pieDataQ2={getDistribution("question2")}
        avgQ1={calculateAverage("question1")}
        avgQ2={calculateAverage("question2")}
      />

      {isAdminModalOpen && (
        <Modal
          onClose={() => setIsAdminModalOpen(false)}
          refreshSemesters={fetchSemesters}
          refreshCourses={fetchCourses}
          refreshLectures={fetchLectures}
          refreshResults={fetchResults}
        />
      )}
    </div>
  );
}

export default Results;
