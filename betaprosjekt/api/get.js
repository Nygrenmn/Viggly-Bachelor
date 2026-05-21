/**
 * GET-RUTER OG DATAHENTING (get.js)
 *
 * Denne filen håndterer alle forespørsler om uthenting av data.
 * Den er delt inn i fire hovedområder:
 * 1. Autentisering og Cookies: Verktøy for å sette sesjonsinformasjon.
 * 2. API-endepunkter: Henting av semestre, emner, forelesninger og resultater.
 * 3. LTI & Sikkerhet: Eksponering av offentlige nøkler (JWKS) for Canvas-integrasjon.
 * 4. Utviklingsverktøy: "Dev-login" ruter for lokal testing utenfor Canvas.
 */
import express from "express";
import { poolPromise } from "./db.js";
import sql from "mssql";
import "dotenv/config";
import { createPublicKey } from "crypto";

/**
 * Hjelpefunksjoner for å administrere brukersesjoner via cookies.
 * Skiller mellom produksjon (sikre cookies) og lokal utvikling.
 */
const isProduction = process.env.NODE_ENV === "production";

const appCookieOptions = {
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  maxAge: 3600000,
};

const secureAppCookieOptions = {
  ...appCookieOptions,
  httpOnly: true,
};

function setLtiAppCookies(
  res,
  { name, role, semester = "V\u00e5r 2026", courseCode = "DAT100", anonId },
) {
  res.cookie("user_name", name || "User", appCookieOptions);
  res.cookie("semester", semester, appCookieOptions);
  res.cookie("user_role", role, appCookieOptions);
  res.cookie("course_code", courseCode || "DAT100", appCookieOptions);

  if (anonId) {
    res.cookie("anon_id", anonId, secureAppCookieOptions);
  } else {
    res.clearCookie("anon_id", secureAppCookieOptions);
  }
}

function getDevLoginValue(req, key, fallback) {
  const value = req.query[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function ensureDevStudentExists(anonId, studieKull) {
  const pool = await poolPromise;

  await pool
    .request()
    .input("s_id", sql.VarChar(64), anonId)
    .input("studieKull", sql.VarChar, studieKull).query(`
      IF NOT EXISTS (
        SELECT 1
        FROM Student
        WHERE S_ID = @s_id
      )
      BEGIN
        INSERT INTO Student (S_ID, StudieKull)
        VALUES (@s_id, @studieKull)
      END
    `);
}

const router = express.Router();

/**
 * Api endepunkter for datahenting
 * Disse rutene brukes av frontend for å fylle nedtrekkslister og vise resultater.
 * Inkluderer kompleks filtrering på semester, emne og forelesning.
 */
router.get("/api/semesters", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            SELECT Sem_ID, Ar, Termin FROM Semester
            ORDER BY Ar DESC, CASE WHEN Termin = 'Høst' THEN 1 ELSE 2 END
        `);
    res.json(result.recordset);
  } catch (err) {
    console.error("SQL FEIL i /api/semesters:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/courses", async (req, res) => {
  try {
    const pool = await poolPromise;
    const Sem_ID = req.query.Sem_ID;

    let query = `SELECT EmneID, EmneKode, Navn FROM Emne`;
    const request = pool.request();

    if (Sem_ID && Sem_ID !== "0") {
      query = `
                SELECT e.EmneID, e.EmneKode, e.Navn 
                FROM Emne e
                JOIN Semester_has_Emne she ON e.EmneID = she.EmneID
                WHERE she.Sem_ID = @semId
            `;
      request.input("semId", sql.Int, Sem_ID);
    }

    const result = await request.query(query + " ORDER BY Navn");
    res.json(result.recordset);
  } catch (err) {
    console.error("SQL FEIL i /api/courses:", err.message);
    res.status(500).send(err.message);
  }
});

router.get("/api/survey/answered", async (req, res) => {
  const anonId = req.cookies.anon_id;

  if (!anonId) {
    return res.status(401).json({ message: "Mangler anonym bruker-ID" });
  }

  try {
    const pool = await poolPromise;

    const result = await pool.request().input("anon_id", sql.VarChar, anonId)
      .query(`
        SELECT DISTINCT F_ID
        FROM Tilbakemeldinger
        WHERE S_ID = @anon_id
      `);

    const answeredLectureIds = result.recordset.map((row) => row.F_ID);

    res.json(answeredLectureIds);
  } catch (err) {
    console.error("Feil i /api/survey/answered:", err);
    res
      .status(500)
      .json({ message: "Kunne ikke hente besvarte forelesninger" });
  }
});

router.get("/api/results", async (req, res) => {
  try {
    const pool = await poolPromise;
    const { f_id, emne_id, Sem_ID } = req.query;

    let query = `
            SELECT 
                t.TM_ID, 
                t.TM_Dato, 
                t.F_ID,
                f.Tema,
                (SELECT SvarTekst FROM Svar WHERE TM_ID = t.TM_ID AND Sp_ID = 1) as question1,
                (SELECT SvarTekst FROM Svar WHERE TM_ID = t.TM_ID AND Sp_ID = 2) as question2,
                (SELECT SvarTekst FROM Svar WHERE TM_ID = t.TM_ID AND Sp_ID = 3) as text
            FROM Tilbakemeldinger t
            INNER JOIN Forelesninger f ON t.F_ID = f.F_ID
            -- Vi må koble oss på Emne for å vite hvilket emne forelesningen hører til
            INNER JOIN Emne e ON f.EmneID = e.EmneID 
            -- VIKTIG: Vi må koble oss på Semester_has_Emne for å vite hvilket semester emnet hører til
            LEFT JOIN Semester_has_Emne she ON e.EmneID = she.EmneID
        `;

    const request = pool.request();
    let whereClauses = [];

    if (f_id) {
      whereClauses.push("t.F_ID = @f_id");
      request.input("f_id", sql.Int, f_id);
    }

    if (emne_id) {
      whereClauses.push("f.EmneID = @emne_id");
      request.input("emne_id", sql.Int, emne_id);
    }

    if (Sem_ID) {
      whereClauses.push("she.Sem_ID = @sem_id");
      request.input("sem_id", sql.Int, Sem_ID);
    }

    if (whereClauses.length > 0) {
      query += " WHERE " + whereClauses.join(" AND ");
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error("Feil i /api/results:", err);
    res.status(500).send(err.message);
  }
});

router.get("/api/lectures", async (req, res) => {
  try {
    const pool = await poolPromise;
    const emneId = req.query.emne_id;
    const Sem_ID = req.query.Sem_ID;
    let query = `SELECT
                        f.F_ID,
                        f.Tema,
                        f.F_Dato,
                        f.EmneID,
                        f.Sem_ID,
                        e.EmneKode,
                        e.Navn AS EmneNavn,
                        s.Termin,
                        s.Ar
                    FROM Forelesninger f
                    INNER JOIN Emne e ON f.EmneID = e.EmneID
                    INNER JOIN Semester s ON f.Sem_ID = s.Sem_ID
            `;
    const request = pool.request();
    const conditions = [];

    if (emneId) {
      conditions.push(`f.EmneID = @emneId`);
      request.input("emneId", sql.Int, emneId);
    }
    if (Sem_ID) {
      conditions.push(`f.Sem_ID = @Sem_ID`);
      request.input("Sem_ID", sql.Int, Sem_ID);
    }
    if (conditions.length) {
      query += ` WHERE ` + conditions.join(" AND ");
    }
    query += ` ORDER BY f.F_Dato DESC`;
    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/**
 * LTI sikkerhet (JWKS)
 * Genererer og eksponerer et "JSON Web Key Set".
 * Canvas bruker dette endepunktet for å hente vår offentlige nøkkel slik at
 * den kan verifisere meldinger sendt fra denne serveren.
 */
router.get("/api/lti/jwks", async (req, res) => {
  try {
    const keyPem = process.env.LTI_PUBLIC_KEY;

    if (!keyPem) {
      throw new Error("Missing LTI_PUBLIC_KEY env variable");
    }

    const normalizedKey = keyPem.replace(/\\n/g, "\n");

    const publicKey = createPublicKey({
      key: normalizedKey,
      format: "pem",
      type: "spki",
    });

    const jwk = publicKey.export({ format: "jwk" });

    const jwks = {
      keys: [
        {
          ...jwk,
          use: "sig",
          alg: "RS256",
          kid: "lti-public-key",
        },
      ],
    };

    res.setHeader("Content-Type", "application/json");
    res.status(200).json(jwks);
  } catch (err) {
    console.error("JWKS error:", err);
    res.status(500).json({
      error: "Could not generate JWKS",
    });
  }
});

/**
 * Utviklingsverktøy (dev-login)
 * Disse rutene simulerer en Canvas-innlogging og er kun tilgjengelige i utviklingsmiljøet.
 * Gjør det mulig å teste appen som lærer eller student uten å gå via Canvas.
 */
router.get("/api/dev-login/student", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send("Not found");
  }

  const anonId = getDevLoginValue(req, "anonId", "local-dev-student");
  const semester = getDevLoginValue(req, "semester", "V\u00e5r 2026");
  const courseCode = getDevLoginValue(
    req,
    "courseCode",
    process.env.DEV_COURSE_CODE || "TESAPP-2050 26V Testemne 2",
  );

  try {
    await ensureDevStudentExists(anonId, semester);

    setLtiAppCookies(res, {
      name: getDevLoginValue(req, "name", "Local Student"),
      role: "student",
      semester,
      courseCode,
      anonId,
    });

    res.redirect("/survey");
  } catch (err) {
    console.error("Dev student login failed:", err);
    res.status(500).send("Could not create local dev student: " + err.message);
  }
});

router.get("/api/dev-login/instructor", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send("Not found");
  }

  setLtiAppCookies(res, {
    name: getDevLoginValue(req, "name", "Local Instructor"),
    role: "instructor",
    semester: getDevLoginValue(req, "semester", "V\u00e5r 2026"),
    courseCode: getDevLoginValue(
      req,
      "courseCode",
      process.env.DEV_COURSE_CODE || "TESAPP-2050 26V Testemne 2",
    ),
  });

  res.redirect("/teacher");
});

export default router;
