"""Koop (cooperative Kontexto) CRUD operations.

Unlike the duel, all players share ONE de-duplicated guess list and win together
the moment anyone reaches rank 1. The shared list is enforced on the DB via
UNIQUE(koop_id, word); solved/solved_by/best_rank live on the koop row so the
WebSocket poller and state endpoint can read the team's progress in one place.
"""

import secrets
import string

import aiosqlite

from categories import decode_filter, encode_filter
from live_chat import parse_badge_tag
from nicknames import sanitize_nickname
from rooms import RoomRevealRefused


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
    categories: list[str] | None = None,
    show_category: bool = False,
) -> dict:
    # One rule for every room, invite links included: an abusive name is not
    # rejected, it comes back masked and pointed at its author.
    nickname = sanitize_nickname(nickname)
    koop_id = _generate_id()
    player_token = _generate_token()

    await db.execute(
        "INSERT INTO koops (id, game_number, created_by, tips_allowed, categories, show_category) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (koop_id, game_number, nickname, tips_allowed, encode_filter(categories or []), show_category),
    )
    await db.execute(
        "INSERT INTO koop_players (koop_id, nickname, player_token) VALUES (?, ?, ?)",
        (koop_id, nickname, player_token),
    )
    await db.commit()
    return {"koop_id": koop_id, "player_token": player_token}


# How many people may join one live room through its guest link. A link that
# leaked onto the stream must not turn into hundreds of player rows and one
# player_joined frame each on the host's socket.
MAX_LIVE_GUESTS = 12


class KoopFull(Exception):
    """The live room already holds MAX_LIVE_GUESTS guests."""


def join_secret_matches(stored: str | None, offered: str | None) -> bool:
    """Whether a join may pass the room's secret. No secret, no check."""
    if stored is None:
        return True
    return secrets.compare_digest(stored.encode(), (offered or "").encode())


async def join_koop(
    db: aiosqlite.Connection, koop_id: str, nickname: str, invite: str | None = None
) -> dict | None:
    """Add a player to a koop. None for an unknown room or a wrong secret.

    The two refusals are one on purpose: a live room's id is on stream, and an
    answer that told "no such room" from "wrong link" would confirm the id to
    whoever is probing it. Raises KoopFull when a live room has no guest seat
    left.
    """
    cursor = await db.execute("SELECT join_secret FROM koops WHERE id = ?", (koop_id,))
    koop = await cursor.fetchone()
    if not koop or not join_secret_matches(koop["join_secret"], invite):
        return None
    guest = koop["join_secret"] is not None

    # One rule for every room, invite links included: an abusive name is not
    # rejected, it comes back masked and pointed at its author.
    nickname = sanitize_nickname(nickname)
    player_token = _generate_token()
    unique = await _unique_nickname(db, koop_id, nickname)
    # The seat count sits inside the INSERT, so two joins racing for the last
    # seat cannot both take it: SQLite runs one write at a time.
    cursor = await db.execute(
        "INSERT INTO koop_players (koop_id, nickname, player_token, guest) "
        "SELECT ?, ?, ?, ? WHERE NOT ? OR "
        "(SELECT COUNT(*) FROM koop_players WHERE koop_id = ? AND guest = 1) < ?",
        (koop_id, unique, player_token, int(guest), int(guest), koop_id, MAX_LIVE_GUESTS),
    )
    if cursor.rowcount == 0:
        await db.rollback()
        raise KoopFull()
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

    # game_number rides along for the handlers and is stripped at the HTTP
    # boundary by KoopStateResponse. See rooms.py.
    return {
        "koop_id": koop_id,
        "game_number": koop["game_number"],
        "round": koop["round"],
        "tips_allowed": bool(koop["tips_allowed"]),
        "solved": bool(koop["solved"]),
        "solved_by": koop["solved_by"],
        "gave_up": bool(koop["gave_up"]),
        "best_rank": koop["best_rank"],
        "categories": decode_filter(koop["categories"]),
        "show_category": bool(koop["show_category"]),
        "players": players,
    }


async def get_koop_guesses(db: aiosqlite.Connection, koop_id: str) -> list[dict]:
    """The shared, de-duplicated guess list, oldest first."""
    cursor = await db.execute(
        "SELECT nickname, word, rank, is_tip, guessed_at, source, badges FROM koop_guesses "
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
            "source": row["source"],
            "badges": [
                {"set_id": badge.set_id, "version": badge.version}
                for badge in parse_badge_tag(row["badges"])
            ],
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
    display_name: str | None = None,
    source: str | None = None,
    badges: str | None = None,
) -> dict | None:
    """Insert a word into the shared list (idempotent on word) and roll up team state.

    Returns None if the token is not a member of this koop. On a duplicate word
    nothing is mutated and ``already_guessed`` is True.

    ``display_name`` overrides the name written next to the word and into
    ``solved_by``. It exists for the live chat mode, where one room has a single
    player row (the host) but the guesses come from thousands of viewers who must
    not each become a player row. Everywhere else it stays None and the player's
    own nickname is used, which is what every other caller wants.

    ``source`` names the chat a live room's guess came from (``twitch``,
    ``tiktok``) and stays None for a person at a keyboard; ``badges`` is the
    author's chat badges in the column form of ``live_chat.encode_badges``.
    """
    cursor = await db.execute(
        "SELECT id, nickname FROM koop_players "
        "WHERE koop_id = ? AND player_token = ?",
        (koop_id, player_token),
    )
    player = await cursor.fetchone()
    if not player:
        return None

    shown_name = display_name or player["nickname"]

    # Idempotent on (koop_id, word): a duplicate word from any member is ignored.
    cursor = await db.execute(
        "INSERT OR IGNORE INTO koop_guesses "
        "(koop_id, player_token, nickname, word, rank, is_tip, source, badges) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (koop_id, player_token, shown_name, word, rank, int(is_tip), source, badges),
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
                (shown_name, koop_id),
            )

    await db.commit()

    cursor = await db.execute(
        "SELECT solved, best_rank FROM koops WHERE id = ?", (koop_id,)
    )
    koop = await cursor.fetchone()
    # The row id lets an in-process writer push this guess to the sockets at
    # once and move the broadcast loop's high-water mark past it.
    guess_id = None
    if is_new:
        cursor = await db.execute(
            "SELECT id FROM koop_guesses WHERE koop_id = ? AND word = ?",
            (koop_id, word),
        )
        row = await cursor.fetchone()
        guess_id = row["id"] if row else None
    return {
        "nickname": shown_name,
        "already_guessed": not is_new,
        "best_rank": koop["best_rank"],
        "solved": bool(koop["solved"]),
        "guess_id": guess_id,
    }


async def record_koop_guess(
    db: aiosqlite.Connection,
    koop_id: str,
    player_token: str,
    word: str,
    rank: int,
    display_name: str | None = None,
    source: str | None = None,
    badges: str | None = None,
) -> dict | None:
    return await _record_shared(
        db, koop_id, player_token, word, rank, is_tip=False,
        display_name=display_name, source=source, badges=badges,
    )


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
    cursor = await db.execute(
        "SELECT game_number, round FROM koops WHERE id = ?", (koop_id,)
    )
    koop = await cursor.fetchone()
    await db.commit()
    return {
        "word": target_word,
        "nickname": player["nickname"],
        "gave_up": True,
        "game_number": koop["game_number"],
        "round": koop["round"],
    }


async def reveal_context(
    db: aiosqlite.Connection, koop_id: str, player_token: str
) -> dict:
    """What a koop member may be told about the puzzle, or a refusal.

    A koop is one team on one board, so the round is over for everybody at the
    same moment: solved by anyone, or given up by anyone.
    """
    cursor = await db.execute(
        "SELECT game_number, round, solved, gave_up FROM koops WHERE id = ?",
        (koop_id,),
    )
    koop = await cursor.fetchone()
    if not koop:
        raise RoomRevealRefused("room_not_found")

    cursor = await db.execute(
        "SELECT 1 FROM koop_players WHERE koop_id = ? AND player_token = ?",
        (koop_id, player_token),
    )
    if not await cursor.fetchone():
        raise RoomRevealRefused("player_not_found")
    if not (koop["solved"] or koop["gave_up"]):
        raise RoomRevealRefused("round_open")

    return {"game_number": koop["game_number"], "round": koop["round"]}


class KoopRoundChanged(Exception):
    """The room left the round the caller asked to advance from.

    Somebody else pressed "Nächstes Spiel" first: a teammate, a second tab of
    the same host, or the live room's automatic start racing a manual click.
    Advancing again would skip a round nobody played.
    """


async def advance_koop_game(
    db: aiosqlite.Connection,
    koop_id: str,
    pick_next,
    expected_round: int | None = None,
) -> int | None:
    """Advance the koop to a fresh game on the same link.

    ``pick_next(current, played)`` returns the next game number (or None when no
    game is available). In one transaction the round counter is bumped, the new
    game set, the old game appended to the played history, the shared list wiped,
    and per-player + team state reset. Returns the new game number or None.

    With ``expected_round`` the advance only happens from that round and raises
    ``KoopRoundChanged`` otherwise. The round guard sits in the UPDATE itself,
    because the five workers share nothing but this file and two requests can
    both read the same round before either writes.
    """
    cursor = await db.execute(
        "SELECT game_number, played_games, round FROM koops WHERE id = ?", (koop_id,)
    )
    row = await cursor.fetchone()
    if not row:
        return None
    if expected_round is not None and row["round"] != expected_round:
        raise KoopRoundChanged()
    current = row["game_number"]
    played = _parse_played(row["played_games"])
    new_game = pick_next(current, played)
    if new_game is None:
        return None

    played_str = _format_played(played | {current})
    cursor = await db.execute(
        "UPDATE koops SET game_number = ?, round = round + 1, played_games = ?, "
        "solved = 0, solved_by = NULL, gave_up = 0, best_rank = NULL, "
        "last_activity = CURRENT_TIMESTAMP WHERE id = ? AND round = ?",
        (new_game, played_str, koop_id, row["round"]),
    )
    if cursor.rowcount == 0:
        await db.rollback()
        raise KoopRoundChanged()
    await db.execute("DELETE FROM koop_guesses WHERE koop_id = ?", (koop_id,))
    await db.execute(
        "UPDATE koop_players SET contribution_count = 0 WHERE koop_id = ?", (koop_id,)
    )
    await db.commit()
    return new_game


async def is_guest(db: aiosqlite.Connection, koop_id: str, player_token: str) -> bool:
    """Whether this token joined the room through a live guest link."""
    cursor = await db.execute(
        "SELECT 1 FROM koop_players WHERE koop_id = ? AND player_token = ? AND guest = 1",
        (koop_id, player_token),
    )
    return await cursor.fetchone() is not None


async def count_guests(db: aiosqlite.Connection, koop_id: str) -> int:
    cursor = await db.execute(
        "SELECT COUNT(*) AS n FROM koop_players WHERE koop_id = ? AND guest = 1", (koop_id,)
    )
    row = await cursor.fetchone()
    return row["n"]


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
        # Live chat mode hangs more child tables off a koop room. Deleted by
        # hand like the others, because this routine does not rely on the foreign
        # keys: an older database file may predate a table's REFERENCES clause.
        await db.execute("DELETE FROM live_host_messages WHERE koop_id = ?", (koop_id,))
        await db.execute("DELETE FROM live_viewers WHERE koop_id = ?", (koop_id,))
        await db.execute("DELETE FROM live_events WHERE koop_id = ?", (koop_id,))
        await db.execute("DELETE FROM live_channels WHERE koop_id = ?", (koop_id,))
        await db.execute("DELETE FROM live_rooms WHERE koop_id = ?", (koop_id,))
        await db.execute("DELETE FROM koops WHERE id = ?", (koop_id,))

    await db.commit()
    return len(stale_ids)
