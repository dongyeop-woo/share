// Use current host to support mobile access over LAN (avoid hardcoded localhost)
const CURRENT_HOST = window.location.hostname || "localhost";
const API_BASE = `http://${CURRENT_HOST}:8000`;
const AUTH_API_BASE = `http://${CURRENT_HOST}:8001`;

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
        return data.map((item) => {
            // 번역이 실패했거나 원문과 같으면 원문 사용
            const headlineKo = item.headline_ko && item.headline_ko !== item.headline 
                ? item.headline_ko 
                : item.headline;
            const summaryKo = item.summary_ko && item.summary_ko !== item.summary 
                ? item.summary_ko 
                : (item.summary ?? "");
            
            return {
                title: headlineKo,
                summary: summaryKo,
                sentiment: "neutral",
                time: new Date(item.published_at).toLocaleString("ko-KR", { hour12: false }),
                url: item.url,
                source: item.source ?? "Finnhub",
                originalTitle: item.headline,
                originalSummary: item.summary,
                image: item.image || null,
            };
        });
    } catch (error) {
        console.warn("실시간 뉴스 로드 실패", error);
        return [];
    }
};

const setAuthMessage = (message, tone = "info", messageEl = null) => {
    const el = messageEl || document.getElementById("auth-message");
    if (!el) return;
    el.textContent = message;
    el.classList.remove("error", "success");
    if (tone === "error") {
        el.classList.add("error");
    } else if (tone === "success") {
        el.classList.add("success");
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
    // 모든 페이지에서 로그인 정보 UI 숨김 (헤더에 표시하지 않음)
    const toggle = document.getElementById("auth-toggle");
    const status = document.getElementById("auth-status");
    const displayName = document.getElementById("auth-display-name");
    const logout = document.getElementById("auth-logout");
    const loginOverlay = document.getElementById("login-overlay");
    // body auth (desktop) - 제거됨
    const toggleBody = document.getElementById("auth-toggle-body");
    const statusBody = document.getElementById("auth-status-body");
    const displayNameBody = document.getElementById("auth-display-name-body");
    const logoutBody = document.getElementById("auth-logout-body");
    // 내정보 페이지 auth
    const profileAuthToggle = document.getElementById("profile-auth-toggle");
    const profileAuthSection = document.getElementById("profile-auth-section");

    // 모든 헤더의 로그인 정보 숨김
    if (toggle) toggle.hidden = true;
    if (status) {
        status.hidden = true;
        status.classList.remove("visible");
    }
    if (toggleBody) toggleBody.hidden = true;
    if (statusBody) {
        statusBody.hidden = true;
        statusBody.classList.remove("visible");
    }

    if (authState.user) {
        // 내정보 페이지 auth - 로그인 버튼 숨김
        if (profileAuthSection) {
            profileAuthSection.hidden = true;
        }
        // 로그아웃 및 회원탈퇴 버튼 표시
        const profileActions = document.getElementById("profile-actions");
        if (profileActions) {
            profileActions.hidden = false;
        }
        if (loginOverlay) {
            loginOverlay.classList.remove("active");
            loginOverlay.setAttribute("aria-hidden", "true");
        }
    } else {
        // 내정보 페이지 auth - 로그인 버튼 표시
        if (profileAuthSection) {
            profileAuthSection.hidden = false;
        }
        // 로그아웃 및 회원탈퇴 버튼 숨김
        const profileActions = document.getElementById("profile-actions");
        if (profileActions) {
            profileActions.hidden = true;
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
        const response = await fetch(`${AUTH_API_BASE}/api/auth/me`, {
            method: "GET",
            credentials: "include",
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                // 명시적으로 인증 실패인 경우만 null 반환
                return null;
            }
            // 다른 오류는 무시하고 로컬 상태 유지
            return null;
        }
        
        const text = await response.text();
        if (!text) return null;
        
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    } catch (error) {
        // 네트워크 오류 등은 무시하고 로컬 상태 유지
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
    // 즉시 로컬 상태 반영(페이지 진입 직후) - 우선적으로 로컬 상태 사용
    if (authState.user) {
        setAuthUser(authState.user);
    } else {
        updateAuthUI();
    }

    const logoutBtn = document.getElementById("auth-logout");
    const logoutBtnBody = document.getElementById("auth-logout-body");
    const profileAuthLogout = document.getElementById("profile-auth-logout");

    // 로그아웃 버튼 이벤트는 한 번만 등록되도록 체크
    if (logoutBtn && !logoutBtn.dataset.listenerAdded) {
        logoutBtn.dataset.listenerAdded = "true";
        logoutBtn.addEventListener("click", async () => {
            try {
                await logoutUser();
            } catch (error) {
                console.warn("로그아웃 실패", error);
                alert(error.message ?? "로그아웃에 실패했습니다.");
            }
        });
    }
    
    if (logoutBtnBody && !logoutBtnBody.dataset.listenerAdded) {
        logoutBtnBody.dataset.listenerAdded = "true";
        logoutBtnBody.addEventListener("click", async () => {
            try {
                await logoutUser();
            } catch (error) {
                console.warn("로그아웃 실패", error);
                alert(error.message ?? "로그아웃에 실패했습니다.");
            }
        });
    }
    
    // 내정보 페이지 로그아웃 버튼
    if (profileAuthLogout && !profileAuthLogout.dataset.listenerAdded) {
        profileAuthLogout.dataset.listenerAdded = "true";
        profileAuthLogout.addEventListener("click", async () => {
            try {
                await logoutUser();
            } catch (error) {
                console.warn("로그아웃 실패", error);
                alert(error.message ?? "로그아웃에 실패했습니다.");
            }
        });
    }
    
    // 내정보 페이지 회원탈퇴 버튼
    const profileDeleteAccount = document.getElementById("profile-delete-account");
    if (profileDeleteAccount && !profileDeleteAccount.dataset.listenerAdded) {
        profileDeleteAccount.dataset.listenerAdded = "true";
        profileDeleteAccount.addEventListener("click", async () => {
            if (!confirm("정말로 회원탈퇴를 하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                return;
            }
            
            if (!confirm("회원탈퇴를 진행하시겠습니까? 모든 데이터가 삭제됩니다.")) {
                return;
            }
            
            try {
                const response = await fetch(`${AUTH_API_BASE}/api/auth/account`, {
                    method: "DELETE",
                    credentials: "include",
                });
                
                if (!response.ok) {
                    throw new Error("회원탈퇴에 실패했습니다.");
                }
                
                // 로그아웃 처리
                setAuthUser(null);
                alert("회원탈퇴가 완료되었습니다.");
                window.location.href = "index.html";
            } catch (error) {
                console.error("회원탈퇴 실패", error);
                alert(error.message ?? "회원탈퇴에 실패했습니다.");
            }
        });
    }

    // 서버에서 사용자 정보 가져오기 시도 (백그라운드에서)
    // 실패해도 로컬 상태는 유지
    try {
        const serverUser = await fetchCurrentUser();
        if (serverUser) {
            // 서버에서 사용자 정보를 성공적으로 가져온 경우에만 업데이트
            setAuthUser(serverUser);
        }
        // 서버에서 가져오지 못해도 로컬 상태는 이미 위에서 설정했으므로 유지
    } catch (error) {
        // 에러가 발생해도 로컬 상태는 유지
        console.warn("서버에서 사용자 정보 가져오기 실패 (로컬 상태 유지):", error);
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

// 서버 기록 → 로컬 치환 유틸
const mapServerTradeToLocal = (srv) => ({
    id: `srv-${srv.id}`,
    serverId: srv.id,
    date: srv.date,
    stock: srv.stock ?? "",
    position: srv.position ?? null,
    result: srv.result ?? null,
    profit: typeof srv.profit === "number" ? srv.profit : 0,
    chartImage: srv.chartImage ?? null,
    profitReason: srv.profitReason ?? null,
    lossReason: srv.lossReason ?? null,
    createdAt: srv.createdAt || srv.created_at || null,
});

const fetchServerTrades = async () => {
    try {
        const data = await requestJSON(`${AUTH_API_BASE}/api/trades`, { method: "GET" });
        if (!Array.isArray(data)) return [];
        return data.map(mapServerTradeToLocal);
    } catch (error) {
        console.warn("서버 매매내역 조회 실패:", error);
        return [];
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
        
        // 수정인 경우 PUT, 새로 추가인 경우 POST
        if (record.id) {
            // 수정 API가 있으면 PUT 요청, 없으면 POST로 새로 생성
            try {
                await requestJSON(`${AUTH_API_BASE}/api/trades/${record.id}`, {
                    method: "PUT",
                    body: JSON.stringify(payload)
                });
            } catch (putError) {
                // PUT이 실패하면 POST로 새로 생성
                await requestJSON(`${AUTH_API_BASE}/api/trades`, {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
            }
        } else {
            await requestJSON(`${AUTH_API_BASE}/api/trades`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
        }
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

const updateTradingRecord = (id, updatedRecord) => {
    const history = loadTradingHistory();
    const index = history.findIndex(item => item.id === id);
    if (index !== -1) {
        history[index] = {
            ...history[index],
            ...updatedRecord,
            updatedAt: new Date().toISOString()
        };
        saveTradingHistory(history);
        return history[index];
    }
    return null;
};

const getTodayRecords = () => {
    const history = loadTradingHistory();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const records = history.filter(item => {
        const recordDate = new Date(item.date);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate.getTime() === today.getTime();
    });
    // 최신 등록이 맨 위로 오도록 정렬
    return records.sort((a, b) => {
        // createdAt이 있으면 createdAt 기준, 없으면 id 기준
        if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        // id를 숫자로 변환하여 비교 (srv-123 형식도 처리)
        const idA = typeof a.id === 'string' && a.id.startsWith('srv-') 
            ? parseInt(a.id.replace('srv-', '')) || 0 
            : parseInt(a.id) || 0;
        const idB = typeof b.id === 'string' && b.id.startsWith('srv-') 
            ? parseInt(b.id.replace('srv-', '')) || 0 
            : parseInt(b.id) || 0;
        return idB - idA;
    });
};

const getMonthRecords = () => {
    const history = loadTradingHistory();
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const records = history.filter(item => {
        const recordDate = new Date(item.date);
        return recordDate.getMonth() === currentMonth && 
               recordDate.getFullYear() === currentYear;
    });
    // 최신 등록이 맨 위로 오도록 정렬
    return records.sort((a, b) => {
        // createdAt이 있으면 createdAt 기준, 없으면 날짜 + id 기준
        if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) {
            return dateB - dateA;
        }
        // 같은 날짜면 id 기준 내림차순 (최신 등록이 맨 위)
        const idA = typeof a.id === 'string' && a.id.startsWith('srv-') 
            ? parseInt(a.id.replace('srv-', '')) || 0 
            : parseInt(a.id) || 0;
        const idB = typeof b.id === 'string' && b.id.startsWith('srv-') 
            ? parseInt(b.id.replace('srv-', '')) || 0 
            : parseInt(b.id) || 0;
        return idB - idA;
    });
};

const getAllRecords = () => {
    const history = loadTradingHistory();
    // 최신 등록이 맨 위로 오도록 정렬
    return history.sort((a, b) => {
        // createdAt이 있으면 createdAt 기준, 없으면 날짜 + id 기준
        if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) {
            return dateB - dateA;
        }
        // 같은 날짜면 id 기준 내림차순 (최신 등록이 맨 위)
        const idA = typeof a.id === 'string' && a.id.startsWith('srv-') 
            ? parseInt(a.id.replace('srv-', '')) || 0 
            : parseInt(a.id) || 0;
        const idB = typeof b.id === 'string' && b.id.startsWith('srv-') 
            ? parseInt(b.id.replace('srv-', '')) || 0 
            : parseInt(b.id) || 0;
        return idB - idA;
    });
};

const calculateTodayTotal = () => {
    const todayRecords = getTodayRecords();
    return todayRecords.reduce((sum, record) => {
        let profit = Number(record.profit) || 0;
        // 패배인 경우 수익금이 양수면 음수로 변환
        if (record.result === "loss" && profit > 0) {
            profit = -profit;
        }
        return sum + profit;
    }, 0);
};

const calculateMonthTotal = () => {
    const monthRecords = getMonthRecords();
    return monthRecords.reduce((sum, record) => {
        let profit = Number(record.profit) || 0;
        // 패배인 경우 수익금이 양수면 음수로 변환
        if (record.result === "loss" && profit > 0) {
            profit = -profit;
        }
        return sum + profit;
    }, 0);
};

const calculateAllTotal = () => {
    const allRecords = getAllRecords();
    return allRecords.reduce((sum, record) => {
        let profit = Number(record.profit) || 0;
        // 패배인 경우 수익금이 양수면 음수로 변환
        if (record.result === "loss" && profit > 0) {
            profit = -profit;
        }
        return sum + profit;
    }, 0);
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

    let profit = Number(record.profit) || 0;
    // 패배인 경우 수익금이 양수면 음수로 변환
    if (record.result === "loss" && profit > 0) {
        profit = -profit;
    }
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

const renderTradingTableRow = (record) => {
    const row = document.createElement("tr");
    row.dataset.id = record.id;

    let profit = Number(record.profit) || 0;
    // 패배인 경우 수익금이 양수면 음수로 변환
    if (record.result === "loss" && profit > 0) {
        profit = -profit;
    }
    const profitClass = profit > 0 ? "profit-positive" : profit < 0 ? "profit-negative" : "";
    const profitText = formatCurrency(profit);

    const resultText = record.result === "win" ? "승" : record.result === "draw" ? "무" : record.result === "loss" ? "패" : "-";
    const resultClass = record.result || "";

    const positionText = record.position === "long" ? "롱" : record.position === "short" ? "숏" : "-";
    const positionClass = record.position || "";

    row.innerHTML = `
        <td>${formatDate(record.date)}</td>
        <td>${record.stock || "-"}</td>
        <td><span class="trading-position-badge ${positionClass}">${positionText}</span></td>
        <td><span class="trading-result-badge ${resultClass}">${resultText}</span></td>
        <td><span class="trading-profit ${profitClass}">${profitText}</span></td>
        <td>
            <button type="button" class="detail-btn" data-id="${record.id}">자세히보기</button>
        </td>
    `;

    const detailBtn = row.querySelector(".detail-btn");
    detailBtn.addEventListener("click", () => {
        showTradingDetail(record);
    });

    return row;
};

const showTradingDetail = (record) => {
    const modal = document.getElementById("trading-detail-modal");
    const content = document.getElementById("trading-detail-content");
    
    if (!modal || !content) return;

    let profit = Number(record.profit) || 0;
    // 패배인 경우 수익금이 양수면 음수로 변환
    if (record.result === "loss" && profit > 0) {
        profit = -profit;
    }
    const profitClass = profit > 0 ? "profit-positive" : profit < 0 ? "profit-negative" : "";
    const profitText = formatCurrency(profit);

    const resultText = record.result === "win" ? "승" : record.result === "draw" ? "무" : record.result === "loss" ? "패" : "-";
    const resultClass = record.result || "";

    const positionText = record.position === "long" ? "롱" : record.position === "short" ? "숏" : "-";
    const positionClass = record.position || "";

    const chartImage = record.chartImage ? `
        <div class="trading-detail-chart">
            <h4>차트 이미지</h4>
            <img src="${record.chartImage}" alt="차트 이미지" onclick="window.open('${record.chartImage}', '_blank')" style="max-width: 100%; cursor: pointer; border-radius: 8px;">
        </div>
    ` : "";

    content.innerHTML = `
        <div class="trading-detail-field">
            <label>날짜</label>
            <div>${formatDate(record.date)}</div>
        </div>
        <div class="trading-detail-field">
            <label>종목명</label>
            <div>${record.stock || "-"}</div>
        </div>
        <div class="trading-detail-field">
            <label>포지션</label>
            <div><span class="trading-position-badge ${positionClass}">${positionText}</span></div>
        </div>
        <div class="trading-detail-field">
            <label>승무패</label>
            <div><span class="trading-result-badge ${resultClass}">${resultText}</span></div>
        </div>
        <div class="trading-detail-field">
            <label>수익금</label>
            <div><span class="trading-profit ${profitClass}">${profitText}</span></div>
        </div>
        ${record.profitReason ? `
        <div class="trading-detail-field">
            <label>익절한 이유</label>
            <div>${record.profitReason}</div>
        </div>
        ` : ""}
        ${record.lossReason ? `
        <div class="trading-detail-field">
            <label>손절한 이유</label>
            <div>${record.lossReason}</div>
        </div>
        ` : ""}
        ${chartImage}
        <div class="trading-detail-actions">
            <button type="button" class="edit-btn" data-id="${record.id}">수정</button>
            <button type="button" class="delete-btn" data-id="${record.id}">삭제</button>
        </div>
    `;

    const editBtn = content.querySelector(".edit-btn");
    if (editBtn) {
        editBtn.addEventListener("click", () => {
            closeTradingDetail();
            openEditTradingModal(record);
        });
    }

    const deleteBtn = content.querySelector(".delete-btn");
    if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
            if (confirm("이 매매내역을 삭제하시겠습니까?")) {
                deleteTradingRecord(record.id);
                renderTradingLists();
                updateTodayTotal();
                closeTradingDetail();
            }
        });
    }

    // 모달과 내부 사이드 모달에 active 클래스 추가
    modal.classList.add("active");
    const sideModal = modal.querySelector(".side-modal");
    if (sideModal) {
        sideModal.classList.add("active");
    }
    
    // 모바일에서 삭제 버튼이 잘리지 않도록 스크롤 조정
    setTimeout(() => {
        const modalBody = content.closest(".side-modal-body");
        if (modalBody) {
            // 삭제 버튼이 보이도록 스크롤을 맨 아래로
            const deleteBtn = content.querySelector(".delete-btn");
            if (deleteBtn) {
                deleteBtn.scrollIntoView({ behavior: "smooth", block: "end" });
            }
            // 모바일에서 하단 네비게이션 바를 고려한 추가 패딩
            if (window.innerWidth <= 768) {
                const bottomNavHeight = 58; // --bottom-nav-height 값
                const currentPaddingBottom = window.getComputedStyle(modalBody).paddingBottom;
                const currentPaddingBottomValue = parseInt(currentPaddingBottom) || 0;
                if (currentPaddingBottomValue < bottomNavHeight + 20) {
                    modalBody.style.paddingBottom = `${bottomNavHeight + 20}px`;
                }
            }
        }
    }, 100);
};

const closeTradingDetail = () => {
    const modal = document.getElementById("trading-detail-modal");
    if (modal) {
        modal.classList.remove("active");
        const sideModal = modal.querySelector(".side-modal");
        if (sideModal) {
            sideModal.classList.remove("active");
        }
    }
};

let currentEditRecordId = null;

const openEditTradingModal = (record) => {
    currentEditRecordId = record.id;
    const modal = document.getElementById("edit-trading-modal");
    if (!modal) return;
    
    // 기존 데이터로 폼 채우기
    document.getElementById("edit-date").value = record.date || "";
    document.getElementById("edit-stock").value = record.stock || "";
    document.getElementById("edit-position").value = record.position || "long";
    document.getElementById("edit-result").value = record.result || "";
    
    let profit = Number(record.profit) || 0;
    // 패배인 경우 수익금이 음수일 수 있으므로 절대값으로 표시
    if (record.result === "loss" && profit < 0) {
        profit = Math.abs(profit);
    }
    document.getElementById("edit-profit").value = profit;
    
    document.getElementById("edit-profit-reason").value = record.profitReason || "";
    document.getElementById("edit-loss-reason").value = record.lossReason || "";
    
    // 차트 이미지 처리
    const chartPreview = document.getElementById("edit-chart-preview");
    const chartRemove = document.getElementById("edit-chart-remove");
    const chartInput = document.getElementById("edit-chart");
    
    if (record.chartImage) {
        chartPreview.innerHTML = `<img src="${record.chartImage}" alt="차트 이미지">`;
        chartPreview.classList.add("active");
        chartRemove.style.display = "block";
    } else {
        chartPreview.innerHTML = "";
        chartPreview.classList.remove("active");
        chartRemove.style.display = "none";
    }
    
    // 모달 열기
    modal.classList.add("active");
    const sideModal = modal.querySelector(".side-modal");
    if (sideModal) {
        sideModal.classList.add("active");
    }
    
    // 모바일에서 수정 버튼이 잘리지 않도록 스크롤 조정
    setTimeout(() => {
        const modalBody = modal.querySelector(".side-modal-body");
        if (modalBody) {
            // 수정 버튼이 보이도록 스크롤을 맨 아래로
            const submitBtn = document.getElementById("edit-trading-form")?.querySelector(".cta-button");
            if (submitBtn) {
                submitBtn.scrollIntoView({ behavior: "smooth", block: "end" });
            }
            // 모바일에서 하단 네비게이션 바를 고려한 추가 패딩
            if (window.innerWidth <= 768) {
                const bottomNavHeight = 58; // --bottom-nav-height 값
                const currentPaddingBottom = window.getComputedStyle(modalBody).paddingBottom;
                const currentPaddingBottomValue = parseInt(currentPaddingBottom) || 0;
                if (currentPaddingBottomValue < bottomNavHeight + 20) {
                    modalBody.style.paddingBottom = `${bottomNavHeight + 20}px`;
                }
            }
        }
    }, 100);
};

const closeEditTradingModal = () => {
    const modal = document.getElementById("edit-trading-modal");
    if (modal) {
        modal.classList.remove("active");
        const sideModal = modal.querySelector(".side-modal");
        if (sideModal) {
            sideModal.classList.remove("active");
        }
    }
    currentEditRecordId = null;
};

const renderTradingList = (containerId, records) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 더보기 버튼 먼저 찾기 (innerHTML 전에)
    const moreBtn = container.parentElement?.querySelector(`.more-btn[data-target="${containerId}"]`);
    
    container.innerHTML = "";
    container.classList.remove("expanded");

    if (records.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-trading-list";
        empty.textContent = "매매내역이 없습니다.";
        container.appendChild(empty);
        // 더보기 버튼 숨기기
        if (moreBtn) moreBtn.style.display = "none";
        return;
    }

    // 테이블 생성
    const table = document.createElement("table");
    table.className = "trading-table";
    
    // 테이블 헤더
    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th>날짜</th>
            <th>종목</th>
            <th>포지션</th>
            <th>승무패</th>
            <th>수익금</th>
            <th>자세히</th>
        </tr>
    `;
    table.appendChild(thead);

    // 테이블 바디
    const tbody = document.createElement("tbody");
    
    // 처음 3개만 표시하고, 나머지는 더보기 버튼으로 표시
    const isExpanded = container.classList.contains("expanded");
    const displayCount = isExpanded ? records.length : Math.min(3, records.length);
    const displayedRecords = records.slice(0, displayCount);

    displayedRecords.forEach(record => {
        tbody.appendChild(renderTradingTableRow(record));
    });
    
    table.appendChild(tbody);
    container.appendChild(table);

    // 더보기 버튼 표시/숨김 처리 (3개 이상일 때만 표시)
    if (moreBtn) {
        if (records.length > 3 && !isExpanded) {
            moreBtn.style.display = "block";
            moreBtn.style.visibility = "visible";
            moreBtn.textContent = `더보기 (${records.length - 3}개 더)`;
            moreBtn.onclick = () => {
                // 나머지 항목들 추가
                const remainingRecords = records.slice(3);
                remainingRecords.forEach(record => {
                    tbody.appendChild(renderTradingTableRow(record));
                });
                container.classList.add("expanded");
                moreBtn.style.display = "none";
            };
        } else {
            moreBtn.style.display = "none";
        }
    } else {
        console.warn(`더보기 버튼을 찾을 수 없습니다: ${containerId}`, container.parentElement);
    }
};

const renderTradingLists = () => {
    renderTradingList("today-trading-list", getTodayRecords());
    renderTradingList("month-trading-list", getMonthRecords());
    renderTradingList("all-trading-list", getAllRecords());
};

const updateTodayTotal = () => {
    // 오늘 총 수익금
    const todayEl = document.getElementById("today-total-profit");
    if (todayEl) {
        const todayTotal = calculateTodayTotal();
        todayEl.textContent = formatCurrency(todayTotal);
        todayEl.className = `profit-center-value ${todayTotal >= 0 ? 'profit-positive' : 'profit-negative'}`;
    }
    
    // 이번 달 총 수익금
    const monthEl = document.getElementById("month-total-profit");
    if (monthEl) {
        const monthTotal = calculateMonthTotal();
        monthEl.textContent = formatCurrency(monthTotal);
        monthEl.className = `profit-center-value ${monthTotal >= 0 ? 'profit-positive' : 'profit-negative'}`;
    }
    
    // 전체 총 수익금
    const allEl = document.getElementById("all-total-profit");
    if (allEl) {
        const allTotal = calculateAllTotal();
        allEl.textContent = formatCurrency(allTotal);
        allEl.className = `profit-center-value ${allTotal >= 0 ? 'profit-positive' : 'profit-negative'}`;
    }
    
    updateProfitChart();
};

// 종목별 랜덤 색상 생성 (localStorage에 저장하여 새로고침 후에도 유지)
const STOCK_COLORS_STORAGE_KEY = 'tradenote_stock_colors';

const getStockColor = (stock) => {
    if (!stock) return '#4ac9ff'; // 기본 색상
    
    // localStorage에서 종목별 색상 불러오기
    let stockColors = {};
    try {
        const stored = localStorage.getItem(STOCK_COLORS_STORAGE_KEY);
        if (stored) {
            stockColors = JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Failed to load stock colors from localStorage:', e);
    }
    
    // 색상이 없으면 랜덤 생성
    if (!stockColors[stock]) {
        // HSL 색상 공간에서 랜덤 색상 생성 (밝고 채도 높은 색상)
        const hue = Math.floor(Math.random() * 360);
        const saturation = 60 + Math.floor(Math.random() * 40); // 60-100%
        const lightness = 45 + Math.floor(Math.random() * 15); // 45-60%
        stockColors[stock] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        // localStorage에 저장
        try {
            localStorage.setItem(STOCK_COLORS_STORAGE_KEY, JSON.stringify(stockColors));
        } catch (e) {
            console.warn('Failed to save stock colors to localStorage:', e);
        }
    }
    
    return stockColors[stock];
};

const updateProfitChart = () => {
    // 오늘 그래프
    updateSingleChart('today', getTodayRecords(), calculateTodayTotal(), 'profit-pie-slices-today', 'profit-legend-today', '오늘 매매내역이 없습니다.');
    
    // 이번 달 그래프
    updateSingleChart('month', getMonthRecords(), calculateMonthTotal(), 'profit-pie-slices-month', 'profit-legend-month', '이번 달 매매내역이 없습니다.');
    
    // 전체 그래프
    updateSingleChart('all', getAllRecords(), calculateAllTotal(), 'profit-pie-slices-all', 'profit-legend-all', '매매내역이 없습니다.');
};

const updateSingleChart = (type, records, total, slicesId, legendId, emptyMessage) => {
    const slicesContainer = document.getElementById(slicesId);
    const legendContainer = document.getElementById(legendId);
    
    if (!slicesContainer || !legendContainer) return;

    // 종목별 수익금 집계
    const stockProfits = {};
    records.forEach(record => {
        const stock = record.stock || "기타";
        let profit = Number(record.profit) || 0;
        // 패배인 경우 수익금이 양수면 음수로 변환
        if (record.result === "loss" && profit > 0) {
            profit = -profit;
        }
        if (!stockProfits[stock]) {
            stockProfits[stock] = 0;
        }
        stockProfits[stock] += profit;
    });

    const stocks = Object.keys(stockProfits);

    // 기존 차트 초기화
    slicesContainer.innerHTML = "";
    legendContainer.innerHTML = "";

    // 수익과 손실을 구분하여 절대값 합 계산 (비율 계산용)
    const totalProfitAbs = Object.values(stockProfits).reduce((sum, p) => sum + Math.abs(p), 0);

    if (stocks.length === 0 || totalProfitAbs === 0) {
        // 데이터가 없을 때
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "empty-trading-list";
        emptyMsg.textContent = emptyMessage;
        legendContainer.appendChild(emptyMsg);
        return;
    }

    // 수익금 절대값으로 정렬 (큰 것부터)
    const sortedStocks = stocks.sort((a, b) => Math.abs(stockProfits[b]) - Math.abs(stockProfits[a]));

    // 파이 차트 그리기 (그래프 크기에 맞게 반지름 조정)
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    let currentOffset = 0;

    sortedStocks.forEach((stock) => {
        const profit = stockProfits[stock];
        const profitAbs = Math.abs(profit);
        // 모든 종목의 절대값 합 기준으로 비율 계산
        const percentage = totalProfitAbs > 0 ? profitAbs / totalProfitAbs : 0;
        const dashLength = percentage * circumference;
        const strokeDasharray = `${dashLength} ${circumference}`;
        // 수익이면 파란색(시그니처 색상), 손실이면 빨간색
        const color = profit > 0 ? "#4ac9ff" : profit < 0 ? "#ff5757" : "#9e9e9e";

        const slice = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        slice.setAttribute("class", "profit-pie-slice");
        slice.setAttribute("cx", "100");
        slice.setAttribute("cy", "100");
        slice.setAttribute("r", radius.toString());
        slice.setAttribute("stroke", color);
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
            <div class="profit-legend-color" style="background-color: ${color}"></div>
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
            
            let profit = Number(document.getElementById("today-profit").value) || 0;
            const result = document.getElementById("today-result").value || null;
            // 패배인 경우 수익금을 음수로 변환
            if (result === "loss" && profit > 0) {
                profit = -profit;
            }
            
            const formData = {
                date: document.getElementById("today-date").value,
                stock: document.getElementById("today-stock").value.trim(),
                position: document.getElementById("today-position").value,
                result: result,
                profit: profit,
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
            
            let profit = Number(document.getElementById("month-profit").value) || 0;
            const result = document.getElementById("month-result").value || null;
            // 패배인 경우 수익금을 음수로 변환
            if (result === "loss" && profit > 0) {
                profit = -profit;
            }
            
            const formData = {
                date: document.getElementById("month-date").value,
                stock: document.getElementById("month-stock").value.trim(),
                position: document.getElementById("month-position").value,
                result: result,
                profit: profit,
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

    // 수정 폼 제출 처리
    const editForm = document.getElementById("edit-trading-form");
    if (editForm) {
        editForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!currentEditRecordId) return;
            if (!guardTradingAccess()) return;
            
            const chartInput = document.getElementById("edit-chart");
            let chartImage = null;
            // 새 이미지가 선택된 경우에만 업데이트
            if (chartInput && chartInput.files[0]) {
                chartImage = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        resolve(event.target.result);
                    };
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(chartInput.files[0]);
                });
            } else {
                // 기존 이미지 유지 (이미지 미리보기가 있으면 기존 이미지)
                const chartPreview = document.getElementById("edit-chart-preview");
                if (chartPreview && chartPreview.querySelector("img")) {
                    chartImage = chartPreview.querySelector("img").src;
                }
            }
            
            let profit = Number(document.getElementById("edit-profit").value) || 0;
            const result = document.getElementById("edit-result").value || null;
            // 패배인 경우 수익금을 음수로 변환
            if (result === "loss" && profit > 0) {
                profit = -profit;
            }
            
            const formData = {
                date: document.getElementById("edit-date").value,
                stock: document.getElementById("edit-stock").value.trim(),
                position: document.getElementById("edit-position").value,
                result: result,
                profit: profit,
                chartImage: chartImage,
                profitReason: document.getElementById("edit-profit-reason").value.trim() || null,
                lossReason: document.getElementById("edit-loss-reason").value.trim() || null
            };
            
            updateTradingRecord(currentEditRecordId, formData);
            await syncTradeToServer({ id: currentEditRecordId, ...formData });
            
            closeEditTradingModal();
            renderTradingLists();
            updateTodayTotal();
        });
    }

    // 수정 모달 이미지 업로드 처리
    const editChartInput = document.getElementById("edit-chart");
    const editChartPreview = document.getElementById("edit-chart-preview");
    const editChartRemove = document.getElementById("edit-chart-remove");
    
    if (editChartInput && editChartPreview && editChartRemove) {
        editChartInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    editChartPreview.innerHTML = `<img src="${event.target.result}" alt="차트 이미지">`;
                    editChartPreview.classList.add("active");
                    editChartRemove.style.display = "block";
                };
                reader.readAsDataURL(file);
            }
        });
        
        editChartRemove.addEventListener("click", () => {
            editChartInput.value = "";
            editChartPreview.innerHTML = "";
            editChartPreview.classList.remove("active");
            editChartRemove.style.display = "none";
        });
    }

    // 수정 모달 닫기 버튼
    const closeEditBtn = document.getElementById("close-edit-trading-modal");
    const cancelEditBtn = document.getElementById("cancel-edit-trading");
    if (closeEditBtn) {
        closeEditBtn.addEventListener("click", closeEditTradingModal);
    }
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener("click", closeEditTradingModal);
    }
    
    // 수정 모달 배경 클릭 시 닫기
    const editModal = document.getElementById("edit-trading-modal");
    if (editModal) {
        editModal.addEventListener("click", (e) => {
            if (e.target === editModal) {
                closeEditTradingModal();
            }
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
    
    // 매매내역 상세 모달 닫기 이벤트
    const closeModalBtn = document.getElementById("close-trading-detail-modal");
    const detailModal = document.getElementById("trading-detail-modal");
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", closeTradingDetail);
    }
    if (detailModal) {
        detailModal.addEventListener("click", (e) => {
            if (e.target === detailModal) {
                closeTradingDetail();
            }
        });
    }
    
    (async () => {
        if (authState.user) {
            const serverRecords = await fetchServerTrades();
            if (serverRecords.length) {
                saveTradingHistory(serverRecords);
            }
        }
        renderTradingLists();
        updateTodayTotal();
        updateProfitChart();
    })();
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

const initAIAnalysis = () => {
    const loginOverlay = document.getElementById("login-overlay");
    const analysisContent = document.getElementById("ai-analysis-content");
    const analysisSelection = document.getElementById("analysis-selection");
    const lossAnalysisBtn = document.getElementById("loss-analysis-btn");
    const profitAnalysisBtn = document.getElementById("profit-analysis-btn");
    const lossAnalysisContent = document.getElementById("loss-analysis-content");
    const profitAnalysisContent = document.getElementById("profit-analysis-content");
    
    if (!loginOverlay || !analysisContent) return;
    
    const updateAIAnalysisUI = () => {
        if (authState.user) {
            loginOverlay.setAttribute("aria-hidden", "true");
            loginOverlay.style.display = "none";
            analysisContent.style.display = "block";
            // 초기에는 선택 버튼만 표시
            if (analysisSelection) analysisSelection.style.display = "flex";
            if (lossAnalysisContent) lossAnalysisContent.style.display = "none";
            if (profitAnalysisContent) profitAnalysisContent.style.display = "none";
        } else {
            loginOverlay.setAttribute("aria-hidden", "false");
            loginOverlay.style.display = "flex";
            analysisContent.style.display = "none";
        }
    };
    
    // 손절 문제점 분석 버튼 클릭
    if (lossAnalysisBtn) {
        lossAnalysisBtn.addEventListener("click", () => {
            if (analysisSelection) analysisSelection.style.display = "none";
            if (lossAnalysisContent) {
                lossAnalysisContent.style.display = "block";
                performLossAnalysis();
            }
            if (profitAnalysisContent) profitAnalysisContent.style.display = "none";
        });
    }
    
    // 익절 습관 분석 버튼 클릭
    if (profitAnalysisBtn) {
        profitAnalysisBtn.addEventListener("click", () => {
            if (analysisSelection) analysisSelection.style.display = "none";
            if (profitAnalysisContent) {
                profitAnalysisContent.style.display = "block";
                performProfitAnalysis();
            }
            if (lossAnalysisContent) lossAnalysisContent.style.display = "none";
        });
    }
    
    // 뒤로가기 버튼
    const backFromLoss = document.getElementById("back-from-loss");
    const backFromProfit = document.getElementById("back-from-profit");
    
    if (backFromLoss) {
        backFromLoss.addEventListener("click", () => {
            if (analysisSelection) analysisSelection.style.display = "flex";
            if (lossAnalysisContent) lossAnalysisContent.style.display = "none";
            if (profitAnalysisContent) profitAnalysisContent.style.display = "none";
        });
    }
    
    if (backFromProfit) {
        backFromProfit.addEventListener("click", () => {
            if (analysisSelection) analysisSelection.style.display = "flex";
            if (lossAnalysisContent) lossAnalysisContent.style.display = "none";
            if (profitAnalysisContent) profitAnalysisContent.style.display = "none";
        });
    }
    
    // 초기 상태 설정
    updateAIAnalysisUI();
    
    // 로그인 상태 변경 감지
    const observer = new MutationObserver(() => {
        updateAIAnalysisUI();
    });
    
    const authStateElement = document.getElementById("auth-status");
    if (authStateElement) {
        observer.observe(authStateElement, { attributes: true, childList: true });
    }
    
    // authState 변경 감지
    const originalUpdateAuthUI = updateAuthUI;
    updateAuthUI = function() {
        originalUpdateAuthUI.apply(this, arguments);
        updateAIAnalysisUI();
    };
};

// 텍스트에서 정확히 동일한 문장 찾기
const findRepeatingPatterns = (texts) => {
    if (!texts || texts.length === 0) return [];
    
    // 모든 텍스트를 그대로 수집 (공백 정규화)
    const normalizedTexts = texts
        .filter(text => text && text.trim().length > 0)
        .map(text => text.trim());
    
    if (normalizedTexts.length === 0) return [];
    
    // 정확히 동일한 텍스트 카운트
    const textCount = {};
    normalizedTexts.forEach(text => {
        textCount[text] = (textCount[text] || 0) + 1;
    });
    
    // 2회 이상 반복된 텍스트만 반환
    const repeatingPatterns = Object.entries(textCount)
        .filter(([text, count]) => count >= 2)
        .map(([text, count]) => ({
            pattern: text,
            count: count
        }))
        .sort((a, b) => b.count - a.count);
    
    return repeatingPatterns;
};

// 손절 시 반복되는 문제점 찾기
const performLossAnalysis = async () => {
    const lossDetailEl = document.getElementById("loss-analysis-detail");
    if (!lossDetailEl) return;
    
    // 진행 상황 표시
    lossDetailEl.className = "analysis-loading";
    lossDetailEl.innerHTML = `
        <div class="loading-spinner"></div>
        <p>매매내역 불러오는 중...</p>
    `;
    
    try {
        // API에서 직접 매매내역 가져오기
        const response = await fetch(`${AUTH_API_BASE}/api/trades`, {
            method: "GET",
            credentials: "include"
        });
        
        if (!response.ok) {
            throw new Error("매매내역을 불러올 수 없습니다.");
        }
        
        const history = await response.json();
        
        lossDetailEl.innerHTML = `
            <div class="loading-spinner"></div>
            <p>손절 거래 필터링 중...</p>
        `;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (!history || history.length === 0) {
            lossDetailEl.className = "";
            lossDetailEl.innerHTML = "<p>매매내역이 없습니다. 매매내역을 추가하면 분석 결과를 확인할 수 있습니다.</p>";
            return;
        }
        
        // 손절 거래만 필터링
        const lossTrades = history.filter(r => r.result === "loss");
        
        lossDetailEl.innerHTML = `
            <div class="loading-spinner"></div>
            <p>손절 사유 수집 중... (${lossTrades.length}개 거래)</p>
        `;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (lossTrades.length === 0) {
            lossDetailEl.className = "";
            lossDetailEl.innerHTML = "<p>손절 거래가 없습니다. 손절 거래가 있으면 반복되는 문제점을 분석할 수 있습니다.</p>";
            return;
        }
        
        // 손절 사유 텍스트 수집
        const lossReasons = lossTrades
            .map(trade => trade.lossReason)
            .filter(reason => reason && reason.trim().length > 0);
        
        lossDetailEl.innerHTML = `
            <div class="loading-spinner"></div>
            <p>반복 패턴 분석 중... (${lossReasons.length}개 사유)</p>
        `;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (lossReasons.length === 0) {
            lossDetailEl.className = "";
            lossDetailEl.innerHTML = "<p>손절 사유가 기록된 거래가 없습니다. 손절 사유를 기록하면 반복되는 문제점을 분석할 수 있습니다.</p>";
            return;
        }
        
        // 반복되는 패턴 찾기
        const repeatingPatterns = findRepeatingPatterns(lossReasons);
        
        lossDetailEl.innerHTML = `
            <div class="loading-spinner"></div>
            <p>결과 생성 중...</p>
        `;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 분석 결과 생성
        let analysis = "<div style='display: flex; flex-direction: column; gap: 1.5rem;'>";
        
        // 모든 손절 사유 나열
        analysis += `
            <div style="padding: 1rem; background: var(--card); border-radius: 8px;">
                <h4 style="margin: 0 0 0.75rem;">📝 기록된 손절 사유 (${lossReasons.length}개)</h4>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 300px; overflow-y: auto;">
                    ${lossReasons.map((reason, idx) => `
                        <div style="padding: 0.5rem; background: var(--surface); border-radius: 4px; font-size: 0.9rem;">
                            ${idx + 1}. ${reason}
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
        
        if (repeatingPatterns.length > 0) {
            analysis += `
                <div style="padding: 1rem; background: var(--card); border-radius: 8px; border-left: 4px solid var(--negative);">
                    <h4 style="margin: 0 0 0.75rem; color: var(--negative);">⚠️ 반복되는 문제점</h4>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        ${repeatingPatterns.map((pattern, idx) => `
                            <div style="padding: 0.75rem; background: var(--surface); border-radius: 6px;">
                                <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--negative);">
                                    ${idx + 1}. "${pattern.pattern}" (${pattern.count}회 반복)
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
            
            // 해결 방안 제시
            analysis += `
                <div style="padding: 1rem; background: var(--card); border-radius: 8px; border-left: 4px solid var(--primary);">
                    <h4 style="margin: 0 0 0.75rem;">💡 해결 방안</h4>
                    <ul style="margin: 0; padding-left: 1.5rem; line-height: 1.8;">
                        <li>반복되는 문제점을 인지하고, 해당 문제를 해결하기 위한 구체적인 행동 계획을 수립하세요.</li>
                        <li>매매 전 체크리스트를 만들어 반복되는 실수를 방지하세요.</li>
                        <li>손절 기준을 명확히 설정하고 감정에 휘둘리지 않고 철저히 지키세요.</li>
                    </ul>
                </div>
            `;
        } else {
            analysis += `
                <div style="padding: 1rem; background: var(--card); border-radius: 8px; border-left: 4px solid var(--positive);">
                    <h4 style="margin: 0 0 0.75rem; color: var(--positive);">✅ 좋은 소식</h4>
                    <p style="margin: 0; line-height: 1.8;">
                        손절 사유에서 반복되는 패턴이 발견되지 않았습니다. 이는 다양한 상황에서 매매를 하고 있으며, 
                        특정 문제에 집착하지 않고 유연하게 대응하고 있다는 의미입니다. 
                        현재의 매매 패턴을 유지하면서 계속해서 손절 사유를 기록하여 더 나은 분석을 받아보세요.
                    </p>
                </div>
            `;
        }
        
        analysis += "</div>";
        lossDetailEl.className = "";
        lossDetailEl.innerHTML = analysis;
    } catch (error) {
        lossDetailEl.className = "";
        lossDetailEl.innerHTML = `<p style="color: var(--negative);">오류가 발생했습니다: ${error.message}</p>`;
    }
};

// 익절 시 반복되는 좋은 습관 찾기
const performProfitAnalysis = async () => {
    const profitDetailEl = document.getElementById("profit-analysis-detail");
    if (!profitDetailEl) return;
    
    // 진행 상황 표시
    profitDetailEl.className = "analysis-loading";
    profitDetailEl.innerHTML = `
        <div class="loading-spinner"></div>
        <p>매매내역 불러오는 중...</p>
    `;
    
    try {
        // API에서 직접 매매내역 가져오기
        const response = await fetch(`${AUTH_API_BASE}/api/trades`, {
            method: "GET",
            credentials: "include"
        });
        
        if (!response.ok) {
            throw new Error("매매내역을 불러올 수 없습니다.");
        }
        
        const history = await response.json();
        
        profitDetailEl.innerHTML = `
            <div class="loading-spinner"></div>
            <p>익절 거래 필터링 중...</p>
        `;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (!history || history.length === 0) {
            profitDetailEl.className = "";
            profitDetailEl.innerHTML = "<p>매매내역이 없습니다. 매매내역을 추가하면 분석 결과를 확인할 수 있습니다.</p>";
            return;
        }
        
        // 익절 거래만 필터링
        const profitTrades = history.filter(r => r.result === "win");
        
        profitDetailEl.innerHTML = `
            <div class="loading-spinner"></div>
            <p>익절 사유 수집 중... (${profitTrades.length}개 거래)</p>
        `;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (profitTrades.length === 0) {
            profitDetailEl.className = "";
            profitDetailEl.innerHTML = "<p>익절 거래가 없습니다. 익절 거래가 있으면 반복되는 좋은 습관을 분석할 수 있습니다.</p>";
            return;
        }
        
        // 익절 사유 텍스트 수집
        const profitReasons = profitTrades
            .map(trade => trade.profitReason)
            .filter(reason => reason && reason.trim().length > 0);
        
        profitDetailEl.innerHTML = `
            <div class="loading-spinner"></div>
            <p>반복 패턴 분석 중... (${profitReasons.length}개 사유)</p>
        `;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (profitReasons.length === 0) {
            profitDetailEl.className = "";
            profitDetailEl.innerHTML = "<p>익절 사유가 기록된 거래가 없습니다. 익절 사유를 기록하면 반복되는 좋은 습관을 분석할 수 있습니다.</p>";
            return;
        }
        
        // 반복되는 패턴 찾기
        const repeatingPatterns = findRepeatingPatterns(profitReasons);
        
        profitDetailEl.innerHTML = `
            <div class="loading-spinner"></div>
            <p>결과 생성 중...</p>
        `;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 분석 결과 생성
        let analysis = "<div style='display: flex; flex-direction: column; gap: 1.5rem;'>";
        
        // 모든 익절 사유 나열
        analysis += `
            <div style="padding: 1rem; background: var(--card); border-radius: 8px;">
                <h4 style="margin: 0 0 0.75rem;">📝 기록된 익절 사유 (${profitReasons.length}개)</h4>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 300px; overflow-y: auto;">
                    ${profitReasons.map((reason, idx) => `
                        <div style="padding: 0.5rem; background: var(--surface); border-radius: 4px; font-size: 0.9rem;">
                            ${idx + 1}. ${reason}
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
        
        if (repeatingPatterns.length > 0) {
            analysis += `
                <div style="padding: 1rem; background: var(--card); border-radius: 8px; border-left: 4px solid var(--positive);">
                    <h4 style="margin: 0 0 0.75rem; color: var(--positive);">✅ 반복되는 좋은 습관</h4>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        ${repeatingPatterns.map((pattern, idx) => `
                            <div style="padding: 0.75rem; background: var(--surface); border-radius: 6px;">
                                <div style="font-weight: 600; margin-bottom: 0.5rem; color: var(--positive);">
                                    ${idx + 1}. "${pattern.pattern}" (${pattern.count}회 반복)
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
            
            // 습관 유지 방법 제시
            analysis += `
                <div style="padding: 1rem; background: var(--card); border-radius: 8px; border-left: 4px solid var(--primary);">
                    <h4 style="margin: 0 0 0.75rem;">💡 습관 유지 방법</h4>
                    <ul style="margin: 0; padding-left: 1.5rem; line-height: 1.8;">
                        <li>반복되는 좋은 습관을 인지하고, 이를 매매 체크리스트에 포함시켜 일관되게 적용하세요.</li>
                        <li>성공한 매매 패턴을 상세히 기록하고, 비슷한 상황에서 재현하세요.</li>
                        <li>이 습관들이 효과적이라는 것을 인지하고, 의식적으로 더 자주 적용하도록 노력하세요.</li>
                    </ul>
                </div>
            `;
        } else {
            analysis += `
                <div style="padding: 1rem; background: var(--card); border-radius: 8px; border-left: 4px solid var(--positive);">
                    <h4 style="margin: 0 0 0.75rem; color: var(--positive);">✅ 좋은 소식</h4>
                    <p style="margin: 0; line-height: 1.8;">
                        익절 사유에서 반복되는 패턴이 발견되지 않았습니다. 이는 다양한 상황에서 성공적인 매매를 하고 있으며, 
                        유연하게 대응하고 있다는 의미입니다. 
                        현재의 매매 패턴을 유지하면서 계속해서 익절 사유를 기록하여 더 나은 분석을 받아보세요.
                    </p>
                </div>
            `;
        }
        
        analysis += "</div>";
        profitDetailEl.className = "";
        profitDetailEl.innerHTML = analysis;
    } catch (error) {
        profitDetailEl.className = "";
        profitDetailEl.innerHTML = `<p style="color: var(--negative);">오류가 발생했습니다: ${error.message}</p>`;
    }
};

// 내 정보 페이지 초기화
const initMe = async () => {
    const loginOverlay = document.getElementById("login-overlay");
    const profileNickname = document.getElementById("profile-nickname");
    const profileAvatarInitial = document.getElementById("profile-avatar-initial");
    const profilePostsCount = document.getElementById("profile-posts-count");
    const profileCommentsCount = document.getElementById("profile-comments-count");
    const profilePostsClickable = document.getElementById("profile-posts-clickable");
    const profileCommentsClickable = document.getElementById("profile-comments-clickable");
    const myPostsModal = document.getElementById("my-posts-modal");
    const myCommentsModal = document.getElementById("my-comments-modal");
    const closeMyPostsModal = document.getElementById("close-my-posts-modal");
    const closeMyCommentsModal = document.getElementById("close-my-comments-modal");
    const myPostsList = document.getElementById("my-posts-list");
    const myCommentsList = document.getElementById("my-comments-list");
    const editProfileModal = document.getElementById("edit-profile-modal");
    const closeEditProfileModal = document.getElementById("close-edit-profile-modal");
    const btnEditProfile = document.getElementById("btn-edit-profile");
    
    if (!loginOverlay) return;
    
    // 회원정보 수정 모달 열기/닫기
    const openEditProfileModal = () => {
        if (editProfileModal) {
            editProfileModal.style.display = "flex";
            editProfileModal.classList.add("active");
            if (editProfileModal.querySelector(".side-modal")) {
                editProfileModal.querySelector(".side-modal").classList.add("active");
            }
        }
    };
    
    const closeEditProfileModalHandler = () => {
        if (editProfileModal) {
            editProfileModal.style.display = "none";
            editProfileModal.classList.remove("active");
            if (editProfileModal.querySelector(".side-modal")) {
                editProfileModal.querySelector(".side-modal").classList.remove("active");
            }
        }
    };
    
    if (btnEditProfile) {
        btnEditProfile.addEventListener("click", openEditProfileModal);
    }
    
    if (closeEditProfileModal) {
        closeEditProfileModal.addEventListener("click", closeEditProfileModalHandler);
    }
    
    if (editProfileModal) {
        editProfileModal.addEventListener("click", (e) => {
            if (e.target === editProfileModal) {
                closeEditProfileModalHandler();
            }
        });
    }
    
    // 비밀번호 변경 모달
    const changePasswordModal = document.getElementById("change-password-modal");
    const closeChangePasswordModal = document.getElementById("close-change-password-modal");
    const btnChangePassword = document.getElementById("btn-change-password");
    const changePasswordForm = document.getElementById("change-password-form");
    
    const openChangePasswordModal = () => {
        closeEditProfileModalHandler();
        if (changePasswordModal) {
            changePasswordModal.style.display = "flex";
            changePasswordModal.classList.add("active");
            if (changePasswordModal.querySelector(".side-modal")) {
                changePasswordModal.querySelector(".side-modal").classList.add("active");
            }
        }
    };
    
    const closeChangePasswordModalHandler = () => {
        if (changePasswordModal) {
            changePasswordModal.style.display = "none";
            changePasswordModal.classList.remove("active");
            if (changePasswordModal.querySelector(".side-modal")) {
                changePasswordModal.querySelector(".side-modal").classList.remove("active");
            }
        }
        if (changePasswordForm) {
            changePasswordForm.reset();
            const messageEl = document.getElementById("change-password-message");
            if (messageEl) {
                messageEl.textContent = "";
                messageEl.classList.remove("error", "success");
            }
        }
    };
    
    if (btnChangePassword) {
        btnChangePassword.addEventListener("click", openChangePasswordModal);
    }
    
    if (closeChangePasswordModal) {
        closeChangePasswordModal.addEventListener("click", closeChangePasswordModalHandler);
    }
    
    if (changePasswordModal) {
        changePasswordModal.addEventListener("click", (e) => {
            if (e.target === changePasswordModal) {
                closeChangePasswordModalHandler();
            }
        });
    }
    
    // 닉네임 변경 모달
    const changeNicknameModal = document.getElementById("change-nickname-modal");
    const closeChangeNicknameModal = document.getElementById("close-change-nickname-modal");
    const btnChangeNickname = document.getElementById("btn-change-nickname");
    const changeNicknameForm = document.getElementById("change-nickname-form");
    
    const openChangeNicknameModal = () => {
        closeEditProfileModalHandler();
        if (changeNicknameModal) {
            changeNicknameModal.style.display = "flex";
            changeNicknameModal.classList.add("active");
            if (changeNicknameModal.querySelector(".side-modal")) {
                changeNicknameModal.querySelector(".side-modal").classList.add("active");
            }
            // 현재 닉네임으로 초기화
            const displayNameInput = document.getElementById("new-display-name");
            if (displayNameInput && authState.user) {
                displayNameInput.value = authState.user.displayName || "";
            }
        }
    };
    
    const closeChangeNicknameModalHandler = () => {
        if (changeNicknameModal) {
            changeNicknameModal.style.display = "none";
            changeNicknameModal.classList.remove("active");
            if (changeNicknameModal.querySelector(".side-modal")) {
                changeNicknameModal.querySelector(".side-modal").classList.remove("active");
            }
        }
        if (changeNicknameForm) {
            changeNicknameForm.reset();
            const messageEl = document.getElementById("change-nickname-message");
            if (messageEl) {
                messageEl.textContent = "";
                messageEl.classList.remove("error", "success");
            }
        }
    };
    
    if (btnChangeNickname) {
        btnChangeNickname.addEventListener("click", openChangeNicknameModal);
    }
    
    if (closeChangeNicknameModal) {
        closeChangeNicknameModal.addEventListener("click", closeChangeNicknameModalHandler);
    }
    
    if (changeNicknameModal) {
        changeNicknameModal.addEventListener("click", (e) => {
            if (e.target === changeNicknameModal) {
                closeChangeNicknameModalHandler();
            }
        });
    }
    
    // 비밀번호 변경 폼 제출
    if (changePasswordForm) {
        changePasswordForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const form = e.target;
            const currentPassword = form.currentPassword.value;
            const newPassword = form.newPassword.value;
            const confirmPassword = form.confirmPassword.value;
            
            const messageEl = document.getElementById("change-password-message");
            
            if (!currentPassword || !newPassword || !confirmPassword) {
                setAuthMessage("모든 필드를 입력해주세요.", "error", messageEl);
                return;
            }
            
            if (newPassword.length < 8 || newPassword.length > 64) {
                setAuthMessage("비밀번호는 8자 이상 64자 이하여야 합니다.", "error", messageEl);
                return;
            }
            
            if (newPassword !== confirmPassword) {
                setAuthMessage("새 비밀번호가 일치하지 않습니다.", "error", messageEl);
                return;
            }
            
            setAuthMessage("처리 중입니다...", "info", messageEl);
            
            try {
                const response = await requestJSON(`${AUTH_API_BASE}/api/auth/password`, {
                    method: "PUT",
                    body: JSON.stringify({
                        currentPassword,
                        newPassword
                    })
                });
                
                setAuthUser(response);
                setAuthMessage("비밀번호가 성공적으로 변경되었습니다.", "success", messageEl);
                setTimeout(() => {
                    closeChangePasswordModalHandler();
                }, 1500);
            } catch (error) {
                setAuthMessage(error.message ?? "비밀번호 변경에 실패했습니다.", "error", messageEl);
            }
        });
    }
    
    // 닉네임 변경 폼 제출
    if (changeNicknameForm) {
        changeNicknameForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const form = e.target;
            const displayName = form.displayName.value.trim();
            
            const messageEl = document.getElementById("change-nickname-message");
            
            if (!displayName) {
                setAuthMessage("닉네임을 입력해주세요.", "error", messageEl);
                return;
            }
            
            if (displayName.length > 60) {
                setAuthMessage("닉네임은 60자 이하여야 합니다.", "error", messageEl);
                return;
            }
            
            setAuthMessage("처리 중입니다...", "info", messageEl);
            
            try {
                const response = await requestJSON(`${AUTH_API_BASE}/api/auth/display-name`, {
                    method: "PUT",
                    body: JSON.stringify({
                        displayName
                    })
                });
                
                setAuthUser(response);
                setAuthMessage("닉네임이 성공적으로 변경되었습니다.", "success", messageEl);
                
                // 프로필 닉네임 업데이트
                if (profileNickname) {
                    profileNickname.textContent = displayName;
                }
                // 프로필 아바타 초기 업데이트
                const profileAvatarInitial = document.getElementById("profile-avatar-initial");
                if (profileAvatarInitial) {
                    const initial = displayName ? displayName.charAt(0).toUpperCase() : "-";
                    profileAvatarInitial.textContent = initial;
                }
                
                setTimeout(() => {
                    closeChangeNicknameModalHandler();
                }, 1500);
            } catch (error) {
                setAuthMessage(error.message ?? "닉네임 변경에 실패했습니다.", "error", messageEl);
            }
        });
    }
    
    // 모달 열기/닫기 함수
    const openMyPostsModal = () => {
        if (myPostsModal) {
            myPostsModal.style.display = "flex";
            myPostsModal.classList.add("active");
            if (myPostsModal.querySelector(".side-modal")) {
                myPostsModal.querySelector(".side-modal").classList.add("active");
            }
            loadMyPosts();
        }
    };
    
    const closeMyPostsModalHandler = () => {
        if (myPostsModal) {
            myPostsModal.style.display = "none";
            myPostsModal.classList.remove("active");
            if (myPostsModal.querySelector(".side-modal")) {
                myPostsModal.querySelector(".side-modal").classList.remove("active");
            }
        }
    };
    
    const openMyCommentsModal = () => {
        if (myCommentsModal) {
            myCommentsModal.style.display = "flex";
            myCommentsModal.classList.add("active");
            if (myCommentsModal.querySelector(".side-modal")) {
                myCommentsModal.querySelector(".side-modal").classList.add("active");
            }
            loadMyCommentedPosts();
        }
    };
    
    const closeMyCommentsModalHandler = () => {
        if (myCommentsModal) {
            myCommentsModal.style.display = "none";
            myCommentsModal.classList.remove("active");
            if (myCommentsModal.querySelector(".side-modal")) {
                myCommentsModal.querySelector(".side-modal").classList.remove("active");
            }
        }
    };
    
    // 이벤트 리스너
    if (profilePostsClickable) {
        profilePostsClickable.addEventListener("click", openMyPostsModal);
    }
    if (profileCommentsClickable) {
        profileCommentsClickable.addEventListener("click", openMyCommentsModal);
    }
    if (closeMyPostsModal) {
        closeMyPostsModal.addEventListener("click", closeMyPostsModalHandler);
    }
    if (closeMyCommentsModal) {
        closeMyCommentsModal.addEventListener("click", closeMyCommentsModalHandler);
    }
    if (myPostsModal) {
        myPostsModal.addEventListener("click", (e) => {
            if (e.target === myPostsModal) {
                closeMyPostsModalHandler();
            }
        });
    }
    if (myCommentsModal) {
        myCommentsModal.addEventListener("click", (e) => {
            if (e.target === myCommentsModal) {
                closeMyCommentsModalHandler();
            }
        });
    }
    
    // 내가 쓴 글 로드 함수
    const loadMyPosts = async () => {
        try {
            const myPostsResponse = await fetch(`${AUTH_API_BASE}/api/community/my/posts`, {
                method: "GET",
                credentials: "include"
            });
            if (myPostsResponse.ok) {
                const posts = await myPostsResponse.json();
                if (myPostsList) {
                    if (posts.length === 0) {
                        myPostsList.innerHTML = '<div class="empty-trading-list">작성한 글이 없습니다.</div>';
                    } else {
                        myPostsList.innerHTML = posts.map(post => `
                            <div class="card" style="margin-bottom: 0.75rem; padding: 1rem; cursor: pointer;" onclick="window.location.href='community.html?post=${post.id}'">
                                <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
                                    <div style="flex: 1;">
                                        <h4 style="margin: 0 0 0.5rem; font-size: 1rem;">${post.title || "제목 없음"}</h4>
                                        <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">${(post.content || "").substring(0, 100)}${(post.content || "").length > 100 ? "..." : ""}</p>
                                    </div>
                                    <div style="display: flex; gap: 0.5rem; align-items: center; font-size: 0.85rem; color: var(--text-muted);">
                                        <span>👍 ${post.upVotes || 0}</span>
                                        <span>👎 ${post.downVotes || 0}</span>
                                    </div>
                                </div>
                            </div>
                        `).join("");
                    }
                }
            } else {
                console.warn("내가 쓴 글 조회 실패:", myPostsResponse.status);
                if (myPostsList) {
                    myPostsList.innerHTML = '<div class="empty-trading-list">작성한 글이 없습니다.</div>';
                }
            }
        } catch (error) {
            console.error("내가 쓴 글 조회 오류:", error);
            if (myPostsList) {
                myPostsList.innerHTML = '<div class="empty-trading-list">작성한 글이 없습니다.</div>';
            }
        }
    };
    
    // 내가 댓글 단 글 로드 함수
    const loadMyCommentedPosts = async () => {
        try {
            const myCommentedPostsResponse = await fetch(`${AUTH_API_BASE}/api/community/my/comments`, {
                method: "GET",
                credentials: "include"
            });
            if (myCommentedPostsResponse.ok) {
                const posts = await myCommentedPostsResponse.json();
                if (myCommentsList) {
                    if (posts.length === 0) {
                        myCommentsList.innerHTML = '<div class="empty-trading-list">댓글을 단 글이 없습니다.</div>';
                    } else {
                        myCommentsList.innerHTML = posts.map(post => `
                            <div class="card" style="margin-bottom: 0.75rem; padding: 1rem; cursor: pointer;" onclick="window.location.href='community.html?post=${post.id}'">
                                <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
                                    <div style="flex: 1;">
                                        <h4 style="margin: 0 0 0.5rem; font-size: 1rem;">${post.title || "제목 없음"}</h4>
                                        <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">${(post.content || "").substring(0, 100)}${(post.content || "").length > 100 ? "..." : ""}</p>
                                    </div>
                                    <div style="display: flex; gap: 0.5rem; align-items: center; font-size: 0.85rem; color: var(--text-muted);">
                                        <span>👍 ${post.upVotes || 0}</span>
                                        <span>👎 ${post.downVotes || 0}</span>
                                    </div>
                                </div>
                            </div>
                        `).join("");
                    }
                }
            } else {
                console.warn("내가 댓글 단 글 조회 실패:", myCommentedPostsResponse.status);
                if (myCommentsList) {
                    myCommentsList.innerHTML = '<div class="empty-trading-list">댓글을 단 글이 없습니다.</div>';
                }
            }
        } catch (error) {
            console.error("내가 댓글 단 글 조회 오류:", error);
            if (myCommentsList) {
                myCommentsList.innerHTML = '<div class="empty-trading-list">댓글을 단 글이 없습니다.</div>';
            }
        }
    };
    
    const updateMeUI = async () => {
        if (authState.user) {
            loginOverlay.setAttribute("aria-hidden", "true");
            loginOverlay.style.display = "none";
            
            try {
                // 사용자 정보 가져오기 (로컬 상태 우선 사용)
                const displayName = authState.user.displayName || authState.user.username || "-";
                if (profileNickname) {
                    profileNickname.textContent = displayName;
                }
                // 프로필 아바타 초기 설정
                if (profileAvatarInitial) {
                    const initial = displayName !== "-" ? displayName.charAt(0).toUpperCase() : "-";
                    profileAvatarInitial.textContent = initial;
                }
                
                // 서버에서 최신 사용자 정보 가져오기
                const userInfo = await fetchCurrentUser();
                if (userInfo && profileNickname) {
                    const updatedDisplayName = userInfo.displayName || userInfo.username || authState.user.displayName || authState.user.username || "-";
                    profileNickname.textContent = updatedDisplayName;
                    // 프로필 아바타 초기 업데이트
                    if (profileAvatarInitial) {
                        const initial = updatedDisplayName !== "-" ? updatedDisplayName.charAt(0).toUpperCase() : "-";
                        profileAvatarInitial.textContent = initial;
                    }
                }
                
                // 작성한 글 수 및 댓글 수 가져오기
                try {
                    console.log("통계 조회 시작:", `${AUTH_API_BASE}/api/community/my/stats`);
                    const statsResponse = await fetch(`${AUTH_API_BASE}/api/community/my/stats`, {
                        method: "GET",
                        credentials: "include"
                    });
                    console.log("통계 조회 응답 상태:", statsResponse.status, statsResponse.statusText);
                    
                    if (statsResponse.ok) {
                        const stats = await statsResponse.json();
                        console.log("통계 데이터:", stats);
                        if (profilePostsCount) {
                            profilePostsCount.textContent = stats.postCount || 0;
                            console.log("작성한 글 수 설정:", stats.postCount || 0);
                        }
                        if (profileCommentsCount) {
                            profileCommentsCount.textContent = stats.commentCount || 0;
                            console.log("댓글 수 설정:", stats.commentCount || 0);
                        }
                    } else {
                        const errorText = await statsResponse.text();
                        console.warn("통계 조회 실패:", statsResponse.status, errorText);
                        if (profilePostsCount) {
                            profilePostsCount.textContent = "0";
                        }
                        if (profileCommentsCount) {
                            profileCommentsCount.textContent = "0";
                        }
                    }
                } catch (error) {
                    console.error("통계 조회 오류:", error);
                    if (profilePostsCount) {
                        profilePostsCount.textContent = "0";
                    }
                    if (profileCommentsCount) {
                        profileCommentsCount.textContent = "0";
                    }
                }
            } catch (error) {
                console.error("내 정보 로드 실패:", error);
            }
        } else {
            loginOverlay.setAttribute("aria-hidden", "false");
            loginOverlay.style.display = "flex";
        }
    };
    
    // 초기 상태 설정
    await updateMeUI();
    
    // 로그인 상태 변경 감지
    const observer = new MutationObserver(() => {
        updateMeUI();
    });
    
    const authStateElement = document.getElementById("auth-status");
    if (authStateElement) {
        observer.observe(authStateElement, { attributes: true, childList: true });
    }
    
    // authState 변경 감지 - bootstrap 함수에서 updateAuthUI 호출 시 함께 호출되도록
    const originalUpdateAuthUI = updateAuthUI;
    updateAuthUI = function() {
        originalUpdateAuthUI.apply(this, arguments);
        if (window.location.pathname.includes("me.html")) {
            updateMeUI();
        }
    };
};

// 전역으로 노출하여 다른 스크립트에서도 사용 가능하도록
window.initAuth = initAuth;
window.updateAuthUI = updateAuthUI;
window.setAuthUser = setAuthUser;

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    bootstrap();
    initTrading();
    
    // AI 분석 페이지 초기화
    if (window.location.pathname.includes("ai-analysis.html")) {
        initAIAnalysis();
    }
    
    // 내 정보 페이지 초기화
    if (window.location.pathname.includes("me.html")) {
        initMe();
    }
});

