# ApexTrade AI Chatbot

A high-fidelity, trading-focused rule-based chatbot application built with modern web technologies. Inspired by financial analytics interfaces, this single-page dashboard simulates real-time trading feeds, calendar interactions, and a pattern-matching conversational engine.

## Features

1. **Rule-Based Conversations**:
   - Responds to predefined keywords and regex patterns for greeting queries, leverage, risk management rules, Relative Strength Index (RSI), cryptocurrency trends, recommended stock picks, and fallback responses.
   - Outputs rich HTML templates with formatting like tables, bullet lists, bold highlights, warning cards, and tips inside message bubbles.
   
2. **Live Ticker Price Simulator**:
   - Tracks `SPY`, `BTC`, `ETH`, `TSLA`, and `EUR/USD`.
   - Prices dynamically fluctuate by a minor randomized margin every 3.5 seconds.
   - Price drops trigger red visual flashes; price surges trigger green visual flashes.

3. **Interactive News Calendar**:
   - Select any date in the calendar to dynamically view financial news stories computed for that specific day.
   - Includes full calendar layout grid construction and month navigation links.

4. **Sleek Premium UI (Vanilla CSS)**:
   - Full dark-theme layout with glowing accents (neon cyan and blue).
   - Glassmorphism containers with subtle border elements and drop shadows.
   - Responsive layouts that automatically shrink/collapse sidebars for tablet and mobile screens.

## Project Structure

```
├── index.html   # HTML layout structure and DOM hierarchy
├── style.css    # Responsive styles, design system, colors, and animations
├── app.js       # Conversation rules engine, ticker simulation, calendar logic, and UI bindings
└── README.md    # Documentation file
```

## How to Run Locally

Since this app uses pure Vanilla HTML, CSS, and JS, you can open it directly in any browser:

1. Double-click the `index.html` file or drag it into any web browser.
2. Alternatively, run a local development server using Node.js:
   ```bash
   # If you have serve installed
   npx serve .
   ```
   Or use the IDE's built-in preview/subagent window.
