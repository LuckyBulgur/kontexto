"""Wordle duel CRUD operations."""

import json
import secrets
import string

import aiosqlite


def _generate_id(length: int = 6) -> str:
    chars = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def _generate_token() -> str:
    return secrets.token_urlsafe(32)


def _parse_played(raw: str) -> set[int]:
    """Parse the CSV of already-played game numbers stored on the duel row."""
    return {int(p) for p in raw.split(",") if p.strip().lstrip("-").isdigit()}


def _format_played(games: set[int]) -> str:
    return ",".join(str(n) for n in sorted(games))


async def create_wordle_duel(
    db: aiosqlite.Connection, nickname: str, game_number: int
) -> dict:
    duel_id = _generate_id()
    player_token = _generate_token()
    await db.execute(
        "INSERT INTO wordle_duels (id, game_number, created_by) VALUES (?, ?, ?)",
        (duel_id, game_number, nickname),
    )
    await db.execute(
        "INSERT INTO wordle_duel_players (duel_id, nickname, player_token) VALUES (?, ?, ?)",
        (duel_id, nickname, player_token),
    )
    await db.commit()
    return {"duel_id": duel_id, "player_token": player_token}


async def join_wordle_duel(
    db: aiosqlite.Connection, duel_id: str, nickname: str
) -> dict:
    player_token = _generate_token()
    cursor = await db.execute(
        "SELECT game_number FROM wordle_duels WHERE id = ?", (duel_id,)
    )
    row = await cursor.fetchone()
    if not row:
        raise ValueError("Duel not found")
    game_number = row["game_number"]

    # Ensure the nickname is unique within the duel: identity (self/opponent
    # boards) is keyed by nickname on the client, so collisions break the game.
    cursor = await db.execute(
        "SELECT nickname FROM wordle_duel_players WHERE duel_id = ?", (duel_id,)
    )
    taken = {r["nickname"] for r in await cursor.fetchall()}
    unique_nickname = nickname
    suffix = 2
    while unique_nickname in taken:
        unique_nickname = f"{nickname} ({suffix})"
        suffix += 1

    await db.execute(
        "INSERT INTO wordle_duel_players (duel_id, nickname, player_token) VALUES (?, ?, ?)",
        (duel_id, unique_nickname, player_token),
    )
    await db.commit()
    state = await get_wordle_duel_state(db, duel_id)
    return {
        "player_token": player_token,
        "nickname": unique_nickname,
        "players": state["players"],
        "game_number": game_number,
    }


async def record_wordle_guess(
    db: aiosqlite.Connection,
    duel_id: str,
    player_token: str,
    word: str,
    result: list[str],
) -> None:
    result_json = json.dumps(result)
    solved = all(c == "GREEN" for c in result)
    await db.execute(
        "INSERT INTO wordle_duel_guesses (duel_id, player_token, word, result) VALUES (?, ?, ?, ?)",
        (duel_id, player_token, word, result_json),
    )
    await db.execute(
        "UPDATE wordle_duel_players SET guesses_used = guesses_used + 1 "
        "WHERE duel_id = ? AND player_token = ?",
        (duel_id, player_token),
    )
    if solved:
        await db.execute(
            "UPDATE wordle_duel_players SET solved = 1 "
            "WHERE duel_id = ? AND player_token = ?",
            (duel_id, player_token),
        )
    await db.execute(
        "UPDATE wordle_duels SET last_activity = CURRENT_TIMESTAMP WHERE id = ?",
        (duel_id,),
    )
    await db.commit()


async def get_wordle_duel_state(db: aiosqlite.Connection, duel_id: str) -> dict:
    cursor = await db.execute(
        "SELECT game_number FROM wordle_duels WHERE id = ?", (duel_id,)
    )
    duel = await cursor.fetchone()
    if not duel:
        raise ValueError("Duel not found")
    cursor = await db.execute(
        "SELECT nickname, player_token, guesses_used, solved, connected "
        "FROM wordle_duel_players WHERE duel_id = ?",
        (duel_id,),
    )
    rows = await cursor.fetchall()
    players = []
    for r in rows:
        guess_cursor = await db.execute(
            "SELECT result FROM wordle_duel_guesses "
            "WHERE duel_id = ? AND player_token = ? ORDER BY id",
            (duel_id, r["player_token"]),
        )
        guess_rows = await guess_cursor.fetchall()
        players.append(
            {
                "nickname": r["nickname"],
                "guesses_used": r["guesses_used"],
                "solved": bool(r["solved"]),
                "connected": bool(r["connected"]),
                "results": [json.loads(g["result"]) for g in guess_rows],
            }
        )
    return {"game_number": duel["game_number"], "players": players}


async def is_wordle_duel_member(
    db: aiosqlite.Connection, duel_id: str, player_token: str
) -> bool:
    cursor = await db.execute(
        "SELECT 1 FROM wordle_duel_players WHERE duel_id = ? AND player_token = ?",
        (duel_id, player_token),
    )
    return await cursor.fetchone() is not None


async def advance_wordle_duel_game(
    db: aiosqlite.Connection, duel_id: str, pick_next
) -> int | None:
    """Advance the Wördle duel to a fresh game on the same link (rematch).

    ``pick_next(current, played)`` returns the next game number (or None). In one
    transaction the round counter is bumped, the new game set, the old game
    appended to the played history, both boards wiped and player stats reset.
    Returns the new game number or None.
    """
    cursor = await db.execute(
        "SELECT game_number, played_games FROM wordle_duels WHERE id = ?", (duel_id,)
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
        "UPDATE wordle_duels SET game_number = ?, round = round + 1, played_games = ?, "
        "last_activity = CURRENT_TIMESTAMP WHERE id = ?",
        (new_game, played_str, duel_id),
    )
    await db.execute("DELETE FROM wordle_duel_guesses WHERE duel_id = ?", (duel_id,))
    await db.execute(
        "UPDATE wordle_duel_players SET guesses_used = 0, solved = 0 WHERE duel_id = ?",
        (duel_id,),
    )
    await db.commit()
    return new_game


async def get_wordle_player_history(
    db: aiosqlite.Connection, duel_id: str, player_token: str
) -> list[dict]:
    cursor = await db.execute(
        "SELECT word, result, guessed_at FROM wordle_duel_guesses "
        "WHERE duel_id = ? AND player_token = ? ORDER BY id",
        (duel_id, player_token),
    )
    rows = await cursor.fetchall()
    return [
        {
            "word": r["word"],
            "result": json.loads(r["result"]),
            "guessed_at": str(r["guessed_at"]),
        }
        for r in rows
    ]


async def set_wordle_player_connected(
    db: aiosqlite.Connection, duel_id: str, player_token: str, connected: bool
) -> None:
    await db.execute(
        "UPDATE wordle_duel_players SET connected = ? "
        "WHERE duel_id = ? AND player_token = ?",
        (connected, duel_id, player_token),
    )
    await db.execute(
        "UPDATE wordle_duels SET last_activity = CURRENT_TIMESTAMP WHERE id = ?",
        (duel_id,),
    )
    await db.commit()


async def cleanup_stale_wordle_duels(db: aiosqlite.Connection) -> int:
    cursor = await db.execute("""
        DELETE FROM wordle_duels WHERE id IN (
            SELECT d.id FROM wordle_duels d
            WHERE d.last_activity < datetime('now', '-1 hour')
            AND NOT EXISTS (
                SELECT 1 FROM wordle_duel_players p
                WHERE p.duel_id = d.id AND p.connected = 1
            )
        )
    """)
    count = cursor.rowcount
    await db.commit()
    return count
