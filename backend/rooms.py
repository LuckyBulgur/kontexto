"""What a room may tell its own players about the puzzle, and when.

The game number is not a label, it is the answer. ``/api/reveal``,
``/api/closest`` and ``/api/wordle/reveal`` hand out the target word for any
number without asking who is calling, and that is deliberate: a solo player is
allowed to spoil their own game. In a room the same number is the opponent's
secret, so one number plus one open endpoint is a working cheat.

Hence the boundary that lives here: no room response and no socket frame carries
``game_number`` or the target while that round is open. Clients key their round
resets on the ``round`` counter, which every room table already has, and the
number comes back together with the word from the reveal endpoint of that mode,
once the caller's own round is over. Who is over is a per-mode question, so each
room module answers it in its own ``reveal_context``; this module only holds the
refusal and its wording.
"""


class RoomRevealRefused(Exception):
    """A reveal that must not happen yet, or not for this caller.

    ``code`` is the machine-readable reason; ``ROOM_REVEAL_MESSAGES`` holds the
    sentence the player reads.
    """

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


ROOM_REVEAL_MESSAGES = {
    "room_not_found": "Diese Runde gibt es nicht",
    "player_not_found": "Spieler nicht gefunden",
    # Deliberately not "du darfst noch nicht": a player who probes this endpoint
    # learns only that the round is still going, which they already knew.
    "round_open": "Die Runde läuft noch",
}
