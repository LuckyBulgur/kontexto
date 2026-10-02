# Easter egg sources and licenses

Everything under `frontend/public/eggs/` comes from published sources with permissive licenses. Built by `scripts/build-easter-eggs.py` (pictures, word list) and `scripts/build-egg-sounds.py` (sounds).

## Word list

German emoji names and keywords from Unicode CLDR (`unicode-org/cldr-json`, `cldr-annotations-full/annotations/de`), Unicode License v3 (https://www.unicode.org/license.txt). Used at build time only; the shipped catalogue is the joined, filtered and hand-corrected result.

## Pictures

Microsoft Fluent Emoji, flat style (https://github.com/microsoft/fluentui-emoji), MIT License, Copyright (c) Microsoft Corporation, as packaged by Iconify (`@iconify-json/fluent-emoji-flat`, version 1.2.6, fetched 2026-10-02). The license text ships next to the files: `frontend/public/eggs/LICENSE-fluent-emoji.txt`.

The hitmarker, the pixel sunglasses, the scope and the rainbow arc are drawn in `frontend/lib/easter-eggs/stage.ts`. The hitmarker tick is synthesised in the browser (`sound.ts`), and the spoken lines use the browser's own voices.

## Sounds

BigSoundBank (https://bigsoundbank.com), CC0 1.0, no attribution required; listed anyway, one line per file:

| File | Source |
|-|-|
| `airhorn.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1832.mp3 |
| `airplane.mp3` | https://bigsoundbank.com/UPLOAD/mp3/3004.mp3 |
| `alarm.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2814.mp3 |
| `anvil.mp3` | https://bigsoundbank.com/UPLOAD/mp3/3589.mp3 |
| `applause.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2363.mp3 |
| `arrow.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0548.mp3 |
| `babycry.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0233.mp3 |
| `babylaugh.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0980.mp3 |
| `balloonblow.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1130.mp3 |
| `balloonpop.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0551.mp3 |
| `bark.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2954.mp3 |
| `bat.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0458.mp3 |
| `bee.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1000.mp3 |
| `bikebell.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0028.mp3 |
| `birthday.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2194.mp3 |
| `boing.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2277.mp3 |
| `boxingbell.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1926.mp3 |
| `bubbles.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0150.mp3 |
| `bugle.mp3` | https://bigsoundbank.com/UPLOAD/mp3/3263.mp3 |
| `burp.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1708.mp3 |
| `bushorn.mp3` | https://bigsoundbank.com/UPLOAD/mp3/3594.mp3 |
| `camera.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0307.mp3 |
| `carhorn.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0258.mp3 |
| `carstart.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0189.mp3 |
| `chain.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0359.mp3 |
| `chainsaw.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0454.mp3 |
| `cheer.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0236.mp3 |
| `cheers.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1335.mp3 |
| `chewing.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1432.mp3 |
| `chick.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0672.mp3 |
| `chimes.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2079.mp3 |
| `churchbell.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0135.mp3 |
| `clock.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0007.mp3 |
| `coins.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0194.mp3 |
| `cork.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0211.mp3 |
| `cough.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2183.mp3 |
| `creak.mp3` | https://bigsoundbank.com/UPLOAD/mp3/3205.mp3 |
| `cricket.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1020.mp3 |
| `crow.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2766.mp3 |
| `crunch.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1114.mp3 |
| `cymbal.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2314.mp3 |
| `dice.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0581.mp3 |
| `donkey.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1549.mp3 |
| `doorbell.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0159.mp3 |
| `drumroll.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2402.mp3 |
| `duck.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0276.mp3 |
| `explosion.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1023.mp3 |
| `faucet.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0652.mp3 |
| `fire.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2857.mp3 |
| `firecracker.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1137.mp3 |
| `fireworks.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0831.mp3 |
| `flush.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0141.mp3 |
| `fly.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0759.mp3 |
| `footsteps.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0514.mp3 |
| `frog.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0819.mp3 |
| `frying.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0145.mp3 |
| `gallop.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0611.mp3 |
| `gavel.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1590.mp3 |
| `ghost.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2046.mp3 |
| `glass.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0771.mp3 |
| `glockenspiel.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0920.mp3 |
| `goat.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0279.mp3 |
| `golf.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0455.mp3 |
| `gong.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1483.mp3 |
| `hammer.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0005.mp3 |
| `heartbeat.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0218.mp3 |
| `helicopter.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0263.mp3 |
| `hen.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0453.mp3 |
| `ice.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2123.mp3 |
| `kettle.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1351.mp3 |
| `kick.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1044.mp3 |
| `kiss.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2198.mp3 |
| `laser.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1758.mp3 |
| `laugh.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0475.mp3 |
| `meow.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1890.mp3 |
| `microwave.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1631.mp3 |
| `moo.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0546.mp3 |
| `motorcycle.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0603.mp3 |
| `musicbox.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0465.mp3 |
| `neigh.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0863.mp3 |
| `oogah.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2542.mp3 |
| `owl.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1764.mp3 |
| `parrot.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2779.mp3 |
| `partyhorn.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1553.mp3 |
| `phone.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0253.mp3 |
| `pig.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1658.mp3 |
| `pigeon.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0840.mp3 |
| `pingpong.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2236.mp3 |
| `pistol.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0437.mp3 |
| `police.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0886.mp3 |
| `popcorn.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0413.mp3 |
| `pour.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1391.mp3 |
| `printer.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0169.mp3 |
| `purr.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0436.mp3 |
| `radio.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0312.mp3 |
| `rain.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1290.mp3 |
| `register.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1417.mp3 |
| `robot.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1975.mp3 |
| `rockfall.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1022.mp3 |
| `rooster.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0283.mp3 |
| `santa.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2077.mp3 |
| `saw.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0559.mp3 |
| `scream.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1148.mp3 |
| `seagull.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0267.mp3 |
| `sheep.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2343.mp3 |
| `shiphorn.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0261.mp3 |
| `shot.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2854.mp3 |
| `siren.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1463.mp3 |
| `sleighbells.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0585.mp3 |
| `slurp.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1244.mp3 |
| `smallbell.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0292.mp3 |
| `sneeze.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0609.mp3 |
| `snore.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0170.mp3 |
| `snowsteps.mp3` | https://bigsoundbank.com/UPLOAD/mp3/3363.mp3 |
| `splash.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1519.mp3 |
| `steamtrain.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0228.mp3 |
| `stream.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1354.mp3 |
| `sword.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0128.mp3 |
| `teeth.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0789.mp3 |
| `tennis.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0584.mp3 |
| `thunder.mp3` | https://bigsoundbank.com/UPLOAD/mp3/3115.mp3 |
| `tibetan.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1110.mp3 |
| `tires.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2371.mp3 |
| `toothbrush.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0718.mp3 |
| `toy.mp3` | https://bigsoundbank.com/UPLOAD/mp3/3333.mp3 |
| `tractor.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0132.mp3 |
| `trainwhistle.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0226.mp3 |
| `tram.mp3` | https://bigsoundbank.com/UPLOAD/mp3/3539.mp3 |
| `typewriter.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2841.mp3 |
| `ufo.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1972.mp3 |
| `vacuum.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0722.mp3 |
| `waterfall.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0219.mp3 |
| `waves.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0266.mp3 |
| `whip.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2950.mp3 |
| `whistle.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1017.mp3 |
| `whoosh.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1796.mp3 |
| `wind.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0595.mp3 |
| `yawn.mp3` | https://bigsoundbank.com/UPLOAD/mp3/1406.mp3 |
| `zipper.mp3` | https://bigsoundbank.com/UPLOAD/mp3/0270.mp3 |
| `zombie.mp3` | https://bigsoundbank.com/UPLOAD/mp3/2106.mp3 |
