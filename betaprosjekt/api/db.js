// Denne filen tar for seg databasetilkoblingene for både Docker og Azure, og sørger for at resten
// av API-et kan ta nytte av samme connection pool.
// Det er for å minske antall nye tilkoblinger.

import sql from "mssql";
import "dotenv/config";

// Vi følger gode standarder ved bruk av miljøvariabler for å holde sensitive data utenfor kildekoden.
// Innstilligene under er satt opp for Azure SQL server, samtidig som tidligere brukt lokal kjøring for Docker.
const config = {
  user: process.env.DB_USER_AZURE,
  password: process.env.DB_PASSWORD_AZURE,
  server: process.env.DB_SERVER_AZURE,
  database: process.env.DB_DATABASE_AZURE,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 30000,
    requestTimeout: 30000,
    tdsVersion: "7_4",
  },
  port: 1433,
};

// Her eksporteres poolen som følge av at tilkoblingen opprettes asynkront ved oppstart.
// Da kan de ulike Rutene vente på at tilkoblingen er klar, før de gjør spørringer til databasen.
export const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("Koblet til SQL Server (Azure)");
    return pool;
  })
  .catch((err) => {
    console.error("Database Connection Failed! Bad Config: ", err);
    throw err;
  });
