const API_BASE = "http://localhost:8000";
const AUTH_API_BASE = "http://localhost:8080";

const AUTH_STORAGE_KEY = "breakingShareUser";
const THEME_STORAGE_KEY = "tradeNoteTheme";

const loadStoredUser = () => {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("저장된 사용자 정보를 불러오지 못했습니다.", error);
        return null;
    }
};

const authState = {
    mode: "login",
    user: loadStoredUser(),
};

const fetchLiveNews = async () => {
    try {
        const response = await fetch(`${API_BASE}/api/news`);
        if (!response.ok) throw new Error("뉴스 API 실패");
        const data = await response.json();
        return data.map((item) => ({
            title: item.headline_ko || item.headline,
            summary: item.summary_ko ?? item.summary ?? "",
            sentiment: "neutral",
            time: new Date(item.published_at).toLocaleString("ko-KR", { hour12: false }),
            url: item.url,
            source: item.source ?? "Finnhub",
            originalTitle: item.headline,
            originalSummary: item.summary,
            image: item.image || null,
        }));
    } catch (error) {
        console.warn("실시간 뉴스 로드 실패", error);
        return [];
    }
};

const setAuthMessage = (message, tone = "info") => {
    const messageEl = document.getElementById("auth-message");
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.classList.remove("error", "success");
    if (tone === "error") {
        messageEl.classList.add("error");
    } else if (tone === "success") {
        messageEl.classList.add("success");
    }
};

const setAuthUser = (user) => {
    authState.user = user;
    if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    updateAuthUI();
};

const guardTradingAccess = () => {
    if (!authState.user) {
        alert("로그인이 필요합니다. 로그인 페이지로 이동합니다.");
        window.location.href = "login.html";
        return false;
    }
    return true;
};

const updateAuthUI = () => {
    const toggle = document.getElementById("auth-toggle");
    const status = document.getElementById("auth-status");
    const displayName = document.getElementById("auth-display-name");
    const logout = document.getElementById("auth-logout");
    const loginOverlay = document.getElementById("login-overlay");

    if (authState.user) {
        if (toggle) {
            toggle.hidden = true;
        }
        if (status) {
            status.hidden = false;
        }
        if (displayName) {
            displayName.textContent = `${authState.user.displayName} 님`;
        }
        if (logout) {
            logout.hidden = false;
        }
        if (loginOverlay) {
            loginOverlay.classList.remove("active");
            loginOverlay.setAttribute("aria-hidden", "true");
        }
    } else {
        if (toggle) {
            toggle.hidden = false;
        }
        if (status) {
            status.hidden = true;
        }
        if (displayName) {
            displayName.textContent = "";
        }
        if (logout) {
            logout.hidden = true;
        }
        if (loginOverlay) {
            loginOverlay.classList.add("active");
            loginOverlay.setAttribute("aria-hidden", "false");
        }
    }
};

const initChatbot = () => {
    const widget = document.getElementById("chatbot");
    const chatBody = document.getElementById("chat-body");
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    const chatToggle = document.getElementById("chat-toggle");

    if (!widget || !chatBody || !chatForm || !chatInput || !chatToggle) {
        return;
    }

    const appendMessage = (text, type = "bot") => {
        const bubble = document.createElement("div");
        bubble.className = `chat-message ${type}`;
        const textEl = document.createElement("p");
        textEl.className = "chat-message__text";
        textEl.textContent = text;
        bubble.appendChild(textEl);
        chatBody.appendChild(bubble);
        chatBody.scrollTop = chatBody.scrollHeight;
        return { bubble, textEl };
    };

    const renderSources = (container, sources) => {
        if (!sources?.length) {
            return;
        }
        const list = document.createElement("div");
        list.className = "chat-message__sources";
        sources.slice(0, 5).forEach((url, index) => {
            if (!url) return;
            const link = document.createElement("a");
            link.href = url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = `출처 ${index + 1}`;
            list.appendChild(link);
        });
        if (list.childNodes.length) {
            container.appendChild(list);
        }
    };

    chatForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = chatInput.value.trim();
        if (!message) {
            return;
        }

        appendMessage(message, "user");
        chatInput.value = "";
        chatInput.focus();

        const submitButton = chatForm.querySelector("button");
        if (submitButton) {
            submitButton.disabled = true;
        }
        chatInput.disabled = true;

        const pending = appendMessage("답변을 준비하고 있어요...", "bot");

        try {
            const { reply, sources } = await requestChatbotReply(message);
            pending.textEl.textContent = reply;
            renderSources(pending.bubble, sources);
        } catch (error) {
            pending.textEl.textContent =
                error.message || "챗봇 응답을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.";
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
            chatInput.disabled = false;
            chatInput.focus();
        }
    });

    chatToggle.addEventListener("click", () => {
        const collapsed = widget.classList.toggle("collapsed");
        chatToggle.textContent = collapsed ? "+" : "ㅡ";
        chatToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
};

const requestJSON = async (url, options = {}) => {
    const response = await fetch(url, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
        ...options,
    });

    let data = null;
    const text = await response.text();
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (error) {
            data = { message: text };
        }
    }

    if (!response.ok) {
        const message = data?.message || data?.detail || "요청 처리에 실패했습니다.";
        throw new Error(message);
    }

    return data;
};

const requestChatbotReply = (message) =>
    requestJSON(`${API_BASE}/api/chat`, {
        method: "POST",
        body: JSON.stringify({
            message,
            include_market: true,
            include_news: true,
            max_news: 3,
        }),
    });

const registerUser = (payload) =>
    requestJSON(`${AUTH_API_BASE}/api/auth/register`, {
        method: "POST",
        body: JSON.stringify(payload),
    });

const loginUser = (payload) =>
    requestJSON(`${AUTH_API_BASE}/api/auth/login`, {
        method: "POST",
        body: JSON.stringify(payload),
    });

const fetchCurrentUser = async () => {
    try {
        return await requestJSON(`${AUTH_API_BASE}/api/auth/me`, {
            method: "GET",
        });
    } catch (error) {
        return null;
    }
};

const logoutUser = async () => {
    const response = await fetch(`${AUTH_API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
    });
    if (!response.ok && response.status !== 204) {
        throw new Error("로그아웃에 실패했습니다.");
    }
    setAuthUser(null);
};

const initAuth = async () => {
    updateAuthUI();

    const logoutBtn = document.getElementById("auth-logout");

    logoutBtn?.addEventListener("click", async () => {
        try {
            await logoutUser();
        } catch (error) {
            console.warn("로그아웃 실패", error);
            alert(error.message ?? "로그아웃에 실패했습니다.");
        }
    });

    const serverUser = await fetchCurrentUser();
    if (serverUser) {
        setAuthUser(serverUser);
    } else if (authState.user) {
        setAuthUser(null);
    } else {
        updateAuthUI();
    }
};

const parseNumberValue = (value) => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const cleaned = value.replace(/[,%]/g, "").trim();
        const parsed = Number(cleaned);
        return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
};

const fetchMarketOverview = async () => {
    try {
        const response = await fetch(`${API_BASE}/api/market/overview`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const message = errorData.detail || `서버 오류 (${response.status})`;
            throw new Error(message);
        }
        const data = await response.json();
        return data.map((item) => ({
            symbol: item.symbol,
            name: item.name ?? "",
            current: parseNumberValue(item.current),
            change: parseNumberValue(item.change),
            percent: parseNumberValue(item.percent),
        }));
    } catch (error) {
        console.warn("실시간 시장 데이터 로드 실패", error);
        return [];
    }
};

const sentimentBadge = (sentiment) => {
    const map = {
        positive: { label: "상승", icon: "▲", className: "badge" },
        caution: { label: "주의", icon: "⚠", className: "badge" },
        neutral: { label: "중립", icon: "○", className: "badge" }
    };
    return map[sentiment] ?? map.neutral;
};

const formatChange = (value, { suffix = "" } = {}) => {
    if (value === null || value === undefined) {
        return { text: "-", className: "" };
    }

    if (typeof value === "number") {
        const className = value > 0 ? "change-positive" : value < 0 ? "change-negative" : "";
        const text = `${value > 0 ? "+" : value < 0 ? "" : ""}${value.toFixed(2)}${suffix}`;
        return { text, className };
    }

    const normalized = String(value).trim();
    if (normalized.startsWith("+")) return { text: normalized, className: "change-positive" };
    if (normalized.startsWith("-")) return { text: normalized, className: "change-negative" };
    return { text: normalized, className: "" };
};

const summarizeWithAI = async (text) => {
    try {
        const response = await fetch(`${API_BASE}/api/summarize`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text })
        });
        if (!response.ok) throw new Error("요약 요청 실패");
        const data = await response.json();
        return data.summary ?? text;
    } catch (error) {
        console.warn("AI 요약에 실패했습니다. 기본 텍스트를 사용합니다.", error);
        return text;
    }
};

const populateNews = (items) => {
    const container = document.getElementById("news-list");
    if (!container) return;
    container.innerHTML = "";

    if (!items.length) {
        const message = document.createElement("div");
        message.className = "empty-state";
        message.textContent = "뉴스 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.";
        container.appendChild(message);
        return;
    }

    items.forEach((item) => {
        const badge = sentimentBadge(item.sentiment);
        const article = document.createElement("article");
        article.className = "card";
        const imageHtml = item.image 
            ? `<img src="${item.image}" alt="${item.title}" class="news-image" onerror="this.style.display='none'">`
            : "";
        article.innerHTML = `
            ${imageHtml}
            <span class="${badge.className}">
                <span>${badge.icon}</span>
                <span>${badge.label}</span>
            </span>
            <a class="news-link" href="${item.url ?? "#"}" target="_blank" rel="noopener noreferrer">
                <h3>${item.title}</h3>
            </a>
            <p>${item.summary || "요약이 제공되지 않았습니다."}</p>
            <footer class="news-meta">
                <span>${item.source ?? "출처 미상"}</span>
                <span>${item.time ?? ""}</span>
            </footer>
        `;
        container.appendChild(article);
    });
};

const populateMarket = (items) => {
    const tbody = document.getElementById("market-table");
    const note = document.getElementById("market-note");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!items.length) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td colspan="4" class="empty-cell">
                시장 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
            </td>
        `;
        tbody.appendChild(row);
        if (note) {
            note.textContent = "데이터를 불러오는 중 오류가 발생했습니다.";
        }
        return;
    }

    items.forEach((item) => {
        const row = document.createElement("tr");
        const changeInfo = formatChange(item.change);
        const changeRateInfo = formatChange(item.percent, { suffix: "%" });
        const priceText =
            typeof item.current === "number"
                ? item.current.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : item.current ?? "-";
        const label = item.name && item.name !== item.symbol ? `${item.name}` : "";
        row.innerHTML = `
            <th scope="row">
                <div class="symbol-cell">
                    <strong>${item.symbol}</strong>
                    ${label ? `<span>${label}</span>` : ""}
                </div>
            </th>
            <td>${priceText}</td>
            <td class="${changeInfo.className}">${changeInfo.text}</td>
            <td class="${changeRateInfo.className}">${changeRateInfo.text}</td>
        `;
        tbody.appendChild(row);
    });
};

const populateRecommendations = (items) => {
    const container = document.getElementById("recommendations-list");
    if (!container) return;
    container.innerHTML = "";

    if (!items.length) {
        const message = document.createElement("div");
        message.className = "empty-state";
        message.textContent = "추천 종목을 불러오지 못했습니다.";
        container.appendChild(message);
        return;
    }

    items.forEach((rec) => {
        const card = document.createElement("article");
        card.className = "recommendation-card";
        card.innerHTML = `
            <header>
                <strong>${rec.ticker}</strong>
                <span class="badge">${rec.conviction ?? rec.composite_score.toFixed(2)}</span>
            </header>
            <h3>${rec.name ?? rec.ticker}</h3>
            <p>${rec.thesis ?? "AI 스코어 기반으로 선별된 종목입니다."}</p>
            <div class="recommendation-meta">
                <span>목표가: ${rec.target ?? "-"}</span>
                <span>관점: ${rec.timeline ?? "6-12개월"}</span>
            </div>
        `;
        container.appendChild(card);
    });
};

const updateHighlightDate = () => {
    const highlightDate = document.getElementById("highlight-date");
    if (!highlightDate) return;
    const today = new Date();
    const formatted = today.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
    highlightDate.textContent = formatted;
};

const fetchAIRecommendations = async (tickers = []) => {
    if (!tickers.length) {
        return [];
    }

    try {
        const response = await fetch(`${API_BASE}/api/recommendations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ tickers })
        });
        if (!response.ok) throw new Error("추천 종목 API 실패");
        const data = await response.json();
        return data.items.map((item) => ({
            ticker: item.ticker,
            name: item.ticker,
            thesis: `합성 점수 ${item.composite_score.toFixed(2)} 기반 추천`,
            target: "-",
            timeline: "6-12개월",
            conviction: item.composite_score.toFixed(2)
        }));
    } catch (error) {
        console.warn("AI 추천 로드 실패", error);
        return [];
    }
};

const bootstrap = async () => {
    await initAuth();

    const hasMarketTable = document.getElementById("market-table");
    const hasNewsGrid = document.getElementById("news-list");
    const hasRecommendations = document.getElementById("recommendations-list");
    const highlight = document.getElementById("highlight-summary");

    let marketItems = [];
    let newsItems = [];

    if (hasMarketTable) {
        marketItems = await fetchMarketOverview();
        populateMarket(marketItems);
    }

    if (hasNewsGrid || highlight) {
        newsItems = await fetchLiveNews();
    }

    if (hasNewsGrid) {
        populateNews(newsItems);
    }

    if (hasRecommendations) {
        const recommendationUniverse = marketItems.map((item) => item.symbol).slice(0, 6);
        const recommendationItems = await fetchAIRecommendations(recommendationUniverse);
        populateRecommendations(recommendationItems);
    }

    updateHighlightDate();

    if (highlight) {
        if (newsItems.length) {
            const combined = newsItems
                .slice(0, 2)
                .map((item) => `${item.title}. ${item.summary}`)
                .join(" ");
            highlight.textContent = await summarizeWithAI(combined);
        } else {
            highlight.textContent = "최신 뉴스를 불러오지 못했습니다.";
        }
    }
};

// 매매내역 관리
const TRADING_STORAGE_KEY = "breakingShareTrading";

const loadTradingHistory = () => {
    try {
        const raw = localStorage.getItem(TRADING_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.warn("매매내역을 불러오지 못했습니다.", error);
        return [];
    }
};

const saveTradingHistory = (history) => {
    try {
        localStorage.setItem(TRADING_STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
        console.warn("매매내역을 저장하지 못했습니다.", error);
    }
};

const addTradingRecord = (record) => {
    const history = loadTradingHistory();
    const newRecord = {
        id: Date.now().toString(),
        ...record,
        createdAt: new Date().toISOString()
    };
    history.push(newRecord);
    saveTradingHistory(history);
    return newRecord;
};

const syncTradeToServer = async (record) => {
    if (!authState.user) return;
    try {
        const payload = {
            date: record.date,
            stock: record.stock,
            position: record.position || null,
            result: record.result || null,
            profit: typeof record.profit === "number" ? Math.trunc(record.profit) : null,
            chartImage: record.chartImage || null,
            profitReason: record.profitReason || null,
            lossReason: record.lossReason || null
        };
        await requestJSON(`${AUTH_API_BASE}/api/trades`, {
            method: "POST",
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.warn("서버 매매내역 동기화 실패:", error);
    }
};

const deleteTradingRecord = (id) => {
    const history = loadTradingHistory();
    const filtered = history.filter(item => item.id !== id);
    saveTradingHistory(filtered);
    return filtered;
};

const getTodayRecords = () => {
    const history = loadTradingHistory();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return history.filter(item => {
        const recordDate = new Date(item.date);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate.getTime() === today.getTime();
    });
};

const getMonthRecords = () => {
    const history = loadTradingHistory();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return history.filter(item => {
        const recordDate = new Date(item.date);
        return recordDate.getMonth() === currentMonth && 
               recordDate.getFullYear() === currentYear;
    });
};

const getAllRecords = () => {
    return loadTradingHistory();
};

const calculateTodayTotal = () => {
    const todayRecords = getTodayRecords();
    return todayRecords.reduce((sum, record) => sum + (Number(record.profit) || 0), 0);
};

const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ko-KR").format(amount) + "원";
};

const renderTradingItem = (record) => {
    const item = document.createElement("div");
    item.className = "trading-item";
    item.dataset.id = record.id;

    const profit = Number(record.profit) || 0;
    const profitClass = profit > 0 ? "profit-positive" : profit < 0 ? "profit-negative" : "";
    const profitText = formatCurrency(profit);

    const resultBadge = record.result ? `
        <span class="trading-item-result ${record.result}">
            ${record.result === "win" ? "승" : record.result === "draw" ? "무" : "패"}
        </span>
    ` : "";

    const chartImage = record.chartImage ? `
        <div class="trading-item-chart">
            <img src="${record.chartImage}" alt="차트 이미지" onclick="window.open('${record.chartImage}', '_blank')">
        </div>
    ` : "";

    item.innerHTML = `
        <div class="trading-item-field">
            <span class="trading-item-label">날짜</span>
            <span class="trading-item-value">${formatDate(record.date)}</span>
        </div>
        <div class="trading-item-field">
            <span class="trading-item-label">종목명</span>
            <span class="trading-item-value">${record.stock}</span>
        </div>
        <div class="trading-item-field">
            <span class="trading-item-label">포지션</span>
            <span class="trading-item-position ${record.position}">
                ${record.position === "long" ? "롱" : "숏"}
            </span>
        </div>
        <div class="trading-item-field">
            <span class="trading-item-label">승무패</span>
            ${resultBadge || '<span class="trading-item-value">-</span>'}
        </div>
        <div class="trading-item-field">
            <span class="trading-item-label">수익금</span>
            <span class="trading-item-value ${profitClass}">${profitText}</span>
        </div>
        ${chartImage}
        ${record.profitReason ? `
        <div class="trading-item-field trading-item-field-full">
            <span class="trading-item-label">익절한 이유</span>
            <span class="trading-item-value">${record.profitReason}</span>
        </div>
        ` : ""}
        ${record.lossReason ? `
        <div class="trading-item-field trading-item-field-full">
            <span class="trading-item-label">손절한 이유</span>
            <span class="trading-item-value">${record.lossReason}</span>
        </div>
        ` : ""}
        <div class="trading-item-actions">
            <button type="button" class="delete-btn" data-id="${record.id}">삭제</button>
        </div>
    `;

    const deleteBtn = item.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", () => {
        if (confirm("이 매매내역을 삭제하시겠습니까?")) {
            deleteTradingRecord(record.id);
            renderTradingLists();
            updateTodayTotal();
        }
    });

    return item;
};

const renderTradingList = (containerId, records) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    if (records.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-trading-list";
        empty.textContent = "매매내역이 없습니다.";
        container.appendChild(empty);
        return;
    }

    records.forEach(record => {
        container.appendChild(renderTradingItem(record));
    });
};

const renderTradingLists = () => {
    renderTradingList("today-trading-list", getTodayRecords());
    renderTradingList("month-trading-list", getMonthRecords());
    renderTradingList("all-trading-list", getAllRecords());
};

const updateTodayTotal = () => {
    const totalEl = document.getElementById("today-total-profit");
    if (!totalEl) return;
    const total = calculateTodayTotal();
    totalEl.textContent = formatCurrency(total);
    updateProfitChart();
};

const updateProfitChart = () => {
    const todayRecords = getTodayRecords();
    const chartContainer = document.getElementById("profit-chart");
    const legendContainer = document.getElementById("profit-legend");
    const slicesContainer = document.getElementById("profit-pie-slices");
    
    if (!chartContainer || !legendContainer || !slicesContainer) return;

    // 종목별 수익금 집계
    const stockProfits = {};
    todayRecords.forEach(record => {
        const stock = record.stock || "기타";
        const profit = Number(record.profit) || 0;
        if (!stockProfits[stock]) {
            stockProfits[stock] = 0;
        }
        stockProfits[stock] += profit;
    });

    const stocks = Object.keys(stockProfits);
    const total = calculateTodayTotal();

    // 기존 차트 초기화
    slicesContainer.innerHTML = "";
    legendContainer.innerHTML = "";

    if (stocks.length === 0 || total === 0) {
        // 데이터가 없을 때
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "empty-trading-list";
        emptyMsg.textContent = "오늘 매매내역이 없습니다.";
        legendContainer.appendChild(emptyMsg);
        return;
    }

    // 차트 색상 팔레트
    const colors = [
        "#4ac9ff", "#8c5bff", "#26de81", "#ffa034", 
        "#ff4757", "#b474ff", "#f2d45f", "#58f28a"
    ];

    // 수익금 절대값으로 정렬 (큰 것부터)
    const sortedStocks = stocks.sort((a, b) => Math.abs(stockProfits[b]) - Math.abs(stockProfits[a]));

    // 파이 차트 그리기
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    const totalAbs = Math.abs(total);
    let currentOffset = 0;

    sortedStocks.forEach((stock, index) => {
        const profit = stockProfits[stock];
        const profitAbs = Math.abs(profit);
        const percentage = totalAbs > 0 ? profitAbs / totalAbs : 0;
        const dashLength = percentage * circumference;
        const strokeDasharray = `${dashLength} ${circumference}`;

        const slice = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        slice.setAttribute("class", "profit-pie-slice");
        slice.setAttribute("cx", "100");
        slice.setAttribute("cy", "100");
        slice.setAttribute("r", radius.toString());
        slice.setAttribute("stroke", colors[index % colors.length]);
        slice.setAttribute("stroke-dasharray", strokeDasharray);
        slice.setAttribute("stroke-dashoffset", (-currentOffset).toString());
        slice.setAttribute("data-stock", stock);
        slice.setAttribute("data-profit", profit.toString());
        slicesContainer.appendChild(slice);

        // 범례 추가
        const legendItem = document.createElement("div");
        legendItem.className = "profit-legend-item";
        const profitClass = profit > 0 ? "profit-positive" : profit < 0 ? "profit-negative" : "";
        legendItem.innerHTML = `
            <div class="profit-legend-color" style="background-color: ${colors[index % colors.length]}"></div>
            <div class="profit-legend-info">
                <span class="profit-legend-stock">${stock}</span>
                <span class="profit-legend-amount ${profitClass}">${formatCurrency(profit)}</span>
            </div>
            <span class="profit-legend-percent">${(percentage * 100).toFixed(1)}%</span>
        `;
        legendContainer.appendChild(legendItem);

        currentOffset += dashLength;
    });
};

const initImageUpload = () => {
    // 오늘 매매내역 이미지 업로드
    const todayChartInput = document.getElementById("today-chart");
    const todayChartPreview = document.getElementById("today-chart-preview");
    const todayChartRemove = document.getElementById("today-chart-remove");
    
    if (todayChartInput && todayChartPreview && todayChartRemove) {
        todayChartInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    todayChartPreview.innerHTML = `<img src="${event.target.result}" alt="차트 이미지">`;
                    todayChartPreview.classList.add("active");
                    todayChartRemove.style.display = "block";
                };
                reader.readAsDataURL(file);
            }
        });
        
        todayChartRemove.addEventListener("click", () => {
            todayChartInput.value = "";
            todayChartPreview.innerHTML = "";
            todayChartPreview.classList.remove("active");
            todayChartRemove.style.display = "none";
        });
    }

    // 이번 달 매매내역 이미지 업로드
    const monthChartInput = document.getElementById("month-chart");
    const monthChartPreview = document.getElementById("month-chart-preview");
    const monthChartRemove = document.getElementById("month-chart-remove");
    
    if (monthChartInput && monthChartPreview && monthChartRemove) {
        monthChartInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    monthChartPreview.innerHTML = `<img src="${event.target.result}" alt="차트 이미지">`;
                    monthChartPreview.classList.add("active");
                    monthChartRemove.style.display = "block";
                };
                reader.readAsDataURL(file);
            }
        });
        
        monthChartRemove.addEventListener("click", () => {
            monthChartInput.value = "";
            monthChartPreview.innerHTML = "";
            monthChartPreview.classList.remove("active");
            monthChartRemove.style.display = "none";
        });
    }
};

const initTradingForms = () => {
    // 오늘 날짜를 기본값으로 설정
    const today = new Date().toISOString().split("T")[0];
    const todayDateInput = document.getElementById("today-date");
    const monthDateInput = document.getElementById("month-date");
    if (todayDateInput) todayDateInput.value = today;
    if (monthDateInput) monthDateInput.value = today;
    
    initImageUpload();

    // 오늘 매매내역 폼
    const todayForm = document.getElementById("today-trading-form");
    if (todayForm) {
        todayForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!guardTradingAccess()) return;
            const chartInput = document.getElementById("today-chart");
            let chartImage = null;
            if (chartInput && chartInput.files[0]) {
                // 동기적으로 처리하기 위해 Promise 사용
                chartImage = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        resolve(event.target.result);
                    };
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(chartInput.files[0]);
                });
            }
            
            const formData = {
                date: document.getElementById("today-date").value,
                stock: document.getElementById("today-stock").value.trim(),
                position: document.getElementById("today-position").value,
                result: document.getElementById("today-result").value || null,
                profit: Number(document.getElementById("today-profit").value) || 0,
                chartImage: chartImage,
                profitReason: document.getElementById("today-profit-reason").value.trim() || null,
                lossReason: document.getElementById("today-loss-reason").value.trim() || null
            };
            const saved = addTradingRecord(formData);
            await syncTradeToServer(saved);
            todayForm.reset();
            if (todayDateInput) todayDateInput.value = today;
            // 이미지 미리보기 초기화
            const todayPreview = document.getElementById("today-chart-preview");
            const todayRemove = document.getElementById("today-chart-remove");
            if (todayPreview) {
                todayPreview.innerHTML = "";
                todayPreview.classList.remove("active");
            }
            if (todayRemove) todayRemove.style.display = "none";
            // 모달 닫기
            closeSideModal("today-trading-modal");
            renderTradingLists();
            updateTodayTotal();
        });
    }

    // 이번 달 매매내역 폼
    const monthForm = document.getElementById("month-trading-form");
    if (monthForm) {
        monthForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!guardTradingAccess()) return;
            const chartInput = document.getElementById("month-chart");
            let chartImage = null;
            if (chartInput && chartInput.files[0]) {
                // 동기적으로 처리하기 위해 Promise 사용
                chartImage = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        resolve(event.target.result);
                    };
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(chartInput.files[0]);
                });
            }
            
            const formData = {
                date: document.getElementById("month-date").value,
                stock: document.getElementById("month-stock").value.trim(),
                position: document.getElementById("month-position").value,
                result: document.getElementById("month-result").value || null,
                profit: Number(document.getElementById("month-profit").value) || 0,
                chartImage: chartImage,
                profitReason: document.getElementById("month-profit-reason").value.trim() || null,
                lossReason: document.getElementById("month-loss-reason").value.trim() || null
            };
            const saved = addTradingRecord(formData);
            await syncTradeToServer(saved);
            monthForm.reset();
            if (monthDateInput) monthDateInput.value = today;
            // 이미지 미리보기 초기화
            const monthPreview = document.getElementById("month-chart-preview");
            const monthRemove = document.getElementById("month-chart-remove");
            if (monthPreview) {
                monthPreview.innerHTML = "";
                monthPreview.classList.remove("active");
            }
            if (monthRemove) monthRemove.style.display = "none";
            // 모달 닫기
            closeSideModal("month-trading-modal");
            renderTradingLists();
            updateTodayTotal();
        });
    }
};

const openSideModal = (modalId) => {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById("modal-overlay");
    
    if (modal && overlay) {
        modal.classList.add("active");
        overlay.classList.add("active");
        document.body.style.overflow = "hidden";
    }
};

const closeSideModal = (modalId) => {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById("modal-overlay");
    
    if (modal) {
        modal.classList.remove("active");
    }
    
    // 모든 모달이 닫혔는지 확인
    const activeModals = document.querySelectorAll(".side-modal.active");
    if (activeModals.length === 0 && overlay) {
        overlay.classList.remove("active");
        document.body.style.overflow = "";
    }
};

const initTradingToggles = () => {
    // 새로 만들기 버튼
    const newButtons = document.querySelectorAll(".new-btn");
    newButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!guardTradingAccess()) return;
            const modalId = btn.getAttribute("data-modal");
            if (modalId) {
                openSideModal(modalId);
            }
        });
    });

    // 모달 닫기 버튼
    const closeButtons = document.querySelectorAll(".side-modal-close, .cancel-btn[data-modal]");
    closeButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const modalId = btn.getAttribute("data-modal");
            if (modalId) {
                const modal = document.getElementById(modalId);
                const form = modal?.querySelector("form");
                if (form) {
                    form.reset();
                    // 날짜 필드 다시 설정
                    const today = new Date().toISOString().split("T")[0];
                    const dateInput = form.querySelector('input[type="date"]');
                    if (dateInput) dateInput.value = today;
                    // 이미지 미리보기 초기화
                    const preview = modal.querySelector(".image-preview");
                    const removeBtn = modal.querySelector(".image-remove-btn");
                    if (preview) {
                        preview.innerHTML = "";
                        preview.classList.remove("active");
                    }
                    if (removeBtn) {
                        removeBtn.style.display = "none";
                    }
                }
                closeSideModal(modalId);
            }
        });
    });

    // 오버레이 클릭 시 모달 닫기
    const overlay = document.getElementById("modal-overlay");
    if (overlay) {
        overlay.addEventListener("click", () => {
            const activeModal = document.querySelector(".side-modal.active");
            if (activeModal) {
                const modalId = activeModal.id;
                closeSideModal(modalId);
            }
        });
    }

    // ESC 키로 모달 닫기
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const activeModal = document.querySelector(".side-modal.active");
            if (activeModal) {
                const modalId = activeModal.id;
                closeSideModal(modalId);
            }
        }
    });

    // 기존 토글 버튼 (총 매매내역 등)
    const toggleButtons = document.querySelectorAll(".toggle-btn");
    toggleButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const targetId = btn.getAttribute("data-target");
            const content = document.getElementById(targetId);
            const section = btn.closest(".trading-section");
            
            if (!content || !section) return;

            const isExpanded = btn.getAttribute("aria-expanded") === "true";
            const newState = !isExpanded;

            btn.setAttribute("aria-expanded", newState);
            section.classList.toggle("collapsed", !newState);
            
            const toggleText = btn.querySelector(".toggle-text");
            const toggleIcon = btn.querySelector(".toggle-icon");
            if (toggleText) {
                toggleText.textContent = newState ? "접기" : "펼쳐보기";
            }
            if (toggleIcon) {
                toggleIcon.textContent = newState ? "▼" : "▶";
            }
        });
    });
};

const initTrading = () => {
    initTradingForms();
    initTradingToggles();
    renderTradingLists();
    updateTodayTotal();
    updateProfitChart();
};

const initTheme = () => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const currentTheme = document.documentElement.getAttribute("data-theme");
            const newTheme = currentTheme === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", newTheme);
            localStorage.setItem(THEME_STORAGE_KEY, newTheme);
        });
    }
};

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    bootstrap();
    initTrading();
});

