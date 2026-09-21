# Concrete-noun solution pool (rebuild from game 107)

Status: in progress, started 2026-09-21.

## Why

Kontexto's solutions were never chosen for guessability, only for frequency and word class.
Measured against production on 2026-09-21:

| | share of the 9,537 live solutions |
|-|-|
| common nouns | 66.8 % |
| verbs | 15.1 % |
| adjectives | 13.8 % |
| proper nouns that slipped the filter | 3.6 % (346 words, among them `bayern`, `siemens`, `linux`) |

The reference implementation, contexto.me, publishes roughly 98 % nouns, and they are almost
all short, concrete, everyday things (`banana`, `lighthouse`, `pelican`, `screwdriver`). The
gap is the whole complaint: a German player is regularly asked to converge on `bewältigung`,
`voraussichtlich` or `berücksichtigen`.

## The measurement that decided the rule

Concreteness ratings come from Köper and Schulte im Walde, "Automatically Generated Affective
Norms of Abstractness, Arousal, Imageability and Valence for 350,000 German Lemmas" (LREC 2016),
`AbstConc` column, higher means more concrete. Joined against `analytics_game_stats` from
production, over all modes:

| AbstConc | live solutions | guesses per solve |
|-|-|-|
| below 4.0 | 1,731 | 118 |
| 4.0 to 5.0 | 896 | 97 |
| 5.0 to 6.0 | 609 | 83 |
| 6.0 to 7.0 | 363 | 61 |
| 7.0 and above | 130 | 48 |

Concreteness dominates frequency: a very concrete rare word costs 48 guesses, an abstract
frequent one 102. Two consequences that overturned the first draft of this plan.

1. **Banning compounds would have been wrong.** Contexto is full of them, English just writes
   them apart: `lighthouse`, `toothbrush`, `blackboard`, `screwdriver`. `schlafzimmer` rates
   7.33, `pressekonferenz` 5.28. The norms separate those, a suffix rule does not.
2. **The Zipf 3.2 floor was throwing away the best words.** `maiskolben`, `teddybär`,
   `kochtopf`, `pelikan`, `streichholz`, `erdnuss`, `ruderboot` are rare in a news crawl and
   perfectly ordinary in life. The pelican is literally in the Contexto archive.

## The rule (approved by the user)

A solution is a common noun, in base form, not a proper noun, not offensive, not religious,
not a foreign word, with `AbstConc >= 6.0` and German `zipf >= 2.5`.

Expected: 3,981 candidates at roughly 57 guesses per solve, against 9,537 at roughly 90 today.

## Scope

- Games 1 to 106 have been played. They stay byte-identical.
- Everything from game 107 is rebuilt. `total_games` shrinks accordingly.
- The vocabulary stays at 80,000 words. Extending it was measured and adds 13 junk words
  (`paßwort`, `mißerfolg`, `psst`), because anything frequent enough is already inside the
  top 80k of the crawl. Keeping it means `vocabulary.json`, `bloom.bin` and `lemma_map.json`
  are untouched, and the played games need no recomputation.
- Guess input is unchanged. Verbs and adjectives remain legal guesses, they just stop being
  solutions.
- Wördle is out of scope.

## Steps

- [ ] 1. `scripts/build-concreteness-list.py`: derive `backend/data/concrete_nouns.txt` from the
      norms. The 6 MB norms file is never committed, only the per-word decision.
- [ ] 2. Concreteness gate in `backend/target_selection.py`, tests in `backend/test_target_selection.py`.
- [ ] 3. `scripts/rebuild-concrete-pool.py`, modelled on `scripts/regenerate-future-games.py`,
      keeping its vocabulary gate and its bit-for-bit fidelity gate.
- [ ] 4. Generate locally. The server has too little RAM for the fastText model.
- [ ] 5. Audit 100 % of the new target list, including the top-100 neighbourhood of every word.
- [ ] 6. Play at least 30 full rounds against a local backend and report each one.
- [ ] 7. Run every gate: `pytest`, `pnpm build`, `pnpm test`, `pnpm seo:check`,
      `pnpm verify:slop --all`, `pnpm verify:dashes`, `pnpm test:e2e`.
- [ ] 8. Ask the user, then upload over SSH and verify `/api/game` still reports game 106.

## Found along the way

- **The norms are lemmatised with `ss`.** Looking up a vocabulary word spelled with
  the ligature therefore missed 1,260 otherwise valid nouns, among them the words for
  street, football, foot, fun and grandmother. `scripts/build-concreteness-list.py` folds
  the spelling, the way the rest of the pipeline already does.
- **The norms have holes.** They carry an entry for the German words for DIY store and
  cotton and none at all for the word for tree. Rating an unrated compound by its head
  was tried and dropped: 453 recovered words, 50 surviving the other gates, and those 50
  carried place names and noise. A hand-verified `CONCRETE_RESCUE` list of 24 words
  closes the real gaps instead.
- **`select_target_words` was throwing away its best candidates.** A simplemma
  base-form check, predating the HanTa filter that now does the same job properly,
  lemmatises short German nouns onto verb infinitives. It silently dropped 352 words
  including the ones for ball, bed, book, boat, roof, beer and blood. Removed.
- **The fidelity gate asserted the wrong thing.** Bit-for-bit equality against the
  deployed npz cannot hold: the debiasing SVD is not associative under parallel
  reduction, so genuinely tied similarities come out about 1e-9 apart and in either
  order. On game 1 that is 30 swapped adjacent pairs at ranks 12,000 to 79,000. The gate
  now requires the solution at rank 1, the same set of 500 nearest words, and at most a
  one-rank move for at most a tenth of a percent of the vocabulary. The two older
  scripts still assert exact equality and have been passing on luck.
- **Imageability is the weaker signal.** Measured the same way, its top band is noisy
  (71.6 guesses per solve at 8.0+) where abstractness stays monotone. `AbstConc` it is.

## The hand audit, 2026-09-21

All 4,304 proposed solutions were read. 321 were removed and the reasons are written
down, grouped, in `backend/data/unfair_targets.txt`: word classes the tagger misreads,
brands, landmarks, nationalities, weapons and atrocity, drugs, sexual content, dated
terms for people, and words no player could converge on. A further 56 church-specific
words went into `RELIGION_BLOCKLIST`.

Things the automatic gates had let through and a human caught: `hakenkreuz`, `mischling`,
`landser`, `reichskanzlei`, a vulgar participle, `heroin`, `kokain`, `kitzler`,
`sexspielzeug`, `eskimo`, and a row of nationalities. That is the argument for the audit.

Pool after the audit: **4,033 games**, 106 kept plus 3,927 new.

## The neighbourhood audit

`scripts/audit-neighbourhoods.py` scores every solution on its hundred nearest words.
Two different failures, measured apart. **Reachable** counts neighbours a player would
actually type. **Name share** counts neighbours that are proper names, and that is the
one that finds broken solutions: when the embedding read the word as a name, the round
cannot be won by meaning at all. The word for vine scores 100 out of 100 given names.

Being a surname is not enough. The words for wolf, fox, forester, bush, cook and farmer
all sit in a third of a page of surnames and keep a real ladder of their own, so the cut
is name share **and** no ladder. Nine solutions failed both.

## The play test

`scripts/playtest-pool.py` plays sampled rounds against a running backend with a solver
that thinks in the same vector space the game scores with, so it is an optimistic player:
a round it cannot finish is a round nobody finishes.

The first version chased its single best guess, walked into a cluster of near synonyms
and circled there, ending 28 of 40 rounds at rank 2 to 11. That was the solver, not the
pool. Triangulating from the five best guesses, weighted by `1/log(rank)`, and lifting the
frequency floor once the trail is warm:

**38 of 40 rounds solved, median 60 guesses, worst 141.** The two failures went on the
blocklist: the word for parapet (best rank 262, its neighbours are verbs of motion) and
the one for spectacle wearer (best rank 58, its neighbours are categories of people).

A second run of 40 different rounds against the finished pool: **40 of 40 solved, median
48 guesses, worst 161**. 78 of 80 rounds over both runs. The sampled solutions read like
the reference implementation's archive: pumpkin, drawer, aquarium, olive oil, cow, paper,
chihuahua, beach chair, banana, frying pan, syringe.

One entry came back off the blocklist. The word for olive looked fatal on the metric,
since its neighbours are English colour words, and then a played round found it in 94
guesses. A round beats a metric.

## Upload

`target_words.json` and `metadata.json` are read once at startup and the npz are cached
per game, so the restart is the switch. Uploading the new npz into the live `games/`
directory before the restart would leave the running process serving old solutions
against new rank arrays, so the upload stages everything and swaps it in one move.

## Progress

- [x] 1. `scripts/build-concreteness-list.py` and `backend/data/concrete_nouns.txt` (7,326 words)
- [x] 2. Concreteness and noun gates in `backend/target_selection.py`, 269 tests green
- [x] 3. `scripts/rebuild-concrete-pool.py`
- [x] 4. Generated locally
- [x] 5. Audit of 100 % of the list, plus `scripts/audit-neighbourhoods.py`
- [x] 6. 80 rounds played end to end, 78 solved
- [x] 7. Every gate: `pytest` 726 passed, `pnpm build`, `pnpm test` 189, `pnpm seo:check`,
      `pnpm verify:slop --all` 0 findings over 309 files, `pnpm verify:dashes` 459 files,
      `pnpm test:e2e` 36 passed
- [x] 8. Uploaded and live, 2026-09-21

## The upload

`scripts/upload-concrete-pool.sh .regen-work/concrete-final`, after the user approved it.
Staged into the volume, swapped in three moves, restarted. Verified on production
afterwards:

| check | result |
|-|-|
| `/api/game` before and after | `gameNumber: 106` both times |
| `total_games` | 9,537 to 4,023 |
| npz in `games/` | 4,023, with 9,537 kept as `games.previous` |
| sha256 of the first 106 solutions | `7b9522bf261449e7`, the same value as the local reference |
| a played round through kontexto.de | game 3,572, `tier` 24,542, `hund` 30,041, `katze` 1,019, `banane` rank 1 |

Two things the upload found:

- The script's spot check asked for `closest` on the first rebuilt game, which the date
  gate refuses with a 400 because that game is tomorrow's. The swap and both health
  checks had already passed; the check itself was wrong and is the only thing that failed.
- `/app/data` now holds 2.9 GB, because the previous pool is deliberately still there.
  Once tomorrow's puzzle has been played, `scripts/upload-concrete-pool.sh
  --drop-previous` frees about 2 GB. Until then a rollback is `--rollback` and a restart.

## Final numbers

| | before | after |
|-|-|-|
| games | 9,537 | 4,023 |
| nouns | 66.8 % | 100 % |
| proper nouns that slipped through | 346 | 0 |
| expected guesses per solve | about 90 | about 57 |
| data volume | 2.0 GB | 0.83 GB |

Games 1 to 106 are byte-identical and today's game number is 106 before and after, checked
against a local backend serving the rebuilt pool.

## Deliberately not done

- The words for steward and gag survive with a name-heavy neighbourhood at 19 and 18 out
  of 100. Both are ordinary German words with a working ladder, and each further removal
  costs a full regeneration.
- The word for camel keeps a neighbourhood of Arabic given names at 18 out of 100. The
  animal path exists alongside it and the reference implementation publishes the same
  word.
- The two older maintenance scripts still assert bit-for-bit equality in their fidelity
  gate. They are pinned to the pre-2026-09-21 rule and are not run by this work, but the
  gate is known to be passing on luck.
- Woerdle is untouched, and so is anything about how a guess is validated.
