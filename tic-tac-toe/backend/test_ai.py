import unittest
from app import get_best_move, check_winner

class TestTicTacToeAI(unittest.TestCase):
    def test_winning_move_row(self):
        # AI is 'O'. AI can win on index 2 (row 0: O, O, _)
        board = [
            "O", "O", "",
            "X", "X", "",
            "", "", ""
        ]
        move = get_best_move(board, ai_player="O", human_player="X")
        self.assertEqual(move, 2, f"AI should have played at index 2 to win, but got {move}")

    def test_winning_move_diagonal(self):
        # AI is 'X'. AI can win on index 8 (diag: X, X, _)
        board = [
            "X", "", "",
            "O", "X", "",
            "O", "", ""
        ]
        move = get_best_move(board, ai_player="X", human_player="O")
        self.assertEqual(move, 8, f"AI should have played at index 8 to win, but got {move}")

    def test_blocking_move(self):
        # AI is 'O', Human is 'X'. Human is about to win on index 6 (col 0: X, X, _)
        # AI must block on 6.
        board = [
            "X", "", "",
            "X", "O", "",
            "", "", ""
        ]
        move = get_best_move(board, ai_player="O", human_player="X")
        self.assertEqual(move, 6, f"AI should have blocked at index 6, but got {move}")

    def test_double_threat_block(self):
        # AI is 'O'. Human is 'X'.
        # Player plays corner X (0), AI plays center O (4), Player plays corner X (8).
        # Board:
        # X . .
        # . O .
        # . . X
        # To avoid double threat, AI must play a side edge (1, 3, 5, or 7) rather than a corner.
        # If AI plays corner (e.g., 2), player plays 6 and wins on the next turn.
        board = [
            "X", "", "",
            "", "O", "",
            "", "", "X"
        ]
        move = get_best_move(board, ai_player="O", human_player="X")
        self.assertIn(move, [1, 3, 5, 7], f"AI should have played on an edge to prevent double threat, but got {move}")

if __name__ == "__main__":
    unittest.main()
