# Nuvio Plugin & Stremio Addon

Questo repository contiene una collezione di provider italiani per lo streaming di Film, Serie TV e Anime.
Il progetto è progettato per essere versatile e può essere utilizzato in due modi diversi:

1.  Come **Plugin per Nuvio**
2.  Come **Addon per Stremio**

## 📺 Provider Supportati

-   **AnimeUnity** (Anime)
-   **AnimeWorld** (Anime)
-   **EuroStreaming** (Serie TV)
-   **GuardaHD** (Film)
-   **GuardaSerie** (Serie TV)
-   **StreamingCommunity** (Film & Serie TV)

---

## 🚀 Installazione su Nuvio

Per installare i provider su Nuvio, basta seguire questi semplici passaggi:

1.  Apri **Nuvio**.
2.  Vai nelle **Impostazioni** > **Plugin**.
3.  Incolla il seguente link nel campo apposito per aggiungere un plugin esterno:
    ```text
    https://raw.githubusercontent.com/realbestia1/nuvio-providers-it/refs/heads/main/manifest.json
    ```
4.  I provider saranno immediatamente attivi.

---

## 🍿 Installazione su Stremio

Puoi trasformare questi provider in un Addon per Stremio che gira in locale o su un server.

### Esecuzione Locale (Consigliata)
Poiché molti siti italiani bloccano gli IP dei server cloud (AWS, Heroku, ecc.), l'esecuzione locale è spesso la soluzione migliore.

1.  Apri il terminale nella cartella del progetto.
2.  Avvia l'addon:
    ```bash
    npm start
    ```
3.  L'addon si avvierà su `http://localhost:7000`.
4.  Apri il browser a quell'indirizzo.
5.  Clicca sul pulsante **"INSTALL ADDON"** per aggiungerlo automaticamente al tuo Stremio.

### Esecuzione con Docker
Se preferisci usare Docker (ottimo per NAS o server casalinghi):

1.  Assicurati di avere Docker installato.
2.  Esegui il comando:
    ```bash
    docker-compose up -d
    ```
3.  L'addon sarà disponibile su `http://localhost:7000`.

### Deploy su Cloud (HuggingFace, Render, ecc.)
Puoi caricare questo repository su servizi come HuggingFace.
Tuttavia, tieni presente che **alcuni provider potrebbero non funzionare** a causa dei blocchi geografici o dei blocchi IP dei datacenter imposti dai siti sorgente.

---

## 🛠️ Sviluppo

-   **Struttura**: Ogni provider ha la sua cartella in `src/`.
-   **Build**: Lo script `build.js` compila i provider per Nuvio.
-   **Stremio**: Il file `stremio_addon.js` funge da server e adattatore per convertire i risultati dei provider nel formato Stremio.

---

**Powered by [realbestia1](https://github.com/realbestia1/)**
