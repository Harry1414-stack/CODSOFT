import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Home, AlertCircle, Cpu, User } from 'lucide-react';

// ── Preset theme colours ──────────────────────────────────────────────────────
const THEMES = [
  { name: 'Cyber Blue',      color: '#3b82f6', glow: 'rgba(59,130,246,0.4)'  },
  { name: 'Neon Pink',       color: '#ec4899', glow: 'rgba(236,72,153,0.4)'  },
  { name: 'Toxic Green',     color: '#10b981', glow: 'rgba(16,185,129,0.4)'  },
  { name: 'Sunset Orange',   color: '#f97316', glow: 'rgba(249,115,22,0.4)'  },
  { name: 'Electric Purple', color: '#8b5cf6', glow: 'rgba(139,92,246,0.4)'  },
];

// ── Win combinations (indices 0-8 of the 3x3 grid) ───────────────────────────
const WIN_COMBOS = [
  [0,1,2],[3,4,5],[6,7,8],   // rows
  [0,3,6],[1,4,7],[2,5,8],   // cols
  [0,4,8],[2,4,6],           // diagonals
];

// ── SVG win-line coordinates (normalised 0-100 in board space) ────────────────
// Board has 3 cells + 2 gaps.  Each cell = 100/3 ≈ 33.3 units.
// Cell centres: col 0→16.7, col 1→50, col 2→83.3
//              row 0→16.7, row 1→50, row 2→83.3
const WIN_LINE_COORDS = [
  { x1:  5, y1: 16.7, x2: 95, y2: 16.7 }, // row 0
  { x1:  5, y1: 50,   x2: 95, y2: 50   }, // row 1
  { x1:  5, y1: 83.3, x2: 95, y2: 83.3 }, // row 2
  { x1: 16.7, y1:  5, x2: 16.7, y2: 95 }, // col 0
  { x1: 50,   y1:  5, x2: 50,   y2: 95 }, // col 1
  { x1: 83.3, y1:  5, x2: 83.3, y2: 95 }, // col 2
  { x1:  5, y1:  5,  x2: 95, y2: 95   }, // diag \
  { x1: 95, y1:  5,  x2:  5, y2: 95   }, // diag /
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function checkWinner(board) {
  for (let i = 0; i < WIN_COMBOS.length; i++) {
    const [a, b, c] = WIN_COMBOS[i];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { symbol: board[a], lineIdx: i };
    }
  }
  if (board.every(c => c !== '')) return { symbol: 'Draw', lineIdx: -1 };
  return null;
}

// ── Client-side Minimax (offline fallback) ────────────────────────────────────
function evaluate(board, ai, human) {
  for (const [a, b, c] of WIN_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] === ai ? 10 : -10;
    }
  }
  if (board.every(c => c !== '')) return 0;
  return null;
}

function minimax(board, depth, isMax, ai, human, alpha, beta) {
  const score = evaluate(board, ai, human);
  if (score !== null) {
    if (score === 10)  return score - depth;
    if (score === -10) return score + depth;
    return score;
  }
  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = ai;
        best = Math.max(best, minimax(board, depth+1, false, ai, human, alpha, beta));
        board[i] = '';
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = human;
        best = Math.min(best, minimax(board, depth+1, true, ai, human, alpha, beta));
        board[i] = '';
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  }
}

function bestLocalMove(board, ai, human, difficulty) {
  const empty = board.map((c,i) => c==='' ? i : null).filter(x => x!==null);
  if (!empty.length) return -1;

  if (difficulty === 'easy') return empty[Math.floor(Math.random()*empty.length)];
  if (difficulty === 'medium' && Math.random() < 0.5) return empty[Math.floor(Math.random()*empty.length)];

  if (empty.length === 9) return [4,0,2,6,8][Math.floor(Math.random()*5)];

  let best = -Infinity, move = -1;
  for (const i of empty) {
    board[i] = ai;
    const s = minimax(board, 0, false, ai, human, -Infinity, Infinity);
    board[i] = '';
    if (s > best) { best = s; move = i; }
  }
  return move;
}

// ── Sound helper ──────────────────────────────────────────────────────────────
let audioCtx = null;
function playSound(type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(110, now+0.1);
      gain.gain.setValueAtTime(0.07, now); gain.gain.linearRampToValueAtTime(0, now+0.1);
      osc.start(); osc.stop(now+0.1);
    } else if (type === 'win') {
      osc.type = 'triangle';
      [523.25, 659.25, 783.99].forEach((f,i) => osc.frequency.setValueAtTime(f, now+i*0.1));
      gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now+0.5);
      osc.start(); osc.stop(now+0.5);
    } else if (type === 'lose') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now); osc.frequency.linearRampToValueAtTime(140, now+0.35);
      gain.gain.setValueAtTime(0.08, now); gain.gain.linearRampToValueAtTime(0, now+0.35);
      osc.start(); osc.stop(now+0.35);
    } else if (type === 'draw') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, now); osc.frequency.setValueAtTime(294, now+0.18);
      gain.gain.setValueAtTime(0.08, now); gain.gain.linearRampToValueAtTime(0, now+0.38);
      osc.start(); osc.stop(now+0.38);
    }
  } catch(_) {}
}

// ── SVG Mark Components ───────────────────────────────────────────────────────
function XMark() {
  return (
    <svg className="cell-svg" viewBox="0 0 100 100">
      <path className="x-line-1" d="M22,22 L78,78" />
      <path className="x-line-2" d="M78,22 L22,78" />
    </svg>
  );
}

function OMark() {
  // r=32 → circumference = 2π×32 ≈ 201.1 — use 202 in CSS
  return (
    <svg className="cell-svg" viewBox="0 0 100 100">
      <circle className="o-circle" cx="50" cy="50" r="32" />
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function App() {
  // ─ State ──────────────────────────────────────────────────────────────────
  const [screen,      setScreen]      = useState('setup'); // 'setup' | 'game'
  const [board,       setBoard]       = useState(Array(9).fill(''));
  const [playerMark,  setPlayerMark]  = useState('X');
  const [aiMark,      setAiMark]      = useState('O');
  const [currentTurn, setCurrentTurn] = useState('X');
  const [difficulty,  setDifficulty]  = useState('unbeatable');
  const [result,      setResult]      = useState(null);  // null | { symbol, lineIdx }
  const [scores,      setScores]      = useState(() => {
    try { return JSON.parse(localStorage.getItem('ttt_scores')) || {p:0,ai:0,d:0}; }
    catch { return {p:0,ai:0,d:0}; }
  });
  const [theme,       setTheme]       = useState(THEMES[0]);
  const [customColor, setCustomColor] = useState('#3b82f6');
  const [serverOnline,setServerOnline]= useState(false);
  const [aiThinking,  setAiThinking]  = useState(false);
  const [doodles]     = useState(() => Array.from({length:16},(_,i) => ({
    id:i, type: i%2===0 ? 'X' : 'O',
    top:  `${5 + Math.random()*88}%`,
    left: `${2 + Math.random()*94}%`,
    size: `${28+Math.random()*36}px`,
    delay:    `${-(Math.random()*20)}s`,
    duration: `${18+Math.random()*18}s`,
  })));

  // Ref to always have fresh board in async callbacks
  const boardRef = useRef(board);
  useEffect(() => { boardRef.current = board; }, [board]);

  const aiMarkRef      = useRef(aiMark);
  const playerMarkRef  = useRef(playerMark);
  const difficultyRef  = useRef(difficulty);
  useEffect(() => { aiMarkRef.current     = aiMark;     }, [aiMark]);
  useEffect(() => { playerMarkRef.current = playerMark; }, [playerMark]);
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);

  // Theme CSS vars
  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', theme.color);
    document.documentElement.style.setProperty('--primary-glow',  theme.glow);
  }, [theme]);

  // Persist scores
  useEffect(() => {
    localStorage.setItem('ttt_scores', JSON.stringify(scores));
  }, [scores]);

  // ─ Backend health ──────────────────────────────────────────────────────────
  const pingServer = useCallback(async () => {
    try {
      const r = await fetch('http://localhost:5000/api/ping', {signal: AbortSignal.timeout(2000)});
      setServerOnline(r.ok);
    } catch { setServerOnline(false); }
  }, []);

  useEffect(() => { pingServer(); }, [pingServer]);

  // ─ Game logic ─────────────────────────────────────────────────────────────
  const applyMove = useCallback((index, mark, currentBoard) => {
    const next = [...currentBoard];
    next[index] = mark;
    setBoard(next);

    const res = checkWinner(next);
    if (res) {
      setResult(res);
      setScreen('game');   // stay on game screen, result is shown inline
      setAiThinking(false);
      if (res.symbol === playerMarkRef.current) {
        playSound('win');
        setScores(s => ({...s, p: s.p+1}));
      } else if (res.symbol === aiMarkRef.current) {
        playSound('lose');
        setScores(s => ({...s, ai: s.ai+1}));
      } else {
        playSound('draw');
        setScores(s => ({...s, d: s.d+1}));
      }
    } else {
      setCurrentTurn(mark === 'X' ? 'O' : 'X');
    }
  }, []);

  // AI move fetcher
  const fetchAiMove = useCallback(async () => {
    const snap       = [...boardRef.current];
    const ai         = aiMarkRef.current;
    const diff       = difficultyRef.current;
    const human      = playerMarkRef.current;
    const empty      = snap.filter(c => c==='');
    if (!empty.length) { setAiThinking(false); return; }

    try {
      const res = await fetch('http://localhost:5000/api/move', {
        method:  'POST',
        headers: {'Content-Type':'application/json'},
        body:    JSON.stringify({ board: snap, ai_player: ai, difficulty: diff }),
        signal:  AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        setServerOnline(true);
        applyMove(data.move, ai, snap);
      } else throw new Error();
    } catch {
      setServerOnline(false);
      const move = bestLocalMove([...snap], ai, human, diff);
      if (move !== -1) applyMove(move, ai, snap);
    } finally {
      setAiThinking(false);
    }
  }, [applyMove]);

  // Trigger AI turn
  useEffect(() => {
    if (screen !== 'game' || result || currentTurn !== aiMark) return;
    setAiThinking(true);
    const id = setTimeout(() => fetchAiMove(), 550);
    return () => { clearTimeout(id); };
  }, [currentTurn, screen, result, aiMark, fetchAiMove]);

  // ─ User actions ───────────────────────────────────────────────────────────
  const handleCellClick = (i) => {
    if (board[i] || result || aiThinking || currentTurn !== playerMark) return;
    playSound('click');
    applyMove(i, playerMark, board);
  };

  const startGame = () => {
    playSound('click');
    const ai = playerMark === 'X' ? 'O' : 'X';
    setAiMark(ai);
    aiMarkRef.current     = ai;
    playerMarkRef.current = playerMark;
    difficultyRef.current = difficulty;
    setBoard(Array(9).fill(''));
    setCurrentTurn('X');
    setResult(null);
    setAiThinking(false);
    setScreen('game');
    pingServer();
  };

  const playAgain = () => {
    playSound('click');
    setBoard(Array(9).fill(''));
    setCurrentTurn('X');
    setResult(null);
    setAiThinking(false);
    pingServer();
  };

  const goMenu = () => {
    playSound('click');
    setScreen('setup');
    setBoard(Array(9).fill(''));
    setResult(null);
    setAiThinking(false);
    setScores({p:0, ai:0, d:0});
    pingServer();
  };

  const handleCustomColor = (e) => {
    const c = e.target.value;
    setCustomColor(c);
    const h = c.replace('#','');
    const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
    setTheme({ name:'Custom', color:c, glow:`rgba(${r},${g},${b},0.4)` });
  };

  // ─ Status text ────────────────────────────────────────────────────────────
  const statusEl = () => {
    if (result) {
      if (result.symbol === 'Draw')       return <><span>It&apos;s a Draw! 🤝</span></>;
      if (result.symbol === playerMark)   return <><span>🎉 You Win!</span></>;
      return <><span>AI Wins! 🤖</span></>;
    }
    if (currentTurn === playerMark) {
      return <>
        <User size={15} style={{color: playerMark==='X' ? 'var(--color-x)' : 'var(--color-o)'}} />
        <span>Your turn ({playerMark})</span>
      </>;
    }
    return <>
      {aiThinking ? <span className="thinking-spinner"/> : <Cpu size={15}/>}
      <span>AI thinking…</span>
    </>;
  };

  // ─ Result banner ──────────────────────────────────────────────────────────
  const resultBanner = () => {
    if (!result) return null;
    let cls = 'result-banner draw', msg = "It's a Draw! 🤝";
    if (result.symbol === playerMark) { cls = 'result-banner win';  msg = '🎉 You Win! Impressive!'; }
    if (result.symbol === aiMark)     { cls = 'result-banner lose'; msg = '🤖 AI Wins! Better luck next round.'; }
    return <div className={cls}>{msg}</div>;
  };

  // ─ Win line SVG overlay ───────────────────────────────────────────────────
  const winLineSVG = () => {
    if (!result || result.symbol === 'Draw' || result.lineIdx < 0) return null;
    const { x1, y1, x2, y2 } = WIN_LINE_COORDS[result.lineIdx];
    const color = result.symbol === 'X' ? 'var(--color-x)' : 'var(--color-o)';
    return (
      <svg className="win-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line
          className="win-line-path"
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={color}
        />
      </svg>
    );
  };

  // ─ Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="bg-ambient" />

      {/* Background floating doodles */}
      <div className="doodles-container">
        {doodles.map(d => (
          <div key={d.id} className="floating-doodle" style={{
            top: d.top, left: d.left,
            fontSize: d.size, width: d.size, height: d.size,
            animationDelay: d.delay, animationDuration: d.duration,
          }}>
            {d.type}
          </div>
        ))}
      </div>

      <div className="glass-container">

        {/* ── SETUP SCREEN ─────────────────────────────────────── */}
        {screen === 'setup' && (
          <div>
            <h1>Tic-Tac-Toe</h1>
            <p className="subtitle">Challenge an unbeatable Minimax AI</p>

            {/* Mark selection */}
            <div className="theme-label" style={{marginBottom:'0.5rem'}}>Choose Your Mark</div>
            <div className="selection-grid">
              {['X','O'].map(m => (
                <div key={m}
                  className={`selection-card ${m==='X'?'x-choice':'o-choice'} ${playerMark===m?'selected':''}`}
                  onClick={() => { playSound('click'); setPlayerMark(m); }}
                >
                  {m === 'X'
                    ? <svg className="choice-svg" viewBox="0 0 100 100" style={{stroke:'#3b82f6',strokeWidth:9}}>
                        <path d="M22,22 L78,78"/><path d="M78,22 L22,78"/>
                      </svg>
                    : <svg className="choice-svg" viewBox="0 0 100 100" style={{stroke:'#ec4899',strokeWidth:9}}>
                        <circle cx="50" cy="50" r="32"/>
                      </svg>
                  }
                  <span>Play as {m}</span>
                </div>
              ))}
            </div>

            {/* Difficulty */}
            <div className="theme-label" style={{marginBottom:'0.5rem'}}>Difficulty</div>
            <div className="difficulty-selector">
              {['easy','medium','unbeatable'].map(l => (
                <button key={l}
                  className={`diff-btn ${difficulty===l?'active':''}`}
                  onClick={() => { playSound('click'); setDifficulty(l); }}
                >{l}</button>
              ))}
            </div>

            {/* Theme */}
            <div className="theme-picker">
              <span className="theme-label">Accent Colour</span>
              <div className="swatches-grid">
                {THEMES.map(t => (
                  <button key={t.name}
                    className={`color-swatch ${theme.name===t.name?'active':''}`}
                    style={{backgroundColor: t.color}}
                    onClick={() => { playSound('click'); setTheme(t); }}
                    title={t.name}
                  />
                ))}
                <div
                  className={`custom-color-picker-wrapper ${theme.name==='Custom'?'active':''}`}
                  style={{backgroundColor: customColor}}
                  title="Custom colour"
                >
                  <input type="color" value={customColor} onChange={handleCustomColor}/>
                </div>
              </div>
            </div>

            <button className="btn-primary" onClick={startGame}>
              <Play size={17}/> Start Battle
            </button>
          </div>
        )}

        {/* ── GAME SCREEN ──────────────────────────────────────── */}
        {screen === 'game' && (
          <div>
            {/* Status row */}
            <div className="status-bar">
              <div className="status-indicator">{statusEl()}</div>
              <div className="status-badge difficulty-badge">{difficulty}</div>
            </div>

            {/* Offline notice */}
            {!serverOnline && (
              <div className="alert-banner">
                <AlertCircle size={13}/> Offline — using built-in JS AI
              </div>
            )}

            {/* Result banner */}
            {resultBanner()}

            {/* Board */}
            <div className="board-wrapper">
              <div className="game-board">
                {board.map((cell, i) => (
                  <div key={i}
                    className={[
                      'grid-cell',
                      cell==='X' ? 'cell-x' : cell==='O' ? 'cell-o' : '',
                      !cell && !result && !aiThinking && currentTurn===playerMark ? 'clickable' : '',
                    ].join(' ')}
                    onClick={() => handleCellClick(i)}
                  >
                    {cell==='X' && <XMark/>}
                    {cell==='O' && <OMark/>}
                  </div>
                ))}
              </div>
              {/* SVG win-line overlay */}
              {winLineSVG()}
            </div>

            {/* Scoreboard */}
            <div className="scoreboard">
              <div className="score-card player-score">
                <div className="score-name">You ({playerMark})</div>
                <div className="score-val">{scores.p}</div>
              </div>
              <div className="score-card draw-score">
                <div className="score-name">Ties</div>
                <div className="score-val">{scores.d}</div>
              </div>
              <div className="score-card ai-score">
                <div className="score-name">AI ({aiMark})</div>
                <div className="score-val">{scores.ai}</div>
              </div>
            </div>

            {/* Buttons */}
            <div className="game-controls">
              <button className="btn-secondary" onClick={goMenu}>
                <Home size={15}/> Menu
              </button>
              <button className={result ? 'btn-primary' : 'btn-secondary'} onClick={playAgain}>
                <RotateCcw size={15}/> {result ? 'Play Again' : 'Restart'}
              </button>
            </div>
          </div>
        )}

        {/* Server status badge */}
        <div className="network-status">
          <span className={`dot ${serverOnline?'dot-online':'dot-offline'}`}/>
          <span>Python AI: {serverOnline ? 'Online' : 'Offline (JS fallback)'}</span>
        </div>
      </div>
    </>
  );
}
