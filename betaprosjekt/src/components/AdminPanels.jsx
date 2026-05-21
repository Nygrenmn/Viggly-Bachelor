/*
  ADMINPANELS.JSX HÅNDTERER PANELENE SOM ÅPNES AV MODAL.JSX

  Denne filen inneholder tre UI-komponenter som brukes i vinduet som åpner seg
  - SemesterPanel (for håndtering av semestre)
  - CoursePanel (for håndtering av emner)
  - LecturePanel (for håndtering av forelesninger)
  De tre panelene følger mye av den samme logikken og dataflyten mellom 
  dem er bygget opp på en hierarkisk måte.
  Semesterpanelet ligger øverst og kan sees på som en parent komponent.
  Når et semester velges her vil CoursePanel vise tilknyttede
  emner, og det samme gjelder i LecturePanel når et emne velges.
  Course- og LecturePanel er altså child-komponenter av SemesterPanel.
*/

/*
  Importerer funksjoner fra React og CSS-filen som brukes i disse panelene.
*/
import { useState, useRef, useEffect } from "react";
import "../css/AdminPanels.css";

/*
  Semesterpanel er den første komponenten, og der brukeren kan bli vist 
  og administrere alle semestre knyttet applikasjonen.
  Hovedfunksjonaliteten i dette panelet er å:
  - Vise en liste over tilgjengelige/tillagte semestre.
  - La brukeren velge et semester for videre datahåndtering.
  - La brukeren opprette nye semestre.
  - La brukeren slette eksisterende semestre (dersom disse er tomme for emner).
*/
export function SemesterPanel({ semesters, selectedSemesterId, onSelect, onRefresh }) {

  /*
    I const'ene lagres state-variabler for skjemaet som brukes til å opprette semestre.
    ShowAdd: styrer om skjemaet for å legge til semester vises eller skjules dersom
    dersom brukeren klikker på "Legg til semester"-knappen.
    Type: lagrer valgt semester-type (Vår/Høst)
    Year: lagrer valgt årstall for semesteret
    FormRef brukes på sin side til å registrere om brukeren klikker utenfor skjemaet
    for å legge til semester, slik at dette lukkes automatisk. UserEffect'en nedenfor
    er tilknyttet denne.
  */
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState("Vår");
  const [year, setYear] = useState(new Date().getFullYear());
  const formRef = useRef(null);

  /*
    Dette er koden som håndterer åpning og lukking av skjemaet når brukeren
    interagerer med dette. Når skjemaet er synlig (showAdd = true):
    - Når skjemaet åpnes, legges det til en event listener for å registrere 
      hva brukeren gjør.
    - Dersom brukeren klikker utenfor skjemaet eller fyller det ut og 
      klikker, skjules det igjen ved å sette showAdd til false.
    - Når skjemaet lukkes igjen fjernes eventlistener, da denne ikke 
      lenger behøver å lytte etter klikk utenfor skjemaet.
  */
  useEffect(() => {
    if (!showAdd) return;
    const handler = (e) => {
      if (formRef.current && !formRef.current.contains(e.target))
        setShowAdd(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAdd]);

  /*
    Dette er funksjonen som håndterer tillegging av nye semestre.
    Den sender data (type og år) til backend via et POST-kall (se post.js)
    Dersom forespørselen lykkes skjules skjemaet og dataene oppdateres via onRefresh()
    Hvis noe går galt, vises en feilmelding.
  */
  const handleAdd = async () => {
    try {
      const res = await fetch("/api/semesters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termin: type, ar: year }),
      });
      if (res.ok) {
        setShowAdd(false);
        onRefresh();
      } else {
        alert("Kunne ikke legge til semester");
      }
    } catch (err) {
      console.error(err);
    }
  };

  /*
    Denne funksjonen håndterer på sin side sletting semestre.
    Dersom brukeren klikker på "slett"-knappen, vil funksjonen først 
    stoppe brukeren og spørre om bekreftelse på sletting.
    Hvis brukeren bekrefter vil funksjonen så sjekke om det finnes 
    emner inne i semesteret. Dersom dette er tilfellet, vil brukeren
    bli bedt om å slette disse først.
    Dersom semesteret er tomt:
    - En DELETE-forespørsel sendes til backend
    - Ved suksessm oppdateres dataene via onRefresh()
    Hvis noe går galt, vises en feilmelding.
  */
  const handleDelete = async (semId, e) => {
    e.stopPropagation();
    if (!window.confirm("Slette dette semesteret? Du må slette alle tilhørende emner før dette semesteret kan fjernes."))
      return;
    try {
      const res = await fetch(`/api/semesters/${semId}`, { method: "DELETE" });
      if (res.ok) onRefresh();
      else alert("Kunne ikke slette semester. Sjekk om det har tilknyttede emner.");
    } catch (err) {
      console.error(err);
    }
  };

  /*
    Denne return-koden bygger selve brukergrensesnittet (UI) for semesterpanelet.
    UI-et består av:
    - En knapp for å åpne et skjema så nye semestre kan legges til.
    - Dette skjemaet åpnes så, med mulighet for å velge termin og år.
    - En liste med alle eksisterende semestre vises nedenfor dette.
    - I listen kan brukeren klikke på et semester for å velge det, 
      eller klikke på søppelbøtte-ikonet for å slette det. 
  */
  return (
    <div className="admin-panel-inner">
      <div className="panel-top-actions">
        {!showAdd && (
          <button className="add-button" onClick={() => setShowAdd(true)}>
            + Legg til semester
          </button>
        )}

        {/* 
          Skjemaet for å legge til semester vises når showAdd er true, og skjules ellers.
        */} 
        {showAdd && (
          <div className="add-semester-form" ref={formRef}>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="Vår">Vår</option>
              <option value="Høst">Høst</option>
            </select>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
            <div className="button-row">
              <button className="add-form-button" onClick={handleAdd}>
                Legg til
              </button>
              <button className="cancel-form-button" onClick={() => setShowAdd(false)}>
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 
        Liste over semestre, med mulighet for å velge og slette disse 
      */}
      <div className="item-list">
        {semesters.length === 0 && (
          <p className="empty-msg">Ingen semestre funnet</p>
        )}
        {semesters.map((sem) => (
          <div
            key={sem.Sem_ID}
            className={`list-row ${selectedSemesterId === sem.Sem_ID ? "selected" : ""}`}
            onClick={() => onSelect(sem.Sem_ID)}
            title="Klikk for å filtrere"
          >
            <span className="row-label">
              {sem.Termin} {sem.Ar}
            </span>
            <button
              className="delete-row-btn"
              onClick={(e) => handleDelete(sem.Sem_ID, e)}
              title="Slett"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/*
  Dette er koden som bygger grensesnittet for emnepanelet.
  På samme måte som semesterpanelet består det av:
  - En knapp for å åpne et skjema for å legge til nye emner 
    (vises kun når et semester er valgt)
  - Et skjema for å opprette et nytt emne, hvor brukeren fyller inn 
    emnekode, navn og velger semester
  - En liste over emner som tilhører valgt semester
  Her kan brukeren opprette, slette og velge emner på samme måte som i semesterpanelet,
  men dersom ingen semester er valgt vises en beskjed om å velge semester først.
*/
export function CoursePanel({ courses, semesters, selectedSemesterId, selectedCourseId, onSelect, onRefresh }) {

  /*
    I variablene lagres data fra skjemaet for å opprette nye emner.
    - ShowAdd: styrer om skjemaet for å legge til emne vises eller skjules.
    - Code: lagrer emnekoden for det nye emnet.
    - Name: lagrer navnet på det nye emnet.
    - SemId: lagrer id'en til det valgte semesteret, slik at emnet knyttes riktig.
    FormRef brukes på samme måte som i SemesterPanel.
  */
  const [showAdd, setShowAdd] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [semId, setSemId] = useState("");
  const formRef = useRef(null);

  /*
    Denne useEffect'en sørger for at semId får riktig semesterId, basert
    på hvilket semester brukeren har valgt.
    Dette oppdateres automatisk i skjemaet for å fylle inn emne.
  */
  useEffect(() => {
    setSemId(selectedSemesterId ?? "");
  }, [selectedSemesterId, showAdd]);

  /*
    Fungerer på samme måte som i semesterpanelet, og håndterer åpning og 
    lukking av skjemaet for å legge til emner.
  */
  useEffect(() => {
    if (!showAdd) return;
    const handler = (e) => {
      if (formRef.current && !formRef.current.contains(e.target))
        setShowAdd(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAdd]);

  /*
    Denne koden håndterer tillegging av nye emner og fungerer på samme måte 
    som tillegging av nye semestre.
    Data (emnekode, emnenavn, og tilknyttet semester) sendes til backend.
    Skjemaet lukker seg så på samme måte som i semesterpanelet, og dataene oppdateres.
  */
  const handleAdd = async () => {
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emneKode: code,
          navn: name,
          Sem_ID: Number(semId)
        }),
      });
      if (res.ok) {
        setCode("");
        setName("");
        setSemId(selectedSemesterId ?? "");
        setShowAdd(false);
        onRefresh();
        onSelect(null);
      } else {
        alert("Kunne ikke legge til emne");
      }
    } catch (err) {
      console.error(err);
    }
  };

  /*
    Funksjonen håndterer sletting av emner på samme måte som i semesterpanelet.
    Ved sletting bes brukeren om bekreftelse, og dersom dette bekreftes sendes 
    en DELETE-forespørsel til backend.
    Ved suksess oppdateres dataene (onRefresh) og det valgte emnet fjernes
    En feilmelding vises hvis noe går galt, vises en feilmelding.
  */
  const handleDelete = async (courseId, e) => {
  e.stopPropagation();
  if (!window.confirm("Slette dette emnet? Dette vil også slette tilknyttede forelesninger")) return;

  try {
    const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
    if (res.ok) {
      onRefresh();
      onSelect(null);
    } else {
      alert("Kunne ikke slette emne.");
    }
  } catch (err) {
    console.error(err);
  }
};

  // Sjekker om alle nødvendige felt er fylt ut for å kunne opprette et nytt emne.
  const canSubmit = code.trim() && name.trim() && semId;

  /*
    Koden nedenfor bygger brukergrensesnittet for emnepanelet på lignende måte som
    gjøres i semesterpanelet.
    Dette panelet:
    - Viser en knapp for å legge til nytt emne (dersom et semester er valgt).
    - Viser et skjema for å opprette nytt emne når knappen klikkes på.
    - Lar brukeren skrive inn emnekode og emnenavn.
    - Lar brukeren velge hvilket semester emnet skal knyttes til.
    - Validerer input via canSubmit før "Legg til" kan trykkes.
    - Viser en liste over emnene som hører til valgt semester.
    - Lar brukeren velge eller slette disse.
  */
  return (
    <div className="admin-panel-inner">
      <div className="panel-top-actions">
        {selectedSemesterId && !showAdd && (
          <button className="add-button" onClick={() => setShowAdd(true)}>
            + Legg til emne
          </button>
        )}

        {/* 
          Skjemaet for å legge til emner vises kun når knappen er tryket på 
        */} 
        {showAdd && (
          <div className="add-course-form" ref={formRef}>
            <input
              placeholder="Emnekode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              placeholder="Emnenavn"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            
            <select
              value={semId}
              onChange={(e) => setSemId(e.target.value)}
            >
              <option value="">Velg semester</option>
              {semesters.map((sem) => (
                <option key={sem.Sem_ID} value={sem.Sem_ID}>
                  {sem.Termin} {sem.Ar}
                </option>
              ))}
            </select>

            <div className="button-row">
              <button
                className="add-form-button"
                onClick={handleAdd}
                disabled={!canSubmit}
              >
                Legg til
              </button>
              <button className="cancel-form-button" onClick={() => setShowAdd(false)}>
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* 
        Listen som viser alle tilknyttede emner, med mulighet for å velge og slette disse   
      */}
      <div className="item-list">
        {!selectedSemesterId ? (
          <p className="empty-msg">Velg et semester for å se emner</p>
        ) : courses.length === 0 ? (
          <p className="empty-msg">Ingen emner funnet</p>
        ) : (
          courses.map((course) => (
            <div
              key={course.EmneID}
              className={`list-row ${selectedCourseId === course.EmneID ? "selected" : ""}`}
              onClick={() => onSelect(course.EmneID)}
              title="Klikk for å filtrere"
            >
              <span className="row-label">
                {course.EmneKode} – {course.Navn}
              </span>
              <button
                className="delete-row-btn"
                onClick={(e) => handleDelete(course.EmneID, e)}
                title="Slett"
              >
                🗑
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/*
  Denne komponenten håndterer visning og administrasjon av forelesninger.
  Logikken tilsvarer semester- og emnepanelet, men panelet har på sin side 
  følgende funksjonalitet:
  - Knapp for å legge til ny forelesning (når et emne er valgt).
  - Skjema for å opprette forelesning (med tittel, tilknyttet emne og dato).
  - Kobler forelesning til valgt emne.
  - Sorterer og viser forelesninger kronologisk.
  - Lar brukeren slette forelesninger.
  - Oppdaterer data via onRefresh etter endringer
*/
export function LecturePanel({ lectures, courses, selectedCourseId, selectedSemesterId, onRefresh }) {

/*
  Variablene nedenfor lagrer dataene skjemaet som brukes til å opprette en ny forelesning.
  - ShowAdd: Styrer om skjemaet for å legge til forelesning vises eller skjules.
  - Title: Tittelen på forelesningen.
  - Date: Datoen for forelesningen.
  - EmneId: ID'en til emnet forelesningen skal knyttes til.
  FormRef har samme funksjon som i de to foregående panelene.
*/
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [courseId, setCourseId] = useState("");
  const formRef = useRef(null);

  /*
    Sørger for at riktig emneID tilknyttes forelesningen.
    Oppdateres automatisk når emnet er valgt.
  */
  useEffect(() => {
    setCourseId(selectedCourseId ?? "");
  }, [selectedCourseId, showAdd]);

  /*
    UseEffect'en nedenfor fungerer på samme måte som i de to andre panelene.
    Her håndteres åpning og lukking av skjemaet for å legge til forelesninger.
  */
  useEffect(() => {
    if (!showAdd) return;
    const handler = (e) => {
      if (formRef.current && !formRef.current.contains(e.target))
        setShowAdd(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAdd]);

  /*
    HandleAdd håndterer opprettelse av en ny forelesning.
    Når skjemaet er fyllt ut og brukeren klikker "Legg til", sender en POST-forespørsel 
    til /api/lectures med data fra skjemaet
    Dataene som sendes er de samme som er lagret i state-variablene (tema, dato og emneId).
    Etter dette nullstilles skjemaet ved suksess, eller det vises en feilmelding dersom
    noe går galt.
  */
  const handleAdd = async () => {
    try {
      const res = await fetch("/api/lectures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tema: title,
          dato: date,
          emneId: Number(courseId),
          Sem_ID: selectedSemesterId ?? undefined,
        }),
      });
      if (res.ok) {
        setTitle("");
        setDate("");
        setCourseId(selectedCourseId ?? "");
        setShowAdd(false);
        onRefresh();
      } else {
        alert("Kunne ikke legge til forelesning");
      }
    } catch (err) {
      console.error(err);
    }
  };

  /*
    HandleDelete håndterer sletting av en eksisterende forelesning.
    Når brukeren bekrefter sletting, sendes det en DELETE-forespørsel 
    til /api/lectures/ med ID'en til forelesningen som skal slettes.
    Etter dette kalles onRefresh() for å hente oppdatert data fra backend
    eller det vises en feilmelding dersom noe går galt.
  */
  const handleDelete = async (lectureId, e) => {
    e.stopPropagation();
    if (!window.confirm("Slette denne forelesningen og alle tilhørende tilbakemeldinger?"))
      return;
    try {
      const res = await fetch(`/api/lectures/${lectureId}`, { method: "DELETE" });
      if (res.ok) onRefresh();
      else alert("Kunne ikke slette forelesning");
    } catch (err) {
      console.error(err);
    }
  };

  // Sjekker at alle nødvendige felt er fylt ut for å kunne opprette en forelesning.
  const canSubmit = title.trim() && date && courseId;

  /*
  Bygger brukergrensesnittet for forelesningspanelet:
  - Har en knapp for å legge til ny forelesning (Når et emne er valgt).
  - Har et skjema for å opprette forelesning.
  - Lar brukeren skrive inn navn på forelesning.
  - Lar brukeren velge hvilket emne forelesningen skal tilhøre.
  - Lar brukeren velge dato for forelesningen.
  - Viser en sortert liste over forelesninger (kronologisk etter dato)
  - Lar brukeren slette forelesninger
*/
  return (
    <div className="admin-panel-inner">
      <div className="panel-top-actions">
        {selectedCourseId && !showAdd && (
          <button className="add-button" onClick={() => setShowAdd(true)}>
            + Legg til forelesning
          </button>
        )}

        {/* 
          Skjemaet for å legge til forelesning vises når 
          "legg til forelesning"-knappen er trykket på. 
        */}
        {showAdd && (
          <div className="add-lecture-form" ref={formRef}>
            <input
              placeholder="Navn på forelesning"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Velg emne</option>
              {courses.map((course) => (
                <option key={course.EmneID} value={course.EmneID}>
                  {course.EmneKode} – {course.Navn}
                </option>
              ))}
            </select>

            <label className="form-field-label">Dato</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <div className="button-row">
              <button
                className="add-form-button"
                onClick={handleAdd}
                disabled={!canSubmit}
              >
                Legg til
              </button>
              <button className="cancel-form-button" onClick={() => setShowAdd(false)}>
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>

        {/* 
          Liste over forelesninger, sortert kronologisk etter dato,
          med mulighet for å slette disse.
        */}
      <div className="item-list">
        {!selectedCourseId ? (
          <p className="empty-msg">Velg et emne for å se forelesninger</p>
        ) : lectures.length === 0 ? (
          <p className="empty-msg">Ingen forelesninger funnet</p>
        ) : (
          [...lectures]
            .sort((a, b) => new Date(a.F_Dato) - new Date(b.F_Dato))
            .map((lec) => (
              <div key={lec.F_ID} className="list-row">
                <span className="row-label">
                  {lec.Tema}
                  <span className="row-date">
                    {new Date(lec.F_Dato).toLocaleDateString("nb-NO")}
                  </span>
                </span>
                <button
                  className="delete-row-btn"
                  onClick={(e) => handleDelete(lec.F_ID, e)}
                  title="Slett"
                >
                  🗑
                </button>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
