/**
 * HOVEDFIL FOR SERVER (index.js)
 * 
 * Denne filen initialiserer Express-serveren og setter opp nødvendig middleware.
 * Den fungerer som inngangspunktet for applikasjonen og håndterer ruting for
 * API-endepunkter (GET, POST, DELETE) samt servering av statiske filer fra frontend.
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import getRoutes from './get.js';
import postRoutes from './post.js';
import deleteRoutes from './delete.js';
import cookieParser from 'cookie-parser';

const app = express();

/**
 * Setter opp standard verktøy for parsing av cookies, JSON-data og 
 * URL-enkoding. Inkluderer også CORS-støtte for kryss-domene forespørsler.
 */
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

/**
 * Api ruting
 * Importerer og aktiverer ruter fra eksterne filer for å holde index.js ryddig.
 * Dette skiller logikken for henting, lagring og sletting av data.
 */
app.use(getRoutes);
app.use(postRoutes);
app.use(deleteRoutes);

/**
 * Server start
 * Definerer port fra miljøvariabler eller fallback til port 3000.
 */
const PORT = process.env.PORT || 3000; 
app.listen(PORT, () => {
    console.log(`Server kjører på port ${PORT}`);
});

/**
 * Konfigurerer serveren til å levere ferdigbygget frontend (dist-mappen).
 * Inneholder også en catch-all rute som sender alle ukjente forespørsler
 * tilbake til index.html for å støtte klientside-ruting.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, '..', 'dist');

app.use(express.static(distPath));

app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});
