/* ApexTrade AI - Application Logic and Rules Engine */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatHistory = document.getElementById('chat-history');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const btnClear = document.getElementById('btn-clear');
    const btnHelp = document.getElementById('btn-help');
    const chipsContainer = document.getElementById('chips-container');
    const calendarDaysContainer = document.getElementById('calendar-days');
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    // State Variables
    let currentYear = 2026;
    let currentMonth = 5; // June (0-indexed: January is 0, June is 5)
    let selectedDate = 18; // Default selected date in the screenshot is 18

    // Base market ticker values
    const tickers = {
        SPY: { name: 'S&P 500 ETF', price: 545.05, basePrice: 540.38 },
        BTC: { name: 'Bitcoin', price: 66421.91, basePrice: 67380.00 },
        ETH: { name: 'Ethereum', price: 3536.85, basePrice: 3437.84 },
        TSLA: { name: 'Tesla Inc.', price: 183.23, basePrice: 186.08 },
        EURUSD: { name: 'Euro / Dollar', price: 1.0701, basePrice: 1.0738 }
    };

    // Month Names
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Initialize UI
    initTickers();
    initCalendar();
    setupEventListeners();

    // ==========================================
    // 1. Live Ticker Simulator
    // ==========================================
    function initTickers() {
        // Render initial values
        updateTickerUI('SPY');
        updateTickerUI('BTC');
        updateTickerUI('ETH');
        updateTickerUI('TSLA');
        updateTickerUI('EURUSD');

        // Simulate price feeds every 3.5 seconds
        setInterval(() => {
            Object.keys(tickers).forEach(symbol => {
                // Change price by a small percentage (-0.15% to +0.15%)
                const changePercent = (Math.random() * 0.3 - 0.15) / 100;
                const oldPrice = tickers[symbol].price;
                const newPrice = oldPrice * (1 + changePercent);
                tickers[symbol].price = parseFloat(newPrice.toFixed(symbol === 'EURUSD' ? 4 : 2));
                
                const isUp = newPrice >= oldPrice;
                const tickerCard = document.getElementById(`ticker-${symbol}`);
                
                // Add flash effect animation classes
                if (tickerCard) {
                    tickerCard.classList.remove('flash-up', 'flash-down');
                    // Force reflow to restart animation
                    void tickerCard.offsetWidth;
                    tickerCard.classList.add(isUp ? 'flash-up' : 'flash-down');
                    
                    // Clear animation class after delay
                    setTimeout(() => {
                        tickerCard.classList.remove('flash-up', 'flash-down');
                    }, 1000);
                }

                updateTickerUI(symbol);
            });
        }, 3500);
    }

    function updateTickerUI(symbol) {
        const ticker = tickers[symbol];
        const card = document.getElementById(`ticker-${symbol}`);
        if (!card) return;

        const priceEl = card.querySelector('.ticker-price');
        const changeEl = card.querySelector('.ticker-change');

        // Format price
        let formattedPrice = ticker.price.toLocaleString('en-US', {
            style: symbol === 'EURUSD' ? 'decimal' : 'currency',
            currency: 'USD',
            minimumFractionDigits: symbol === 'EURUSD' ? 4 : 2,
            maximumFractionDigits: symbol === 'EURUSD' ? 4 : 2
        });
        if (symbol === 'EURUSD') formattedPrice = ticker.price.toFixed(4);

        priceEl.textContent = formattedPrice;

        // Calculate change percent relative to basePrice
        const netChange = ticker.price - ticker.basePrice;
        const netChangePercent = (netChange / ticker.basePrice) * 100;
        const sign = netChangePercent >= 0 ? '+' : '';
        
        changeEl.textContent = `${sign}${netChangePercent.toFixed(2)}%`;
        
        if (netChangePercent >= 0) {
            changeEl.classList.remove('down');
            changeEl.classList.add('up');
        } else {
            changeEl.classList.remove('up');
            changeEl.classList.add('down');
        }
    }

    // ==========================================
    // 2. Interactive Calendar
    // ==========================================
    function initCalendar() {
        renderCalendar();
    }

    function renderCalendar() {
        calendarMonthYear.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        calendarDaysContainer.innerHTML = '';

        // Get first day of the month
        const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
        // Get number of days in the month
        const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

        // Create empty day slots for padding before the 1st of the month
        for (let i = 0; i < firstDayIndex; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.classList.add('calendar-day', 'empty');
            calendarDaysContainer.appendChild(emptyDiv);
        }

        // Generate day numbers
        for (let day = 1; day <= totalDays; day++) {
            const dayDiv = document.createElement('div');
            dayDiv.classList.add('calendar-day');
            dayDiv.textContent = day;

            // Highlight if it's the selected date
            if (day === selectedDate && currentMonth === 5 && currentYear === 2026) {
                dayDiv.classList.add('selected');
            }

            // Mark today's date if it matches actual current calendar date
            const today = new Date();
            if (day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
                dayDiv.classList.add('today');
            }

            // Highlight that dates have news items
            if (day % 2 === 0 || day === 15 || day === 21) {
                dayDiv.classList.add('has-news');
            }

            // Click listener for selecting date and fetching news
            dayDiv.addEventListener('click', () => {
                // Remove previous selected class
                const previouslySelected = calendarDaysContainer.querySelector('.calendar-day.selected');
                if (previouslySelected) {
                    previouslySelected.classList.remove('selected');
                }

                dayDiv.classList.add('selected');
                selectedDate = day;

                // Send news query for that date
                const dateString = `${monthNames[currentMonth]} ${day}, ${currentYear}`;
                handleUserQuery(`Market news for ${dateString}`);
            });

            calendarDaysContainer.appendChild(dayDiv);
        }
    }

    function changeMonth(direction) {
        currentMonth += direction;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        } else if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendar();
    }

    // ==========================================
    // 3. Rules Engine / Predefined Rules
    // ==========================================
    const responses = {
        greeting: {
            patterns: [/^\b(hi|hello|hey|greetings|yo|welcome|howdy)\b/i],
            getResponse: () => `
                <h3>👋 Welcome back to ApexTrade AI!</h3>
                <p>I am your dedicated rules-based market assistant. I process financial signals, market news, and core trading metrics.</p>
                <p>Here are some topics you can query me on:</p>
                <ul>
                    <li><strong>"Explain leverage"</strong> - Understand risk multiplier structures.</li>
                    <li><strong>"Risk management"</strong> - Position sizing guidelines.</li>
                    <li><strong>"RSI Indicator"</strong> - Momentum oscillator calculations.</li>
                    <li><strong>"Stock Picks"</strong> - Recent equity signals.</li>
                    <li><strong>"Crypto trends"</strong> - Blockchain sector metrics.</li>
                    <li><strong>"Today's news"</strong> - Financial briefing.</li>
                </ul>
            `
        },
        leverage: {
            patterns: [/\b(leverage|margin|liquidat|long|short|margin call|gearing)\b/i],
            getResponse: () => `
                <h3>⚙️ Trading Leverage & Margin Mechanics</h3>
                <p>Leverage allows you to control a large position with a relatively small amount of capital (margin). For example, 10x leverage means a $1,000 margin allows a $10,000 position size.</p>
                <div class="highlight-box">
                    <strong>⚠️ Critical Risk Warning:</strong> While leverage amplifies gains, it equally amplifies losses. If your trade moves against you by 10% on 10x leverage, your initial margin is 100% wiped out, leading to <strong>Liquidation</strong>.
                </div>
                <p><strong>Key Concepts:</strong></p>
                <ul>
                    <li><strong>Initial Margin:</strong> The collateral required to open a position.</li>
                    <li><strong>Maintenance Margin:</strong> The minimum account value required to keep the position open. If you fall below this, you face a <strong>Margin Call</strong>.</li>
                    <li><strong>Liquidation Price:</strong> The threshold price at which the exchange automatically closes your position to prevent negative balances.</li>
                </ul>
            `
        },
        riskManagement: {
            patterns: [/\b(risk|risk management|stop loss|position size|position sizing|stop-loss|risk reward)\b/i],
            getResponse: () => `
                <h3>🛡️ Risk Management & Capital Preservation</h3>
                <p>Consistent profitability relies on survival. The best technical analysis is useless without strict risk parameters. Implement these three core practices:</p>
                <ul>
                    <li><strong>The 1% Rule:</strong> Never risk more than 1% to 2% of your total trading capital on a single trade. If you have a $10,000 account, your maximum loss per trade should be $100.</li>
                    <li><strong>Risk-to-Reward Ratio (R:R):</strong> Aim for a minimum of 1:2 R:R. This means if you risk $100 (stop-loss), your target profit should be at least $200. Even with a 40% win rate, you will remain profitable over time.</li>
                    <li><strong>Dynamic Stop-Loss:</strong> Always set an invalidation point *before* entering a trade. Never adjust your stop-loss wider during an active loss.</li>
                </ul>
                <div class="highlight-box">
                    <strong>Position Sizing Formula:</strong><br>
                    Position Size = (Account Risk in $) / (Distance to Stop-Loss in %)
                </div>
            `
        },
        rsi: {
            patterns: [/\b(rsi|relative strength index|overbought|oversold)\b/i],
            getResponse: () => `
                <h3>📈 Relative Strength Index (RSI) Oscillator</h3>
                <p>The Relative Strength Index (RSI) is a momentum indicator that measures the speed and change of price movements on a scale from 0 to 100. It is primarily used to identify overbought or oversold conditions.</p>
                <table>
                    <thead>
                        <tr>
                            <th>RSI Level</th>
                            <th>Market Condition</th>
                            <th>Traditional Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Above 70</strong></td>
                            <td>Overbought</td>
                            <td>Expect correction / Sell signal</td>
                        </tr>
                        <tr>
                            <td><strong>Below 30</strong></td>
                            <td>Oversold</td>
                            <td>Expect bounce / Buy signal</td>
                        </tr>
                        <tr>
                            <td><strong>50 Line</strong></td>
                            <td>Neutral Trend</td>
                            <td>Bullish breakout above, bearish below</td>
                        </tr>
                    </tbody>
                </table>
                <p><strong>💡 Pro Tip:</strong> Look for <em>RSI Divergence</em>. If the price makes a higher high but the RSI makes a lower high, it indicates weakening momentum and a potential trend reversal.</p>
            `
        },
        crypto: {
            patterns: [/\b(crypto|bitcoin|ethereum|btc|eth|solana|sol|altcoin|cryptocurrency)\b/i],
            getResponse: () => `
                <h3>🪙 Cryptocurrency Market Trends</h3>
                <p>The crypto sector displays strong correlation with global liquidity conditions and tech equity metrics, mixed with native cyclicality (halving events):</p>
                <ul>
                    <li><strong>Bitcoin (BTC):</strong> Trading in a consolidation range. Support established near $64,000; resistance strong at $68,500. Institutional inflow via spot ETFs remains the primary narrative driver.</li>
                    <li><strong>Ethereum (ETH):</strong> Demonstrating strength post-upgrade. L2 scaling solutions (Arbitrum, Optimism) are capturing record transaction volumes, driving down mainnet gas fee pressures.</li>
                    <li><strong>Layer 1 Alternatives (SOL, etc.):</strong> Solana continues to see high decentralized exchange (DEX) activity, driven by retail interest. Support sits at $135.</li>
                </ul>
                <div class="highlight-box">
                    <strong>Trend Sentiment:</strong> Moderately Bullish. Watch macroeconomic announcements (CPI, Fed rates) as crypto assets remain highly sensitive to interest rate expectations.
                </div>
            `
        },
        stockPicks: {
            patterns: [/\b(stock picks|stock pick|stocks to buy|picks|what stocks|recommend stocks|equities)\b/i],
            getResponse: () => `
                <h3>📊 High-Conviction Stock Picks</h3>
                <p>Based on automated technical support levels and fundamental momentum, here are our current featured tickers:</p>
                <table>
                    <thead>
                        <tr>
                            <th>Ticker</th>
                            <th>Signal</th>
                            <th>Buy Range</th>
                            <th>Target</th>
                            <th>Stop Loss</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>NVDA</strong></td>
                            <td>Strong Buy</td>
                            <td>$122 - $125</td>
                            <td>$145.00</td>
                            <td>$115.50</td>
                        </tr>
                        <tr>
                            <td><strong>TSLA</strong></td>
                            <td>Neutral Accumulate</td>
                            <td>$178 - $182</td>
                            <td>$210.00</td>
                            <td>$170.00</td>
                        </tr>
                        <tr>
                            <td><strong>AAPL</strong></td>
                            <td>Hold / Buy Dip</td>
                            <td>$205 - $208</td>
                            <td>$235.00</td>
                            <td>$198.00</td>
                        </tr>
                    </tbody>
                </table>
                <p><strong>Rationale:</strong> <em>NVDA</em> maintains strong buy demand at its 50-day moving average. <em>TSLA</em> is exhibiting a bottoming rounding pattern on the daily chart. <em>AAPL</em> is consolidating after hitting record highs, forming a bullish flag pattern.</p>
            `
        },
        news: {
            patterns: [/\b(news|today's news|daily news|headlines|market news|economic calendar)\b/i],
            getResponse: (query) => {
                // Check if user is asking about a specific date from calendar
                const dateMatch = query.match(/market news for ([a-zA-Z]+) (\d+), (\d+)/i);
                let dateString = "Today";
                if (dateMatch) {
                    dateString = `${dateMatch[1]} ${dateMatch[2]}, ${dateMatch[3]}`;
                }
                
                return generateMockNews(dateString);
            }
        },
        indicators: {
            patterns: [/\b(indicator|macd|moving average|ema|sma|support|resistance|chart pattern|head and shoulders)\b/i],
            getResponse: () => `
                <h3>📈 Core Technical Indicators Explained</h3>
                <ul>
                    <li><strong>Moving Averages (SMA/EMA):</strong> Smooths out price action. The 50-day and 200-day moving averages are crucial. A "Golden Cross" (50 crossing above 200) is bullish; a "Death Cross" is bearish.</li>
                    <li><strong>MACD (Moving Average Convergence Divergence):</strong> A trend-following momentum indicator. Buy when the MACD signal line crosses above the MACD line; sell when it crosses below.</li>
                    <li><strong>Support & Resistance:</strong> Support is where buying interest is strong enough to overcome selling pressure (price floor). Resistance is where selling interest overcomes buying pressure (price ceiling).</li>
                </ul>
            `
        },
        help: {
            patterns: [/\b(help|commands|menu|what can you do|features)\b/i],
            getResponse: () => `
                <h3>❓ ApexTrade AI Help Menu</h3>
                <p>I operate on predefined rule configurations. Ask me queries containing these keywords:</p>
                <ul>
                    <li><strong>News:</strong> "Give me today's news", or select a date on the calendar.</li>
                    <li><strong>Leverage:</strong> "Explain leverage", "what is margin", "margin call".</li>
                    <li><strong>Risk:</strong> "How to manage risk", "stop loss rules", "position sizing".</li>
                    <li><strong>RSI:</strong> "Explain RSI indicator", "what does overbought mean".</li>
                    <li><strong>Crypto:</strong> "What is happening in crypto", "Bitcoin trends".</li>
                    <li><strong>Stocks:</strong> "Show stock picks", "best stocks to buy".</li>
                </ul>
                <p>Click on the suggestion chips or any item in the welcome menu to trigger them instantly!</p>
            `
        }
    };

    function matchQuery(query) {
        const cleaned = query.trim().toLowerCase();
        
        // Loop through response rules
        for (const key in responses) {
            const rule = responses[key];
            for (const pattern of rule.patterns) {
                if (pattern.test(cleaned)) {
                    return rule.getResponse(query);
                }
            }
        }
        
        // Special case: check for specific date mention like "Market news for June 18, 2026"
        if (/market news for/i.test(cleaned)) {
            return responses.news.getResponse(query);
        }

        // Fallback response
        return `
            <h3>🔍 Query Unrecognized</h3>
            <p>I couldn't match your query with my rules database. Because I am a rules-based agent, I operate on specific keyword patterns.</p>
            <p><strong>Try asking about:</strong></p>
            <ul>
                <li>"Today's news" (or click any date on the left calendar)</li>
                <li>"Explain leverage"</li>
                <li>"Explain risk management"</li>
                <li>"What is the RSI indicator?"</li>
                <li>"Show stock picks"</li>
                <li>"Crypto trends"</li>
            </ul>
        `;
    }

    function generateMockNews(dateString) {
        // Create somewhat pseudo-random headlines but deterministic for the date so it feels high-fidelity
        const hash = dateString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        
        const headlines = [
            [
                "SPY hits all-time highs as tech rally accelerates.",
                "Federal Reserve signals potential rate cuts coming next quarter.",
                "TSLA jumps 4.2% on news of autonomous driving expansion in Europe."
            ],
            [
                "Market dips as oil prices surge on Middle East supply worries.",
                "NVDA slides 3.1% following analyst downgrade on valuation fears.",
                "EUR/USD hits 2-month low as US Dollar Index gains strength."
            ],
            [
                "Crypto volatility spikes; BTC liquidates $150M in levered longs.",
                "S&P 500 consolidates near key support levels ahead of CPI print.",
                "Ethereum gas fees plunge to record lows as L2 networks grow."
            ],
            [
                "Retail sales beat expectations, raising concerns of persistent inflation.",
                "Apple announces new AI integration partnerships, boosting stock 2.8%.",
                "US treasury yields climb, putting pressure on growth stocks."
            ]
        ];

        // Select headlines based on hash value
        const selection = headlines[hash % headlines.length];

        return `
            <h3>📰 Market Briefing for ${dateString}</h3>
            <p>Here are the top market updates compiled for this period:</p>
            <div class="highlight-box">
                🔥 <strong>Top Story:</strong> ${selection[0]}
            </div>
            <ul>
                <li>${selection[1]}</li>
                <li>${selection[2]}</li>
                <li>Macroeconomic volume is normal; volatility indicators (VIX) are stable.</li>
            </ul>
        `;
    }

    // ==========================================
    // 4. Chat Interface UI Controller
    // ==========================================
    function setupEventListeners() {
        // Chat Form Submit
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const messageText = chatInput.value.trim();
            if (messageText) {
                handleUserQuery(messageText);
                chatInput.value = '';
            }
        });

        // Clear Chat Log
        btnClear.addEventListener('click', () => {
            chatHistory.innerHTML = `
                <!-- Welcome Message Card -->
                <div class="chat-message bot welcome-card">
                    <div class="message-content">
                        <h3>👋 Hey there! Welcome to ApexTrade AI.</h3>
                        <p>I'm your trading partner and market assistant. I can fetch <strong>everyday market news</strong> or break down <strong>complex trading concepts</strong> so they actually make sense.</p>
                        <div class="welcome-section">
                            <strong>What's on your mind today?</strong>
                            <ul class="welcome-actions-list">
                                <li class="action-item" data-query="Give me today's news">
                                    <span class="icon">📰</span>
                                    <span>"Give me today's news" (or just select any date on the calendar!)</span>
                                </li>
                                <li class="action-item" data-query="Explain leverage">
                                    <span class="icon">⚙️</span>
                                    <span>"Explain leverage"</span>
                                </li>
                                <li class="action-item" data-query="How does risk management work?">
                                    <span class="icon">🛡️</span>
                                    <span>"How does risk management work?"</span>
                                </li>
                                <li class="action-item" data-query="What is the RSI indicator?">
                                    <span class="icon">📈</span>
                                    <span>"What is the RSI indicator?"</span>
                                </li>
                                <li class="action-item" data-query="What's happening in crypto?">
                                    <span class="icon">🪙</span>
                                    <span>"What's happening in crypto?"</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <span class="message-time">${getCurrentTimeFormatted()}</span>
                </div>
            `;
            // Reset selected date on calendar to default June 18
            const previouslySelected = calendarDaysContainer.querySelector('.calendar-day.selected');
            if (previouslySelected) previouslySelected.classList.remove('selected');
            
            selectedDate = 18;
            currentMonth = 5;
            currentYear = 2026;
            renderCalendar();
        });

        // Help Button
        btnHelp.addEventListener('click', () => {
            handleUserQuery('help');
        });

        // Suggested Chips clicks
        chipsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('chip')) {
                const queryText = e.target.getAttribute('data-query');
                handleUserQuery(queryText);
            }
        });

        // Welcome actions item clicks (Event delegation on chat-history)
        chatHistory.addEventListener('click', (e) => {
            const actionItem = e.target.closest('.action-item');
            if (actionItem) {
                const queryText = actionItem.getAttribute('data-query');
                handleUserQuery(queryText);
            }
        });

        // Calendar Month Navigation
        prevMonthBtn.addEventListener('click', () => changeMonth(-1));
        nextMonthBtn.addEventListener('click', () => changeMonth(1));
    }

    function handleUserQuery(query) {
        // 1. Add User Message
        appendMessage(query, 'user');

        // 2. Add Typing Indicator
        const typingIndicator = appendTypingIndicator();

        // 3. Process Response after brief simulated delay (e.g. 800ms)
        setTimeout(() => {
            // Remove typing indicator
            typingIndicator.remove();

            // Get bot response
            const botResponse = matchQuery(query);

            // Append bot response
            appendMessage(botResponse, 'bot');
        }, 800);
    }

    function appendMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', sender);

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        
        // Render html tags for rich canned messages
        if (sender === 'bot') {
            contentDiv.innerHTML = content;
        } else {
            contentDiv.textContent = content;
        }

        const timeSpan = document.createElement('span');
        timeSpan.classList.add('message-time');
        timeSpan.textContent = getCurrentTimeFormatted();

        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeSpan);
        
        chatHistory.appendChild(messageDiv);
        scrollToBottom();
    }

    function appendTypingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', 'bot');

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');

        const indicatorDiv = document.createElement('div');
        indicatorDiv.classList.add('typing-indicator');
        indicatorDiv.innerHTML = '<span></span><span></span><span></span>';

        contentDiv.appendChild(indicatorDiv);
        messageDiv.appendChild(contentDiv);
        chatHistory.appendChild(messageDiv);
        scrollToBottom();

        return messageDiv;
    }

    function scrollToBottom() {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function getCurrentTimeFormatted() {
        const now = new Date();
        let hours = now.getHours();
        const minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const minutesStr = minutes < 10 ? '0' + minutes : minutes;
        
        return `${hours}:${minutesStr} ${ampm}`;
    }
});
