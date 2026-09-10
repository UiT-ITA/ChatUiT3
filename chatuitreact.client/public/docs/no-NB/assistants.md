En assistent er en samtale du har satt opp på forhånd: en modell, instruksjoner og filene den skal kjenne. Bruk dem UiT tilbyr, eller lag dine egne.

## Velg assistent for en samtale

Klikk assistentknappen til venstre for meldingsfeltet. Velgeren har et søkefelt, en kategorilinje (alle, favoritter, system, mine, delt med meg) og et filter for egenskaper: syn, verktøy og resonnering. Merk en assistent med stjerne for å ha den under Favoritter.

![Replace with screenshot featuring the assistant picker open above the composer](placeholder)

> [!NOTE]
>
> Assistenten velges når samtalen starter. Vil du bruke en annen assistent, start en ny samtale.

## Assistentsiden

Åpne **Assistenter** i ikonlinjen. Listekolonnen har tre grupper:

- **Mine assistenter** er dem du har laget.
- **Systemassistenter** kommer fra UiT.
- **Delte assistenter** er laget av andre brukere og lagt til av deg.

Klikk en for å se detaljene, eller **Ny assistent** for å lage en.

## Lag en assistent

![Replace with screenshot featuring the assistant form with model, instructions and knowledge sections](placeholder)

| Felt | Hva det gjør |
|---|---|
| Navn og beskrivelse | Slik vises den i lister og i velgeren. |
| Tagger | Ord å søke etter i velgeren. |
| Modell | Hvilken AI-modell som svarer. Listen viser egenskaper, kontekststørrelse og kunnskapsgrense for hver modell. Se [Modeller](/help/models). |
| Instruks | Hva assistenten skal vite og hvordan den skal oppføre seg. Sendes før hver samtale. |
| Verktøy | Hvilke verktøy assistenten får kalle, hvis modellen støtter verktøy. |
| Temperatur | Hvor varierte svarene er, fra 0 (forutsigbar) til 1 (variert). Vises bare for modeller som godtar det. |
| Resonneringsinnsats | Hvor lenge modellen får tenke før den svarer. Vises bare for resonnerende modeller. |

> [!NOT_IMPLEMENTED]

Under Instruks er det tre avkrysningsbokser som legger til standardinstruksjoner: **Svar i markdown**, **Ta med grunnleggende info om deg** og **Vis likninger**. Kryss av i stedet for å skrive de delene selv.

### Kunnskapsfiler

Filer under **Alltid lastede filer** er med i hver samtale med assistenten.

> [!TIP]
>
> Det passer for kort referansemateriale: en stilguide, en emnebeskrivelse, en mal. Alt i disse filene teller mot kontekstvinduet i hver samtale.

> [!NOT_IMPLEMENTED]

**Selektivt lastede filer** tas bare med når modellen vurderer dem som relevante for spørsmålet. **RAG-lastede filer** deles opp og søkes i, slik at assistenten bare leser delene som passer. Bruk disse for store samlinger.

## Handlinger på en assistent

- **Sett som standard** gjør at nye samtaler starter med denne assistenten. Noen kostbare modeller kan ikke være standard. Siden sier fra om det gjelder.
- **Skjul fra valglisten** beholder assistenten, men tar den ut av velgeren.
- **Bruk i ny samtale** starter en samtale med den straks.
- **Del assistent** viser en lenke og en ID du kan gi til kolleger.
- **Slett** fjerner en assistent du eier. For en delt assistent fjerner den samme knappen den bare fra listen din.

## Bruk en assistent noen har delt

Enten åpner du lenken du fikk, som legger til assistenten automatisk, eller du går til **Assistenter**, limer inn ID-en under **Legg til delt assistent** og klikker Legg til. Assistenten vises under Delte assistenter. Du bruker eierens instruksjoner og filer, men dine egne samtaler.
