/*
  MODAL-KOMPONENT FOR Å VISE INNHOLDET I ADMINISTRATORPANELET

  Denne komponenten åpner en modal (vindu som åpner seg over hovedsiden)
  med admin-panelet.
  Modalen kan brukes av forelesere til å administrere:
  - Semestre
  - Emner
  - Forelesninger
  I vinduet kan forelesere opprette, redigere og slette disse elementene,
  samt holde oversikt over og filtrere mellom dem. 
  Når modalen åpnes, låses scrolling på nettsiden slik at brukeren
  kun kan interagere med modal-vinduet til dette er lukket igjen.
*/

/*
  Importerer React-funksjoner, selve panelene fra AdminPanels.jsx
  og CSS-filen som brukes i modal-vinduet.
*/
import { useState, useEffect } from "react";
import { SemesterPanel, CoursePanel, LecturePanel } from "./AdminPanels";
import "../css/Modal.css";

/* 
  Lager Modal-komponenten og tar inn funksjoner for å lukke denne, 
  samt funksjonene for å oppdatere semestre, emner og forelesninger.
  Disse funksjonene hentes fra Results.jsx, og sørger for at når en endring 
  gjøres i admin-panelet, oppdateres dataene i resultatvisningen i sanntid.
*/
export default function Modal({
  onClose,
  refreshSemesters,
  refreshCourses,
  refreshLectures,
  refreshResults,
}) {
  /*
    State-variabler som lagrer ID-en til semesteret/emnet som er 
    valgt i administratorpanelet.
    Disse er variabler i React som lar komponenter "huske" informasjon og data
    selv om siden lastes inn på nytt.
  */
  const [selectedSemesterId, setSelectedSemesterId] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState(null);

  /*
    State-variabler som lagrer følgende data hentet fra backend:
    - Semestre: alle semestre i databasen
    - Emner: emner tilhørende valgt semester
    - Forelesninger: forelesninger tilhørende valgt emne
  */
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [lectures, setLectures] = useState([]);

  /*

    Henter en liste med semestre fra backend via API-et "/api/semesters".
    Dataen konverteres til JSON og lagres i state-variabelen ovenfor (semestre).
    Dersom feil skulle oppstå, blir disse vist i konsollen.
  */
  const fetchSemesters = () =>
    fetch("/api/semesters")
      .then((r) => r.json())
      .then(setSemesters)
      .catch(console.error);

  /* 
  Henter emner basert på valgt semester.
  Dersom det ikke er valgt noen semestre, tømmes emnelisten.
  Ellers gjøres et API-kall med semester-ID som parameter,
  og resultatet lagres i state-variabelen "emner".
  Eventuelle feil logges i konsollen.
*/
  const fetchCourses = () => {
    if (!selectedSemesterId) {
      setCourses([]);
      return;
    }

    fetch(`/api/courses?Sem_ID=${selectedSemesterId}`)
      .then((r) => r.json())
      .then(setCourses)
      .catch(console.error);
  };

  /* 
  Logikken i denne er lik den i fetchCourses.
  Dersom det ikke er valgt noen forelesninger, settes listen til tom.
  Ellers gjøres et API-kall med en ID som parameter,
  og resultatet lagres i lectures-variabelen.
  Det logges også eventuelle feil i konsollen.
*/
  const fetchLectures = () => {
    if (!selectedCourseId) {
      setLectures([]);
      return;
    }

    fetch(`/api/lectures?emne_id=${selectedCourseId}`)
      .then((r) => r.json())
      .then(setLectures)
      .catch(console.error);
  };

  /*
  UseEffects'ene nedenfor styrer ulik funksjonalitet i administratorpanelet, basert
  brukerinteraksjon.
  Denne første useEffect'en sørger for å låse scrolling på hovedsiden når modalen 
  åpnes, og gjenoppretter scroll når modalen blir lukket igjen.
*/
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  /*
  Denne kjører med en gang modalen åpnes og henter alle semestre fra databasen.
  Her brukes fetchSemesters-funksjonen som er definert ovenfor, for å ta seg av
  selve hentingen av data.
*/
  useEffect(() => {
    fetchSemesters();
  }, []);

  /*
  Når brukeren velger et semester i panelet henter denne useEffect'en alle 
  emner som er tilknyttet dette semesteret. 
  Dersom ingen semester er valgt, tømmes emnelisten igjen til brukeren
  har valgt et nytt.
*/
  useEffect(() => {
    setSelectedCourseId(null);
    fetchCourses();
  }, [selectedSemesterId]);

  /* 
  Funksjonaliteten er lik useEffect'en ovenfor.
  Dersom brukeren velger et emne hentes alle tilknyttede forelesninger.
  Dersom ingen emner er valgt, tømmes forelesningslisten igjen.
*/
  useEffect(() => {
    fetchLectures();
  }, [selectedCourseId]);

  /* 
  Dette er koden som henter (returns) selve UI'et for administratorpanelet.
  Panelet inneholder tre hovedseksjoner: semestre, emner og forelesninger
  Hver seksjon har en header, og inneholder et panel som viser dataen som 
  blir hentet av funksjonene og useEffects'ene over.
  Panelet er UI'et hvor brukeren kan administrere disse dataene.
  Når dataene oppdateres inne i panelet og dette lukkes av brukeren,
  vil de umiddelbart bli tilgjengelige på evalueringsdashbordet. 
*/
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box admin-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        <h2 className="modal-header">Administratorpanel</h2>

        {/*
          Viser alle tilgjengelige semestre i systemet.
          Lar brukeren velge eller fjerne valgt semester.
          Muligheter for å administrere emner skjer når et semester
          er valgt.
        */}
        <div className="admin-grid">
          <div className="admin-panel">
            <h3 className="panel-header">Semestre</h3>
            <SemesterPanel
              semesters={semesters}
              selectedSemesterId={selectedSemesterId}
              onSelect={(id) =>
                setSelectedSemesterId((prev) => (prev === id ? null : id))
              }
              onRefresh={() => {
                fetchSemesters();
                refreshSemesters();
                refreshResults();
              }}
            />
          </div>

          {/*
            Viser alle tilgjengelige emner dersom brukeren har valgt et semester
            Brukeren kan legge til, fjerne eller velge emner tilknyttet det 
            valgte semesteret.
            Dersom brukeren velger et bestemt emne, kan hen gå videre 
            og administrere tilknyttedet forelesninger.
          */}
          <div className="admin-panel">
            <h3 className="panel-header">
              Emner
              {selectedSemesterId && (
                <span className="filter-badge">filtrert</span>
              )}
            </h3>

            <CoursePanel
              courses={courses}
              semesters={semesters}
              selectedSemesterId={selectedSemesterId}
              selectedCourseId={selectedCourseId}
              onSelect={(id) =>
                setSelectedCourseId((prev) => (prev === id ? null : id))
              }
              onRefresh={() => {
                fetchCourses();
                refreshCourses();
                refreshResults();
              }}
            />
          </div>

          {/*
            Dette panelet viser til slutt alle tilgjengelige forelesninger
            dersom brukeren har valgt et emne.
            Brukeren kan også legge til eller fjerne forelesninger som skal 
            evalueres av studentene gjennom Survey.jsx.
          */}
          <div className="admin-panel">
            <h3 className="panel-header">
              Forelesninger
              {(selectedCourseId || selectedSemesterId) && (
                <span className="filter-badge">filtrert</span>
              )}
            </h3>

            <LecturePanel
              lectures={lectures}
              courses={courses}
              selectedCourseId={selectedCourseId}
              selectedSemesterId={selectedSemesterId}
              onRefresh={() => {
                fetchLectures();
                refreshLectures();
                refreshResults();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/*
  En nærmere forklaring av logikken for de ulike panelene er forklart i AdminPanels.jsx.
*/
