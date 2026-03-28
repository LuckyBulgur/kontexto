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
    await db.execute(
        "INSERT INTO wordle_duel_players (duel_id, nickname, player_token) VALUES (?, ?, ?)",
        (duel_id, nickname, player_token),
    )
    await db.commit()
    state = await get_wordle_duel_state(db, duel_id)
    return {
        "player_token": player_token,
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
        "SELECT nickname, guesses_used, solved, connected "
        "FROM wordle_duel_players WHERE duel_id = ?",
        (duel_id,),
    )
    rows = await cursor.fetchall()
    players = [
        {
            "nickname": r["nickname"],
            "guesses_used": r["guesses_used"],
            "solved": bool(r["solved"]),
            "connected": bool(r["connected"]),
        }
        for r in rows
    ]
    return {"game_number": duel["game_number"], "players": players}


async def get_wordle_player_history(
    db: aiosqlite.Connection, duel_id: str, player_token: str
) -> list[dict]:
    cursor = await db.execute(
        "SELECT word, result, guessed_at FROM wordle_duel_guesses "
        "WHERE duel_id = ? AND player_token = ? ORDER BY guessed_at",
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
