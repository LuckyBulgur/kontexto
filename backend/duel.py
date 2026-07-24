"""Duel CRUD operations."""

import secrets
import string

import aiosqlite


def _generate_id(length: int = 6) -> str:
    chars = string.ascii_letters + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


def _parse_played(raw: str) -> set[int]:
    """Parse the CSV of already-played game numbers stored on the duel row."""
    return {int(p) for p in raw.split(",") if p.strip().lstrip("-").isdigit()}


def _format_played(games: set[int]) -> str:
    return ",".join(str(n) for n in sorted(games))


async def create_duel(
    db: aiosqlite.Connection,
    game_number: int,
    nickname: str,
    tips_allowed: bool,
) -> dict:
    duel_id = _generate_id()
    player_token = _generate_token()

    await db.execute(
        "INSERT INTO duels (id, game_number, created_by, tips_allowed) VALUES (?, ?, ?, ?)",
        (duel_id, game_number, nickname, tips_allowed),
    )
    await db.execute(
        "INSERT INTO duel_players (duel_id, nickname, player_token) VALUES (?, ?, ?)",
        (duel_id, nickname, player_token),
    )
    await db.commit()
    return {"duel_id": duel_id, "player_token": player_token}


async def join_duel(db: aiosqlite.Connection, duel_id: str, nickname: str) -> dict | None:
    cursor = await db.execute("SELECT id FROM duels WHERE id = ?", (duel_id,))
    if not await cursor.fetchone():
        return None

    player_token = _generate_token()
    await db.execute(
        "INSERT INTO duel_players (duel_id, nickname, player_token) VALUES (?, ?, ?)",
        (duel_id, nickname, player_token),
    )
    await db.commit()

    state = await get_duel_state(db, duel_id)
    return {"player_token": player_token, **state}


async def get_duel_state(db: aiosqlite.Connection, duel_id: str) -> dict | None:
    cursor = await db.execute("SELECT * FROM duels WHERE id = ?", (duel_id,))
    duel = await cursor.fetchone()
    if not duel:
        return None

    cursor = await db.execute(
        "SELECT nickname, best_rank, guess_count, tip_count, solved, connected "
        "FROM duel_players WHERE duel_id = ?",
        (duel_id,),
    )
    players = [
        {
            "nickname": row["nickname"],
            "best_rank": row["best_rank"],
            "guess_count": row["guess_count"],
            "tip_count": row["tip_count"],
            "solved": bool(row["solved"]),
            "connected": bool(row["connected"]),
        }
        for row in await cursor.fetchall()
    ]

    return {
        "duel_id": duel_id,
        "game_number": duel["game_number"],
        "tips_allowed": bool(duel["tips_allowed"]),
        "players": players,
    }


async def record_guess(
    db: aiosqlite.Connection,
    duel_id: str,
    player_token: str,
    word: str,
    rank: int,
) -> dict | None:
    cursor = await db.execute(
        "SELECT id, best_rank, guess_count, nickname FROM duel_players "
        "WHERE duel_id = ? AND player_token = ?",
        (duel_id, player_token),
    )
    player = await cursor.fetchone()
    if not player:
        return None

    await db.execute(
        "INSERT INTO duel_guesses (duel_id, player_token, word, rank) VALUES (?, ?, ?, ?)",
        (duel_id, player_token, word, rank),
    )

    new_best = rank if player["best_rank"] is None else min(player["best_rank"], rank)
    new_count = player["guess_count"] + 1
    solved = rank == 1

    await db.execute(
        "UPDATE duel_players SET best_rank = ?, guess_count = ?, solved = ? WHERE id = ?",
        (new_best, new_count, solved, player["id"]),
    )
    await db.commit()

    return {
        "nickname": player["nickname"],
        "best_rank": new_best,
        "guess_count": new_count,
        "solved": solved,
    }


async def record_tip(
    db: aiosqlite.Connection,
    duel_id: str,
    player_token: str,
    word: str,
    rank: int,
) -> dict | None:
    cursor = await db.execute(
        "SELECT id, best_rank, guess_count, tip_count, nickname FROM duel_players "
        "WHERE duel_id = ? AND player_token = ?",
        (duel_id, player_token),
    )
    player = await cursor.fetchone()
    if not player:
        return None

    await db.execute(
        "INSERT INTO duel_guesses (duel_id, player_token, word, rank) VALUES (?, ?, ?, ?)",
        (duel_id, player_token, word, rank),
    )

    new_best = rank if player["best_rank"] is None else min(player["best_rank"], rank)
    new_count = player["guess_count"] + 1
    new_tip_count = player["tip_count"] + 1
    solved = rank == 1

    await db.execute(
        "UPDATE duel_players SET best_rank = ?, guess_count = ?, tip_count = ?, solved = ? WHERE id = ?",
        (new_best, new_count, new_tip_count, solved, player["id"]),
    )
    await db.commit()

    return {
        "nickname": player["nickname"],
        "best_rank": new_best,
        "guess_count": new_count,
        "tip_count": new_tip_count,
        "solved": solved,
    }


async def advance_duel_game(db: aiosqlite.Connection, duel_id: str, pick_next) -> int | None:
    """Advance the duel to a fresh game on the same link (rematch).

    ``pick_next(current, played)`` returns the next game number (or None). In one
    transaction the round counter is bumped, the new game set, the old game
    appended to the played history, both players' guesses wiped and their stats
    reset. Returns the new game number or None.
    """
    cursor = await db.execute(
        "SELECT game_number, played_games FROM duels WHERE id = ?", (duel_id,)
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
        "UPDATE duels SET game_number = ?, round = round + 1, played_games = ?, "
        "last_activity = CURRENT_TIMESTAMP WHERE id = ?",
        (new_game, played_str, duel_id),
    )
    await db.execute("DELETE FROM duel_guesses WHERE duel_id = ?", (duel_id,))
    await db.execute(
        "UPDATE duel_players SET best_rank = NULL, guess_count = 0, tip_count = 0, "
        "solved = 0 WHERE duel_id = ?",
        (duel_id,),
    )
    await db.commit()
    return new_game


async def get_player_history(
    db: aiosqlite.Connection, duel_id: str, player_token: str
) -> list[dict]:
    cursor = await db.execute(
        "SELECT word, rank, guessed_at FROM duel_guesses "
        "WHERE duel_id = ? AND player_token = ? ORDER BY id",
        (duel_id, player_token),
    )
    return [dict(row) for row in await cursor.fetchall()]


async def get_player_info(db: aiosqlite.Connection, player_token: str) -> dict | None:
    """Get player's duel_id, nickname, and stats by token."""
    cursor = await db.execute(
        "SELECT duel_id, nickname, best_rank, guess_count, tip_count, solved "
        "FROM duel_players WHERE player_token = ?",
        (player_token,),
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


async def set_player_connected(
    db: aiosqlite.Connection, player_token: str, connected: bool
) -> str | None:
    """Set connection status. Returns duel_id or None if player not found."""
    cursor = await db.execute(
        "SELECT duel_id FROM duel_players WHERE player_token = ?",
        (player_token,),
    )
    row = await cursor.fetchone()
    if not row:
        return None

    duel_id = row["duel_id"]
    await db.execute(
        "UPDATE duel_players SET connected = ? WHERE player_token = ?",
        (connected, player_token),
    )

    if not connected:
        cursor = await db.execute(
            "SELECT COUNT(*) as cnt FROM duel_players WHERE duel_id = ? AND connected = 1",
            (duel_id,),
        )
        result = await cursor.fetchone()
        if result["cnt"] == 0:
            await db.execute(
                "UPDATE duels SET last_activity = CURRENT_TIMESTAMP WHERE id = ?",
                (duel_id,),
            )

    await db.commit()
    return duel_id


async def cleanup_stale_duels(db: aiosqlite.Connection) -> int:
    """Delete duels with no connected players and last_activity > 1 hour ago."""
    cursor = await db.execute(
        "SELECT d.id FROM duels d "
        "LEFT JOIN duel_players dp ON d.id = dp.duel_id AND dp.connected = 1 "
        "WHERE dp.id IS NULL AND d.last_activity < datetime('now', '-1 hour')"
    )
    stale_ids = [row["id"] for row in await cursor.fetchall()]

    for duel_id in stale_ids:
        await db.execute("DELETE FROM duel_guesses WHERE duel_id = ?", (duel_id,))
        await db.execute("DELETE FROM duel_players WHERE duel_id = ?", (duel_id,))
        await db.execute("DELETE FROM duels WHERE id = ?", (duel_id,))

    await db.commit()
    return len(stale_ids)
