/**
 * Every visible Spooktober string outside the controller's toasts, in one
 * place. The components render from here, so a wording change is one edit
 * and the copy can be read top to bottom (the klartext pass was done on this
 * file as a whole).
 */
export const COPY = {
  bag: {
    title: "Dein Süßigkeiten-Beutel",
    description:
      "Jede Runde, die du im Oktober löst, bringt eine Süßigkeit. Dazu spuken 13 Geheimnisse durch Kontexto. Nur bis 31. Oktober, gespeichert nur auf diesem Gerät.",
    candyHeading: "Süßigkeiten",
    pieces: (n: number) => (n === 1 ? "1 Stück" : `${n} Stück`),
    golden: "Ein goldenes Bonbon, für alle 13 Geheimnisse.",
    empty: "Noch leer. Löse eine Runde, egal in welchem Modus, dann liegt hier die erste Süßigkeit.",
    secretsHeading: "Geheimnisse",
    secretsCount: (found: number, total: number) => `${found} von ${total}`,
    hidden: "Noch versteckt",
    foundSuffix: ", gefunden",
  },
  menuEntry: "Süßigkeiten-Beutel",
  pumpkinLabel: "Kürbis. Klopf an, vielleicht gibt es Süßes.",
  pumpkinEmptyLabel: "Kürbis, gerade leer",
  graveyard: {
    label: "Kleiner Friedhof",
    stones: [
      { top: "Rang 2", bottom: "So nah dran" },
      { top: "Hier ruht", bottom: "mein Streak" },
      { top: "Zu allgemein", bottom: "R.I.P." },
    ],
    knockLabel: "An den Grabstein klopfen",
  },
  lost: {
    line: "Hier spukt es nur noch. Die Seite ist schon lange ausgezogen.",
  },
  announce: {
    title: "Spooktober bei Kontexto",
    description:
      "Bis 31. Oktober: Gruseldesign, ein Kürbis voller Süßigkeiten und 13 Geheimnisse. Abschalten kannst du es in den Einstellungen.",
    halloweenTitle: "Heute ist Halloween",
    halloweenDescription: "Vollmond, mehr Fledermäuse und ein Kürbis, der sich freut, wenn du anklopfst.",
    action: "Beutel öffnen",
  },
  tabAway: "Buh! Komm zurück …",
  flashlightOff: "Licht an",
} as const;
