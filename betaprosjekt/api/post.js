/**
 * POST-RUTER OG DATAHÅNDTERING (post.js)
 *
 * Denne filen inneholder alle ruter som tar imot data (POST).
 * Den håndterer tre hovedområder:
 * 1. LTI 1.3 Autentisering mot Canvas (OIDC Login og Launch).
 * 2. Innsending av spørreundersøkelser med anonymisering.
 * 3. Administrasjon av database-entiteter som forelesninger, emner og semestre.
 */
import express from "express";
import { poolPromise } from "./db.js";
import sql from "mssql";
import "dotenv/config";
import crypto from "crypto";
import * as jose from "jose";

/**
 * Funksjon for å hashe Canvas-bruker-ID-er slik at studenter forblir
 * anonyme i databasen, men likevel kan gjenkjennes for å unngå duplikate svar.
 */
const hashUserId = (userId) => {
  if (!process.env.ANONYMIZATION) {
    throw new Error("Missing ANONYMIZATION");
  }

  return crypto
    .createHmac("sha256", process.env.ANONYMIZATION)
    .update(String(userId))
    .digest("hex");
};

const router = express.Router();
const canvasAuthUrl = "https://sso.canvaslms.com/api/lti/authorize_redirect";

/**
 * LTI 1.3 FLOW login og launch
 * Håndterer den sikre "håndhilsingen" mellom Canvas og denne serveren.
 * Inkluderer validering av ID-tokens, sjekk av 'state' for å hindre CSRF-angrep,
 * og uthenting av roller/kursinformasjon fra Canvas-payloaden.
 */
router.post("/api/lti/login", async (req, res) => {
  const { login_hint, lti_message_hint } = req.body;

  const state = crypto.randomBytes(16).toString("hex");
  const nonce = crypto.randomBytes(16).toString("hex");

  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 600000, // 10 mins
  };
  res.cookie("lti_state", state, cookieOptions);
  res.cookie("lti_nonce", nonce, cookieOptions);

  const redirectUri = "https://bachelor-6xir.onrender.com/api/lti/launch";

  const searchParams = new URLSearchParams({
    scope: "openid",
    response_type: "id_token",
    client_id: process.env.LTI_CLIENT_ID,
    redirect_uri: redirectUri,
    login_hint,
    lti_message_hint,
    state,
    nonce,
    prompt: "none",
    response_mode: "form_post",
  });

  res.redirect(`${canvasAuthUrl}?${searchParams.toString()}`);
});

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

function setLtiAppCookies(res, { name, role, semester, courseCode, anonId }) {
  res.cookie("user_name", name, appCookieOptions);
  res.cookie("user_role", role, appCookieOptions);
  res.cookie("semester", semester, appCookieOptions);
  res.cookie("course_code", courseCode, appCookieOptions);
  res.cookie("anon_id", anonId, secureAppCookieOptions);
}

const JWKS = jose.createRemoteJWKSet(
  new URL("https://usn.instructure.com/api/lti/security/jwks"),
);

router.post("/api/lti/launch", async (req, res) => {
  if (req.body.error) {
    console.error("Canvas LTI Error:", req.body.error_description);
    return res
      .status(400)
      .send(`LTI Error from Canvas: ${req.body.error_description}`);
  }

  const { id_token, state } = req.body;
  const { lti_state } = req.cookies;

  if (!id_token) {
    return res.status(400).send("Missing id_token.");
  }

  if (!state || state !== lti_state) {
    return res.status(403).send("Security Error: State mismatch.");
  }

  try {
    const { payload } = await jose.jwtVerify(id_token, JWKS, {
      issuer: "https://canvas.instructure.com",
      audience: process.env.LTI_CLIENT_ID,
      clockTolerance: "60s",
    });

    const iatDate = new Date(payload.iat * 1000);
    const year = iatDate.getFullYear();
    const month = iatDate.getMonth() + 1;

    let semester;
    if (month >= 1 && month <= 6) {
      semester = "Vår";
    } else {
      semester = "Høst";
    }

    const semesterLabel = `${semester} ${year}`;

    console.log("Semester:", semester);

    const context =
      payload["https://purl.imsglobal.org/spec/lti/claim/context"];
    const courseCode = context?.label || context?.title || null;

    console.log("Canvas course:", courseCode);

    const roles =
      payload["https://purl.imsglobal.org/spec/lti/claim/roles"] ?? [];

    const isInstructor = roles.some((r) => r.includes("membership#Instructor"));
    const userRole = isInstructor ? "instructor" : "student";

    res.clearCookie("lti_state", { sameSite: "none", secure: true });
    res.clearCookie("lti_nonce", { sameSite: "none", secure: true });

    const anonymousId = hashUserId(payload.sub);

    if (!isInstructor) {
      const pool = await poolPromise;

      await pool
        .request()
        .input("s_id", sql.VarChar(64), anonymousId)
        .input("studieKull", sql.VarChar, semesterLabel).query(`
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

    setLtiAppCookies(res, {
      name: payload.name || "User",
      role: userRole,
      semester: semesterLabel,
      courseCode,
      anonId: anonymousId,
    });

    res.redirect(isInstructor ? "/teacher" : "/survey");
  } catch (err) {
    console.error("LTI Auth Error Code:", err.code);
    console.error("LTI Auth Error Message:", err.message);

    let userMessage = "Uautorisert: Tokenvalidering mislyktes.";

    if (err.code === "ERR_JWT_EXPIRED") {
      userMessage = "Økten er utløpt. Start på nytt fra Canvas.";
    }

    res.status(401).send(userMessage);
  }
});

/**
 * Logikken til spørreundersøkelse (survey)
 * Håndterer innsending av svar fra studenter.
 * Bruker en database-transaksjon for å sikre at både 'Tilbakemeldinger'
 * og de tilhørende svarene i 'Svar'-tabellen lagres korrekt, eller ingen av dem.
 */
router.post("/api/survey", async (req, res) => {
  const { question1, question2, text, f_id } = req.body;
  const anonId = req.cookies.anon_id;

  if (!anonId) {
    return res.status(401).send("Mangler anonym bruker-ID");
  }

  try {
    const pool = await poolPromise;

    const check = await pool
      .request()
      .input("f_id", sql.Int, f_id)
      .input("anon_id", sql.VarChar, anonId)
      .query(
        "SELECT 1 FROM Tilbakemeldinger WHERE F_ID = @f_id AND S_ID = @anon_id",
      );

    if (check.recordset.length > 0) {
      return res
        .status(403)
        .send("Du har allerede svart på denne forelesningen.");
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const tmResult = await new sql.Request(transaction)
        .input("f_id", sql.Int, f_id)
        .input("s_id", sql.VarChar, anonId)
        .query(`INSERT INTO Tilbakemeldinger (TM_Dato, F_ID, S_ID) 
                        OUTPUT INSERTED.TM_ID VALUES (GETDATE(), @f_id, @s_id)`);

      const tmId = tmResult.recordset[0].TM_ID;

      await new sql.Request(transaction)
        .input("tmId", sql.Int, tmId)
        .input("ans1", sql.VarChar, question1)
        .input("ans2", sql.VarChar, question2)
        .input("ans3", sql.VarChar, text)
        .query(`INSERT INTO Svar (Sp_ID, SvarTekst, TM_ID) VALUES 
                        (1, @ans1, @tmId), (2, @ans2, @tmId), (3, @ans3, @tmId)`);

      await transaction.commit();
      res.status(201).json({ message: "Svar lagret" });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/**
 * Administrative ruter - lectures, semester, emner
 * Ruter som brukes av lærere/administratorer for å bygge opp
 * datagrunnlaget i applikasjonen. Inkluderer logikk for å koble
 * emner til riktig semester.
 */
router.post("/api/lectures", async (req, res) => {
  const { tema, dato, emneId } = req.body;

  if (!tema || !dato || !emneId) {
    return res
      .status(400)
      .send("Mangler nødvendige felt (tema, dato, eller emneId)");
  }

  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("tema", sql.VarChar, tema)
      .input("dato", sql.DateTime, new Date(dato))
      .input("emneId", sql.Int, emneId).query(`
                INSERT INTO Forelesninger (Tema, F_Dato, EmneID, Sem_ID)
                OUTPUT INSERTED.F_ID
                SELECT @tema, @dato, @emneId, Sem_ID
                FROM Semester_has_Emne
                WHERE EmneID = @emneId
            `);

    if (result.recordset && result.recordset.length > 0) {
      console.log("Forelesningen er opprettet");
      res.status(201).json({
        success: true,
        F_ID: result.recordset[0].F_ID,
      });
    } else {
      res
        .status(400)
        .send(
          "Fant ikke kobling mellom EmneID og Semester i Semester_has_Emne.",
        );
    }
  } catch (err) {
    console.error("Database Error Detail:", err.message);
    res.status(500).send("Kunne ikke lagre forelesning.");
  }
});

router.post("/api/semesters", async (req, res) => {
  const { termin, ar } = req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("termin", sql.VarChar, termin)
      .input("ar", sql.Int, ar)
      .query("INSERT INTO Semester (Termin, Ar) VALUES (@termin, @ar)");
    res.status(201).send("Semester opprettet");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.post("/api/courses", async (req, res) => {
  const { emneKode, navn, Sem_ID } = req.body;
  if (!emneKode || !navn) return res.status(400).send("Mangler felt");

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const result = await new sql.Request(transaction)
        .input("kode", sql.VarChar, emneKode)
        .input("navn", sql.VarChar, navn).query(`
                    INSERT INTO Emne (EmneKode, Navn)
                    OUTPUT INSERTED.EmneID
                    VALUES (@kode, @navn)
                `);

      const newEmneId = result.recordset[0].EmneID;

      if (Sem_ID) {
        await new sql.Request(transaction)
          .input("semId", sql.Int, Sem_ID)
          .input("emneId", sql.Int, newEmneId).query(`
                        INSERT INTO Semester_has_Emne (Sem_ID, EmneID)
                        VALUES (@semId, @emneId)
                    `);
      }

      await transaction.commit();
      res.status(201).json({
        message: "Emne opprettet og koblet til semester",
        EmneID: newEmneId,
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

export default router;
