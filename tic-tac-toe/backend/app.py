import random
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
# Enable CORS for all routes to allow frontend requests
CORS(app)

WIN_COMBINATIONS = [
    (0, 1, 2), (3, 4, 5), (6, 7, 8),  # Rows
    (0, 3, 6), (1, 4, 7), (2, 5, 8),  # Columns
    (0, 4, 8), (2, 4, 6)              # Diagonals
]

def check_winner(board):
    """
    Checks if there is a winner.
    Returns 'X', 'O' if someone won, 'Draw' if the board is full and no winner, or None if the game is still active.
    """
    for a, b, c in WIN_COMBINATIONS:
        if board[a] and board[a] == board[b] == board[c]:
            return board[a]
    if all(cell != "" and cell is not None for cell in board):
        return "Draw"
    return None

def evaluate(board, ai_player, human_player):
    """
    Evaluates the board state.
    Returns +10 if AI wins, -10 if Human wins, 0 for Draw, or None if not terminal.
    """
    winner = check_winner(board)
    if winner == ai_player:
        return 10
    elif winner == human_player:
        return -10
    elif winner == "Draw":
        return 0
    return None

def minimax(board, depth, is_maximizing, ai_player, human_player, alpha, beta):
    """
    Minimax search with Alpha-Beta Pruning.
    """
    score = evaluate(board, ai_player, human_player)
    if score is not None:
        # Subtract/add depth to favor quicker wins or longer survival
        if score == 10:
            return score - depth
        elif score == -10:
            return score + depth
        return score

    if is_maximizing:
        best_score = -float('inf')
        for i in range(9):
            if board[i] == "" or board[i] is None:
                board[i] = ai_player
                eval_score = minimax(board, depth + 1, False, ai_player, human_player, alpha, beta)
                board[i] = ""
                best_score = max(best_score, eval_score)
                alpha = max(alpha, eval_score)
                if beta <= alpha:
                    break  # Beta cutoff
        return best_score
    else:
        best_score = float('inf')
        for i in range(9):
            if board[i] == "" or board[i] is None:
                board[i] = human_player
                eval_score = minimax(board, depth + 1, True, ai_player, human_player, alpha, beta)
                board[i] = ""
                best_score = min(best_score, eval_score)
                beta = min(beta, eval_score)
                if beta <= alpha:
                    break  # Alpha cutoff
        return best_score

def get_best_move(board, ai_player, human_player):
    """
    Calculates the absolute best move for the AI.
    """
    best_score = -float('inf')
    best_move = -1
    
    # If board is empty, pick the center or a corner for speed and good opening play
    empty_cells = [i for i, cell in enumerate(board) if cell == "" or cell is None]
    if len(empty_cells) == 9:
        # Center or random corner is mathematically excellent for Tic-Tac-Toe
        return random.choice([4, 0, 2, 6, 8])

    for i in range(9):
        if board[i] == "" or board[i] is None:
            board[i] = ai_player
            move_score = minimax(board, 0, False, ai_player, human_player, -float('inf'), float('inf'))
            board[i] = ""
            if move_score > best_score:
                best_score = move_score
                best_move = i
                
    return best_move

@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({"status": "ok", "message": "Tic-Tac-Toe AI Backend is running."})

@app.route('/api/move', methods=['POST'])
def make_move():
    data = request.get_json() or {}
    
    board = data.get('board')
    ai_player = data.get('ai_player', 'O')
    difficulty = data.get('difficulty', 'unbeatable')
    
    if not board or len(board) != 9:
        return jsonify({"error": "Invalid board state. Must be a list of 9 elements."}), 400
        
    human_player = 'O' if ai_player == 'X' else 'X'
    
    # Normalize board cells (convert null/None to "")
    normalized_board = [cell if cell is not None else "" for cell in board]
    
    empty_cells = [i for i, cell in enumerate(normalized_board) if cell == ""]
    if not empty_cells:
        return jsonify({"error": "Board is full. No moves available."}), 400
        
    # Check if game is already over
    if check_winner(normalized_board) is not None:
        return jsonify({"error": "Game is already over."}), 400

    # Determine move based on difficulty
    if difficulty == 'easy':
        # Easy: random move
        move = random.choice(empty_cells)
    elif difficulty == 'medium':
        # Medium: 50% chance of best move, 50% chance of random move
        if random.random() < 0.5:
            move = get_best_move(normalized_board, ai_player, human_player)
        else:
            move = random.choice(empty_cells)
    else:
        # Unbeatable (default): Best move computed via Minimax
        move = get_best_move(normalized_board, ai_player, human_player)
        
    return jsonify({
        "move": move,
        "difficulty": difficulty,
        "ai_player": ai_player
    })

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
