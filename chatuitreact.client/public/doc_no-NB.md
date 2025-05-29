# ChatUiT

## Kom i gang

Velkommen til ChatUiT! Denne guiden hjelper deg å komme i gang med vårt kraftige chatte-grensesnitt.

### Hva er ChatUiT?

ChatUiT er et avansert AI-chatte-grensesnitt som lar deg samhandle med ulike AI-assistenter, administrere samtalene dine og tilpasse opplevelsen din.

### Nøkkelfunksjoner

- **Flere AI-assistenter**: Få tilgang til forskjellige AI-assistenter spesialisert for ulike oppgaver
- **Samtalehistorikk**: Enkelt tilgang til og administrasjon av tidligere samtaler
- **Tilpasning**: Skreddersy grensesnittet og assistentens oppførsel etter dine preferanser
- **Avansert formatering**: Støtte for kodeblokker, matematisk notasjon og mer

### Hurtigstart

1. **Opprett en ny chat**: Klikk på ny chat-knappen i sidepanelet
2. **Velg en assistent**: Velg AI-assistenten som passer best for dine behov
3. **Start samtalen**: Skriv meldingen din og trykk Enter for å starte samtalen
4. **Bruk spesialfunksjoner**: Prøv formatering med markdown, send kode eller bruk andre spesialfunksjoner

## Installasjon

Følg disse stegene for å installere og sette opp ChatUiT på ditt system.

### Systemkrav

Før installasjon, sørg for at systemet ditt oppfyller følgende krav:

- Node.js 16.0 eller høyere
- Minimum 4GB RAM (8GB anbefalt)
- Moderne nettleser (Chrome, Firefox, Safari, Edge)

### Installasjonssteg

#### Med npm

```bash
# Klon repoet
git clone https://github.com/your-org/chatuit.git

# Gå til prosjektmappen
cd chatuit

# Installer avhengigheter
npm install

# Start utviklingsserveren
npm run dev
```

#### Med Docker

```bash
# Last ned Docker-imaget
docker pull chatuit/app:latest

# Kjør containeren
docker run -p 3000:3000 chatuit/app:latest
```

### Konfigurasjon

Etter installasjon må du konfigurere API-nøkler og preferanser:

1. Opprett en `.env`-fil i rotmappen
2. Legg til dine API-nøkler og konfigurasjonsinnstillinger
3. Start applikasjonen på nytt

Eksempel på `.env`-fil:

```
API_KEY=dinn_api_nøkkel_her
API_ENDPOINT=https://api.example.com/v1
THEME=dark
```

# Brukergrensesnitt

## Chat-grensesnitt

Lær hvordan du navigerer og bruker ChatUiT-grensesnittet effektivt.

### Grensesnittoversikt

ChatUiT-grensesnittet består av flere hovedkomponenter:

- **Sidepanel**: Navigasjon og tilgang til ulike chatter og innstillinger
- **Chat-område**: Hovedvisningen for samtalen
- **Inntastingsboks**: Her skriver du meldingene dine
- **Verktøylinje**: Ekstra formaterings- og vedleggsalternativer

![Chat Interface](https://example.com/chat-interface.png)

### Sidepanel

Sidepanelet gir navigasjon og tilgang til ulike funksjoner:

- **Ny chat**: Start en ny samtale
- **Nylige chatter**: Tilgang til dine siste samtaler
- **Innstillinger**: Konfigurer dine preferanser
- **Hjelp**: Tilgang til dokumentasjonen (du er her nå!)
- **Admin**: Tilgang til administrative funksjoner (kun for admin)

### Chat-område

Chat-området viser samtalen mellom deg og AI-assistenten:

- Meldinger vises i kronologisk rekkefølge
- Dine meldinger vises til høyre
- Assistentens meldinger vises til venstre
- Kodeblokker, bilder og annet rikt innhold vises direkte

### Inntastingsboks

Inntastingsboksen er der du skriver meldingene dine:

- Trykk **Enter** for å sende en melding
- Bruk **Shift+Enter** for å legge til en ny linje uten å sende
- Dra og slipp filer for å laste dem opp
- Bruk markdown-formatering for rik tekst

### Verktøylinje

Verktøylinjen gir flere alternativer for formatering og sending av meldinger:

- **Formateringsvalg**: Fet, kursiv, kode, osv.
- **Vedlegg**: Last opp filer eller bilder
- **Taleinnspilling**: Spill inn lydmeldinger
- **Innstillinger**: Juster chat-spesifikke innstillinger

## Funksjonsoversikt

Oppdag de kraftige funksjonene i ChatUiT.

### Samtalehåndtering

- **Flere chatter**: Ha flere samtaler samtidig
- **Historikk**: Tilgang til hele chat-historikken din
- **Søk**: Søk gjennom tidligere samtaler
- **Eksport**: Eksporter samtaler til ulike formater
- **Slett**: Fjern samtaler når de ikke lenger trengs

### Assistentvalg

Velg mellom flere spesialiserte AI-assistenter:

| Assistent   | Spesialisering         | Best for                |
|-------------|-----------------------|-------------------------|
| Generell    | Allsidig AI           | Hverdagslige spørsmål  |
| Koder       | Programmering         | Kodehjelp              |
| Skribent    | Innholdsproduksjon    | Skrivehjelp            |
| Forsker     | Informasjonsinnhenting| Forskning              |
| Kreativ     | Kreativt arbeid       | Idémyldring            |

### Markdown-støtte

ChatUiT støtter rik tekstformatering med Markdown:

- **Fet**: `**fet tekst**` &rarr **fet tekst**
- **Kursiv**: `*kursiv tekst*` &rarr *kursiv tekst*
- **Kode**: ```kode``` &rarr Formaterte kodeblokker
- **Lister**: Sorterte og usorterte lister
- **Lenker**: `[lenketekst](url)` &rarr [lenketekst](url)
- **Bilder**: `![alt-tekst](bilde_url)` &rarr Innebygde bilder

### Kodehåndtering

- Syntaksutheving for flere programmeringsspråk
- Kopierbare kodeblokker
- Kjøring av kode (for støttede språk)
- Forklaringer og kommentarer til kode

### Matematikk-støtte

ChatUiT støtter matematisk notasjon med LaTeX-syntaks:

Inline-matematikk: `$E=mc^2$` &rarr $E=mc^2$

Blokkmatematikk:
```
$$
\frac{d}{dx}\left( \int_{0}^{x} f(u)\,du\right)=f(x)
$$
```

$$
\frac{d}{dx}\left( \int_{0}^{x} f(u)\,du\right)=f(x)
$$

### Fildeling

- Last opp og del filer med AI-en
- Støttede filtyper: PDF, DOC/DOCX, bilder, kodefiler og mer
- Filanalyse og utvinning utført av AI-en

# Avanserte emner

## Assistenter

Lær om de ulike AI-assistentene og hvordan du bruker dem effektivt.

### Tilgjengelige assistenter

ChatUiT tilbyr flere spesialiserte assistenter for ulike oppgaver:

#### Generell assistent

Standard allsidig assistent som kan håndtere et bredt spekter av spørsmål og oppgaver. Et godt utgangspunkt for de fleste brukere.

#### Kodeassistent

Spesialisert på programmering og programvareutvikling:

- Skriver, gjennomgår og forklarer kode
- Hjelper med feilsøking
- Gir anbefalinger for beste praksis
- Støtter flere programmeringsspråk

Eksempel på prompt:
```
Skriv en React-komponent som viser en nedtellingstimer
```

#### Skriveassistent

Fokusert på skriving og innholdsproduksjon:

- Hjelper med å utforme e-poster, artikler og annet innhold
- Gir forslag for klarhet og stil
- Assisterer med grammatikk og struktur
- Kan tilpasse seg ulike skrivestiler og toner

#### Forskerassistent

Designet for informasjonsinnhenting og analyse:

- Hjelper med å finne og oppsummere informasjon
- Gir omfattende svar på komplekse spørsmål
- Siterer kilder når det er hensiktsmessig
- Organiserer informasjon på en strukturert måte

### Tilpasse assistenter

Du kan tilpasse assistenter for å passe dine behov:

1. Gå til **Innstillinger** > **Assistenter**
2. Velg assistenten du vil tilpasse
3. Juster parametere som detaljeringsgrad, kreativitet og tone
4. Lagre endringene dine

### Lage egendefinerte assistenter

Admin-brukere kan lage egendefinerte assistenter for spesifikke oppgaver:

1. Gå til **Admin** > **Assistenter**
2. Klikk "Opprett ny assistent"
3. Konfigurer assistentens egenskaper og parametere
4. Gjør assistenten tilgjengelig for utvalgte brukere eller grupper

## Admin-funksjoner

En oversikt over administrative funksjoner tilgjengelig for administratorer.

### Bruker- og gruppeadministrasjon

Administratorer kan administrere brukere og grupper fra Admin-panelet:

- **Opprett brukere**: Legg til nye brukere i systemet
- **Brukerrettigheter**: Tildel roller og rettigheter
- **Gruppeadministrasjon**: Opprett og administrer brukergrupper
- **Tilgangskontroll**: Kontroller hvilke assistenter og funksjoner som er tilgjengelige for hvilke brukere/grupper

### Modelladministrasjon

Administrer AI-modellene i systemet:

- **Legg til modeller**: Koble nye AI-modeller til plattformen
- **Konfigurer modeller**: Juster modellparametere og innstillinger
- **Modellovervåkning**: Spor bruk og ytelse
- **Versjonskontroll**: Administrer modellversjoner og oppdateringer

### Assistentadministrasjon

Lag og administrer egendefinerte assistenter:

- **Opprett assistenter**: Bygg nye assistenter for spesifikke formål
- **Maler**: Bruk maler for å raskt lage vanlige assistenttyper
- **Tilpasning**: Finjuster assistentens oppførsel og egenskaper
- **Tilgangskontroll**: Kontroller hvilke brukere som har tilgang til hvilke assistenter

### Systemovervåkning

Overvåk systemets helse og bruk:

- **Bruksstatistikk**: Spor meldingsvolum, brukeraktivitet osv.
- **Ytelsesmetrikker**: Overvåk responstider og systembelastning
- **Feillogging**: Se og analyser systemfeil
- **Revisjonslogger**: Gå gjennom brukeraktivitet for sikkerhet og etterlevelse

### Varslingsadministrasjon

Administrer systemvarsler:

- **Opprett varsler**: Send kunngjøringer til brukere
- **Planlagte varsler**: Sett opp tilbakevendende eller fremtidige varsler
- **Målrettede varsler**: Send varsler til spesifikke brukere eller grupper
- **Varselmaler**: Lag gjenbrukbare varslingsmaler

## Feilsøking

Løsninger på vanlige problemer du kan møte når du bruker ChatUiT.

### Tilkoblingsproblemer

#### Problem: Får ikke kontakt med ChatUiT

**Mulige løsninger:**

1. Sjekk internettforbindelsen din
2. Kontroller at serveren kjører
3. Prøv å oppdatere siden
4. Tøm nettleserens cache og informasjonskapsler
5. Prøv en annen nettleser

#### Problem: Treg responstid

**Mulige løsninger:**

1. Sjekk internett-hastigheten din
2. Reduser kompleksiteten i spørsmålene dine
3. Prøv på et mindre travelt tidspunkt
4. Sjekk om det er systemomfattende ytelsesproblemer

### Autentiseringsproblemer

#### Problem: Får ikke logget inn

**Mulige løsninger:**

1. Kontroller brukernavn og passord
2. Tilbakestill passordet ditt
3. Sjekk om kontoen din er låst
4. Kontakt administratoren din

#### Problem: Økten utløper stadig

**Mulige løsninger:**

1. Sjekk nettleserens innstillinger for informasjonskapsler
2. Sørg for at enhetens tid og dato er korrekte
3. Prøv å logge inn igjen
4. Bruk "Husk meg"-valget om tilgjengelig

### Assistentproblemer

#### Problem: Assistenten forstår ikke spørsmålene

**Mulige løsninger:**

1. Omformuler spørsmålet for å være mer spesifikk
2. Del opp komplekse spørsmål i enklere deler
3. Prøv en annen assistent som kan passe bedre for oppgaven
4. Sjekk om det finnes kjente begrensninger for visse spørsmålstyper

#### Problem: Problemer med kodegenerering

**Mulige løsninger:**

1. Vær mer spesifikk om programmeringsspråk og krav
2. Gi kontekst om eksisterende kodebase
3. Start med en enklere forespørsel og bygg videre
4. Sjekk for syntaksfeil i prompten din

### Fil- og markdown-problemer

#### Problem: Markdown vises ikke riktig

**Mulige løsninger:**

1. Sjekk markdown-syntaksen din
2. Sørg for at du bruker støttede markdown-funksjoner
3. Prøv å forenkle komplekse markdown-strukturer
4. Bruk forhåndsvisningsfunksjonen om tilgjengelig

#### Problem: Får ikke lastet opp filer

**Mulige løsninger:**

1. Sjekk om filtypen støttes
2. Kontroller at filstørrelsen er innenfor grensen
3. Prøv en annen fil
4. Sjekk nettleserens tillatelser for filtilgang