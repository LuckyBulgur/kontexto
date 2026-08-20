"""Koop (cooperative Kontexto) CRUD operations.

Unlike the duel, all players share ONE de-duplicated guess list and win together
the moment anyone reaches rank 1. The shared list is enforced on the DB via
UNIQUE(koop_id, word); solved/solved_by/best_rank live on the koop row so the
WebSocket poller and state endpoint can read the team's progress in one place.
"""

import secrets
import string

import aiosqlite


def _generate_id(length: int = 6) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


def _parse_played(raw: str) -> set[int]:
    """Parse the CSV of already-played game numbers stored on the koop row."""
    return {int(p) for p in raw.split(",") if p.strip().lstrip("-").isdigit()}


def _format_played(games: set[int]) -> str:
    return ",".join(str(n) for n in sorted(games))


async def _unique_nickname(
    db: aiosqlite.Connection, koop_id: str, nickname: str
) -> str:
    """Disambiguate nicknames within a koop.

    The shared feed attributes every guess by nickname, so a collision would make
    "who guessed what" ambiguous. Mirrors the Wördle-duel suffix scheme.
    """
    cursor = await db.execute(
        "SELECT nickname FROM koop_players WHERE koop_id = ?", (koop_id,)
    )
    taken = {row["nickname"] for row in await cursor.fetchall()}
    unique = nickname
    suffix = 2
    while unique in taken:
        unique = f"{nickname} ({suffix})"
        suffix += 1
    return unique


async def create_koop(
    db: aiosqlite.Connection,
    game_number: int,
    nickname: str,
    tips_allowed: bool,
) -> dict:
    koop_id = _generate_id()
    player_token = _generate_token()

    await db.execute(
        "INSERT INTO koops (id, game_number, created_by, tips_allowed) VALUES (?, ?, ?, ?)",
        (koop_id, game_number, nickname, tips_allowed),
    )
    await db.execute(
        "INSERT INTO koop_players (koop_id, nickname, player_token) VALUES (?, ?, ?)",
        (koop_id, nickname, player_token),
    )
    await db.commit()
    return {"koop_id": koop_id, "player_token": player_token}


async def join_koop(
    db: aiosqlite.Connection, koop_id: str, nickname: str
) -> dict | None:
    cursor = await db.execute("SELECT id FROM koops WHERE id = ?", (koop_id,))
    if not await cursor.fetchone():
        return None

    player_token = _generate_token()
    unique = await _unique_nickname(db, koop_id, nickname)
    await db.execute(
        "INSERT INTO koop_players (koop_id, nickname, player_token) VALUES (?, ?, ?)",
        (koop_id, unique, player_token),
    )
    await db.commit()

    state = await get_koop_state(db, koop_id)
    return {"player_token": player_token, "nickname": unique, **state}


async def get_koop_state(db: aiosqlite.Connection, koop_id: str) -> dict | None:
    cursor = await db.execute("SELECT * FROM koops WHERE id = ?", (koop_id,))
    koop = await cursor.fetchone()
    if not koop:
        return None

    cursor = await db.execute(
        "SELECT nickname, contribution_count, connected "
        "FROM koop_players WHERE koop_id = ? ORDER BY id",
        (koop_id,),
    )
    players = [
        {
            "nickname": row["nickname"],
            "contribution_count": row["contribution_count"],
            "connected": bool(row["connected"]),
        }
        for row in await cursor.fetchall()
    ]

    return {
        "koop_id": koop_id,
        "game_number": koop["game_number"],
        "tips_allowed": bool(koop["tips_allowed"]),
        "solved": bool(koop["solved"]),
        "solved_by": koop["solved_by"],
        "gave_up": bool(koop["gave_up"]),
        "best_rank": koop["best_rank"],
        "players": players,
    }


async def get_koop_guesses(db: aiosqlite.Connection, koop_id: str) -> list[dict]:
    """The shared, de-duplicated guess list, oldest first."""
    cursor = await db.execute(
        "SELECT nickname, word, rank, is_tip, guessed_at FROM koop_guesses "
        "WHERE koop_id = ? ORDER BY id",
        (koop_id,),
    )
    return [
        {
            "nickname": row["nickname"],
            "word": row["word"],
            "rank": row["rank"],
            "is_tip": bool(row["is_tip"]),
            "guessed_at": row["guessed_at"],
        }
        for row in await cursor.fetchall()
    ]


async def _record_shared(
    db: aiosqlite.Connection,
    koop_id: str,
    player_token: str,
    word: str,
    rank: int,
    is_tip: bool,
) -> dict | None:
    """Insert a word into the shared list (idempotent on word) and roll up team state.

    Returns None if the token is not a member of this koop. On a duplicate word
    nothing is mutated and ``already_guessed`` is True.
    """
    cursor = await db.execute(
        "SELECT id, nickname FROM koop_players "
        "WHERE koop_id = ? AND player_token = ?",
        (koop_id, player_token),
    )
    player = await cursor.fetchone()
    if not player:
        return None

    # Idempotent on (koop_id, word): a duplicate word from any member is ignored.
    cursor = await db.execute(
        "INSERT OR IGNORE INTO koop_guesses "
        "(koop_id, player_token, nickname, word, rank, is_tip) VALUES (?, ?, ?, ?, ?, ?)",
        (koop_id, player_token, player["nickname"], word, rank, int(is_tip)),
    )
    is_new = cursor.rowcount == 1

    if is_new:
        await db.execute(
            "UPDATE koop_players SET contribution_count = contribution_count + 1 WHERE id = ?",
            (player["id"],),
        )
        # Roll up team state with atomic, commutative SQL, no read-modify-write,
        # so concurrent guesses from the 4 API workers can't lose an update.
        await db.execute(
            "UPDATE koops SET "
            "best_rank = CASE WHEN best_rank IS NULL OR ? < best_rank THEN ? ELSE best_rank END, "
            "last_activity = CURRENT_TIMESTAMP WHERE id = ?",
            (rank, rank, koop_id),
        )
        if rank == 1:
            # First solver wins solved_by; idempotent once solved.
            await db.execute(
                "UPDATE koops SET solved = 1, solved_by = COALESCE(solved_by, ?) WHERE id = ?",
                (player["nickname"], koop_id),
            )

    await db.commit()

    cursor = await db.execute(
        "SELECT solved, best_rank FROM koops WHERE id = ?", (koop_id,)
    )
    koop = await cursor.fetchone()
    return {
        "nickname": player["nickname"],
        "already_guessed": not is_new,
        "best_rank": koop["best_rank"],
        "solved": bool(koop["solved"]),
    }


async def record_koop_guess(
    db: aiosqlite.Connection,
    koop_id: str,
    player_token: str,
    word: str,
    rank: int,
) -> dict | None:
    return await _record_shared(db, koop_id, player_token, word, rank, is_tip=False)


async def record_koop_tip(
    db: aiosqlite.Connection,
    koop_id: str,
    player_token: str,
    word: str,
    rank: int,
) -> dict | None:
    return await _record_shared(db, koop_id, player_token, word, rank, is_tip=True)


async def give_up_koop(
    db: aiosqlite.Connection,
    koop_id: str,
    player_token: str,
    target_word: str,
) -> dict | None:
    """Reveal the solution for the whole team.

    Sets the team-wide ``gave_up`` flag (idempotent) and drops the solution into
    the shared list as a rank-1 entry so it persists and renders for everyone,
    even on a fresh page load. Returns None if the token is not a member.
    The contribution count is deliberately not bumped, because a reveal is not a guess.
    """
    cursor = await db.execute(
        "SELECT id, nickname FROM koop_players "
        "WHERE koop_id = ? AND player_token = ?",
        (koop_id, player_token),
    )
    player = await cursor.fetchone()
    if not player:
        return None

    await db.execute(
        "UPDATE koops SET gave_up = 1, last_activity = CURRENT_TIMESTAMP WHERE id = ?",
        (koop_id,),
    )
    await db.execute(
        "INSERT OR IGNORE INTO koop_guesses "
        "(koop_id, player_token, nickname, word, rank, is_tip) VALUES (?, ?, ?, ?, 1, 0)",
        (koop_id, player_token, player["nickname"], target_word),
    )
    await db.commit()
    return {"word": target_word, "nickname": player["nickname"], "gave_up": True}


async def advance_koop_game(db: aiosqlite.Connection, koop_id: str, pick_next) -> int | None:
    """Advance the koop to a fresh game on the same link.

    ``pick_next(current, played)`` returns the next game number (or None when no
    game is available). In one transaction the round counter is bumped, the new
    game set, the old game appended to the played history, the shared list wiped,
    and per-player + team state reset. Returns the new game number or None.
    """
    cursor = await db.execute(
        "SELECT game_number, played_games FROM koops WHERE id = ?", (koop_id,)
    )
    row = await cursor.fetchone()
    if not row:
        return None
    current = row["game_number"]
    played = _parse_played(row["played_games"])
    new_game = pick_next(current, played)
    if new_game is None:
        return None

    played_str = _format_played(played | {current})
    await db.execute(
        "UPDATE koops SET game_number = ?, round = round + 1, played_games = ?, "
        "solved = 0, solved_by = NULL, gave_up = 0, best_rank = NULL, "
        "last_activity = CURRENT_TIMESTAMP WHERE id = ?",
        (new_game, played_str, koop_id),
    )
    await db.execute("DELETE FROM koop_guesses WHERE koop_id = ?", (koop_id,))
    await db.execute(
        "UPDATE koop_players SET contribution_count = 0 WHERE koop_id = ?", (koop_id,)
    )
    await db.commit()
    return new_game


async def get_player_info(db: aiosqlite.Connection, player_token: str) -> dict | None:
    """Get a player's koop_id and nickname by token."""
    cursor = await db.execute(
        "SELECT koop_id, nickname FROM koop_players WHERE player_token = ?",
        (player_token,),
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


async def set_player_connected(
    db: aiosqlite.Connection, player_token: str, connected: bool
) -> str | None:
    """Set connection status. Returns koop_id or None if player not found."""
    cursor = await db.execute(
        "SELECT koop_id FROM koop_players WHERE player_token = ?",
        (player_token,),
    )
    row = await cursor.fetchone()
    if not row:
        return None

    koop_id = row["koop_id"]
    await db.execute(
        "UPDATE koop_players SET connected = ? WHERE player_token = ?",
        (connected, player_token),
    )

    if not connected:
        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM koop_players WHERE koop_id = ? AND connected = 1",
            (koop_id,),
        )
        result = await cursor.fetchone()
        if result["cnt"] == 0:
            await db.execute(
                "UPDATE koops SET last_activity = CURRENT_TIMESTAMP WHERE id = ?",
                (koop_id,),
            )

    await db.commit()
    return koop_id


async def cleanup_stale_koops(db: aiosqlite.Connection) -> int:
    """Delete koops with no connected players and last_activity > 1 hour ago."""
    cursor = await db.execute(
        "SELECT k.id FROM koops k "
        "LEFT JOIN koop_players kp ON k.id = kp.koop_id AND kp.connected = 1 "
        "WHERE kp.id IS NULL AND k.last_activity < datetime('now', '-1 hour')"
    )
    stale_ids = [row["id"] for row in await cursor.fetchall()]

    for koop_id in stale_ids:
        await db.execute("DELETE FROM koop_guesses WHERE koop_id = ?", (koop_id,))
        await db.execute("DELETE FROM koop_players WHERE koop_id = ?", (koop_id,))
        await db.execute("DELETE FROM koops WHERE id = ?", (koop_id,))

    await db.commit()
    return len(stale_ids)
