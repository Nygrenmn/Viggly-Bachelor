// Her ligger DELETE-rutene samlet der sletting må tilpasses på grunn av fremmednøkler.
// Det er en rekkefølge for sletting som må følges og er: svar sletttes før tilbakemeldinger,
// og tilbakemeldinger slettes før forelesninger eller emner kan slettes.

import express from "express";
import { poolPromise } from "./db.js";
import sql from "mssql";
import "dotenv/config";

const router = express.Router();

// Svar sendt inn slettes for en forelesning.
// Planen er å slette alle svar for å nullstille resultatene om ønskelig,
// men forstattt beholde forelesninger for å slippe å opprette dem på nytt.
router.delete("/api/results", async (req, res) => {
  const lectureId = req.query.f_id;
  if (!lectureId) return res.status(400).send("Mangler f_id");

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await new sql.Request(transaction).input("fId", sql.Int, lectureId)
        .query(`
                    DELETE s FROM Svar s
                    JOIN Tilbakemeldinger t ON s.TM_ID = t.TM_ID
                    WHERE t.F_ID = @fId
                `);

      await new sql.Request(transaction)
        .input("fId", sql.Int, lectureId)
        .query(`DELETE FROM Tilbakemeldinger WHERE F_ID = @fId`);

      await transaction.commit();
      res.json({ message: "Tilbakemeldinger slettet" });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// For å sørge for at rader ikke blir liggende igjen, så slettes forlesninger
// sammen med tilhørende tilbakemeldinger og svar.
router.delete("/api/lectures/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await new sql.Request(transaction).input("id", sql.Int, id).query(`
                    DELETE s FROM Svar s
                    JOIN Tilbakemeldinger t ON s.TM_ID = t.TM_ID
                    WHERE t.F_ID = @id
                `);

      await new sql.Request(transaction)
        .input("id", sql.Int, id)
        .query(`DELETE FROM Tilbakemeldinger WHERE F_ID = @id`);

      await new sql.Request(transaction)
        .input("id", sql.Int, id)
        .query(`DELETE FROM Forelesninger WHERE F_ID = @id`);

      await transaction.commit();
      res.json({ message: "Forelesning slettet" });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Emnesletting er litt mer komplisert for å sørge for det ikke ender med delvis sletting av data.
// Det er på grunn av at datamodellen er bygd opp slik at emner "eier" forelesninger.
router.delete("/api/courses/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await new sql.Request(transaction).input("emneId", sql.Int, id).query(`
                    DELETE Svar 
                    FROM Svar 
                    INNER JOIN Tilbakemeldinger ON Svar.TM_ID = Tilbakemeldinger.TM_ID
                    INNER JOIN Forelesninger ON Tilbakemeldinger.F_ID = Forelesninger.F_ID
                    WHERE Forelesninger.EmneID = @emneId
                `);

      await new sql.Request(transaction).input("emneId", sql.Int, id).query(`
                    DELETE Tilbakemeldinger 
                    FROM Tilbakemeldinger 
                    INNER JOIN Forelesninger ON Tilbakemeldinger.F_ID = Forelesninger.F_ID
                    WHERE Forelesninger.EmneID = @emneId
                `);

      await new sql.Request(transaction)
        .input("emneId", sql.Int, id)
        .query(`DELETE FROM Forelesninger WHERE EmneID = @emneId`);

      await new sql.Request(transaction)
        .input("emneId", sql.Int, id)
        .query(`DELETE FROM Semester_has_Emne WHERE EmneID = @emneId`);

      await new sql.Request(transaction)
        .input("emneId", sql.Int, id)
        .query(`DELETE FROM Emne WHERE EmneID = @emneId`);

      await transaction.commit();
      res.json({
        message: "Emne og alt tilhørende innhold slettet suksessfullt",
      });
    } catch (err) {
      await transaction.rollback();
      console.error("Transaksjonsfeil:", err);
      throw err;
    }
  } catch (err) {
    console.error("Serverfeil ved sletting:", err);
    res.status(500).send("Kunne ikke slette emne: " + err.message);
  }
});

// Sletting av semester er strengere og tillater ikke sletting dersom det har
// emner den er nyttet til. Det er for å unngå, som nevnt tidligere, at rader blir værende igjen
// uten noe tilknytning.
router.delete("/api/semesters/:id", async (req, res) => {
  try {
    const pool = await poolPromise;

    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("DELETE FROM Semester WHERE Sem_ID = @id");

    res.send("Semester slettet");
  } catch {
    res
      .status(500)
      .send(
        "Kan ikke slette: Semesteret har tilknyttede emner. Slett koblingene først.",
      );
  }
});

export default router;
