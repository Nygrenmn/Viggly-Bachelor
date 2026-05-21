
/*
  SURVEY.JSX HÅNDTERER FRONTEND FOR STUDENTENES TILBAKEMELDINGSSKJEMA

  Denne filen inneholder hele logikken og grensesnittet spørreskjemaet der 
  studenter kan gi tilbakemelding på sine forelesninger. Noen av survey.jsx
  sine hovedfunksjoner inkluderer:
  - Å hente tilgjengelige forelesninger fra backend, basert på emnekode og semester.
  - Filtrere ut forelesninger studenten allerede har svart på, eller som er for gamle.
  - Sortere forelesninger etter dato basert på nyeste tillagte først.
  - Automatisk forhåndsvelge den aktuelle forelesningen hvis mulig.
  - La studenten velge forelesning via en dropdown-meny.
  - Gjøre det mulig for studenten å vurdere forelesningen (skala fra 1-5).
  - La studenten sende inn en fritekstkommentar.
  - Sende svar anonymt til databasen, for å bli presentert for foreleser.
  - Hindre at studenten kan besvare samme forelesning to ganger.
*/

/*
  Importerer nødvendige funksjoner som brukes i komponenten, samt logo og CSS.
*/
import { useEffect, useState } from "react";
import logo from "../assets/logo.png";
import "../css/Survey.css";

/*
  Lagrer de fem svaralternativene for vurderingsskalaen i en const. 
  Tallet blir sendt til backend for å regne ut vurderinger
  samtidig som teksten er det studenten ser i grensesnittet.
*/
const labels = {
  1: "Svært vanskelig",
  2: "Vanskelig",
  3: "Nøytral",
  4: "Lett",
  5: "Svært lett",
};

/*
  GetCookie er en hjelpefunksjon for å hente riktig verdi for emnekode og semester.
  - Leser alle cookies i nettleseren
  - Finner cookie med riktig navn
  - Henter verdien
  - Returnerer verdien som tekst
  - Hvis den ikke finnes, returnerer den tom streng

  Brukes i denne applikasjonen for å hente:
  - course_code (emnekode)
  - semester (aktivt semester)
*/
const getCookie = (name) =>
  decodeURIComponent(
    document.cookie
      .split("; ")
      .find((row) => row.startsWith(name + "="))
      ?.split("=")[1] || "",
  );

/*
  isFutureLecture er en hjelpefunksjon som sjekker dato for forelesningen.
  - Tar inn en forelesning (lecture).
  - Leser datoen (F_Dato).
  - Sammenligner med dagens dato.
  - Returnerer true hvis forelesningen er i fremtiden.
  - Returnerer false hvis den er i dag eller har vært.
  Poenget er å ikke vise forelesninger som ikke har skjedd 
  ennå i listen over tilgjengelige forelesninger i spørreskjemaet.
*/
const isFutureLecture = (lecture) =>
  new Date(lecture.F_Dato) > new Date();

/*
  IsTooOldLecture sjekker også dato for forelesningen.
  Denne sjekker derimot om forelesningen er for gammel, 
  nærmere bestemt eldre enn 7 dager.
  Dersom dette er tilfellet returneres true og forelesningen vises
  i dropdown, men vil være utilgjengelig for besvarelse i spørreskjemaet.
  Dette for å unngå at studenter besvarer forelesninger som er for gamle, og dermed
  ikke relevante for foreleseren å få tilbakemelding på lenger. 
*/
const isTooOldLecture = (lecture) =>
  (Date.now() - new Date(lecture.F_Dato).getTime()) /
    (1000 * 60 * 60 * 24) >
  7;

/*
  SortLectures sorterer forelesningene i dropdown utifra dato og 
  besvarelsesstatus, sjekket av funksjonene ovenfor.
  Den tar inn to parametere: listen av forelesninger, 
  og en liste av IDer for forelesninger som er besvart.
  Nyeste forelesninger vises først (basert på dato)
  Dersom to forelesninger har samme dato, vises ubesvart først, og besvart under.
*/
const sortLectures = (lectures, answeredIds) =>
  [...lectures].sort((a, b) => {
    const dateDiff =
      new Date(b.F_Dato) - new Date(a.F_Dato);

    if (dateDiff !== 0) return dateDiff;

    const aAnswered = answeredIds.includes(Number(a.F_ID));
    const bAnswered = answeredIds.includes(Number(b.F_ID));

    return aAnswered === bAnswered ? 0 : aAnswered ? 1 : -1;
  });

/*
  Nedenfor ligger koden for selve Survey-komponenten hvor all logikk og UI 
  for spørreskjemaet håndteres.
  Hovedoppgavene til denne komponenten er nevnt i kommentaren øverst i denne filen, 
  og nedenfor vil det bli forklart nærmere hvordan ulik logikk blir håndtert.
*/
function Survey({ onSubmit }) {

  /*
    State-variabler for spørreskjemaet.
    Her lagres, svar på de to skalaspørsmålene, tesktsvar og valgt forelesning. 
  */
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [selectedLecture, setSelectedLecture] = useState("");

  /*
    State-variabler for håndtering av forelesninger og dropdown-menyen.
    Her lagres informasjo om forelesningslisten, hvilke forelesninger studenten 
    allerede har svart på, og om dropdown-menyen for valg av forelesning 
    er åpen eller lukket.
  */
  const [lectures, setLectures] = useState([]);
  const [answeredLectureIds, setAnsweredLectureIds] = useState([]);
  const [isLectureDropdownOpen, setIsLectureDropdownOpen] = useState(false);

  /*
    State-variabler hvor informasjon fra nettleseren lagres vha cookies.
    Her lagres emnekode og semester, som er nødvendig for å hente riktige forelesninger
    fra backend, og for å vise riktig informasjon i grensesnittet.
    isLocked sjekker om en forelesning er valgt eller ikke.
  */
  const courseCode = getCookie("course_code");
  const semester = getCookie("semester");
  const isLocked = !selectedLecture;

  /*
    Tittelen på spørreskjemaet settes til emnekode og semester hentet 
    fra cookies, hvis disse er tilgjengelig. 
    Som default settes tittelen til "Spørreskjema" hvis ingen av disse er tilgjengelig.  
  */
  const surveyTitle = [courseCode?.split(" ")[0], semester]
    .filter(Boolean)
    .join("\n");

  /*
    UseEffect'en nedenfor henter data som trengs til spørreskjemaet 
    når komponenten lastes inn.
    Her hentes alle forelesninger fra backend, og hvilke forelesninger studenten 
    allerede har svart på.
    Dataene er nødvendig for å vise riktig informasjon i dropdown-menyen 
    for valg av forelesning.
  */
  useEffect(() => {
    const fetchLectures = async () => {
      try {
        const [lecturesRes, answeredRes] = await Promise.all([
          fetch("/api/lectures", { credentials: "include" }),
          fetch("/api/survey/answered", {
            credentials: "include",
          }),
        ]);

        /* Konverterer dataene hentet fra API-et til JavaScript-data. */
        const lecturesData = await lecturesRes.json();
        const answeredIds = answeredRes.ok
          ? (await answeredRes.json()).map(Number)
          : [];

        /* Lagrer hvilke forelesninger brukeren allerede har svart på. */
        setAnsweredLectureIds(answeredIds);

        /*
          Gjør teksten fra semester og emnekode om til små bokstaver 
          for enklere sammenligning.
          Dette brukes for at filtrering skal fungere bedre.
        */
        const semLower = semester.toLowerCase();
        const courseLower = courseCode.toLowerCase();

        /*
          Filtrerer forelesninger som matcher valgt semester og emnekode.
          Går gjennom alle forelesninger og sjekker samsvarende emnekode 
          (lowecase og uten mellomrom).
        */
        const filtered = lecturesData
          .filter((l) => {
            const courseCode = (l.EmneKode || "")
              .toLowerCase()
              .trim();
        
        /* 
          Gjør semester/termin om til små bokstaver og fjerner mellomrom.
          Gjør dette for at filtrering skal fungere bedre.
        */
        const semester = (l.Termin || "")
          .toLowerCase()
          .trim();

        /*
          Henter årstallet fra forelesningen og gjør det om til tekst.
          Dette brukes for sammenligning i filtrering.
        */
        const year = l.Ar?.toString() || "";
        
        /*
          Sjekker om forelesningen matcher valgt semester og emne
          Alle tre krav må være oppfylt:
            - semester inneholder årstall
            - semester inneholder et semester (vår/høst)
            - emnekoden matcher valgt kurs
        */
        return (
          semLower.includes(year) &&
          semLower.includes(semester) &&
          courseLower.includes(courseCode)
        );
      })

      // Fjerner forelesninger som ligger i fremtiden
      .filter((lecture) => !isFutureLecture(lecture));

      /*
        Sorterer filtrerte forelesninger basert på dato og om de er besvart.
        Lagrer resultatet i state slik at UI oppdateres.
        setLectures oppdaterer state med den sorterte listen over forelesninger
      */
      const sorted = sortLectures(filtered, answeredIds);
      setLectures(sorted);

      /*
        Koden nedenfor vil automatisk velge nyeste forelesning for studenten, om mulig.
        Den går gjennom listen med sorterte forelesninger og finner den første som:
        - Ikke allerede er besvart av studenten
        - Ikke er eldre enn 7 dager (ikke utgått)
        Hvis en slik forelesning finnes, blir den satt som valgt i dropdownen,
        slik at brukeren slipper å velge manuelt hver gang.
      */
      const autoSelected = sorted.find((l) => {
        const isAnswered = answeredIds.includes(Number(l.F_ID));
        const isExpired = isTooOldLecture(l);
        return !isAnswered && !isExpired;
      });

      if (autoSelected) {
        setSelectedLecture(String(autoSelected.F_ID));
      }
    } catch (err) {
      console.error(
        "Kunne ikke hente forelesninger:",
        err,
      );
    }
  };

    /*
      Koden nedenfor bestemmer når useEffect skal kjøres på nytt.
      I dette tilfellet vil fetchLectures kjøres hver gang:
      - CourseCode endres
      - Semester endres
      Dette gjør at data alltid oppdateres når applikasjonen henter nytt emne/semester.
    */
    fetchLectures();
  }, [courseCode, semester]);

  /*
    ResetSurvey tilbakestiller hele spørreskjemaet.
    Tømmer alle svarfelt (skala 1, skala 2 og tekstfelt),
    fjerner valgt forelesning,
    og lukker dropdown-menyen.
    Funksjonen tas i bruk etter innsending eller når skjemaet skal nullstilles.
  */
  const resetSurvey = () => {
    setAnswer1("");
    setAnswer2("");
    setTextAnswer("");
    setSelectedLecture("");
    setIsLectureDropdownOpen(false);
  };

  // Funksjon som lar brukeren velge eller fjerne et svar i en skala.
  const toggleAnswer = (value, setter, current) =>
    setter(current === value ? "" : value);

  /*
    HandleSubmit kjøres når studenten trykker på "Send inn svar".
    Dersom operasjonen lykkes, sendes svarene fra skjemaet  til backend, 
    sammen med cookie-info, og skjemaet tilbakestilles.
    Dersom det skulle oppstå en feil, vil disse logges i konsollen, 
    og studenten vil få en feilmelding.
  */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = {
      question1: answer1,
      question2: answer2,
      text: textAnswer,
      f_id: Number(selectedLecture),
    };

    try {
      const response = await fetch("/api/survey", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (response.ok) {
        alert("Tilbakemeldingen er sendt.");

        const updatedAnsweredIds = [
          ...answeredLectureIds,
          Number(selectedLecture),
        ];

        setAnsweredLectureIds(updatedAnsweredIds);

        setLectures((prev) =>
          sortLectures(prev, updatedAnsweredIds),
        );

        resetSurvey();
      } else if (response.status === 403) {
        alert(
          "Du har allerede svart på denne forelesningen.",
        );
      } else {
        alert("Noe gikk galt ved sending.");
      }
    } catch {
      alert("Kunne ikke kontakte server");
    }

    onSubmit?.(data);
  };

  /*
    IsInvalid sjekker om skjemaet er klart til å sendes.
    Den brukes for å deaktivere "Send inn"-knappen
    slik at brukeren ikke kan sende et ufullstendig skjema.
  */
  const isInvalid =
    !answer1 || !answer2 || !selectedLecture;

  /*
    selectedLectureData finner informasjon (navn og dato) om den valgte forelesningen.
    Dette brukes for å vise detaljer i dropdown-menyen
  */
  const selectedLectureData = lectures.find(
    (l) => String(l.F_ID) === selectedLecture,
  );

  /*
    Denne delen genererer toppdelen av brukergrensesnittet til spørreskjemaet.
    Her vises blant annet:
    - Topptekst med logo og tittel, hentet fra cookies og sjekket
      av funksjonene ovenfor.
    - Liste med filtrerte forelesninger i en dropdown-meny,
      som studenten kan velge fra.
    - Hvilken forelesning som er valgt (eller standardtekst "Velg forelesning".)
    Hver forelesning sjekkes for:
    - Om den allerede er besvart
    - Om den er eldre enn syv dager gammel
    Basert på dette vises det en status ved siden av forelesningen i dropdownen.
  */
  return (

  /* 
    Definisjon av skjema, funksjon for å sende inn svar, css-klasser, overskrift og logo. 
  */
  <form className="survey" onSubmit={handleSubmit}>
    <div className="survey-header">
      <img src={logo} alt="Logo" className="survey-logo" />
      <h2 className="survey-title">
        {surveyTitle || "Spørreskjema"}
      </h2>
    </div>

    {/*
      Dropdown-menyen for valg av forelesning.
      Viser valgt forelesning eller standardtekst.
    */}
    <div className="question">
      <label>Valgt forelesning</label>
      <div className="custom-select">
        <button
          type="button"
          className="custom-select-button"
          onClick={() =>
            setIsLectureDropdownOpen((prev) => !prev)
          }
        >
          <span>
            {selectedLectureData
              ? `${selectedLectureData.Tema} (${new Date(
                  selectedLectureData.F_Dato,
                ).toLocaleDateString()})`
              : "Velg forelesning"}
          </span>

          <span className="custom-select-arrow">
            {isLectureDropdownOpen ? "▲" : "▼"}
          </span>
        </button>

        {/*
          Viser innholdslisten og sjekker om brukeren
          allerede har besvart noen forelesninger.
        */}
        {isLectureDropdownOpen && (
          <div className="custom-select-menu">
            {lectures.map((lecture) => {
              const isAnswered =
                answeredLectureIds.includes(
                  Number(lecture.F_ID),
                );

              // Sjekker om forelesningen er eldre enn 7 dager.
              const isExpired =
                isTooOldLecture(lecture);

              // Setter statustekst basert på om forelesningen er besvart eller utgått.
              const statusText = isAnswered
                ? "Besvart"
                : isExpired
                  ? "Utgått"
                  : "";
              // Setter riktig css-klasse basert på om forelesningen er besvart eller utgått.
              const statusClass = isAnswered
                ? "answered"
                : "expired";

              {/* 
                Return'en nedenfor definerer hvilke forelesninger som skal 
                være klikkbare og hvilke som skal være utilgjengelige.
                Dersom en forelesning allerede er besvart eller gått ut på dato, 
                vil den være grået ut med en tilhørende melding.
                Hvis ikke vil knapp-funksjonen definert nedenfor være aktiv, 
                og studenten kan klikke på forelesningen for å velge den.
                Ved klikk lagres valgt forelesning, og menyen lukkes automatisk. 
              */}
              return (
                <button
                  key={lecture.F_ID}
                  type="button"
                  disabled={isAnswered || isExpired}
                  className={`custom-select-option ${
                    isAnswered || isExpired
                      ? "disabled"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedLecture(
                      String(lecture.F_ID),
                    );
                    setIsLectureDropdownOpen(false);
                  }}
                >
                  <span>
                    {lecture.Tema} (
                    {new Date(
                      lecture.F_Dato,
                    ).toLocaleDateString()}
                    )
                  </span>

                  {statusText && (
                    <span
                      className={`lecture-status ${statusClass}`}
                    >
                      {statusText}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {/*
      Koden nedenfor definerer andre del av spørreskjemaet
      som studenten fyller ut, med spørsmål og svaralternativer.
      Hele denne delen av skjemaet ligger inne i et <fieldset>
      som deaktiveres dersom ingen forelesning er valgt,
      noe som gjør at studenten ikke kan svare før de har valgt
      en forelesning.
      Skjemaet består av to obligatoriske skalaspørsmål
      og et fritekstfelt for kommentarer.
      Nederst ligger knappen som sender inn skjemaet.
      Denne er deaktivert frem til begge de obligatoriske
      spørsmålene er besvart.
    */}
    <fieldset disabled={!selectedLecture} className="survey-fieldset">
      {[answer1, answer2].map((answer, i) => (
        <div className="question" key={i}>
          <label>
            {i === 0
              ? "Hvor forståelig var innholdet i forelesningen?"
              : "Hvor lett var det å forstå formidlingen til foreleser?"}
            <span className="required">*</span>
          </label>

          {/* Skalaen for vurdering av forelesningen, med tilhørende tekst og status. */}
          <div className="scale">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n}
                className={`scale-option ${
                  answer === String(n)
                    ? "selected"
                    : ""
                } ${isLocked ? "disabled" : ""}`}
                onClick={() => {
                  if (isLocked) return;
                  toggleAnswer(
                    String(n),
                    i === 0
                      ? setAnswer1
                      : setAnswer2,
                    answer,
                  );
                }}
                title={
                  isLocked
                    ? "Velg en forelesning først"
                    : ""
                }
              >
                <span className="dot"></span>
                <span className="scale-text">
                  {labels[n]}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Spørsmål og tekstfelt for fritekstkommentarer. */}
      <div className="question">
        <label>
          Har du noen ekstra tilbakemeldinger
          eller kommentarer?
        </label>
        <textarea
          rows="7"
          value={textAnswer}
          onChange={(e) =>
            setTextAnswer(e.target.value)
          }
          className="survey-textarea"
        />
      </div>

      {/* Wrapper som aktiveres dersom obligatoriske spørsmål ikke er besvart. */}
      <span
        className="submit-wrapper"
        title={
          isInvalid
            ? "Obligatoriske* spørsmål er ikke besvart"
            : ""
        }
      >
        {/* Knappen er for å sende inn svaret. */}
        <button
          type="submit"
          disabled={isInvalid}
          className="survey-submit-button"
        >
          Send inn svar
        </button>
      </span>
    </fieldset>
  </form>
  );
}

export default Survey;