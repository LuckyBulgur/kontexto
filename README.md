# Kontexto

Ein deutsches semantisches Wort-Ratespiel, inspiriert von [Contexto.me](https://contexto.me) (erstellt von Nildo Junior).

Errate das geheime Wort! Bei jedem Versuch wird dir angezeigt, wie semantisch nah dein Wort am gesuchten Begriff ist. Je niedriger die Zahl, desto näher bist du dran.

## Features

- Tägliches neues Wort zum Erraten
- Farbcodiertes Feedback (Grün/Gelb/Rot) basierend auf semantischer Nähe
- Hinweissystem mit drei Schwierigkeitsstufen
- Dark/Light Mode
- Ergebnisse teilen
- Vergangene Spiele ansehen
- Vollständig auf Deutsch

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** FastAPI, Python 3.12, NumPy, fastText (deutsche Wort-Embeddings)
- **Deployment:** Docker, Nginx, Supervisor

## Schnellstart

### Mit Docker (empfohlen)

```bash
docker compose up --build
```

Die App ist dann unter `http://localhost:8080` erreichbar.

### Lokale Entwicklung

**Backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**

```bash
cd frontend
pnpm install
pnpm dev
```

### Daten vorbereiten

Beim ersten Docker-Start werden die Spieldaten automatisch generiert. Für die lokale Entwicklung:

```bash
bash scripts/prepare-data.sh data/
```

Dies lädt das deutsche fastText-Modell herunter und berechnet die Wort-Rankings.

## Projektstruktur

```
kontexto/
├── backend/          # FastAPI Backend
│   ├── main.py       # API-Endpunkte
│   ├── game.py       # Spiellogik
│   ├── models.py     # Pydantic-Modelle
│   └── prepare.py    # Datenvorbereitung
├── frontend/         # Next.js Frontend
│   ├── app/          # App Router
│   ├── components/   # React-Komponenten
│   └── lib/          # Utilities & Types
├── scripts/          # Hilfsskripte
├── data/             # Spieldaten (generiert)
├── Dockerfile        # Multi-Stage Build
├── docker-compose.yml
└── nginx.conf        # Reverse Proxy
```

## API-Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| POST | `/api/guess` | Wort raten |
| GET | `/api/tip` | Hinweis abrufen |
| GET | `/api/game` | Aktuelle Spielinfo |
| GET | `/api/games` | Vergangene Spiele |
| GET | `/api/reveal` | Lösung anzeigen |

## Umgebungsvariablen

| Variable | Beschreibung | Standard |
|----------|-------------|----------|
| `KONTEXTO_DATA_DIR` | Pfad zum Datenverzeichnis | `data` |
| `KONTEXTO_DEV` | Aktiviert CORS für lokale Entwicklung | - |
| `KONTEXTO_FORCE_GAME` | Erzwingt eine bestimmte Spielnummer | - |
| `NEXT_PUBLIC_API_URL` | API-URL für das Frontend | `/api` |

## Tests

```bash
cd backend
pytest
```

## Attribution

Dieses Projekt ist inspiriert von [Contexto.me](https://contexto.me), erstellt von Nildo Junior. Kontexto ist ein unabhängiges Open-Source-Projekt und steht in keiner offiziellen Verbindung zu Contexto.me.

Die semantischen Wort-Embeddings basieren auf dem deutschen [fastText](https://fasttext.cc/) Modell von Facebook Research.

## Lizenz

MIT - siehe [LICENSE](LICENSE)
