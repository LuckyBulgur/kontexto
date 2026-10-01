/**
 * Every visible Spooktober string outside the controller's toasts, in one
 * place. The components render from here, so a wording change is one edit
 * and the copy can be read top to bottom (the klartext pass was done on this
 * file as a whole).
 */
export const COPY = {
  pumpkinLabel: "Kürbis. Klopf an, vielleicht gibt es Süßes.",
  pumpkinEmptyLabel: "Kürbis, gerade leer",
  lost: {
    line: "Hier spukt es nur noch. Die Seite ist schon lange ausgezogen.",
  },
  announce: {
    title: "Spooktober bei Kontexto",
    description:
      "Bis 31. Oktober spukt es hier: 13 Geheimnisse sind versteckt, und der Kürbis oben freut sich über jedes Klopfen. Abschalten kannst du es in den Einstellungen.",
    halloweenTitle: "Heute ist Halloween",
    halloweenDescription: "Vollmond, mehr Fledermäuse und ein Kürbis, der sich freut, wenn du anklopfst.",
  },
  tabAway: "Buh! Komm zurück …",
  flashlightOff: "Licht an",
} as const;
