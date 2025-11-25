// Use current host to support mobile access over LAN (avoid hardcoded localhost)
const CURRENT_HOST = window.location.hostname || "localhost";

// 프로덕션 환경 감지 (GitHub Pages 또는 도메인)
const isProduction = window.location.hostname === 'dongyeop-woo.github.io' || 
                     window.location.hostname.endsWith('.github.io') ||
                     window.location.hostname === 'weektalk.co.kr' ||
                     window.location.hostname === 'www.weektalk.co.kr';

// 프로덕션에서 console.log 제거를 위한 유틸리티
const debugLog = isProduction ? () => {} : console.log.bind(console);
const debugWarn = isProduction ? () => {} : console.warn.bind(console);
const debugError = console.error.bind(console); // 에러는 항상 표시

// 프로덕션에서는 도메인 사용 (HTTPS), 개발 환경에서는 로컬 호스트 사용
const API_BASE = isProduction 
    ? 'https://weektalk.co.kr'  // FastAPI (Nginx를 통해 /api/ 경로로 라우팅, HTTPS)
    : `http://${CURRENT_HOST}:8000`;

const AUTH_API_BASE = isProduction
    ? 'https://weektalk.co.kr'  // Spring Boot (Nginx를 통해 /api/auth 경로로 라우팅, HTTPS)
    : `http://${CURRENT_HOST}:8001`;

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

let updateAuthUI = () => {
    // 모든 페이지에서 로그인 정보 UI 숨김 (헤더에 표시하지 않음)
    const toggle = document.getElementById("auth-toggle");
    const status = document.getElementById("auth-status");
    const displayName = document.getElementById("auth-display-name");
    const logout = document.getElementById("auth-logout");
    const loginOverlay = document.getElementById("login-overlay");
    
    // 디버깅: 로그인 오버레이 찾기
    if (!loginOverlay) {
        console.warn("login-overlay 요소를 찾을 수 없습니다.");
    }
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
            debugLog("로그인 오버레이 활성화됨");
        } else {
            console.warn("로그인 오버레이를 찾을 수 없어 활성화할 수 없습니다.");
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
        sources.slice(0, 5).forEach((source, index) => {
            // source가 객체인 경우 (ChatSource)
            if (typeof source === 'object' && source !== null) {
                if (source.url) {
                    const link = document.createElement("a");
                    link.href = source.url;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.textContent = source.title || `출처 ${index + 1}`;
                    list.appendChild(link);
                } else if (source.title) {
                    const span = document.createElement("span");
                    span.textContent = source.title;
                    list.appendChild(span);
                }
            } 
            // source가 문자열(URL)인 경우
            else if (typeof source === 'string' && source) {
                const link = document.createElement("a");
                link.href = source;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = `출처 ${index + 1}`;
                list.appendChild(link);
            }
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
            console.error("챗봇 응답 오류:", error);
            pending.textEl.textContent =
                error.message || `챗봇 응답을 생성하지 못했습니다. (${error.status || '연결 실패'}) 잠시 후 다시 시도해주세요.`;
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
        widget.classList.toggle("expanded", !collapsed);
        chatToggle.textContent = collapsed ? "+" : "ㅡ";
        chatToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
    
    // hover 시 확장 표시
    widget.addEventListener("mouseenter", () => {
        widget.classList.add("expanded");
    });
    
    widget.addEventListener("mouseleave", () => {
        if (widget.classList.contains("collapsed")) {
            widget.classList.remove("expanded");
        }
    });
};

const requestJSON = async (url, options = {}) => {
    try {
        debugLog("API 요청:", url);
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
            const message = data?.message || data?.detail || `HTTP ${response.status}`;
            const error = new Error(message);
            error.status = response.status;
            error.data = data;
            console.error("API 오류:", error);
            throw error;
        }

        return data;
    } catch (error) {
        // 네트워크 오류 처리
        if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
            const networkError = new Error(`서버에 연결할 수 없습니다: ${url}`);
            networkError.status = 'NETWORK_ERROR';
            networkError.originalError = error;
            console.error("네트워크 오류:", networkError);
            throw networkError;
        }
        throw error;
    }
};

const requestChatbotReply = (message) => {
    // AI 분석 관련 질문인지 확인
    const isAIAnalysisQuestion = /손절|익절|AI 분석|반복|문제점|습관/.test(message);
    
    return requestJSON(`${API_BASE}/api/chat`, {
        method: "POST",
        body: JSON.stringify({
            message,
            include_market: !isAIAnalysisQuestion,  // AI 분석 질문일 때는 시장 데이터 생략
            include_news: !isAIAnalysisQuestion,    // AI 분석 질문일 때는 뉴스 데이터 생략
            max_news: 3,
        }),
    });
};

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

    // 서버에서 사용자 정보 가져오기 시도
    try {
        const serverUser = await fetchCurrentUser();
        if (serverUser) {
            // 서버에서 사용자 정보를 성공적으로 가져온 경우에만 업데이트
            setAuthUser(serverUser);
        } else {
            // 서버에서 사용자 정보를 가져오지 못한 경우 (401 등)
            // 로컬 스토리지 정리 및 로그아웃 상태로 설정
            setAuthUser(null);
        }
    } catch (error) {
        // 네트워크 오류 등은 로컬 상태 유지, 401은 이미 위에서 처리됨
        console.warn("서버에서 사용자 정보 가져오기 실패:", error);
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

// 숫자 입력 필드에 콤마 포맷팅 추가/제거 유틸리티
const formatNumberInput = (value) => {
    // 숫자만 추출 (콤마 제거)
    const numericValue = value.replace(/[^\d]/g, '');
    // 콤마 포맷팅
    return numericValue ? new Intl.NumberFormat("ko-KR").format(Number(numericValue)) : '';
};

const unformatNumberInput = (value) => {
    // 콤마 제거하여 숫자만 반환
    return value.replace(/[^\d]/g, '');
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
                ${record.position === "long" ? "롱" : record.position === "short" ? "숏" : record.position === "swing" ? "스윙" : record.position === "scalping" ? "스캘핑" : record.position === "day" ? "데이트레이딩" : record.position || "-"}
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

    const getPositionText = (pos) => {
        const positionMap = {
            "long": "롱",
            "short": "숏",
            "swing": "스윙",
            "scalping": "스캘핑",
            "day": "데이트레이딩"
        };
        return positionMap[pos] || pos || "-";
    };
    const positionText = getPositionText(record.position);
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

    const getPositionText = (pos) => {
        const positionMap = {
            "long": "롱",
            "short": "숏",
            "swing": "스윙",
            "scalping": "스캘핑",
            "day": "데이트레이딩"
        };
        return positionMap[pos] || pos || "-";
    };
    const positionText = getPositionText(record.position);
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
    // 수정 모달 열 때 콤마 포맷팅 적용
    document.getElementById("edit-profit").value = formatNumberInput(profit.toString());
    
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

    // 더보기 버튼 표시/숨김 처리 (4개 이상일 때만 표시)
    if (moreBtn) {
        if (records.length >= 4 && !isExpanded) {
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
    
    // 이번 달 매매내역 렌더링 후 자동으로 습관 분석 실행
    if (window.location.pathname.includes("index.html")) {
        // 기간 선택 드롭다운 이벤트 리스너 설정
        const periodDropdownBtn = document.getElementById("period-dropdown-btn");
        const periodDropdownMenu = document.getElementById("period-dropdown-menu");
        const periodSelectedText = document.getElementById("period-selected-text");
        const periodOptions = document.querySelectorAll(".period-option");
        
        let currentPeriod = 7;
        
        // 드롭다운 버튼 클릭
        if (periodDropdownBtn && periodDropdownMenu) {
            periodDropdownBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                periodDropdownMenu.classList.toggle("active");
            });
            
            // 옵션 선택
            periodOptions.forEach(option => {
                option.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const period = option.getAttribute("data-period");
                    const periodText = option.textContent;
                    const days = period === "all" ? null : parseInt(period);
                    
                    // 선택된 텍스트 업데이트
                    periodSelectedText.textContent = periodText;
                    currentPeriod = days;
                    
                    // 드롭다운 닫기
                    periodDropdownMenu.classList.remove("active");
                    
                    // 습관 분석 재실행
                    performProfitAnalysis("profit-habit-analysis", days);
                    performLossAnalysis("loss-habit-analysis", days);
                });
            });
            
            // 외부 클릭 시 드롭다운 닫기
            document.addEventListener("click", (e) => {
                if (!periodDropdownBtn.contains(e.target) && !periodDropdownMenu.contains(e.target)) {
                    periodDropdownMenu.classList.remove("active");
                }
            });
        }
        
        // 기본값 7일로 습관 분석 실행
        performProfitAnalysis("profit-habit-analysis", 7);
        performLossAnalysis("loss-habit-analysis", 7);
        initTradingCalendar();
    }
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
    const moreBtn = document.getElementById(`profit-detail-btn-${type}`);
    
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

    if (stocks.length === 0) {
        // 데이터가 없을 때
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "empty-trading-list";
        emptyMsg.textContent = emptyMessage;
        legendContainer.appendChild(emptyMsg);
        if (moreBtn) moreBtn.style.display = "none";
        return;
    }

    // 수익금 절대값으로 정렬 (큰 것부터)
    const sortedStocks = stocks.sort((a, b) => Math.abs(stockProfits[b]) - Math.abs(stockProfits[a]));
    
    // 표시할 종목은 최대 2개로 제한
    const displayStocks = sortedStocks.slice(0, 2);
    
    // 표시되는 2개 종목의 절대값 합 계산 (비율 계산용)
    const totalProfitAbs = displayStocks.reduce((sum, stock) => sum + Math.abs(stockProfits[stock]), 0);
    
    if (totalProfitAbs === 0) {
        const emptyMsg = document.createElement("div");
        emptyMsg.className = "empty-trading-list";
        emptyMsg.textContent = emptyMessage;
        legendContainer.appendChild(emptyMsg);
        if (moreBtn) moreBtn.style.display = "none";
        return;
    }

    // 파이 차트 그리기 (그래프 크기에 맞게 반지름 조정)
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    let currentOffset = 0;

    displayStocks.forEach((stock) => {
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
    
    // 종목이 2개를 넘어가면 더보기 버튼 표시
    if (moreBtn) {
        if (sortedStocks.length > 2) {
            moreBtn.style.display = "flex";
            moreBtn.onclick = () => showProfitDetailModal(type, records, sortedStocks, stockProfits);
        } else {
            moreBtn.style.display = "none";
        }
    }
};

// 종목별 수익금 상세 모달 표시
const showProfitDetailModal = (type, records, sortedStocks, stockProfits) => {
    const modal = document.getElementById("profit-detail-modal");
    const title = document.getElementById("profit-detail-title");
    const list = document.getElementById("profit-detail-list");
    
    if (!modal || !title || !list) return;
    
    // 제목 설정
    const typeNames = {
        'today': '오늘',
        'month': '이번 달',
        'all': '전체'
    };
    title.textContent = `${typeNames[type]} 종목별 수익금`;
    
    // 종목별 수익금 리스트 생성
    let html = '';
    sortedStocks.forEach((stock, index) => {
        const profit = stockProfits[stock];
        const profitClass = profit > 0 ? "profit-positive" : profit < 0 ? "profit-negative" : "";
        const color = profit > 0 ? "#4ac9ff" : profit < 0 ? "#ff5757" : "#9e9e9e";
        const totalProfitAbs = Object.values(stockProfits).reduce((sum, p) => sum + Math.abs(p), 0);
        const percentage = totalProfitAbs > 0 ? (Math.abs(profit) / totalProfitAbs * 100).toFixed(1) : 0;
        
        // 해당 종목의 매매내역 필터링
        const stockRecords = records.filter(r => (r.stock || "기타") === stock);
        
        html += `
            <div class="profit-detail-item" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--card); border-radius: 12px; border-left: 4px solid ${color};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${color};"></div>
                        <strong style="font-size: 1.1rem;">${stock}</strong>
                    </div>
                    <div style="text-align: right;">
                        <div class="${profitClass}" style="font-size: 1.1rem; font-weight: 600;">${formatCurrency(profit)}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">${percentage}%</div>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--card-border);">
                    <div style="font-size: 0.9rem; color: var(--text-muted);">매매 건수: ${stockRecords.length}건</div>
                    ${stockRecords.map(record => {
                        let recordProfit = Number(record.profit) || 0;
                        if (record.result === "loss" && recordProfit > 0) {
                            recordProfit = -recordProfit;
                        }
                        const recordProfitClass = recordProfit > 0 ? "profit-positive" : recordProfit < 0 ? "profit-negative" : "";
                        const resultText = record.result === "win" ? "승" : record.result === "draw" ? "무" : record.result === "loss" ? "패" : "-";
                        const dateStr = record.date ? new Date(record.date).toLocaleDateString("ko-KR") : "-";
                        return `
                            <div style="padding: 0.5rem; background: var(--surface); border-radius: 6px; font-size: 0.9rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span>${dateStr} · ${resultText}</span>
                                    <span class="${recordProfitClass}">${formatCurrency(recordProfit)}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });
    
    list.innerHTML = html;
    
    // 모달 열기
    modal.style.display = "flex";
    modal.classList.add("active");
    const sideModal = modal.querySelector(".side-modal");
    if (sideModal) {
        sideModal.classList.add("active");
    }
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

    // 수익금 입력 필드에 콤마 포맷팅 적용
    const profitInputs = ['today-profit', 'month-profit', 'edit-profit'];
    profitInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            // 입력 타입을 text로 변경 (number는 콤마를 허용하지 않음)
            input.type = 'text';
            input.inputMode = 'numeric';
            
            // 입력 시 포맷팅
            input.addEventListener('input', (e) => {
                const cursorPos = e.target.selectionStart;
                const oldValue = e.target.value;
                const formatted = formatNumberInput(e.target.value);
                e.target.value = formatted;
                
                // 커서 위치 조정 (콤마가 추가/제거되면 위치 보정)
                const diff = formatted.length - oldValue.length;
                const newPos = Math.max(0, cursorPos + diff);
                e.target.setSelectionRange(newPos, newPos);
            });
            
            // 포커스 아웃 시에도 포맷팅 적용
            input.addEventListener('blur', (e) => {
                e.target.value = formatNumberInput(e.target.value);
            });
        }
    });

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
            
            let profit = Number(unformatNumberInput(document.getElementById("today-profit").value)) || 0;
            const result = document.getElementById("today-result").value || null;
            // 패배인 경우 수익금을 음수로 변환
            if (result === "loss" && profit > 0) {
                profit = -profit;
            }
            
            // 손절 사유 또는 익절 사유 중 하나는 필수 입력
            const profitReason = document.getElementById("today-profit-reason").value.trim();
            const lossReason = document.getElementById("today-loss-reason").value.trim();
            if (!profitReason && !lossReason) {
                alert("익절 사유 또는 손절 사유 중 하나는 필수로 입력해주세요.");
                return;
            }
            
            const formData = {
                date: document.getElementById("today-date").value,
                stock: document.getElementById("today-stock").value.trim(),
                position: document.getElementById("today-position").value,
                result: result,
                profit: profit,
                chartImage: chartImage,
                profitReason: profitReason || null,
                lossReason: lossReason || null
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
            
            let profit = Number(unformatNumberInput(document.getElementById("month-profit").value)) || 0;
            const result = document.getElementById("month-result").value || null;
            // 패배인 경우 수익금을 음수로 변환
            if (result === "loss" && profit > 0) {
                profit = -profit;
            }
            
            // 손절 사유 또는 익절 사유 중 하나는 필수 입력
            const profitReason = document.getElementById("month-profit-reason").value.trim();
            const lossReason = document.getElementById("month-loss-reason").value.trim();
            if (!profitReason && !lossReason) {
                alert("익절 사유 또는 손절 사유 중 하나는 필수로 입력해주세요.");
                return;
            }
            
            const formData = {
                date: document.getElementById("month-date").value,
                stock: document.getElementById("month-stock").value.trim(),
                position: document.getElementById("month-position").value,
                result: result,
                profit: profit,
                chartImage: chartImage,
                profitReason: profitReason || null,
                lossReason: lossReason || null
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
            
            let profit = Number(unformatNumberInput(document.getElementById("edit-profit").value)) || 0;
            const result = document.getElementById("edit-result").value || null;
            // 패배인 경우 수익금을 음수로 변환
            if (result === "loss" && profit > 0) {
                profit = -profit;
            }
            
            // 손절 사유 또는 익절 사유 중 하나는 필수 입력
            const profitReason = document.getElementById("edit-profit-reason").value.trim();
            const lossReason = document.getElementById("edit-loss-reason").value.trim();
            if (!profitReason && !lossReason) {
                alert("익절 사유 또는 손절 사유 중 하나는 필수로 입력해주세요.");
                return;
            }
            
            const formData = {
                date: document.getElementById("edit-date").value,
                stock: document.getElementById("edit-stock").value.trim(),
                position: document.getElementById("edit-position").value,
                result: result,
                profit: profit,
                chartImage: chartImage,
                profitReason: profitReason || null,
                lossReason: lossReason || null
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

// 캘린더 초기화 (매매일지 페이지용)
const initTradingCalendar = () => {
    const calendarDays = document.getElementById("trading-calendar-days");
    const monthYear = document.getElementById("trading-calendar-month-year");
    const prevBtn = document.getElementById("trading-prev-month");
    const nextBtn = document.getElementById("trading-next-month");
    
    if (!calendarDays || !monthYear) return;
    
    let currentDate = new Date();
    let currentYear = currentDate.getFullYear();
    let currentMonth = currentDate.getMonth();
    
    // 매매 내역을 날짜별로 그룹화
    function getTradingByDate() {
        const history = typeof loadTradingHistory === "function" ? loadTradingHistory() : [];
        const tradingByDate = {};
        
        history.forEach(record => {
            const dateStr = record.date;
            if (!tradingByDate[dateStr]) {
                tradingByDate[dateStr] = [];
            }
            tradingByDate[dateStr].push(record);
        });
        
        return tradingByDate;
    }
    
    // 캘린더 렌더링
    function renderCalendar() {
        const tradingByDate = getTradingByDate();
        
        // 월/년 표시
        const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
        monthYear.textContent = `${currentYear}년 ${monthNames[currentMonth]}`;
        
        // 첫 번째 날짜와 마지막 날짜 계산
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // 주의 첫 날
        
        calendarDays.innerHTML = "";
        
        // 로컬 시간대 기준으로 날짜 문자열 생성 (YYYY-MM-DD)
        function getLocalDateString(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        // 6주치 날짜 렌더링
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayElement = document.createElement("div");
            dayElement.className = "calendar-day";
            
            const isCurrentMonth = date.getMonth() === currentMonth;
            const isToday = date.toDateString() === new Date().toDateString();
            const dateStr = getLocalDateString(date);
            const trades = tradingByDate[dateStr] || [];
            
            if (!isCurrentMonth) {
                dayElement.classList.add("calendar-day-other-month");
            }
            if (isToday) {
                dayElement.classList.add("calendar-day-today");
            }
            if (trades.length > 0) {
                dayElement.classList.add("calendar-day-has-trade");
            }
            
            const dayNumber = document.createElement("div");
            dayNumber.className = "calendar-day-number";
            dayNumber.textContent = date.getDate();
            dayElement.appendChild(dayNumber);
            
            // 매매 내역 표시
            if (trades.length > 0) {
                const tradeIndicator = document.createElement("div");
                tradeIndicator.className = "calendar-day-trades";
                const uniqueStocks = [...new Set(trades.map(t => t.stock).filter(Boolean))];
                // 최대 1개 종목만 표시하고 나머지는 숫자로
                if (uniqueStocks.length === 1) {
                    // 종목명이 길면 자르기
                    const stockName = uniqueStocks[0];
                    tradeIndicator.textContent = stockName.length > 6 ? stockName.substring(0, 5) + "..." : stockName;
                } else {
                    tradeIndicator.textContent = `${uniqueStocks[0].substring(0, 4)} +${uniqueStocks.length - 1}`;
                }
                dayElement.appendChild(tradeIndicator);
                
                // 클릭 이벤트
                dayElement.style.cursor = "pointer";
                dayElement.addEventListener("click", () => showTradingDateDetail(dateStr, trades));
            }
            
            calendarDays.appendChild(dayElement);
        }
    }
    
    // 날짜 상세 정보 표시
    function showTradingDateDetail(dateStr, trades) {
        const modal = document.getElementById("trading-calendar-detail-modal");
        const dateTitle = document.getElementById("trading-calendar-detail-date");
        const content = document.getElementById("trading-calendar-detail-content");
        
        if (!modal || !dateTitle || !content) return;
        
        // YYYY-MM-DD 형식을 로컬 시간대로 파싱
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const dateFormatted = date.toLocaleDateString("ko-KR", { 
            year: "numeric", 
            month: "long", 
            day: "numeric",
            weekday: "long"
        });
        
        dateTitle.textContent = dateFormatted;
        
        if (trades.length === 0) {
            content.innerHTML = "<p>이 날짜에는 매매 내역이 없습니다.</p>";
        } else {
            let html = `<div style="margin-bottom: 1rem;"><strong>총 ${trades.length}건의 매매 내역</strong></div>`;
            trades.forEach(trade => {
                let profit = Number(trade.profit) || 0;
                if (trade.result === "loss" && profit > 0) {
                    profit = -profit;
                }
                const profitClass = profit > 0 ? "profit-positive" : profit < 0 ? "profit-negative" : "";
                const profitText = typeof formatCurrency === "function" ? formatCurrency(profit) : profit.toLocaleString() + "원";
                const resultText = trade.result === "win" ? "승" : trade.result === "draw" ? "무" : trade.result === "loss" ? "패" : "-";
                const getPositionText = (pos) => {
                    const positionMap = {
                        "long": "롱",
                        "short": "숏",
                        "swing": "스윙",
                        "scalping": "스캘핑",
                        "day": "데이트레이딩"
                    };
                    return positionMap[pos] || pos || "-";
                };
                const positionText = getPositionText(trade.position);
                
                html += `
                    <div class="card" style="margin-bottom: 1rem; padding: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <strong>${escapeHtml(trade.stock || "-")}</strong>
                            <span class="trading-profit ${profitClass}">${profitText}</span>
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.9rem;">
                            <span>${positionText}</span> · 
                            <span>${resultText}</span>
                        </div>
                        ${trade.profitReason ? `<div style="margin-top: 0.5rem; font-size: 0.9rem;">익절 이유: ${escapeHtml(trade.profitReason)}</div>` : ""}
                        ${trade.lossReason ? `<div style="margin-top: 0.5rem; font-size: 0.9rem;">손절 이유: ${escapeHtml(trade.lossReason)}</div>` : ""}
                    </div>
                `;
            });
            content.innerHTML = html;
        }
        
        modal.style.display = "flex";
        modal.classList.add("active");
        const sideModal = modal.querySelector(".side-modal");
        if (sideModal) {
            sideModal.classList.add("active");
        }
    }
    
    function closeTradingCalendarDetail() {
        const modal = document.getElementById("trading-calendar-detail-modal");
        if (modal) {
            modal.style.display = "none";
            modal.classList.remove("active");
            const sideModal = modal.querySelector(".side-modal");
            if (sideModal) {
                sideModal.classList.remove("active");
            }
        }
    }
    
    function escapeHtml(str) {
        return String(str ?? "").replace(/[&<>"]/g, s => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[s]));
    }
    
    // 이전/다음 월 버튼
    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            renderCalendar();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            renderCalendar();
        });
    }
    
    // 모달 닫기
    const closeBtn = document.getElementById("close-trading-calendar-detail");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeTradingCalendarDetail);
    }
    
    const modal = document.getElementById("trading-calendar-detail-modal");
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target.id === "trading-calendar-detail-modal") {
                closeTradingCalendarDetail();
            }
        });
    }
    
    // 초기 렌더링
    renderCalendar();
};

// 종목별 수익금 모달 닫기
const closeProfitDetailModal = () => {
    const modal = document.getElementById("profit-detail-modal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.remove("active");
        const sideModal = modal.querySelector(".side-modal");
        if (sideModal) {
            sideModal.classList.remove("active");
        }
    }
};

const initTrading = () => {
    initTradingForms();
    initTradingToggles();
    
    // 종목별 수익금 모달 닫기 버튼
    const closeProfitDetailBtn = document.getElementById("close-profit-detail-modal");
    if (closeProfitDetailBtn) {
        closeProfitDetailBtn.addEventListener("click", closeProfitDetailModal);
    }
    
    // 종목별 수익금 모달 외부 클릭 시 닫기
    const profitDetailModal = document.getElementById("profit-detail-modal");
    if (profitDetailModal) {
        profitDetailModal.addEventListener("click", (e) => {
            if (e.target.id === "profit-detail-modal") {
                closeProfitDetailModal();
            }
        });
    }
    
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
    const chartAnalysisBtn = document.getElementById("chart-analysis-btn");
    const lossAnalysisContent = document.getElementById("loss-analysis-content");
    const profitAnalysisContent = document.getElementById("profit-analysis-content");
    const chartAnalysisContent = document.getElementById("chart-analysis-content");
    
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
            if (chartAnalysisContent) chartAnalysisContent.style.display = "none";
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
            if (chartAnalysisContent) chartAnalysisContent.style.display = "none";
        });
    }

    // 차트 분석 버튼 클릭
    if (chartAnalysisBtn) {
        chartAnalysisBtn.addEventListener("click", () => {
            if (analysisSelection) analysisSelection.style.display = "none";
            if (chartAnalysisContent) {
                chartAnalysisContent.style.display = "block";
            }
            if (lossAnalysisContent) lossAnalysisContent.style.display = "none";
            if (profitAnalysisContent) profitAnalysisContent.style.display = "none";
        });
    }
    
    // 도움말 버튼 클릭 - 챗봇이 자동으로 설명
    const lossHelpBtn = document.getElementById("loss-help-btn");
    const profitHelpBtn = document.getElementById("profit-help-btn");
    const chartHelpBtn = document.getElementById("chart-help-btn");
    
    const askChatbotAboutFeature = async (featureType) => {
        // 챗봇이 열려있지 않으면 열기
        const chatbot = document.getElementById("chatbot");
        const chatBody = document.getElementById("chat-body");
        const chatInput = document.getElementById("chat-input");
        
        if (!chatbot || !chatBody || !chatInput) {
            alert("챗봇을 사용할 수 없습니다. 페이지를 새로고침해주세요.");
            return;
        }
        
        // 챗봇 열기
        chatbot.classList.remove("collapsed");
        chatbot.classList.add("expanded");
        
        // 질문 생성
        let question = "";
        if (featureType === "loss") {
            question = "손절 시 반복되는 문제점 찾기 기능에 대해 자세히 설명해주세요. 이 기능이 어떻게 작동하고, 어떤 데이터가 필요한지 알려주세요.";
        } else if (featureType === "profit") {
            question = "익절 시 반복되는 좋은 습관 찾기 기능에 대해 자세히 설명해주세요. 이 기능이 어떻게 작동하고, 어떤 데이터가 필요한지 알려주세요.";
        } else if (featureType === "chart") {
            question = "차트 분석 기능에 대해 자세히 설명해주세요. PVG, 상승/하락 라인, 지지/저항선 분석이 어떻게 작동하는지 알려주세요.";
        }
        
        // 사용자 메시지 추가
        const userMessage = document.createElement("div");
        userMessage.className = "chat-message user";
        const userText = document.createElement("p");
        userText.className = "chat-message__text";
        userText.textContent = question;
        userMessage.appendChild(userText);
        chatBody.appendChild(userMessage);
        chatBody.scrollTop = chatBody.scrollHeight;
        
        // 챗봇 응답 요청
        const pending = document.createElement("div");
        pending.className = "chat-message bot";
        const pendingText = document.createElement("p");
        pendingText.className = "chat-message__text";
        pendingText.textContent = "답변을 준비하고 있어요...";
        pending.appendChild(pendingText);
        chatBody.appendChild(pending);
        chatBody.scrollTop = chatBody.scrollHeight;
        
        try {
            const { reply, sources } = await requestChatbotReply(question);
            pendingText.textContent = reply;
            
            // 소스 표시 (있는 경우)
            if (sources && sources.length > 0) {
                const sourcesDiv = document.createElement("div");
                sourcesDiv.className = "chat-message__sources";
                sources.forEach((source, index) => {
                    if (source.url) {
                        const link = document.createElement("a");
                        link.href = source.url;
                        link.target = "_blank";
                        link.rel = "noopener noreferrer";
                        link.textContent = `출처 ${index + 1}`;
                        sourcesDiv.appendChild(link);
                    }
                });
                if (sourcesDiv.childNodes.length) {
                    pending.appendChild(sourcesDiv);
                }
            }
        } catch (error) {
            console.error("챗봇 응답 오류:", error);
            const errorMsg = error.message || `챗봇 응답을 생성하지 못했습니다. (${error.status || '연결 실패'})`;
            const helpMsg = `\n\n백엔드 서버가 실행 중인지 확인해주세요:\n- FastAPI: ${API_BASE}/api/chat\n- 브라우저 콘솔에서 자세한 오류를 확인하세요.`;
            pendingText.textContent = errorMsg + helpMsg;
        }
        
        chatBody.scrollTop = chatBody.scrollHeight;
    };
    
    if (lossHelpBtn) {
        lossHelpBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            askChatbotAboutFeature("loss");
        });
    }
    
    if (profitHelpBtn) {
        profitHelpBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            askChatbotAboutFeature("profit");
        });
    }

    if (chartHelpBtn) {
        chartHelpBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            askChatbotAboutFeature("chart");
        });
    }
    
    // 뒤로가기 버튼
    const backFromLoss = document.getElementById("back-from-loss");
    const backFromProfit = document.getElementById("back-from-profit");
    const backFromChart = document.getElementById("back-from-chart");

    if (backFromChart) {
        backFromChart.addEventListener("click", () => {
            if (chartAnalysisContent) chartAnalysisContent.style.display = "none";
            if (analysisSelection) analysisSelection.style.display = "flex";
        });
    }

    // 차트 분석 관련 이벤트 리스너
    const chartImageInput = document.getElementById("chart-image-input");
    const chartImagePreview = document.getElementById("chart-image-preview");
    const chartPreviewImg = document.getElementById("chart-preview-img");
    const removeChartImage = document.getElementById("remove-chart-image");
    const analyzeChartBtn = document.getElementById("analyze-chart-btn");
    const chartSymbolInput = document.getElementById("chart-symbol");
    const chartAnalysisResult = document.getElementById("chart-analysis-result");
    const chartAnalysisText = document.getElementById("chart-analysis-text");
    const chartSummaryContent = document.getElementById("chart-summary-content");

    let currentChartImageBase64 = null;

    // 이미지 업로드
    if (chartImageInput) {
        chartImageInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    currentChartImageBase64 = event.target.result;
                    if (chartPreviewImg) {
                        chartPreviewImg.src = currentChartImageBase64;
                    }
                    if (chartImagePreview) {
                        chartImagePreview.style.display = "block";
                    }
                    if (analyzeChartBtn) {
                        analyzeChartBtn.disabled = false;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 이미지 제거
    if (removeChartImage) {
        removeChartImage.addEventListener("click", () => {
            currentChartImageBase64 = null;
            if (chartImageInput) chartImageInput.value = "";
            if (chartImagePreview) chartImagePreview.style.display = "none";
            if (analyzeChartBtn) analyzeChartBtn.disabled = true;
            if (chartAnalysisResult) chartAnalysisResult.style.display = "none";
        });
    }

    // 차트 분석 시작
    if (analyzeChartBtn) {
        analyzeChartBtn.addEventListener("click", async () => {
            if (!currentChartImageBase64) {
                alert("차트 이미지를 업로드해주세요.");
                return;
            }

            analyzeChartBtn.disabled = true;
            analyzeChartBtn.textContent = "분석 중...";

            try {
                const symbol = chartSymbolInput ? chartSymbolInput.value.trim() : null;
                await performChartAnalysis(currentChartImageBase64, symbol);
            } catch (error) {
                console.error("차트 분석 오류:", error);
                alert(`차트 분석 중 오류가 발생했습니다: ${error.message}`);
            } finally {
                analyzeChartBtn.disabled = false;
                analyzeChartBtn.textContent = "차트 분석 시작";
            }
        });
    }
    
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
    updateAuthUI = function () {
        if (originalUpdateAuthUI) {
            originalUpdateAuthUI.apply(this, arguments);
        }
        updateAIAnalysisUI();
    };

    // 차트 분석 함수
    const performChartAnalysis = async (imageBase64, symbol = null) => {
        const chartAnalysisResult = document.getElementById("chart-analysis-result");
        const chartAnalysisText = document.getElementById("chart-analysis-text");
        const chartSummaryContent = document.getElementById("chart-summary-content");

        if (!chartAnalysisResult || !chartAnalysisText) return;

        // 로딩 표시
        chartAnalysisResult.style.display = "block";
        chartAnalysisText.textContent = "차트를 분석하는 중입니다...";
        chartSummaryContent.innerHTML = "";

        try {
            // Base64에서 data:image 부분 제거
            let imageData = imageBase64;
            if (imageData.includes(",")) {
                imageData = imageData.split(",")[1];
            }

            const response = await fetch(`${API_BASE}/api/analyze-chart`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    image_base64: imageData,
                    symbol: symbol || null,
                    analysis_type: "full"
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "알 수 없는 오류" }));
                throw new Error(errorData.detail || `서버 오류: ${response.status}`);
            }

            const result = await response.json();

            // 분석 결과 표시
            chartAnalysisText.textContent = result.analysis || "분석 결과가 없습니다.";

            // 요약 정보 표시
            let summaryHTML = "<div style='display: flex; flex-direction: column; gap: 1rem;'>";

            if (result.pvg_detected !== null) {
                summaryHTML += `
                <div style="padding: 0.75rem; background: ${result.pvg_detected ? '#fff3cd' : '#d1ecf1'}; border-radius: 6px;">
                    <strong>PVG 감지:</strong> ${result.pvg_detected ? '✅ 감지됨' : '❌ 감지되지 않음'}
                </div>
            `;
            }

            if (result.trend) {
                const trendColors = {
                    "상승": "#d4edda",
                    "하락": "#f8d7da",
                    "횡보": "#d1ecf1"
                };
                summaryHTML += `
                <div style="padding: 0.75rem; background: ${trendColors[result.trend] || '#f5f5f5'}; border-radius: 6px;">
                    <strong>추세:</strong> ${result.trend}
                </div>
            `;
            }

            if (result.recommendations && result.recommendations.length > 0) {
                summaryHTML += `
                <div style="padding: 0.75rem; background: #e7f3ff; border-radius: 6px;">
                    <strong>추천:</strong> ${result.recommendations.join(", ")}
                </div>
            `;
            }

            summaryHTML += "</div>";
            chartSummaryContent.innerHTML = summaryHTML;

        } catch (error) {
            console.error("차트 분석 오류:", error);
            chartAnalysisText.textContent = `오류가 발생했습니다: ${error.message}\n\n백엔드 서버(${API_BASE})가 실행 중인지 확인해주세요.`;
            chartSummaryContent.innerHTML = "";
        }
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
    
    // 일반적인 단어 제외 리스트 (너무 일반적이어서 패턴으로 인식하면 안 되는 단어들)
    const commonWords = new Set([
        '손절', '익절', '매수', '매도', '거래', '주식', '종목', '가격', '수익', '손실',
        '진입', '청산', '보유', '매매', '투자', '차트', '분석', '시장', '상승', '하락',
        '때문', '때문에', '그래서', '그리고', '하지만', '그런데', '그러나', '또한',
        '이것', '저것', '그것', '이런', '저런', '그런', '이렇게', '저렇게', '그렇게'
    ]);
    
    // 문장에서 중요한 키워드 추출 함수
    const extractKeywords = (text) => {
        // 한글, 영문, 숫자로 구성된 단어 추출 (2글자 이상)
        const words = text.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
        return words
            .filter(word => {
                // 숫자만 있는 단어 제외
                if (/^\d+$/.test(word)) return false;
                // 일반적인 단어 제외
                if (commonWords.has(word)) return false;
                return true;
            });
    };
    
    // Jaccard 유사도 계산 (두 문장의 공통 키워드 비율)
    const calculateSimilarity = (text1, text2) => {
        const keywords1 = new Set(extractKeywords(text1));
        const keywords2 = new Set(extractKeywords(text2));
        
        if (keywords1.size === 0 || keywords2.size === 0) return 0;
        
        // 공통 키워드
        const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
        // 합집합
        const union = new Set([...keywords1, ...keywords2]);
        
        // Jaccard 유사도
        return intersection.size / union.size;
    };
    
    // 1. 정확히 동일한 텍스트 카운트
    const exactTextCount = {};
    normalizedTexts.forEach(text => {
        exactTextCount[text] = (exactTextCount[text] || 0) + 1;
    });
    
    const exactPatterns = Object.entries(exactTextCount)
        .filter(([text, count]) => count >= 2)
        .map(([text, count]) => ({
            pattern: text,
            count: count,
            isExact: true,
            examples: [text]
        }))
        .sort((a, b) => b.count - a.count);
    
    // 2. 유사한 문장 그룹화
    const similarGroups = [];
    const processed = new Set();
    
    for (let i = 0; i < normalizedTexts.length; i++) {
        if (processed.has(i)) continue;
        
        const text1 = normalizedTexts[i];
        const group = [text1];
        processed.add(i);
        
        // 다른 문장들과 유사도 계산
        for (let j = i + 1; j < normalizedTexts.length; j++) {
            if (processed.has(j)) continue;
            
            const text2 = normalizedTexts[j];
            const similarity = calculateSimilarity(text1, text2);
            
            // 유사도가 0.4 이상이면 같은 그룹으로 (40% 이상 공통 키워드)
            if (similarity >= 0.4) {
                group.push(text2);
                processed.add(j);
            }
        }
        
        // 2개 이상의 문장이 그룹에 있으면 패턴으로 인식
        if (group.length >= 2) {
            // 그룹에서 공통 키워드 추출
            const allKeywords = group.map(extractKeywords).flat();
            const keywordCount = {};
            allKeywords.forEach(kw => {
                keywordCount[kw] = (keywordCount[kw] || 0) + 1;
            });
            
            // 그룹 내에서 2개 이상의 문장에 나타나는 키워드만
            const commonKeywords = Object.entries(keywordCount)
                .filter(([kw, count]) => count >= 2)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3) // 상위 3개 키워드
                .map(([kw]) => kw);
            
            if (commonKeywords.length > 0) {
                similarGroups.push({
                    pattern: commonKeywords.join(', '),
                    count: group.length,
                    examples: group.slice(0, 3),
                    keywords: commonKeywords
                });
            }
        }
    }
    
    // 3. 결과 병합 및 정렬
    const allPatterns = [...exactPatterns, ...similarGroups];
    allPatterns.sort((a, b) => b.count - a.count);
    
    return allPatterns.slice(0, 10); // 상위 10개만 반환
};

// 손절 시 반복되는 문제점 찾기 (자동 분석용 - 간단 버전)
const performLossAnalysis = async (targetElementId = "loss-analysis-detail", days = null) => {
    const lossDetailEl = document.getElementById(targetElementId);
    if (!lossDetailEl) return;
    
    lossDetailEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">분석 중...</p>`;
    
    try {
        const response = await fetch(`${AUTH_API_BASE}/api/trades`, {
            method: "GET",
            credentials: "include"
        });
        
        if (!response.ok) {
            lossDetailEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">매매내역을 불러올 수 없습니다.</p>`;
            return;
        }
        
        let history = await response.json();
        
        if (!history || history.length === 0) {
            lossDetailEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">매매내역이 없습니다.</p>`;
            return;
        }
        
        // 기간 필터링 - 선택한 기간 내의 매매내역만 사용
        if (days !== null) {
            const cutoffDate = new Date();
            cutoffDate.setHours(0, 0, 0, 0); // 오늘 00:00:00
            cutoffDate.setDate(cutoffDate.getDate() - days);
            history = history.filter(trade => {
                const tradeDate = new Date(trade.date);
                tradeDate.setHours(0, 0, 0, 0); // 거래일 00:00:00
                return tradeDate >= cutoffDate;
            });
        }
        // days가 null이면 "모두" 선택 - 모든 매매내역 사용
        
        const lossTrades = history.filter(r => r.result === "loss");
        
        if (lossTrades.length === 0) {
            lossDetailEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">손절 거래가 없습니다.</p>`;
            return;
        }
        
        const lossReasons = lossTrades
            .map(trade => trade.lossReason)
            .filter(reason => reason && reason.trim().length > 0);
        
        if (lossReasons.length === 0) {
            lossDetailEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">손절 사유가 기록된 거래가 없습니다.</p>`;
            return;
        }
        
        const repeatingPatterns = findRepeatingPatterns(lossReasons);
        
        let analysis = "";
        
        if (repeatingPatterns.length > 0) {
            analysis = `
                <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                    ${repeatingPatterns.slice(0, 3).map((pattern, idx) => {
                        const showExamples = pattern.examples && pattern.examples.length > 0;
                        return `
                        <div style="padding: 0.4rem 0.5rem; background: var(--surface); border-radius: 4px; font-size: 0.8rem; border-left: 3px solid var(--negative);">
                            <strong>${idx + 1}.</strong> <strong style="color: var(--primary);">"${pattern.pattern}"</strong> <span style="color: var(--text-muted);">(${pattern.count}회)</span>
                            ${showExamples && !pattern.isExact ? `<div style="margin-top: 0.25rem; font-size: 0.7rem; color: var(--text-muted); padding-left: 0.4rem; border-left: 2px solid var(--border);">
                                ${pattern.examples.slice(0, 2).map(ex => `• ${ex.length > 50 ? ex.substring(0, 50) + '...' : ex}`).join('<br>')}
                            </div>` : ''}
                </div>
            `;
                    }).join("")}
                </div>
            `;
        } else {
            analysis = `<p style="color: var(--text-muted); font-size: 0.9rem;">반복되는 패턴이 없습니다.</p>`;
        }
        
        lossDetailEl.innerHTML = analysis;
    } catch (error) {
        lossDetailEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">분석 중 오류가 발생했습니다.</p>`;
    }
};

// 익절 시 반복되는 좋은 습관 찾기 (자동 분석용 - 간단 버전)
const performProfitAnalysis = async (targetElementId = "profit-analysis-detail", days = null) => {
    const profitDetailEl = document.getElementById(targetElementId);
    if (!profitDetailEl) return;
    
    profitDetailEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">분석 중...</p>`;
    
    try {
        const response = await fetch(`${AUTH_API_BASE}/api/trades`, {
            method: "GET",
            credentials: "include"
        });
        
        if (!response.ok) {
            profitDetailEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">매매내역을 불러올 수 없습니다.</p>`;
            return;
        }
        
        let history = await response.json();
        
        if (!history || history.length === 0) {
            profitDetailEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">매매내역이 없습니다.</p>`;
            return;
        }
        
        // 기간 필터링 - 선택한 기간 내의 매매내역만 사용
        if (days !== null) {
            const cutoffDate = new Date();
            cutoffDate.setHours(0, 0, 0, 0); // 오늘 00:00:00
            cutoffDate.setDate(cutoffDate.getDate() - days);
            history = history.filter(trade => {
                const tradeDate = new Date(trade.date);
                tradeDate.setHours(0, 0, 0, 0); // 거래일 00:00:00
                return tradeDate >= cutoffDate;
            });
        }
        // days가 null이면 "모두" 선택 - 모든 매매내역 사용
        
        const profitTrades = history.filter(r => r.result === "win");
        
        if (profitTrades.length === 0) {
            profitDetailEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">익절 거래가 없습니다.</p>`;
            return;
        }
        
        const profitReasons = profitTrades
            .map(trade => trade.profitReason)
            .filter(reason => reason && reason.trim().length > 0);
        
        if (profitReasons.length === 0) {
            profitDetailEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">익절 사유가 기록된 거래가 없습니다.</p>`;
            return;
        }
        
        const repeatingPatterns = findRepeatingPatterns(profitReasons);
        
        let analysis = "";
        
        if (repeatingPatterns.length > 0) {
            analysis = `
                <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                    ${repeatingPatterns.slice(0, 3).map((pattern, idx) => {
                        const showExamples = pattern.examples && pattern.examples.length > 0;
                        return `
                        <div style="padding: 0.4rem 0.5rem; background: var(--surface); border-radius: 4px; font-size: 0.8rem; border-left: 3px solid var(--positive);">
                            <strong>${idx + 1}.</strong> <strong style="color: var(--primary);">"${pattern.pattern}"</strong> <span style="color: var(--text-muted);">(${pattern.count}회)</span>
                            ${showExamples && !pattern.isExact ? `<div style="margin-top: 0.25rem; font-size: 0.7rem; color: var(--text-muted); padding-left: 0.4rem; border-left: 2px solid var(--border);">
                                ${pattern.examples.slice(0, 2).map(ex => `• ${ex.length > 50 ? ex.substring(0, 50) + '...' : ex}`).join('<br>')}
                            </div>` : ''}
                </div>
            `;
                    }).join("")}
                </div>
            `;
        } else {
            analysis = `<p style="color: var(--text-muted); font-size: 0.9rem;">반복되는 패턴이 없습니다.</p>`;
        }
        
        profitDetailEl.innerHTML = analysis;
    } catch (error) {
        profitDetailEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">분석 중 오류가 발생했습니다.</p>`;
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
    updateAuthUI = function () {
        if (originalUpdateAuthUI) {
            originalUpdateAuthUI.apply(this, arguments);
        }
        if (window.location.pathname.includes("me.html")) {
            updateMeUI();
        }
    };
};

// 전역으로 노출하여 다른 스크립트에서도 사용 가능하도록
window.initAuth = initAuth;
window.updateAuthUI = updateAuthUI;
window.setAuthUser = setAuthUser;

// 좌측/하단 내비게이션 활성 항목 설정
const setActiveNavItem = () => {
    const currentPath = window.location.pathname.replace(/\\/g, "/");
    const currentSearch = window.location.search;
    const navItems = document.querySelectorAll(".side-nav__item, .bottom-nav__item");
    
    navItems.forEach((item) => {
        item.classList.remove("active");
        const itemPath = item.pathname.replace(/\\/g, "/");
        const itemSearch = item.search || "";
        
        // index.html 처리: 루트(/)나 /index.html 모두 index.html로 간주
        const isIndexPath =
            itemPath.endsWith("/index.html") &&
            (currentPath.endsWith("/index.html") || currentPath === "/");
        
        const pathMatches =
            itemPath === currentPath ||
            isIndexPath;
        
        const searchMatches = itemSearch ? itemSearch === currentSearch : true;
        
        if (pathMatches && searchMatches) {
                item.classList.add("active");
        }
    });
};

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    bootstrap();
    initTrading();
    setActiveNavItem(); // 사이드바 활성 항목 설정
    
    // AI 분석 페이지 초기화
    if (window.location.pathname.includes("ai-analysis.html")) {
        initAIAnalysis();
        initChatbot(); // 챗봇 초기화
    }
    
    // 내 정보 페이지 초기화
    if (window.location.pathname.includes("me.html")) {
        initMe();
    }
    if (window.location.pathname.includes("dashboard.html")) {
        initDashboard();
        initProfileModal();
    }
    
    // 매매일지(index.html)에서도 내정보 모달 초기화
    if (window.location.pathname.includes("index.html") || window.location.pathname === "/" || window.location.pathname.endsWith("/")) {
        initProfileModal();
    }
});

// 내 정보 모달 초기화 (대시보드 및 매매일지용)
const initProfileModal = () => {
    console.log("initProfileModal 호출됨");
    const profileModalBtn = document.getElementById("open-profile-modal-btn");
    const profileModalOverlay = document.getElementById("profile-modal-overlay");
    const profileModalClose = document.getElementById("profile-modal-close");
    
    debugLog("프로필 버튼:", profileModalBtn);
    debugLog("프로필 모달:", profileModalOverlay);
    
    // 모달 열기
    const openProfileModal = async () => {
        console.log("openProfileModal 호출됨", profileModalOverlay);
        if (profileModalOverlay) {
            // 인라인 스타일 제거하고 flex로 설정
            profileModalOverlay.style.display = "flex";
            profileModalOverlay.style.opacity = "1";
            profileModalOverlay.style.visibility = "visible";
            profileModalOverlay.classList.add("active");
            
            // side-modal에도 active 클래스 추가 (슬라이드 애니메이션을 위해)
            const sideModal = profileModalOverlay.querySelector(".side-modal");
            if (sideModal) {
                sideModal.classList.add("active");
            }
            
            console.log("모달 표시됨");
            
            // 내 정보 데이터 로드 및 표시
            await updateProfileModalData();
        } else {
            console.error("프로필 모달 오버레이가 없습니다.");
        }
    };
    
    // 모달 닫기
    const closeProfileModal = () => {
        if (profileModalOverlay) {
            // side-modal에서 active 클래스 먼저 제거 (애니메이션)
            const sideModal = profileModalOverlay.querySelector(".side-modal");
            if (sideModal) {
                sideModal.classList.remove("active");
            }
            
            // 애니메이션 후 오버레이 숨기기
            setTimeout(() => {
                profileModalOverlay.style.display = "none";
                profileModalOverlay.style.opacity = "0";
                profileModalOverlay.style.visibility = "hidden";
                profileModalOverlay.classList.remove("active");
            }, 300); // 애니메이션 시간과 맞춤
        }
    };
    
    // 프로필 모달 데이터 업데이트
    const updateProfileModalData = async () => {
        try {
            const response = await fetch(`${AUTH_API_BASE}/api/auth/me`, {
                method: "GET",
                credentials: "include"
            });
            
            if (response.ok) {
                const user = await response.json();
                const profileNickname = document.getElementById("profile-nickname-modal");
                const profileAvatar = document.getElementById("profile-avatar-initial-modal");
                const profileAuthSection = document.getElementById("profile-auth-section-modal");
                const profileActions = document.getElementById("profile-actions-modal");
                
                if (profileNickname) {
                    profileNickname.textContent = user.displayName || user.username || "-";
                }
                if (profileAvatar) {
                    const initial = (user.displayName || user.username || "-").charAt(0).toUpperCase();
                    profileAvatar.textContent = initial;
                }
                if (profileAuthSection) {
                    profileAuthSection.style.display = "none";
                }
                if (profileActions) {
                    profileActions.hidden = false;
                }
                
                // 통계 데이터 로드 (에러가 나도 계속 진행)
                loadProfileStats();
            } else {
                // 로그인 안 됨
                const profileNickname = document.getElementById("profile-nickname-modal");
                const profileAvatar = document.getElementById("profile-avatar-initial-modal");
                const profileAuthSection = document.getElementById("profile-auth-section-modal");
                const profileActions = document.getElementById("profile-actions-modal");
                
                if (profileNickname) {
                    profileNickname.textContent = "-";
                }
                if (profileAvatar) {
                    profileAvatar.textContent = "-";
                }
                if (profileAuthSection) {
                    profileAuthSection.style.display = "block";
                }
                if (profileActions) {
                    profileActions.hidden = true;
                }
            }
        } catch (error) {
            console.error("프로필 데이터 로드 실패:", error);
            // 에러가 나도 기본 UI는 표시
            const profileNickname = document.getElementById("profile-nickname-modal");
            const profileAvatar = document.getElementById("profile-avatar-initial-modal");
            const profileAuthSection = document.getElementById("profile-auth-section-modal");
            const profileActions = document.getElementById("profile-actions-modal");
            
            if (profileNickname) {
                profileNickname.textContent = "-";
            }
            if (profileAvatar) {
                profileAvatar.textContent = "-";
            }
            if (profileAuthSection) {
                profileAuthSection.style.display = "block";
            }
            if (profileActions) {
                profileActions.hidden = true;
            }
        }
    };
    
    // 통계 데이터 로드
    const loadProfileStats = async () => {
        // 작성한 글, 댓글 단 글 수 가져오기 (엔드포인트가 없을 수 있으므로 선택적 처리)
        let postsCount = 0;
        let commentsCount = 0;
        
        // 작성한 글 API 호출 (404 오류는 무시)
        try {
            const postsResponse = await fetch(`${AUTH_API_BASE}/api/posts/me`, {
                method: "GET",
                credentials: "include"
            });
            if (postsResponse.ok) {
                const posts = await postsResponse.json();
                postsCount = Array.isArray(posts) ? posts.length : 0;
            }
        } catch (e) {
            // 네트워크 오류만 처리, 404는 조용히 무시
            if (e.name !== 'TypeError') {
                // 네트워크 오류가 아닌 경우만 로그
            }
        }
        
        // 댓글 API 호출 (404 오류는 무시)
        try {
            const commentsResponse = await fetch(`${AUTH_API_BASE}/api/comments/me`, {
                method: "GET",
                credentials: "include"
            });
            if (commentsResponse.ok) {
                const comments = await commentsResponse.json();
                commentsCount = Array.isArray(comments) ? comments.length : 0;
            }
        } catch (e) {
            // 네트워크 오류만 처리, 404는 조용히 무시
            if (e.name !== 'TypeError') {
                // 네트워크 오류가 아닌 경우만 로그
            }
        }
        
        const postsCountEl = document.getElementById("profile-posts-count-modal");
        const commentsCountEl = document.getElementById("profile-comments-count-modal");
        
        if (postsCountEl) postsCountEl.textContent = postsCount;
        if (commentsCountEl) commentsCountEl.textContent = commentsCount;
    };
    
    // 이벤트 리스너
    if (profileModalBtn) {
        profileModalBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            debugLog("프로필 버튼 클릭됨");
            openProfileModal();
        });
    } else {
        console.warn("프로필 모달 버튼을 찾을 수 없습니다.");
    }
    
    if (profileModalClose) {
        profileModalClose.addEventListener("click", closeProfileModal);
    }
    
    if (profileModalOverlay) {
        profileModalOverlay.addEventListener("click", (e) => {
            if (e.target === profileModalOverlay) {
                closeProfileModal();
            }
        });
    } else {
        console.warn("프로필 모달 오버레이를 찾을 수 없습니다.");
    }
    
    // 내 정보 모달 내부의 버튼들 이벤트 연결
    const btnEditProfile = document.getElementById("btn-edit-profile-modal");
    const profilePostsClickable = document.getElementById("profile-posts-clickable-modal");
    const profileCommentsClickable = document.getElementById("profile-comments-clickable-modal");
    const profileLogout = document.getElementById("profile-auth-logout-modal");
    const profileDelete = document.getElementById("profile-delete-account-modal");
    
    // 회원정보 수정 모달 열기/닫기
    const openEditProfileModal = () => {
        const editModal = document.getElementById("edit-profile-modal");
        if (editModal) {
            editModal.style.display = "flex";
            editModal.style.opacity = "1";
            editModal.style.visibility = "visible";
            editModal.classList.add("active");
            
            // side-modal에도 active 클래스 추가
            const sideModal = editModal.querySelector(".side-modal");
            if (sideModal) {
                sideModal.classList.add("active");
            }
        } else {
            console.warn("회원정보 수정 모달을 찾을 수 없습니다.");
        }
    };
    
    const closeEditProfileModal = () => {
        const editModal = document.getElementById("edit-profile-modal");
        if (editModal) {
            // side-modal에서 active 클래스 먼저 제거 (애니메이션)
            const sideModal = editModal.querySelector(".side-modal");
            if (sideModal) {
                sideModal.classList.remove("active");
            }
            
            // 애니메이션 후 오버레이 숨기기
            setTimeout(() => {
                editModal.style.display = "none";
                editModal.style.opacity = "0";
                editModal.style.visibility = "hidden";
                editModal.classList.remove("active");
            }, 300);
        }
    };
    
    if (btnEditProfile) {
        btnEditProfile.addEventListener("click", openEditProfileModal);
    }
    
    // 회원정보 수정 모달 닫기 버튼
    const closeEditProfileBtn = document.getElementById("close-edit-profile-modal");
    if (closeEditProfileBtn) {
        closeEditProfileBtn.addEventListener("click", closeEditProfileModal);
    }
    
    // 회원정보 수정 모달 오버레이 클릭 시 닫기
    const editProfileModal = document.getElementById("edit-profile-modal");
    if (editProfileModal) {
        editProfileModal.addEventListener("click", (e) => {
            if (e.target === editProfileModal) {
                closeEditProfileModal();
            }
        });
    }
    
    // 비밀번호 변경 모달
    const changePasswordModal = document.getElementById("change-password-modal");
    const closeChangePasswordModal = document.getElementById("close-change-password-modal");
    const btnChangePassword = document.getElementById("btn-change-password");
    
    const openChangePasswordModal = () => {
        closeEditProfileModal();
        if (changePasswordModal) {
            changePasswordModal.style.display = "flex";
            changePasswordModal.style.opacity = "1";
            changePasswordModal.style.visibility = "visible";
            changePasswordModal.classList.add("active");
            const sideModal = changePasswordModal.querySelector(".side-modal");
            if (sideModal) {
                sideModal.classList.add("active");
            }
        }
    };
    
    const closeChangePasswordModalHandler = () => {
        if (changePasswordModal) {
            const sideModal = changePasswordModal.querySelector(".side-modal");
            if (sideModal) {
                sideModal.classList.remove("active");
            }
            setTimeout(() => {
                changePasswordModal.style.display = "none";
                changePasswordModal.style.opacity = "0";
                changePasswordModal.style.visibility = "hidden";
                changePasswordModal.classList.remove("active");
            }, 300);
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
    
    const openChangeNicknameModal = () => {
        closeEditProfileModal();
        if (changeNicknameModal) {
            changeNicknameModal.style.display = "flex";
            changeNicknameModal.style.opacity = "1";
            changeNicknameModal.style.visibility = "visible";
            changeNicknameModal.classList.add("active");
            const sideModal = changeNicknameModal.querySelector(".side-modal");
            if (sideModal) {
                sideModal.classList.add("active");
            }
        }
    };
    
    const closeChangeNicknameModalHandler = () => {
        if (changeNicknameModal) {
            const sideModal = changeNicknameModal.querySelector(".side-modal");
            if (sideModal) {
                sideModal.classList.remove("active");
            }
            setTimeout(() => {
                changeNicknameModal.style.display = "none";
                changeNicknameModal.style.opacity = "0";
                changeNicknameModal.style.visibility = "hidden";
                changeNicknameModal.classList.remove("active");
            }, 300);
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
    
    if (profilePostsClickable) {
        profilePostsClickable.addEventListener("click", () => {
            const myPostsModal = document.getElementById("my-posts-modal");
            if (myPostsModal) {
                myPostsModal.style.display = "flex";
                myPostsModal.style.opacity = "1";
                myPostsModal.style.visibility = "visible";
                myPostsModal.classList.add("active");
                const sideModal = myPostsModal.querySelector(".side-modal");
                if (sideModal) {
                    sideModal.classList.add("active");
                }
                // 작성한 글 로드
                loadMyPosts();
            }
        });
    }
    
    if (profileCommentsClickable) {
        profileCommentsClickable.addEventListener("click", () => {
            const myCommentsModal = document.getElementById("my-comments-modal");
            if (myCommentsModal) {
                myCommentsModal.style.display = "flex";
                myCommentsModal.style.opacity = "1";
                myCommentsModal.style.visibility = "visible";
                myCommentsModal.classList.add("active");
                const sideModal = myCommentsModal.querySelector(".side-modal");
                if (sideModal) {
                    sideModal.classList.add("active");
                }
                // 댓글 단 글 로드
                loadMyComments();
            }
        });
    }
    
    if (profileLogout) {
        profileLogout.addEventListener("click", async () => {
            if (confirm("로그아웃하시겠습니까?")) {
                try {
                    await fetch(`${AUTH_API_BASE}/api/auth/logout`, {
                        method: "POST",
                        credentials: "include"
                    });
                    window.location.reload();
                } catch (error) {
                    console.error("로그아웃 실패:", error);
                }
            }
        });
    }
    
    if (profileDelete) {
        profileDelete.addEventListener("click", async () => {
            if (confirm("정말 회원탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                try {
                    await fetch(`${AUTH_API_BASE}/api/auth/me`, {
                        method: "DELETE",
                        credentials: "include"
                    });
                    alert("회원탈퇴가 완료되었습니다.");
                    window.location.reload();
                } catch (error) {
                    console.error("회원탈퇴 실패:", error);
                }
            }
        });
    }
    
    // 작성한 글 모달 닫기
    const closeMyPostsModal = () => {
        const myPostsModal = document.getElementById("my-posts-modal");
        if (myPostsModal) {
            const sideModal = myPostsModal.querySelector(".side-modal");
            if (sideModal) {
                sideModal.classList.remove("active");
            }
            setTimeout(() => {
                myPostsModal.style.display = "none";
                myPostsModal.style.opacity = "0";
                myPostsModal.style.visibility = "hidden";
                myPostsModal.classList.remove("active");
            }, 300);
        }
    };
    
    const closeMyPostsBtn = document.getElementById("close-my-posts-modal");
    if (closeMyPostsBtn) {
        closeMyPostsBtn.addEventListener("click", closeMyPostsModal);
    }
    
    const myPostsModal = document.getElementById("my-posts-modal");
    if (myPostsModal) {
        myPostsModal.addEventListener("click", (e) => {
            if (e.target === myPostsModal) {
                closeMyPostsModal();
            }
        });
    }
    
    // 댓글 단 글 모달 닫기
    const closeMyCommentsModal = () => {
        const myCommentsModal = document.getElementById("my-comments-modal");
        if (myCommentsModal) {
            const sideModal = myCommentsModal.querySelector(".side-modal");
            if (sideModal) {
                sideModal.classList.remove("active");
            }
            setTimeout(() => {
                myCommentsModal.style.display = "none";
                myCommentsModal.style.opacity = "0";
                myCommentsModal.style.visibility = "hidden";
                myCommentsModal.classList.remove("active");
            }, 300);
        }
    };
    
    const closeMyCommentsBtn = document.getElementById("close-my-comments-modal");
    if (closeMyCommentsBtn) {
        closeMyCommentsBtn.addEventListener("click", closeMyCommentsModal);
    }
    
    const myCommentsModalEl = document.getElementById("my-comments-modal");
    if (myCommentsModalEl) {
        myCommentsModalEl.addEventListener("click", (e) => {
            if (e.target === myCommentsModalEl) {
                closeMyCommentsModal();
            }
        });
    }
    
    // 작성한 글 로드
    const loadMyPosts = async () => {
        const myPostsList = document.getElementById("my-posts-list");
        if (!myPostsList) return;
        
        try {
            const response = await fetch(`${AUTH_API_BASE}/api/posts/me`, {
                method: "GET",
                credentials: "include"
            });
            
            if (response.ok) {
                const posts = await response.json();
                if (posts.length === 0) {
                    myPostsList.innerHTML = "<div class='empty-trading-list'>작성한 글이 없습니다.</div>";
                } else {
                    myPostsList.innerHTML = posts.map(post => `
                        <div class="trading-item">
                            <div class="trading-item-header">
                                <span class="trading-item-stock">${post.title}</span>
                            </div>
                            <div class="trading-item-content">${post.content.substring(0, 100)}...</div>
                        </div>
                    `).join("");
                }
            } else if (response.status === 404) {
                // 엔드포인트가 없으면 빈 메시지 표시
                myPostsList.innerHTML = "<div class='empty-trading-list'>작성한 글이 없습니다.</div>";
            }
        } catch (error) {
            // 네트워크 오류만 로그, 404는 조용히 처리
            if (error.name === 'TypeError') {
                myPostsList.innerHTML = "<div class='empty-trading-list'>작성한 글이 없습니다.</div>";
            }
        }
    };
    
    // 댓글 단 글 로드
    const loadMyComments = async () => {
        const myCommentsList = document.getElementById("my-comments-list");
        if (!myCommentsList) return;
        
        try {
            const response = await fetch(`${AUTH_API_BASE}/api/comments/me`, {
                method: "GET",
                credentials: "include"
            });
            
            if (response.ok) {
                const comments = await response.json();
                if (comments.length === 0) {
                    myCommentsList.innerHTML = "<div class='empty-trading-list'>댓글을 단 글이 없습니다.</div>";
                } else {
                    myCommentsList.innerHTML = comments.map(comment => `
                        <div class="trading-item">
                            <div class="trading-item-header">
                                <span class="trading-item-stock">${comment.content.substring(0, 50)}...</span>
                            </div>
                        </div>
                    `).join("");
                }
            } else if (response.status === 404) {
                // 엔드포인트가 없으면 빈 메시지 표시
                myCommentsList.innerHTML = "<div class='empty-trading-list'>댓글을 단 글이 없습니다.</div>";
            }
        } catch (error) {
            // 네트워크 오류만 로그, 404는 조용히 처리
            if (error.name === 'TypeError') {
                myCommentsList.innerHTML = "<div class='empty-trading-list'>댓글을 단 글이 없습니다.</div>";
            }
        }
    };
    
    // 비밀번호 변경 폼 제출 (대시보드 내 정보 모달)
    const changePasswordFormModal = document.getElementById("change-password-form");
    if (changePasswordFormModal) {
        changePasswordFormModal.addEventListener("submit", async (e) => {
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
                
                // 폼 초기화
                form.reset();
                
                // 모달 닫기
                setTimeout(() => {
                    const changePasswordModal = document.getElementById("change-password-modal");
                    if (changePasswordModal) {
                        const sideModal = changePasswordModal.querySelector(".side-modal");
                        if (sideModal) {
                            sideModal.classList.remove("active");
                        }
                        setTimeout(() => {
                            changePasswordModal.style.display = "none";
                            changePasswordModal.style.opacity = "0";
                            changePasswordModal.style.visibility = "hidden";
                            changePasswordModal.classList.remove("active");
                        }, 300);
                    }
                }, 1500);
            } catch (error) {
                setAuthMessage(error.message ?? "비밀번호 변경에 실패했습니다.", "error", messageEl);
            }
        });
    }
    
    // 닉네임 변경 폼 제출 (대시보드 내 정보 모달)
    const changeNicknameFormModal = document.getElementById("change-nickname-form");
    if (changeNicknameFormModal) {
        changeNicknameFormModal.addEventListener("submit", async (e) => {
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
                const profileNickname = document.getElementById("profile-nickname-modal");
                if (profileNickname) {
                    profileNickname.textContent = displayName;
                }
                // 프로필 아바타 초기 업데이트
                const profileAvatarInitial = document.getElementById("profile-avatar-initial-modal");
                if (profileAvatarInitial) {
                    const initial = displayName ? displayName.charAt(0).toUpperCase() : "-";
                    profileAvatarInitial.textContent = initial;
                }
                
                // 폼 초기화
                form.reset();
                
                // 모달 닫기
                setTimeout(() => {
                    const changeNicknameModal = document.getElementById("change-nickname-modal");
                    if (changeNicknameModal) {
                        const sideModal = changeNicknameModal.querySelector(".side-modal");
                        if (sideModal) {
                            sideModal.classList.remove("active");
                        }
                        setTimeout(() => {
                            changeNicknameModal.style.display = "none";
                            changeNicknameModal.style.opacity = "0";
                            changeNicknameModal.style.visibility = "hidden";
                            changeNicknameModal.classList.remove("active");
                        }, 300);
                    }
                }, 1500);
            } catch (error) {
                setAuthMessage(error.message ?? "닉네임 변경에 실패했습니다.", "error", messageEl);
            }
        });
    }
};

// 대시보드 초기화
const initDashboard = () => {
    // 로컬 스토리지에서 마지막 선택 종목 가져오기
    let currentSymbol = localStorage.getItem("lastSelectedSymbol");
    let currentSymbolName = localStorage.getItem("lastSelectedSymbolName");
    let currentInterval = "D"; // 기본 일봉 (분봉 미지원으로 변경)
    let currentPeriod = "day"; // 기본 일봉
    let chartInstance = null;
    // 즐겨찾기 목록 (종목명과 종목번호를 함께 저장)
    let favorites = []; // {symbol: string, name: string}[]
    let currentAnalysis = null; // 현재 분석 결과 저장
    let currentCandlestickData = null; // 현재 캔들 데이터 저장
    let visibleRangeSubscription = null; // visible range 구독
    let crosshairMoveHandler = null; // 크로스헤어 이동 구독
    let drawingOverlay = null;
    let drawingChartInstance = null;
    let drawingSeries = null;
    let drawingCanvas = null;
    let drawingCtx = null;
    let drawingShapes = [];
    let drawingCurrentShape = null;
    let drawingResizeHandler = null;
    let drawingResizeObserver = null;
    let drawingKeyHandler = null;
    let drawingTool = "brush";
    let drawingVisibleRangeSubscription = null;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let panStartTimeRange = null;
    let chartSeries = {
        candlestick: null,
        line: null,
        ma5: null,
        ma20: null,
        ma60: null,
        ma120: null,
        supportLines: [],
        resistanceLines: [],
        trendLines: [],
        targetLines: [],
        stopLossLines: []
    };

    const openSearchModalBtn = document.getElementById("open-search-modal-btn");
    const searchModalOverlay = document.getElementById("search-modal-overlay");
    const searchModalClose = document.getElementById("search-modal-close");
    const modalSearchForm = document.getElementById("modal-search-form");
    const modalSearchInput = document.getElementById("modal-search-input");
    const searchResultsList = document.getElementById("search-results-list");
    const favoriteBtn = document.getElementById("favorite-btn");
    const favoriteIcon = document.getElementById("favorite-icon");
    const interestCategoryBtn = document.getElementById("interest-category-btn");
    const interestCategoryModal = document.getElementById("interest-category-modal");
    const closeInterestCategoryModal = document.getElementById("close-interest-category-modal");
    const favoritesHeartBtn = document.getElementById("favorites-heart-btn");
    const favoritesHeartIcon = document.getElementById("favorites-heart-icon");
    // const intervalButtons = document.querySelectorAll(".interval-btn"); // 제거됨
    const periodButtons = document.querySelectorAll(".period-btn");
    const dashboardChart = document.getElementById("dashboard-chart");
    const dashboardSymbol = document.getElementById("dashboard-symbol");
    const dashboardName = document.getElementById("dashboard-name");

    // 초기 종목 설정 (저장된 종목이 있으면, 없으면 기본값 사용)
    if (!currentSymbol) {
        currentSymbol = "005930"; // 기본값: 삼성전자
        currentSymbolName = "삼성전자";
    }
    
    if (dashboardSymbol) dashboardSymbol.textContent = currentSymbol;
    if (dashboardName) dashboardName.textContent = currentSymbolName || currentSymbol;

    // 백엔드에서 즐겨찾기 목록 가져오기
    const loadFavoritesFromBackend = async () => {
        try {
            const response = await fetch(`${AUTH_API_BASE}/api/favorites`, {
                method: "GET",
                credentials: "include",
            });
            if (response.ok) {
                const data = await response.json();
                favorites = data.map(fav => ({ symbol: fav.symbol, name: fav.name }));
                // 로컬 스토리지에도 저장 (백업용)
                localStorage.setItem("dashboardFavorites", JSON.stringify(favorites.map(f => f.symbol)));
                updateFavoriteList();
                updateFavoritesHeartStatus();
            } else if (response.status === 401) {
                // 로그인하지 않은 경우 로컬 스토리지에서만 가져오기
                const localFavorites = JSON.parse(localStorage.getItem("dashboardFavorites") || "[]");
                favorites = localFavorites.map(symbol => ({ 
                    symbol: symbol, 
                    name: localStorage.getItem(`lastSelectedSymbolName_${symbol}`) || symbol 
                }));
                updateFavoriteList();
                updateFavoritesHeartStatus();
            }
        } catch (error) {
            console.error("즐겨찾기 목록 로드 실패:", error);
            // 에러 시 로컬 스토리지에서만 가져오기
            const localFavorites = JSON.parse(localStorage.getItem("dashboardFavorites") || "[]");
            favorites = localFavorites.map(symbol => ({ 
                symbol: symbol, 
                name: localStorage.getItem(`lastSelectedSymbolName_${symbol}`) || symbol 
            }));
            updateFavoriteList();
            updateFavoritesHeartStatus();
        }
    };
    
    // 즐겨찾기 하트 버튼 상태 업데이트 함수 (먼저 정의)
    const updateFavoritesHeartStatus = () => {
        if (currentSymbol && favorites.some(f => f.symbol === currentSymbol)) {
            if (favoritesHeartIcon) favoritesHeartIcon.textContent = "❤️";
            if (favoritesHeartBtn) favoritesHeartBtn.classList.add("active");
        } else {
            if (favoritesHeartIcon) favoritesHeartIcon.textContent = "🤍";
            if (favoritesHeartBtn) favoritesHeartBtn.classList.remove("active");
        }
    };
    
    // 즐겨찾기 상태 업데이트
    const updateFavoriteStatus = () => {
        if (currentSymbol && favorites.some(f => f.symbol === currentSymbol)) {
            if (favoriteBtn) favoriteBtn.classList.add("active");
            if (favoriteIcon) favoriteIcon.textContent = "❤️";
        } else {
            if (favoriteBtn) favoriteBtn.classList.remove("active");
            if (favoriteIcon) favoriteIcon.textContent = "🤍";
        }
        // 하트 버튼 상태도 함께 업데이트
        updateFavoritesHeartStatus();
    };

    // 검색 모달 열기 함수
    const openSearchModal = () => {
        if (searchModalOverlay) {
            searchModalOverlay.style.display = "flex";
            if (modalSearchInput) {
                modalSearchInput.value = "";
                setTimeout(() => modalSearchInput.focus(), 100);
            }
            // 초기 메시지 표시
            if (searchResultsList) {
                searchResultsList.innerHTML = "<p class='search-placeholder'>검색어를 입력해주세요</p>";
            }
        }
    };

    // 검색 모달 열기 (버튼 클릭)
    if (openSearchModalBtn) {
        openSearchModalBtn.addEventListener("click", openSearchModal);
    }

    // "/" 키로 검색 모달 열기
    document.addEventListener("keydown", (e) => {
        // 입력 필드에 포커스가 있으면 무시
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
            return;
        }
        
        // "/" 키를 누르면 검색 모달 열기
        if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            openSearchModal();
        }
    });

    // 검색 모달 닫기
    if (searchModalClose) {
        searchModalClose.addEventListener("click", () => {
            if (searchModalOverlay) {
                searchModalOverlay.style.display = "none";
            }
        });
    }

    if (searchModalOverlay) {
        searchModalOverlay.addEventListener("click", (e) => {
            if (e.target === searchModalOverlay) {
                searchModalOverlay.style.display = "none";
            }
        });
    }

    // 검색 함수 (공통)
    let searchTimeout = null;
    const performSearch = async (query) => {
        const trimmedQuery = query.trim();
        
        // 검색어가 비어있으면 초기 메시지 표시
        if (!trimmedQuery) {
            if (searchResultsList) {
                searchResultsList.innerHTML = "<p class='search-placeholder'>검색어를 입력해주세요</p>";
            }
            return;
        }

        // 로딩 표시
        if (searchResultsList) {
            searchResultsList.innerHTML = "<p class='search-loading'>검색 중...</p>";
        }

        try {
            // 백엔드 API를 통해 검색 (실제 존재하는 종목만 반환)
            const response = await fetch(`${API_BASE}/api/market/search?query=${encodeURIComponent(trimmedQuery)}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "검색 실패" }));
                throw new Error(errorData.detail || "검색 실패");
            }

            const results = await response.json();

            // 검색 결과가 없으면
            if (!results || results.length === 0) {
                if (searchResultsList) {
                    searchResultsList.innerHTML = "<p class='search-empty'>검색 결과가 없습니다.</p>";
                }
                return;
            }

            // 검색 결과 표시 (실제 존재하는 종목만)
            if (searchResultsList) {
                searchResultsList.innerHTML = results.map(item => {
                    const symbol = item.symbol || '';
                    const name = (item.description || item.symbol || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                    return `
                    <div class="search-result-item" data-symbol="${symbol}" data-name="${name}">
                        <div class="search-result-content">
                            <strong class="search-result-symbol">${symbol}</strong>
                            <span class="search-result-name">${item.description || item.symbol || ''}</span>
                            ${item.exchange ? `<span class="search-result-exchange">${item.exchange}</span>` : ''}
                        </div>
                    </div>
                `;
                }).join("");

                // 검색 결과 클릭 이벤트
                searchResultsList.querySelectorAll(".search-result-item").forEach(item => {
                    item.addEventListener("click", async () => {
                        const symbol = item.getAttribute("data-symbol");
                        const name = item.getAttribute("data-name");
                        if (symbol) {
                            console.log("검색 결과에서 종목 선택:", { symbol, name });
                            // window.selectSymbol을 명시적으로 호출
                            if (window.selectSymbol) {
                                await window.selectSymbol(symbol, name);
                            } else {
                                console.error("selectSymbol 함수를 찾을 수 없습니다.");
                            }
                        } else {
                            console.error("심볼이 없습니다:", item);
                        }
                    });
                });
            }
        } catch (error) {
            console.error("검색 오류:", error);
            if (searchResultsList) {
                searchResultsList.innerHTML = `<p class='search-error'>검색 중 오류가 발생했습니다: ${error.message}</p>`;
            }
        }
    };

    // 실시간 검색 (입력 시 자동 검색)
    if (modalSearchInput) {
        modalSearchInput.addEventListener("input", (e) => {
            const query = e.target.value;
            
            // 이전 타이머 취소
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            
            // 300ms 후 검색 실행 (debounce)
            searchTimeout = setTimeout(() => {
                performSearch(query);
            }, 300);
        });
    }

    // 폼 제출 시에도 검색 (엔터 키 등)
    if (modalSearchForm) {
        modalSearchForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const query = modalSearchInput.value;
            // 타이머 취소하고 즉시 검색
            if (searchTimeout) {
                clearTimeout(searchTimeout);
            }
            await performSearch(query);
        });
    }


    // 즐겨찾기 토글
    if (favoriteBtn) {
        favoriteBtn.addEventListener("click", () => {
            if (!currentSymbol) {
                alert("먼저 종목을 선택해주세요.");
                return;
            }

            const index = favorites.findIndex(f => f.symbol === currentSymbol);
            if (index > -1) {
                favorites.splice(index, 1);
            } else {
                const name = dashboardName ? dashboardName.textContent : currentSymbolName || currentSymbol;
                favorites.push({ symbol: currentSymbol, name: name });
            }
            localStorage.setItem("dashboardFavorites", JSON.stringify(favorites.map(f => f.symbol)));
            updateFavoriteStatus();
            updateFavoriteList();
        });
    }

    // 관심 카테고리 모달
    if (interestCategoryBtn) {
        interestCategoryBtn.addEventListener("click", () => {
            if (interestCategoryModal) {
                interestCategoryModal.style.display = "flex";
            }
        });
    }

    if (closeInterestCategoryModal) {
        closeInterestCategoryModal.addEventListener("click", () => {
            if (interestCategoryModal) {
                interestCategoryModal.style.display = "none";
            }
        });
    }

    if (interestCategoryModal) {
        interestCategoryModal.addEventListener("click", (e) => {
            if (e.target === interestCategoryModal) {
                interestCategoryModal.style.display = "none";
            }
        });
    }

    // 기간 선택 (일/주/월/년) -> 캔들 간격(Interval) 변경으로 수정
    periodButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            periodButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentPeriod = btn.getAttribute("data-period");

            // 버튼에 따라 Interval 설정 (일/주/월/년)
            if (currentPeriod === "day") currentInterval = "D";
            else if (currentPeriod === "week") currentInterval = "W";
            else if (currentPeriod === "month") currentInterval = "M";
            else if (currentPeriod === "year") currentInterval = "Y";

            loadChartData();
        });
    });

    // 차트 데이터 로드
    const loadChartData = async () => {
        console.log("loadChartData 호출됨, currentSymbol:", currentSymbol);
        if (!currentSymbol) {
            console.warn("loadChartData: currentSymbol이 없습니다.");
            return;
        }

        try {
            // 백엔드 API를 통해 차트 데이터 가져오기
            // "일에는 하루하루 다 뜨게해야지" 요청에 따라 모든 기간에 대해 최대 범위 데이터를 가져옴
            // 줌 레벨은 fitContent()로 전체를 보여주거나 사용자가 조절하도록 함
            let rangeDays = 3650; // 10년 (충분히 긴 기간)

            debugLog(`차트 데이터 요청: symbol=${currentSymbol}, resolution=${currentInterval.toString()}, rangeDays=${rangeDays}`);
            const response = await fetch(`${API_BASE}/api/market/candles?symbol=${currentSymbol}&resolution=${currentInterval.toString()}&range_days=${rangeDays}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "차트 데이터를 불러올 수 없습니다." }));
                throw new Error(errorData.detail || `HTTP ${response.status}: 차트 데이터 로드 실패`);
            }

            const data = await response.json();

            // 데이터 유효성 검사
            if (!data || !data.data || !data.data.timestamps || data.data.timestamps.length === 0) {
                throw new Error("차트 데이터가 비어있습니다.");
            }

            renderChart(data);
            updatePriceInfo(data);
            
            // 차트 로드 완료 후 자동으로 AI 분석 실행
            setTimeout(() => {
                autoAnalyzeChart();
            }, 1000); // 차트 렌더링 완료 대기
        } catch (error) {
            console.error("차트 데이터 로드 오류:", error);
            // 사용자에게 오류 메시지 표시
            if (dashboardChart) {
                dashboardChart.innerHTML = `<p style='padding: 2rem; text-align: center; color: var(--text-muted);'>${error.message || '차트 데이터를 불러올 수 없습니다.'}</p>`;
            }
        }
    };
    
    const updateChartRangeLabel = (rangeDays, resolution) => {
        const labelEl = document.getElementById("chart-range-label");
        if (!labelEl) return;

        const resolutionMap = {
            D: "일봉",
            W: "주봉",
            M: "월봉",
            Y: "연봉",
        };

        const rangeMap = {
            30: "최근 30일 (약 1개월)",
            90: "최근 90일 (약 3개월)",
            180: "최근 180일 (약 6개월)",
            365: "최근 365일 (약 1년)",
        };

        const resolutionText = resolutionMap[resolution] || `${resolution}`;
        const rangeText = rangeMap[rangeDays] || `최근 ${rangeDays}일`;

        labelEl.textContent = `${resolutionText} · ${rangeText}`;
    };

    const formatChartDateLabel = (time) => {
        if (time === undefined || time === null) return null;
        let date;
        if (typeof time === "number") {
            date = new Date(time * 1000);
        } else if (typeof time === "object" && typeof time.year === "number") {
            const month = typeof time.month === "number" ? time.month - 1 : 0;
            const day = typeof time.day === "number" ? time.day : 1;
            date = new Date(time.year, month, day);
        } else {
            return null;
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}.${month}.${day}`;
    };

    const setCrosshairLabelText = (time, priceValue = null) => {
        const labelEl = document.getElementById("chart-crosshair-label");
        if (!labelEl) return;

        if (time === undefined || time === null) {
            labelEl.textContent = "날짜: -";
            return;
        }

        const dateText = formatChartDateLabel(time);
        if (!dateText) {
            labelEl.textContent = "날짜: -";
            return;
        }

        if (typeof priceValue === "number" && !Number.isNaN(priceValue)) {
            labelEl.textContent = `${dateText} · ${Math.round(priceValue).toLocaleString()}원`;
        } else {
            labelEl.textContent = dateText;
        }
    };

    const updateCrosshairLabelToLatest = () => {
        if (currentCandlestickData && currentCandlestickData.length > 0) {
            const lastPoint = currentCandlestickData[currentCandlestickData.length - 1];
            setCrosshairLabelText(lastPoint.time, lastPoint.close ?? lastPoint.value ?? null);
        } else {
            setCrosshairLabelText(null);
        }
    };

    const subscribeCrosshairLabel = () => {
        if (!chartInstance) return;
        const labelEl = document.getElementById("chart-crosshair-label");
        if (!labelEl) return;

        if (crosshairMoveHandler) {
            try {
                chartInstance.unsubscribeCrosshairMove(crosshairMoveHandler);
            } catch (e) {
                console.warn("기존 크로스헤어 구독 제거 실패:", e);
            }
            crosshairMoveHandler = null;
        }

        const handler = (param) => {
            if (!param || param.time === undefined) {
                updateCrosshairLabelToLatest();
                return;
            }

            let priceValue = null;
            if (param.seriesData) {
                if (chartSeries.candlestick) {
                    const candleData = param.seriesData.get(chartSeries.candlestick);
                    if (candleData && typeof candleData.close === "number") {
                        priceValue = candleData.close;
                    }
                } else if (chartSeries.line) {
                    const lineData = param.seriesData.get(chartSeries.line);
                    if (lineData && typeof lineData.value === "number") {
                        priceValue = lineData.value;
                    }
                }
            }

            setCrosshairLabelText(param.time, priceValue);
        };

        crosshairMoveHandler = handler;
        chartInstance.subscribeCrosshairMove(handler);
    };
    
    // 자동 AI 분석 실행
    const autoAnalyzeChart = async () => {
        if (!currentSymbol) return;
        
        try {
            // 현재 선택된 기간과 간격 사용
            const resolution = currentInterval.toString();
            const rangeDays = currentPeriod === "day" ? 30 : currentPeriod === "week" ? 90 : currentPeriod === "month" ? 180 : 365;

            updateChartRangeLabel(rangeDays, resolution);

            const response = await fetch(`${API_BASE}/api/chart/analyze`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    symbol: currentSymbol,
                    resolution: resolution,
                    range_days: rangeDays
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: "분석 실패" }));
                console.warn("자동 분석 실패:", errorData.detail || "차트 분석 실패");
                return; // 자동 분석 실패는 조용히 처리 (사용자에게 알림 없음)
            }

            const analysis = await response.json();
            currentAnalysis = analysis; // 분석 결과 저장
            displayAnalysisModal(analysis);
            // 차트에 선 그리기
            if (chartInstance && currentSymbol) {
                drawChartLines(analysis);
            }
        } catch (error) {
            console.warn("자동 차트 분석 오류:", error);
            // 자동 분석 실패는 조용히 처리
        }
    };

    // AI 차트 분석은 자동으로 실행됩니다 (차트 로드 시)

    // 분석 결과 사이드바에 표시
    const displayAnalysisModal = (analysis) => {
        const sidebarContent = document.getElementById("analysis-sidebar-content");
        if (!sidebarContent) return;
        
        // 사이드바에 분석 결과 HTML 생성
        sidebarContent.innerHTML = `
            <div class="analysis-card">
                <div class="section-header simple">
                    <div>
                        <h4>기술적 지표</h4>
                        <p class="section-subtitle">RSI · MACD · 볼린저</p>
                    </div>
                </div>
                <div id="technical-indicators-sidebar" class="indicator-card-grid"></div>
            </div>
            
            <div class="analysis-card">
                <div class="section-header simple">
                    <div>
                        <h4>매매 신호</h4>
                        <p class="section-subtitle">현재 전략과 목표 구간</p>
                    </div>
                </div>
                <div id="trading-signal-sidebar"></div>
            </div>
            
            <div class="analysis-card">
                <div class="section-header simple">
                    <div>
                        <h4>지지 · 저항</h4>
                        <p class="section-subtitle">가까운 방어·저항 가격대</p>
                    </div>
                </div>
                <div id="support-resistance-sidebar"></div>
            </div>
            
            <div class="analysis-card">
                <div class="section-header simple">
                    <div>
                        <h4>차트 패턴</h4>
                        <p class="section-subtitle">감지된 패턴과 신뢰도</p>
                    </div>
                </div>
                <div id="patterns-sidebar" class="pattern-card-list"></div>
            </div>
            
            <div class="analysis-card">
                <div class="section-header simple">
                    <div>
                        <h4>리스크 분석</h4>
                        <p class="section-subtitle">변동성 · 52주 범위</p>
                    </div>
                </div>
                <div id="risk-analysis-sidebar"></div>
            </div>
        `;
        
        // 분석 결과 표시 (사이드바용)
        displayAnalysisContent(analysis, false, "sidebar");
        
        // 차트 하이라이트 업데이트
        updateAnalysisHighlights(analysis);
        
        // 툴팁 초기화
        initTooltips();
    };

    // 분석 결과 표시 (내용만)
    const displayAnalysisContent = (analysis, isModal = false, target = "modal") => {
        const suffix = target === "sidebar" ? "-sidebar" : (isModal ? "-modal" : "");
        
        // 기술적 지표
        const indicatorsDiv = document.getElementById(`technical-indicators${suffix}`);
        if (indicatorsDiv) {
            if (!analysis.technical_indicators || analysis.technical_indicators.length === 0) {
                indicatorsDiv.innerHTML = `<p class="empty-copy">지표 데이터를 불러올 수 없습니다.</p>`;
            } else {
                indicatorsDiv.innerHTML = analysis.technical_indicators.map(buildIndicatorCardHTML).join("");
            }
        }

        // 매매 신호
        const signalDiv = document.getElementById(`trading-signal${suffix}`);
        if (signalDiv) {
            const style = getSignalStyle(analysis.trading_signal.type);
            const confidenceText = typeof analysis.trading_signal.confidence === "number"
                ? `${(analysis.trading_signal.confidence * 100).toFixed(0)}%`
                : "-";

            const priceRows = [];
            if (analysis.trading_signal.entry_price) {
                priceRows.push(`<div><span>진입가</span><strong>${formatPriceDisplay(analysis.trading_signal.entry_price)}</strong></div>`);
            }
            if (analysis.trading_signal.target_price) {
                priceRows.push(`<div><span>목표가</span><strong>${formatPriceDisplay(analysis.trading_signal.target_price)}</strong></div>`);
            }
            if (analysis.trading_signal.stop_loss) {
                priceRows.push(`<div><span>손절가</span><strong>${formatPriceDisplay(analysis.trading_signal.stop_loss)}</strong></div>`);
            }

            signalDiv.innerHTML = `
                <div class="signal-card ${style.cardClass}">
                    <div class="signal-card-header">
                        <div>
                            <p class="signal-label">현재 신호</p>
                            <div class="signal-value">${analysis.trading_signal.type.toUpperCase()}</div>
                        </div>
                        <span class="${style.badgeClass}">${style.text}</span>
                    </div>
                    <div class="signal-confidence">신뢰도 ${confidenceText}</div>
                    ${priceRows.length ? `<div class="signal-price-grid">${priceRows.join("")}</div>` : ""}
                    <p class="signal-reason">${analysis.trading_signal.reason}</p>
                </div>
            `;
        }

        // 지지/저항선
        const srDiv = document.getElementById(`support-resistance${suffix}`);
        if (srDiv) {
            const supports = (analysis.support_resistance || []).filter(sr => sr.type === "support");
            const resistances = (analysis.support_resistance || []).filter(sr => sr.type === "resistance");

            const renderRows = (rows, type) => {
                if (!rows.length) {
                    return `<p class="empty-copy">${type === "support" ? "감지된 지지선이 없습니다." : "감지된 저항선이 없습니다."}</p>`;
                }
                return rows.map(sr => {
                const strengthPercent = (sr.strength * 100).toFixed(0);
                return `
                        <div class="sr-row ${type}">
                            <div class="sr-row-values">
                                <span class="sr-chip ${type}">${type === "support" ? "지지" : "저항"}</span>
                                <strong>${formatPriceDisplay(sr.level)}</strong>
                            </div>
                            <span class="sr-strength">강도 ${strengthPercent}%</span>
                    </div>
                `;
                }).join("");
            };

            srDiv.innerHTML = `
                <div class="sr-group">
                    <div class="sr-group-header">
                        <span class="sr-group-title">지지선</span>
                        <span class="sr-count">${supports.length}개</span>
                    </div>
                    <div class="sr-list">${renderRows(supports, "support")}</div>
                </div>
                <div class="sr-group">
                    <div class="sr-group-header">
                        <span class="sr-group-title">저항선</span>
                        <span class="sr-count">${resistances.length}개</span>
                    </div>
                    <div class="sr-list">${renderRows(resistances, "resistance")}</div>
                </div>
            `;
        }

        // 패턴
        const patternsDiv = document.getElementById(`patterns${suffix}`);
        if (patternsDiv) {
            if (!analysis.patterns || analysis.patterns.length === 0) {
                patternsDiv.innerHTML = `<p class="empty-copy">감지된 패턴이 없습니다.</p>`;
            } else {
                patternsDiv.innerHTML = analysis.patterns.map(p => {
                const patternClass = p.signal === "bullish" ? "pattern-bullish" : 
                                    p.signal === "bearish" ? "pattern-bearish" : "pattern-neutral";
                return `
                        <div class="pattern-card ${patternClass}">
                            <div class="pattern-card-header">
                                <strong>${p.name}</strong>
                                <span class="pattern-confidence-badge">${(p.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <p class="pattern-desc">${p.description}</p>
                    </div>
                `;
                }).join("");
            }
        }

        // 리스크 분석
        const riskDiv = document.getElementById(`risk-analysis${suffix}`);
        if (riskDiv) {
            const riskLevel = analysis.risk_analysis.risk_level;
            const riskClass = riskLevel === "high" ? "risk-high" : riskLevel === "medium" ? "risk-medium" : "risk-low";
            const riskText = riskLevel === "high" ? "리스크 높음" : riskLevel === "medium" ? "리스크 보통" : "리스크 낮음";
            const volatility = typeof analysis.risk_analysis.volatility === "number" ? `${analysis.risk_analysis.volatility}%` : "-";
            const currentPrice = formatPriceDisplay(analysis.risk_analysis.current_price);
            const high52 = formatPriceDisplay(analysis.risk_analysis.price_range_52w.high);
            const low52 = formatPriceDisplay(analysis.risk_analysis.price_range_52w.low);

            riskDiv.innerHTML = `
                <div class="risk-card ${riskClass}">
                    <div class="risk-highlight">
                        <span class="risk-label">리스크</span>
                        <strong class="risk-value">${riskText}</strong>
                    </div>
                    <div class="risk-stats">
                        <div><span>변동성</span><strong>${volatility}</strong></div>
                        <div><span>현재가</span><strong>${currentPrice}</strong></div>
                        <div><span>52주 고가</span><strong>${high52}</strong></div>
                        <div><span>52주 저가</span><strong>${low52}</strong></div>
                    </div>
                </div>
            `;
        }

    };

    const formatPriceDisplay = (value, fallback = "-") => {
        if (typeof value !== "number" || Number.isNaN(value)) {
            return fallback;
        }
        return Math.round(value).toLocaleString();
    };

    const INDICATOR_META = {
        rsi: {
            key: "rsi",
            label: "RSI",
            hint: "0 ~ 100 구간",
            progressType: "percentage",
        },
        macd: {
            key: "macd",
            label: "MACD",
            hint: "EMA(12,26,9) 기준",
            showTrendArrow: true,
        },
        "bollinger bands": {
            key: "bb",
            label: "볼린저 밴드",
            hint: "±2σ 범위",
        },
    };

    const getIndicatorMeta = (name) => {
        if (!name) {
            return { key: "default", label: "지표", hint: null };
        }
        const key = name.toLowerCase();
        return INDICATOR_META[key] || { key: key.replace(/\s+/g, "-"), label: name, hint: null };
    };

    const buildIndicatorCardHTML = (ind) => {
        const meta = getIndicatorMeta(ind.name);
        const cardThemeClass = `indicator-${meta.key}`;
        const style = getSignalStyle(ind.signal);
        const valueText = typeof ind.value === "number" ? Math.round(ind.value).toLocaleString() : "-";

        let progressHTML = "";
        if (meta.progressType === "percentage" && typeof ind.value === "number") {
            const progress = Math.max(0, Math.min(100, Math.round(ind.value)));
            progressHTML = `
                <div class="indicator-progress">
                    <span style="width: ${progress}%"></span>
                </div>
                <div class="indicator-progress-labels">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                </div>
            `;
        }

        let trendHTML = "";
        if (meta.showTrendArrow && typeof ind.value === "number") {
            const isPositive = ind.value >= 0;
            const arrow = isPositive ? "↗" : "↘";
            const text = isPositive ? "상승 모멘텀" : "하락 모멘텀";
            trendHTML = `<div class="indicator-trend ${isPositive ? "up" : "down"}">${arrow} ${text}</div>`;
        }

        const hintHTML = meta.hint ? `<p class="indicator-hint">${meta.hint}</p>` : "";

        return `
            <div class="indicator-card ${cardThemeClass} ${style.cardClass}">
                <div class="indicator-card-top">
                    <div>
                        <p class="indicator-card-label">${meta.label}</p>
                        <p class="indicator-card-desc">${ind.description}</p>
                    </div>
                    <span class="${style.badgeClass}">${style.text}</span>
                </div>
                <div class="indicator-card-value">${valueText}</div>
                ${progressHTML}
                ${trendHTML}
                ${hintHTML}
            </div>
        `;
    };

    const getSignalStyle = (signal) => {
        const normalized = (signal || "neutral").toLowerCase();
        const styles = {
            buy: { text: "매수 우위", badgeClass: "signal-badge buy", cardClass: "indicator-positive" },
            sell: { text: "매도 우위", badgeClass: "signal-badge sell", cardClass: "indicator-negative" },
            neutral: { text: "중립", badgeClass: "signal-badge neutral", cardClass: "indicator-neutral" },
            overbought: { text: "과매수", badgeClass: "signal-badge warn", cardClass: "indicator-warn" },
            oversold: { text: "과매도", badgeClass: "signal-badge info", cardClass: "indicator-info" },
        };
        return styles[normalized] || styles.neutral;
    };

    const updateAnalysisHighlights = (analysis) => {
        const highlightsContainer = document.getElementById("analysis-highlights");
        if (!highlightsContainer) return;

        // 종합 신호 카드
        const signalCard = document.getElementById("highlight-signal-card");
        const signalType = analysis?.trading_signal?.type?.toLowerCase() || "hold";
        const normalizedSignal = signalType === "buy" ? "buy" : signalType === "sell" ? "sell" : "neutral";
        
        if (signalCard) {
            signalCard.classList.remove("signal-buy", "signal-sell", "signal-neutral");
            signalCard.classList.add(`signal-${normalizedSignal}`);
        }

        const signalValueEl = document.getElementById("highlight-signal-value");
        if (signalValueEl) {
            signalValueEl.textContent = analysis?.trading_signal?.type?.toUpperCase() || "HOLD";
        }

        const signalDescEl = document.getElementById("highlight-signal-desc");
        if (signalDescEl) {
            signalDescEl.textContent = analysis?.trading_signal?.reason || "신호 설명 없음";
        }

        const signalMetaEl = document.getElementById("highlight-signal-meta");
        if (signalMetaEl) {
            const metaParts = [];
            if (analysis?.trading_signal?.entry_price) {
                metaParts.push(`진입 ${formatPriceDisplay(analysis.trading_signal.entry_price)}`);
            }
            if (analysis?.trading_signal?.target_price) {
                metaParts.push(`목표 ${formatPriceDisplay(analysis.trading_signal.target_price)}`);
            }
            if (analysis?.trading_signal?.stop_loss) {
                metaParts.push(`손절 ${formatPriceDisplay(analysis.trading_signal.stop_loss)}`);
            }
            signalMetaEl.textContent = metaParts.length ? metaParts.join(" · ") : "-";
        }

        // RSI 카드
        const rsiIndicator = (analysis?.technical_indicators || []).find((ind) => ind.name?.toLowerCase().includes("rsi"));
        const rsiValueEl = document.getElementById("highlight-rsi-value");
        const rsiDescEl = document.getElementById("highlight-rsi-desc");
        const rsiBarEl = document.getElementById("highlight-rsi-bar");

        if (rsiValueEl) {
            rsiValueEl.textContent = rsiIndicator ? Math.round(rsiIndicator.value) : "-";
        }
        if (rsiDescEl) {
            rsiDescEl.textContent = rsiIndicator?.description || "RSI 지표 데이터 없음";
        }
        if (rsiBarEl) {
            const rsiValue = rsiIndicator ? Math.round(rsiIndicator.value) : 0;
            const barWidth = Math.max(0, Math.min(100, rsiValue));
            rsiBarEl.style.width = `${barWidth}%`;
        }

        // 리스크 카드
        const riskCard = document.getElementById("highlight-risk-card");
        const riskLevel = analysis?.risk_analysis?.risk_level || "medium";
        if (riskCard) {
            riskCard.classList.remove("risk-high", "risk-medium", "risk-low");
            const riskClass = riskLevel === "high" ? "risk-high" : riskLevel === "low" ? "risk-low" : "risk-medium";
            riskCard.classList.add(riskClass);
        }

        const riskLevelEl = document.getElementById("highlight-risk-level");
        if (riskLevelEl) {
            const riskText = riskLevel === "high" ? "리스크 높음" : riskLevel === "low" ? "리스크 낮음" : "리스크 보통";
            riskLevelEl.textContent = riskText;
        }

        const riskDescEl = document.getElementById("highlight-risk-desc");
        if (riskDescEl) {
            const volatility = analysis?.risk_analysis?.volatility;
            riskDescEl.textContent = typeof volatility === "number" ? `변동성 ${volatility}%` : "변동성 정보 없음";
        }

        const riskRangeEl = document.getElementById("highlight-risk-range");
        if (riskRangeEl) {
            const high52 = formatPriceDisplay(analysis?.risk_analysis?.price_range_52w?.high);
            const low52 = formatPriceDisplay(analysis?.risk_analysis?.price_range_52w?.low);
            riskRangeEl.textContent = `52주 범위: ${low52} ~ ${high52}`;
        }

        // 주요 가격대
        const supportValueEl = document.getElementById("highlight-support-value");
        const resistanceValueEl = document.getElementById("highlight-resistance-value");
        const support = (analysis?.support_resistance || []).find((sr) => sr.type === "support");
        const resistance = (analysis?.support_resistance || []).find((sr) => sr.type === "resistance");

        if (supportValueEl) {
            supportValueEl.textContent = support ? formatPriceDisplay(support.level) : "-";
        }
        if (resistanceValueEl) {
            resistanceValueEl.textContent = resistance ? formatPriceDisplay(resistance.level) : "-";
        }
    };

    // 툴팁 초기화
    const initTooltips = () => {
        const tooltipIcons = document.querySelectorAll(".tooltip-icon");
        tooltipIcons.forEach(icon => {
            const tooltipText = icon.getAttribute("data-tooltip");
            if (!tooltipText) return;
            
            // 기존 툴팁 제거
            const existingTooltip = icon.querySelector(".tooltip-text");
            if (existingTooltip) {
                existingTooltip.remove();
            }
            
            // 툴팁 요소 생성
            const tooltip = document.createElement("div");
            tooltip.className = "tooltip-text";
            tooltip.textContent = tooltipText.replace(/&#10;/g, "\n");
            icon.appendChild(tooltip);
            
            // 마우스 이벤트
            icon.addEventListener("mouseenter", (e) => {
                tooltip.style.display = "block";
                
                // 툴팁 위치 계산 (화면 밖으로 나가지 않도록)
                setTimeout(() => {
                    const rect = icon.getBoundingClientRect();
                    const tooltipRect = tooltip.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    
                    // 기본 위치: 아이콘 위쪽 중앙
                    let top = rect.top - tooltipRect.height - 8;
                    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                    
                    // 화면 왼쪽으로 나가면 조정
                    if (left < 10) {
                        left = 10;
                    }
                    
                    // 화면 오른쪽으로 나가면 조정
                    if (left + tooltipRect.width > viewportWidth - 10) {
                        left = viewportWidth - tooltipRect.width - 10;
                    }
                    
                    // 화면 위로 나가면 아래쪽에 표시
                    if (top < 10) {
                        top = rect.bottom + 8;
                    }
                    
                    // 화면 아래로 나가면 위쪽에 표시
                    if (top + tooltipRect.height > viewportHeight - 10) {
                        top = rect.top - tooltipRect.height - 8;
                    }
                    
                    tooltip.style.position = "fixed";
                    tooltip.style.top = `${top}px`;
                    tooltip.style.left = `${left}px`;
                    tooltip.style.transform = "none";
                    tooltip.style.marginBottom = "0";
                }, 0);
            });
            
            icon.addEventListener("mouseleave", () => {
                tooltip.style.display = "none";
            });
        });
    };

    // 분석 결과 표시 (기존 함수 유지 - 호환성)
    const displayAnalysis = (analysis) => {
        displayAnalysisContent(analysis, false);
    };

    const drawingToolColors = {
        brush: "#38bdf8",
        line: "#f97316",
        hline: "#a855f7",
        rect: "#22c55e",
        text: "#eab308",
    };

    const openDrawingOverlay = () => {
        if (!drawingOverlay) return;
        drawingOverlay.classList.add("active");
        drawingOverlay.setAttribute("aria-hidden", "false");
        document.body.classList.add("prevent-scroll");
        renderDrawingChart();
        setupDrawingCanvas();
        setTimeout(resizeDrawingCanvas, 80);
        drawingKeyHandler = (event) => {
            if (event.key === "Escape") {
                closeDrawingOverlay();
            }
        };
        window.addEventListener("keydown", drawingKeyHandler);
    };

    const closeDrawingOverlay = () => {
        if (!drawingOverlay) return;
        drawingOverlay.classList.remove("active");
        drawingOverlay.setAttribute("aria-hidden", "true");
        document.body.classList.remove("prevent-scroll");
        teardownDrawingChart();
        teardownDrawingCanvas();
        if (drawingKeyHandler) {
            window.removeEventListener("keydown", drawingKeyHandler);
            drawingKeyHandler = null;
        }
    };

    const getCanvasCoordinates = (event) => {
        if (!drawingCanvas) return { x: 0, y: 0 };
        const rect = drawingCanvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    };

    // 픽셀 좌표를 차트의 시간/가격 좌표로 변환
    const pixelToChartCoordinates = (pixelX, pixelY) => {
        if (!drawingChartInstance || !drawingSeries || !drawingCanvas) return null;
        const container = document.getElementById("drawing-chart");
        if (!container) return null;
        
        // 캔버스와 차트 컨테이너는 같은 위치에 있으므로 직접 변환
        const timeScale = drawingChartInstance.timeScale();
        const time = timeScale.coordinateToTime(pixelX);
        
        const price = drawingSeries.coordinateToPrice(pixelY);
        
        return { time, price };
    };

    // 차트의 시간/가격 좌표를 픽셀 좌표로 변환
    const chartToPixelCoordinates = (time, price) => {
        if (!drawingChartInstance || !drawingSeries) return null;
        const container = document.getElementById("drawing-chart");
        if (!container) return null;
        
        const timeScale = drawingChartInstance.timeScale();
        const chartX = timeScale.timeToCoordinate(time);
        const chartY = drawingSeries.priceToCoordinate(price);
        
        // 캔버스와 차트 컨테이너는 같은 위치에 있으므로 직접 변환
        return { x: chartX, y: chartY };
    };

    const drawShape = (shape, isPreview = false) => {
        if (!drawingCtx || !drawingCanvas || !shape) return;
        const color = drawingToolColors[shape.tool] || "#38bdf8";
        drawingCtx.strokeStyle = isPreview ? "#fbbf24" : color;
        drawingCtx.fillStyle = color;
        drawingCtx.beginPath();

        switch (shape.type) {
            case "brush": {
                // 차트 좌표로 저장된 경우
                if (shape.pointsTime !== undefined && shape.pointsTime.length > 0) {
                    const pixelPoints = shape.pointsTime.map(pt => 
                        chartToPixelCoordinates(pt.time, pt.price)
                    ).filter(p => p !== null);
                    
                    if (pixelPoints.length >= 2) {
                        drawingCtx.moveTo(pixelPoints[0].x, pixelPoints[0].y);
                        for (let i = 1; i < pixelPoints.length; i += 1) {
                            drawingCtx.lineTo(pixelPoints[i].x, pixelPoints[i].y);
                        }
                        drawingCtx.stroke();
                    }
                } else if (shape.points && shape.points.length >= 2) {
                    // 기존 픽셀 좌표로 저장된 경우 (하위 호환성)
                    drawingCtx.moveTo(shape.points[0].x, shape.points[0].y);
                    for (let i = 1; i < shape.points.length; i += 1) {
                        drawingCtx.lineTo(shape.points[i].x, shape.points[i].y);
                    }
                    drawingCtx.stroke();
                }
                break;
            }
            case "line": {
                // 차트 좌표로 저장된 경우
                if (shape.startTime !== undefined && shape.startPrice !== undefined) {
                    const startPixel = chartToPixelCoordinates(shape.startTime, shape.startPrice);
                    const endPixel = chartToPixelCoordinates(shape.endTime, shape.endPrice);
                    
                    if (startPixel && endPixel) {
                        drawingCtx.moveTo(startPixel.x, startPixel.y);
                        drawingCtx.lineTo(endPixel.x, endPixel.y);
                        drawingCtx.stroke();
                    }
                } else {
                    // 기존 픽셀 좌표로 저장된 경우 (하위 호환성)
                    drawingCtx.moveTo(shape.start.x, shape.start.y);
                    drawingCtx.lineTo(shape.end.x, shape.end.y);
                    drawingCtx.stroke();
                }
                break;
            }
            case "hline": {
                // 차트 좌표로 저장된 경우
                if (shape.price !== undefined) {
                    const container = document.getElementById("drawing-chart");
                    if (container) {
                        const width = container.clientWidth;
                        // 수평선은 가격 좌표만 사용 (시간은 무시)
                        const pixelY = drawingSeries.priceToCoordinate(shape.price);
                        
                        if (pixelY !== null) {
                            // 수평선은 전체 너비에 걸쳐 그림
                            drawingCtx.moveTo(0, pixelY);
                            drawingCtx.lineTo(width, pixelY);
                            drawingCtx.stroke();
                        }
                    }
                } else {
                    // 기존 픽셀 좌표로 저장된 경우 (하위 호환성)
                    const width = drawingCanvas.clientWidth;
                    drawingCtx.moveTo(0, shape.y);
                    drawingCtx.lineTo(width, shape.y);
                    drawingCtx.stroke();
                }
                break;
            }
            case "rect": {
                // 영역은 차트의 시간/가격 좌표로 저장되어 있음
                // 현재 visible range에 맞춰서 픽셀 좌표로 변환해서 그림
                if (shape.startTime !== undefined && shape.startPrice !== undefined) {
                    // 차트 좌표로 저장된 경우
                    const startPixel = chartToPixelCoordinates(shape.startTime, shape.startPrice);
                    const endPixel = chartToPixelCoordinates(shape.endTime, shape.endPrice);
                    
                    if (startPixel && endPixel) {
                        const x = Math.min(startPixel.x, endPixel.x);
                        const y = Math.min(startPixel.y, endPixel.y);
                        const w = Math.abs(startPixel.x - endPixel.x);
                        const h = Math.abs(startPixel.y - endPixel.y);
                        drawingCtx.strokeRect(x, y, w, h);
                    }
                } else {
                    // 기존 픽셀 좌표로 저장된 경우 (하위 호환성)
                    const x = Math.min(shape.start.x, shape.end.x);
                    const y = Math.min(shape.start.y, shape.end.y);
                    const w = Math.abs(shape.start.x - shape.end.x);
                    const h = Math.abs(shape.start.y - shape.end.y);
                    drawingCtx.strokeRect(x, y, w, h);
                }
                break;
            }
            case "text": {
                if (!shape.text) break;
                drawingCtx.font = "14px sans-serif";
                drawingCtx.fillStyle = color;
                drawingCtx.textAlign = "right"; // 오른쪽 정렬
                drawingCtx.textBaseline = "top";
                
                // 차트 좌표로 저장된 경우
                if (shape.time !== undefined && shape.price !== undefined) {
                    const pixelPos = chartToPixelCoordinates(shape.time, shape.price);
                    if (pixelPos) {
                        drawingCtx.fillText(shape.text, pixelPos.x, pixelPos.y);
                    }
                } else {
                    // 기존 픽셀 좌표로 저장된 경우 (하위 호환성)
                    drawingCtx.fillText(shape.text, shape.x, shape.y);
                }
                break;
            }
            default:
                break;
        }
    };

    const redrawDrawingCanvas = () => {
        if (!drawingCtx || !drawingCanvas) return;
        const ratio = window.devicePixelRatio || 1;
        const width = drawingCanvas.clientWidth * ratio;
        const height = drawingCanvas.clientHeight * ratio;
        drawingCtx.setTransform(1, 0, 0, 1, 0, 0);
        drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        drawingCtx.scale(ratio, ratio);
        drawingCtx.lineCap = "round";
        drawingCtx.lineJoin = "round";
        drawingCtx.lineWidth = 2;

        drawingShapes.forEach(shape => drawShape(shape, false));
        if (drawingCurrentShape) {
            drawShape(drawingCurrentShape, true);
        }
    };

    const resizeDrawingCanvas = () => {
        if (!drawingCanvas || !drawingCtx) return;
        const rect = drawingCanvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            console.warn("캔버스 크기가 0입니다:", rect);
            return;
        }
        const ratio = window.devicePixelRatio || 1;
        const newWidth = rect.width * ratio;
        const newHeight = rect.height * ratio;
        
        // 크기가 변경된 경우에만 리사이즈
        if (drawingCanvas.width !== newWidth || drawingCanvas.height !== newHeight) {
            drawingCanvas.width = newWidth;
            drawingCanvas.height = newHeight;
            drawingCanvas.style.width = `${rect.width}px`;
            drawingCanvas.style.height = `${rect.height}px`;
            drawingCtx.scale(ratio, ratio);
            drawingCtx.lineCap = "round";
            drawingCtx.lineJoin = "round";
            drawingCtx.lineWidth = 2;
            redrawDrawingCanvas();
        }
    };

    const startDrawingStroke = (event) => {
        if (!drawingCanvas || !drawingCtx) {
            console.warn("캔버스 또는 컨텍스트가 없습니다.");
            return;
        }
        
        // 우클릭이면 이동 모드로 전환
        if (event.button === 2 || (event.buttons === 2)) {
            event.preventDefault();
            event.stopPropagation();
            startPanning(event);
            return;
        }
        
        // 일반 클릭이면 드로잉 시작
        event.preventDefault();
        event.stopPropagation();
        if (drawingCanvas.setPointerCapture) {
            drawingCanvas.setPointerCapture(event.pointerId);
        }
        const point = getCanvasCoordinates(event);
        debugLog("드로잉 시작:", { tool: drawingTool, point });
        switch (drawingTool) {
            case "brush": {
                // 자유 그리기는 차트의 시간/가격 좌표로 저장
                const chartCoord = pixelToChartCoordinates(point.x, point.y);
                if (chartCoord) {
                    drawingCurrentShape = { 
                        type: "brush", 
                        tool: "brush", 
                        pointsTime: [{ time: chartCoord.time, price: chartCoord.price }]
                    };
                } else {
                    // 변환 실패 시 픽셀 좌표로 저장 (하위 호환성)
                    drawingCurrentShape = { type: "brush", tool: "brush", points: [point] };
                }
                break;
            }
            case "line": {
                // 직선은 차트의 시간/가격 좌표로 저장
                const startChart = pixelToChartCoordinates(point.x, point.y);
                if (startChart) {
                    drawingCurrentShape = { 
                        type: "line", 
                        tool: "line", 
                        startTime: startChart.time,
                        startPrice: startChart.price,
                        endTime: startChart.time,
                        endPrice: startChart.price
                    };
                } else {
                    // 변환 실패 시 픽셀 좌표로 저장 (하위 호환성)
                    drawingCurrentShape = { type: "line", tool: "line", start: point, end: point };
                }
                break;
            }
            case "hline": {
                // 수평선은 가격 좌표로 저장
                const chartCoord = pixelToChartCoordinates(point.x, point.y);
                if (chartCoord) {
                    drawingCurrentShape = { 
                        type: "hline", 
                        tool: "hline", 
                        price: chartCoord.price
                    };
                } else {
                    // 변환 실패 시 픽셀 좌표로 저장 (하위 호환성)
                    drawingCurrentShape = { type: "hline", tool: "hline", y: point.y };
                }
                break;
            }
            case "rect": {
                // 영역은 차트의 시간/가격 좌표로 저장 (차트 확대/축소와 함께 스케일)
                const startChart = pixelToChartCoordinates(point.x, point.y);
                if (startChart) {
                    drawingCurrentShape = { 
                        type: "rect", 
                        tool: "rect", 
                        startTime: startChart.time,
                        startPrice: startChart.price,
                        endTime: startChart.time,
                        endPrice: startChart.price
                    };
                } else {
                    // 변환 실패 시 픽셀 좌표로 저장 (하위 호환성)
                    drawingCurrentShape = { 
                        type: "rect", 
                        tool: "rect", 
                        start: { x: point.x, y: point.y },
                        end: { x: point.x, y: point.y }
                    };
                }
                break;
            }
            case "text": {
                // 텍스트 입력 받기
                const textInput = prompt("텍스트를 입력하세요:");
                if (textInput && textInput.trim()) {
                    // 텍스트는 차트의 시간/가격 좌표로 저장
                    const chartCoord = pixelToChartCoordinates(point.x, point.y);
                    if (chartCoord) {
                        drawingCurrentShape = { 
                            type: "text", 
                            tool: "text", 
                            time: chartCoord.time,
                            price: chartCoord.price,
                            text: textInput.trim() 
                        };
                    } else {
                        // 변환 실패 시 픽셀 좌표로 저장 (하위 호환성)
                        drawingCurrentShape = { 
                            type: "text", 
                            tool: "text", 
                            x: point.x, 
                            y: point.y, 
                            text: textInput.trim() 
                        };
                    }
                    drawingShapes.push(drawingCurrentShape);
                    drawingCurrentShape = null;
                    redrawDrawingCanvas();
                }
                return;
            }
            default:
                drawingCurrentShape = { type: "brush", tool: "brush", points: [point] };
                break;
        }
        redrawDrawingCanvas();
    };

    const continueDrawingStroke = (event) => {
        if (!drawingCanvas) return;
        
        // 이동 모드 중이면 차트 이동
        if (isPanning) {
            event.preventDefault();
            event.stopPropagation();
            continuePanning(event);
            return;
        }
        
        // 드로잉 중이면 계속 그리기
        if (!drawingCurrentShape) return;
        event.preventDefault();
        event.stopPropagation();
        const point = getCanvasCoordinates(event);
        switch (drawingCurrentShape.type) {
            case "brush": {
                // 자유 그리기는 차트의 시간/가격 좌표로 저장
                const chartCoord = pixelToChartCoordinates(point.x, point.y);
                if (chartCoord && drawingCurrentShape.pointsTime) {
                    drawingCurrentShape.pointsTime.push({ time: chartCoord.time, price: chartCoord.price });
                } else if (!drawingCurrentShape.pointsTime) {
                    // 기존 픽셀 좌표로 저장된 경우 (하위 호환성)
                    drawingCurrentShape.points.push(point);
                }
                break;
            }
            case "line": {
                // 직선은 차트의 시간/가격 좌표로 저장
                const endChart = pixelToChartCoordinates(point.x, point.y);
                if (endChart && drawingCurrentShape.startTime !== undefined) {
                    drawingCurrentShape.endTime = endChart.time;
                    drawingCurrentShape.endPrice = endChart.price;
                } else {
                    // 변환 실패 시 픽셀 좌표로 저장 (하위 호환성)
                    drawingCurrentShape.end = point;
                }
                break;
            }
            case "rect": {
                // 영역은 차트의 시간/가격 좌표로 저장
                const endChart = pixelToChartCoordinates(point.x, point.y);
                if (endChart && drawingCurrentShape.startTime !== undefined) {
                    drawingCurrentShape.endTime = endChart.time;
                    drawingCurrentShape.endPrice = endChart.price;
                } else {
                    // 변환 실패 시 픽셀 좌표로 저장 (하위 호환성)
                    drawingCurrentShape.end = point;
                }
                break;
            }
            case "hline": {
                // 수평선은 가격 좌표로 저장
                const chartCoord = pixelToChartCoordinates(point.x, point.y);
                if (chartCoord && drawingCurrentShape.price !== undefined) {
                    drawingCurrentShape.price = chartCoord.price;
                } else if (drawingCurrentShape.price === undefined) {
                    // 기존 픽셀 좌표로 저장된 경우 (하위 호환성)
                    drawingCurrentShape.y = point.y;
                }
                break;
            }
            case "text":
                // 텍스트는 드래그하지 않음
                break;
            default:
                break;
        }
        redrawDrawingCanvas();
    };

    const endDrawingStroke = (event) => {
        // 이동 모드 종료
        if (isPanning) {
            event.preventDefault();
            event.stopPropagation();
            endPanning();
            return;
        }
        
        // 드로잉 종료
        if (!drawingCurrentShape) return;
        
        // 텍스트는 이미 startDrawingStroke에서 완료됨
        if (drawingCurrentShape.type === "text") {
            return;
        }
        
        event.preventDefault();
        event.stopPropagation();
        if (drawingCanvas && drawingCanvas.releasePointerCapture) {
            drawingCanvas.releasePointerCapture(event.pointerId);
        }
        // brush 체크 (pointsTime 또는 points 사용)
        if (drawingCurrentShape.type === "brush") {
            const pointsCount = drawingCurrentShape.pointsTime 
                ? drawingCurrentShape.pointsTime.length 
                : (drawingCurrentShape.points ? drawingCurrentShape.points.length : 0);
            if (pointsCount < 2) {
                drawingCurrentShape = null;
                redrawDrawingCanvas();
                return;
            }
        }
        
        const point = getCanvasCoordinates(event);
        
        if (drawingCurrentShape.type === "line") {
            // 직선은 차트의 시간/가격 좌표로 저장
            const endChart = pixelToChartCoordinates(point.x, point.y);
            if (endChart && drawingCurrentShape.startTime !== undefined) {
                drawingCurrentShape.endTime = endChart.time;
                drawingCurrentShape.endPrice = endChart.price;
            } else {
                // 변환 실패 시 픽셀 좌표로 저장 (하위 호환성)
                drawingCurrentShape.end = point;
            }
        } else if (drawingCurrentShape.type === "rect") {
            // 영역은 차트의 시간/가격 좌표로 저장
            const endChart = pixelToChartCoordinates(point.x, point.y);
            if (endChart && drawingCurrentShape.startTime !== undefined) {
                drawingCurrentShape.endTime = endChart.time;
                drawingCurrentShape.endPrice = endChart.price;
            } else {
                // 변환 실패 시 픽셀 좌표로 저장 (하위 호환성)
                drawingCurrentShape.end = { x: point.x, y: point.y };
            }
        } else if (drawingCurrentShape.type === "hline") {
            // 수평선은 가격 좌표로 저장
            const chartCoord = pixelToChartCoordinates(point.x, point.y);
            if (chartCoord && drawingCurrentShape.price !== undefined) {
                drawingCurrentShape.price = chartCoord.price;
            } else if (drawingCurrentShape.price === undefined) {
                // 기존 픽셀 좌표로 저장된 경우 (하위 호환성)
                drawingCurrentShape.y = point.y;
            }
        }
        debugLog("드로잉 완료:", drawingCurrentShape);
        drawingShapes.push(drawingCurrentShape);
        drawingCurrentShape = null;
        redrawDrawingCanvas();
    };

    const clearDrawingCanvas = () => {
        drawingShapes = [];
        drawingCurrentShape = null;
        redrawDrawingCanvas();
    };

    const undoDrawingStroke = () => {
        drawingShapes.pop();
        redrawDrawingCanvas();
    };

    // 차트 이동 (우클릭 드래그)
    const startPanning = (event) => {
        if (!drawingChartInstance) return;
        isPanning = true;
        panStartX = event.clientX;
        panStartY = event.clientY;
        const timeScale = drawingChartInstance.timeScale();
        panStartTimeRange = timeScale.getVisibleRange();
        drawingCanvas.style.cursor = "grabbing";
    };

    const continuePanning = (event) => {
        if (!isPanning || !drawingChartInstance || !panStartTimeRange) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const timeScale = drawingChartInstance.timeScale();
        const container = document.getElementById("drawing-chart");
        if (!container) return;
        
        // 좌우 이동만 처리 (deltaX만 사용, 확대 없음)
        const deltaX = event.clientX - panStartX;
        const width = container.clientWidth;
        
        // 시간 범위 계산 (시간 범위는 유지하고 좌우로만 이동)
        const timeRange = panStartTimeRange;
        const timeSpan = timeRange.to - timeRange.from;
        const pixelToTime = timeSpan / width;
        const timeDelta = -deltaX * pixelToTime;
        
        const newFrom = timeRange.from + timeDelta;
        const newTo = timeRange.to + timeDelta;
        
        // 시간 범위만 이동 (확대/축소 없음)
        timeScale.setVisibleRange({
            from: newFrom,
            to: newTo,
        });
    };

    const endPanning = () => {
        isPanning = false;
        panStartX = 0;
        panStartY = 0;
        panStartTimeRange = null;
        if (drawingCanvas) {
            drawingCanvas.style.cursor = "crosshair";
        }
    };

    // 차트 확대/축소 (스크롤)
    const handleChartZoom = (event) => {
        if (!drawingChartInstance || !drawingCanvas) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const delta = event.deltaY;
        const zoomFactor = delta > 0 ? 1.1 : 0.9; // 스크롤 다운: 축소, 스크롤 업: 확대
        
        const timeScale = drawingChartInstance.timeScale();
        const visibleRange = timeScale.getVisibleRange();
        if (!visibleRange) return;
        
        const container = document.getElementById("drawing-chart");
        if (!container) return;
        
        // 마우스 위치를 기준으로 확대/축소
        const rect = container.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseRatio = mouseX / rect.width;
        
        const timeSpan = visibleRange.to - visibleRange.from;
        const centerTime = visibleRange.from + timeSpan * mouseRatio;
        
        const newTimeSpan = timeSpan * zoomFactor;
        const newFrom = centerTime - newTimeSpan * mouseRatio;
        const newTo = centerTime + newTimeSpan * (1 - mouseRatio);
        
        timeScale.setVisibleRange({
            from: newFrom,
            to: newTo,
        });
    };

    const setupDrawingCanvas = () => {
        drawingCanvas = document.getElementById("drawing-canvas");
        if (!drawingCanvas) {
            console.error("drawing-canvas 요소를 찾을 수 없습니다.");
            return;
        }
        drawingCtx = drawingCanvas.getContext("2d");
        if (!drawingCtx) {
            console.error("캔버스 컨텍스트를 가져올 수 없습니다.");
            return;
        }
        drawingShapes = [];
        drawingCurrentShape = null;
        
        // 캔버스 크기 설정
        const rect = drawingCanvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        drawingCanvas.width = rect.width * ratio;
        drawingCanvas.height = rect.height * ratio;
        drawingCanvas.style.width = `${rect.width}px`;
        drawingCanvas.style.height = `${rect.height}px`;
        
        // 컨텍스트 스케일 설정
        drawingCtx.scale(ratio, ratio);
        drawingCtx.lineCap = "round";
        drawingCtx.lineJoin = "round";
        drawingCtx.lineWidth = 2;
        
        debugLog("드로잉 캔버스 초기화 완료:", {
            width: drawingCanvas.width,
            height: drawingCanvas.height,
            clientWidth: rect.width,
            clientHeight: rect.height
        });
        
        // 이벤트 리스너 추가
        drawingCanvas.addEventListener("pointerdown", startDrawingStroke, { passive: false });
        drawingCanvas.addEventListener("pointermove", continueDrawingStroke, { passive: false });
        drawingCanvas.addEventListener("pointerup", endDrawingStroke, { passive: false });
        drawingCanvas.addEventListener("pointerleave", endDrawingStroke, { passive: false });
        drawingCanvas.addEventListener("pointercancel", endDrawingStroke, { passive: false });
        
        // 우클릭 컨텍스트 메뉴 방지
        drawingCanvas.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });
        
        // 스크롤로 확대/축소 (캔버스와 차트 컨테이너 모두에 추가)
        drawingCanvas.addEventListener("wheel", handleChartZoom, { passive: false });
        const chartContainer = document.getElementById("drawing-chart");
        if (chartContainer) {
            chartContainer.addEventListener("wheel", handleChartZoom, { passive: false });
        }
        
        // 리사이즈 리스너
        if (drawingResizeObserver) {
            drawingResizeObserver.disconnect();
        }
        drawingResizeObserver = new ResizeObserver(() => {
            resizeDrawingCanvas();
        });
        drawingResizeObserver.observe(drawingCanvas);
        
        // 초기 그리기
        redrawDrawingCanvas();
    };

    const teardownDrawingCanvas = () => {
        if (drawingResizeObserver) {
            drawingResizeObserver.disconnect();
            drawingResizeObserver = null;
        }
        if (!drawingCanvas) return;
        drawingCanvas.removeEventListener("pointerdown", startDrawingStroke);
        drawingCanvas.removeEventListener("pointermove", continueDrawingStroke);
        drawingCanvas.removeEventListener("pointerup", endDrawingStroke);
        drawingCanvas.removeEventListener("pointerleave", endDrawingStroke);
        drawingCanvas.removeEventListener("pointercancel", endDrawingStroke);
        drawingCanvas.removeEventListener("wheel", handleChartZoom);
        
        const chartContainer = document.getElementById("drawing-chart");
        if (chartContainer) {
            chartContainer.removeEventListener("wheel", handleChartZoom);
        }
        
        isPanning = false;
        panStartX = 0;
        panStartY = 0;
        panStartTimeRange = null;
        drawingCanvas = null;
        drawingCtx = null;
        drawingShapes = [];
        drawingCurrentShape = null;
    };

    const renderDrawingChart = () => {
        const container = document.getElementById("drawing-chart");
        const emptyState = document.getElementById("drawing-empty-state");
        if (!container || !drawingOverlay) return;

        container.innerHTML = "";
        if (!window.LightweightCharts) {
            if (emptyState) {
                emptyState.hidden = false;
                emptyState.textContent = "차트 엔진을 불러올 수 없습니다.";
            }
            return;
        }

        if (!currentCandlestickData || currentCandlestickData.length === 0) {
            if (emptyState) {
                emptyState.hidden = false;
                emptyState.textContent = "차트 데이터를 찾을 수 없습니다.";
            }
            return;
        }

        if (emptyState) {
            emptyState.hidden = true;
        }

        drawingChartInstance = LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: container.clientHeight,
            layout: {
                background: { type: "solid", color: "#0f172a" },
                textColor: "#e2e8f0",
            },
            grid: {
                vertLines: { color: "rgba(255,255,255,0.08)" },
                horzLines: { color: "rgba(255,255,255,0.08)" },
            },
            timeScale: {
                timeVisible: true,
                borderColor: "rgba(255,255,255,0.15)",
            },
            rightPriceScale: {
                borderColor: "rgba(255,255,255,0.15)",
            },
            localization: {
                priceFormatter: price => Math.round(price).toLocaleString(),
            },
        });

        drawingSeries = drawingChartInstance.addCandlestickSeries({
            upColor: "#22d3ee",
            downColor: "#f87171",
            borderVisible: false,
            wickUpColor: "#22d3ee",
            wickDownColor: "#f87171",
            priceFormat: {
                type: "price",
                precision: 0,
                minMove: 1,
            },
        });

        drawingSeries.setData(currentCandlestickData);

        // 차트의 visible range 변경 감지 (영역이 차트와 함께 스케일되도록)
        if (drawingVisibleRangeSubscription) {
            drawingChartInstance.timeScale().unsubscribeVisibleTimeRangeChange(drawingVisibleRangeSubscription);
        }
        drawingVisibleRangeSubscription = drawingChartInstance.timeScale().subscribeVisibleTimeRangeChange(() => {
            // 차트가 확대/축소되면 영역도 다시 그리기
            redrawDrawingCanvas();
        });

        drawingResizeHandler = () => {
            if (!drawingChartInstance) return;
            drawingChartInstance.applyOptions({
                width: container.clientWidth,
                height: container.clientHeight,
            });
            resizeDrawingCanvas();
        };

        window.addEventListener("resize", drawingResizeHandler);
    };

    const teardownDrawingChart = () => {
        if (drawingResizeHandler) {
            window.removeEventListener("resize", drawingResizeHandler);
            drawingResizeHandler = null;
        }
        if (drawingChartInstance && drawingVisibleRangeSubscription) {
            drawingChartInstance.timeScale().unsubscribeVisibleTimeRangeChange(drawingVisibleRangeSubscription);
            drawingVisibleRangeSubscription = null;
        }
        if (drawingChartInstance) {
            drawingChartInstance.remove();
            drawingChartInstance = null;
        }
        drawingSeries = null;
    };

    const initDrawingMode = () => {
        drawingOverlay = document.getElementById("drawing-overlay");
        const openBtn = document.getElementById("open-drawing-mode-btn");
        const closeBtn = document.getElementById("close-drawing-mode-btn");
        const clearBtn = document.getElementById("drawing-clear-btn");
        const undoBtn = document.getElementById("drawing-undo-btn");
        const toolButtons = document.querySelectorAll(".drawing-tool-btn");

        if (!drawingOverlay || !openBtn) return;

        openBtn.addEventListener("click", () => {
            if (!currentCandlestickData || currentCandlestickData.length === 0) {
                alert("차트 데이터를 먼저 불러온 뒤 그리기 모드를 사용할 수 있습니다.");
                return;
            }
            openDrawingOverlay();
        });

        closeBtn?.addEventListener("click", closeDrawingOverlay);
        clearBtn?.addEventListener("click", clearDrawingCanvas);
        undoBtn?.addEventListener("click", undoDrawingStroke);

        // 지표 신뢰도 결과 버튼
        const indicatorReliabilityBtn = document.getElementById("open-indicator-reliability-btn");
        const indicatorReliabilityModal = document.getElementById("indicator-reliability-modal");
        
        // 헤더의 X 버튼과 모달 외부 클릭으로 닫기 기능 추가
        document.addEventListener('click', (e) => {
            if (e.target.id === 'close-indicator-reliability-modal-header') {
                if (indicatorReliabilityModal) {
                    indicatorReliabilityModal.style.display = 'none';
                }
            } else if (e.target === indicatorReliabilityModal) {
                // 모달 배경 클릭 시 닫기
                indicatorReliabilityModal.style.display = 'none';
            }
        });
        const indicatorReliabilityContent = document.getElementById("indicator-reliability-content");

        debugLog("지표 신뢰도 버튼 초기화:", {
            button: indicatorReliabilityBtn,
            modal: indicatorReliabilityModal,
            content: indicatorReliabilityContent
        });

        if (indicatorReliabilityBtn && indicatorReliabilityModal) {
            debugLog("지표 신뢰도 버튼 이벤트 리스너 등록 완료");
            
            indicatorReliabilityBtn.addEventListener("click", async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                debugLog("지표 신뢰도 버튼 클릭됨, currentSymbol:", currentSymbol);
                
                if (!currentSymbol) {
                    alert("종목을 먼저 선택해주세요.");
                    return;
                }

                // 모달 열기
                console.log("모달 열기 시도");
                indicatorReliabilityModal.style.display = "flex";
                indicatorReliabilityModal.style.opacity = "1";
                indicatorReliabilityModal.style.visibility = "visible";
                console.log("모달 스타일 적용됨:", indicatorReliabilityModal.style.display);
                indicatorReliabilityContent.innerHTML = `
                    <div style="text-align: center; padding: 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50vh;">
                        <div class="loading-spinner" style="margin: 0 auto;"></div>
                        <p style="margin-top: 1rem; color: var(--text-muted);">테스트를 실행하는 중입니다...<br>이 작업은 시간이 걸릴 수 있습니다.</p>
                    </div>
                `;

                try {
                    // 기본 지표 신뢰도 테스트
                    const response = await fetch(`${API_BASE}/api/technical-indicators/test?symbol=${currentSymbol}`);
                    const data = await response.json();
                    
                    // 추가 지표 분석도 함께 가져오기
                    let additionalData = null;
                    try {
                        console.log("추가 지표 분석 API 호출 시작:", `${API_BASE}/api/technical-indicators/test-additional?symbol=${currentSymbol}`);
                        const additionalResponse = await fetch(`${API_BASE}/api/technical-indicators/test-additional?symbol=${currentSymbol}`);
                        debugLog("추가 지표 분석 API 응답 상태:", additionalResponse.status);
                        additionalData = await additionalResponse.json();
                        debugLog("추가 지표 분석 데이터:", additionalData);
                    } catch (e) {
                        console.error("추가 지표 분석 실패:", e);
                    }

                    if (!data.success) {
                        indicatorReliabilityContent.innerHTML = `
                            <div style="padding: 2rem; text-align: center;">
                                <p style="color: var(--negative); margin-bottom: 1rem;">테스트 실행 실패</p>
                                <p style="color: var(--text-muted);">${data.error || "알 수 없는 오류가 발생했습니다."}</p>
                            </div>
                        `;
                        return;
                    }

                    // 결과 표시
                    if (data.format === "text" && data.report) {
                        // 텍스트 리포트를 파싱하여 구조화된 데이터로 변환
                        const reportLines = data.report.split('\n');
                        
                        // 디버깅: 리포트 확인
                        debugLog('=== 리포트 원본 ===');
                        console.log(data.report);
                        debugLog('=== 리포트 라인별 (계산/예시 관련) ===');
                        reportLines.forEach((line, idx) => {
                            if (line.includes('계산') || line.includes('예시')) {
                                console.log(`[${idx}] ${line}`);
                            }
                        });
                        
                        let html = `
                            <div style="width: 100%; max-width: 100%;">
                                <div style="background: linear-gradient(135deg, var(--primary) 0%, #0052a3 100%); color: white; padding: 1rem 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; position: relative; width: 100%;">
                                    <button type="button" class="modal-close" id="close-indicator-reliability-modal-header" style="position: absolute; top: 0.75rem; right: 1rem; background: rgba(255,255,255,0.2); color: white; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 1.25rem; line-height: 1; display: flex; align-items: center; justify-content: center; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
                                    <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700;">📊 지표 신뢰 테스트 결과 - ${currentSymbol}</h2>
                                </div>
                        `;
                        
                        // 리포트 파싱
                        let currentSection = null;
                        let currentData = {};
                        let supportData = { examples: [], calcMethod: '' };
                        let resistanceData = { examples: [], calcMethod: '' };
                        let trendData = {};
                        let maData = { goldenExamples: [], deathExamples: [], goldenCalcMethod: '', deathCalcMethod: '' };
                        let inCalculationSection = false;
                        let currentCalcTarget = null; // 'support', 'resistance', 'golden', 'death'
                        
                        reportLines.forEach((line, index) => {
                            const trimmed = line.trim();
                            if (!trimmed) {
                                inCalculationSection = false;
                                currentCalcTarget = null;
                                return;
                            }
                            
                            // 섹션 헤더
                            if (trimmed.includes('지지/저항선')) {
                                currentSection = 'support_resistance';
                                inCalculationSection = false;
                                currentCalcTarget = null;
                            } else if (trimmed.includes('추세선')) {
                                currentSection = 'trend';
                                inCalculationSection = false;
                                currentCalcTarget = null;
                            } else if (trimmed.includes('이동평균선')) {
                                currentSection = 'ma';
                                inCalculationSection = false;
                                currentCalcTarget = null;
                            }
                            
                            // 데이터 추출
                            if (trimmed.includes('지지선 정확도:')) {
                                const match = trimmed.match(/지지선 정확도:\s*([\d.]+)%/);
                                if (match) supportData.accuracy = parseFloat(match[1]);
                                inCalculationSection = false;
                                currentCalcTarget = null;
                            } else if (trimmed.includes('저항선 정확도:')) {
                                const match = trimmed.match(/저항선 정확도:\s*([\d.]+)%/);
                                if (match) resistanceData.accuracy = parseFloat(match[1]);
                                inCalculationSection = false;
                                currentCalcTarget = null;
                            } else if (trimmed.includes('전체 정확도:')) {
                                const match = trimmed.match(/전체 정확도:\s*([\d.]+)%/);
                                if (match) currentData.overall = parseFloat(match[1]);
                            } else if (trimmed.includes('성공:') && trimmed.includes('회')) {
                                const match = trimmed.match(/성공:\s*(\d+)회/);
                                if (match) {
                                    if (currentSection === 'support_resistance') {
                                        if (!supportData.hits) supportData.hits = parseInt(match[1]);
                                        else resistanceData.hits = parseInt(match[1]);
                                    } else if (currentSection === 'ma') {
                                        if (!maData.goldenHits) maData.goldenHits = parseInt(match[1]);
                                        else maData.deathHits = parseInt(match[1]);
                                    }
                                }
                                // 성공/실패를 읽은 후에도 계산 과정 섹션은 계속 유지
                            } else if (trimmed.includes('실패:') && trimmed.includes('회')) {
                                const match = trimmed.match(/실패:\s*(\d+)회/);
                                if (match) {
                                    if (currentSection === 'support_resistance') {
                                        if (!supportData.misses) supportData.misses = parseInt(match[1]);
                                        else resistanceData.misses = parseInt(match[1]);
                                    } else if (currentSection === 'ma') {
                                        if (!maData.goldenMisses) maData.goldenMisses = parseInt(match[1]);
                                        else maData.deathMisses = parseInt(match[1]);
                                    }
                                }
                                // 성공/실패를 읽은 후에도 계산 과정 섹션은 계속 유지
                            } else if (trimmed.includes('추세선') && trimmed.includes('정확도:')) {
                                const match = trimmed.match(/전체 정확도:\s*([\d.]+)%/);
                                if (match) trendData.accuracy = parseFloat(match[1]);
                            } else if (trimmed.includes('골든크로스 정확도:')) {
                                const match = trimmed.match(/골든크로스 정확도:\s*([\d.]+)%/);
                                if (match) maData.goldenAccuracy = parseFloat(match[1]);
                                inCalculationSection = false;
                                currentCalcTarget = null;
                            } else if (trimmed.includes('데드크로스 정확도:')) {
                                const match = trimmed.match(/데드크로스 정확도:\s*([\d.]+)%/);
                                if (match) maData.deathAccuracy = parseFloat(match[1]);
                                inCalculationSection = false;
                                currentCalcTarget = null;
                            } else if (trimmed.includes('계산 과정:')) {
                                // 계산 과정 섹션 시작
                                inCalculationSection = true;
                                // 현재 섹션과 이전에 파싱한 데이터를 기반으로 타겟 결정
                                if (currentSection === 'support_resistance') {
                                    // 지지선 정확도는 파싱했지만 저항선 정확도는 아직 안 파싱했다면 지지선
                                    // 저항선 정확도를 파싱했다면 저항선
                                    if (supportData.accuracy !== undefined && resistanceData.accuracy === undefined) {
                                        currentCalcTarget = 'support';
                                    } else if (resistanceData.accuracy !== undefined) {
                                        currentCalcTarget = 'resistance';
                                    } else {
                                        currentCalcTarget = 'support';
                                    }
                                } else if (currentSection === 'ma') {
                                    // 골든크로스 정확도는 파싱했지만 데드크로스 정확도는 아직 안 파싱했다면 골든크로스
                                    // 데드크로스 정확도를 파싱했다면 데드크로스
                                    if (maData.goldenAccuracy !== undefined && maData.deathAccuracy === undefined) {
                                        currentCalcTarget = 'golden';
                                    } else if (maData.deathAccuracy !== undefined) {
                                        currentCalcTarget = 'death';
                                    } else {
                                        currentCalcTarget = 'golden';
                                    }
                                }
                            } else if (inCalculationSection) {
                                // 계산 과정 섹션 내에서 예시 또는 계산 방법 파싱
                                if (trimmed.includes('예시:')) {
                                    if (trimmed.includes('지지선')) {
                                        // 단순 파싱: "예시: 지지선 191,700.0원 탐지 -> 196,500원 도달 (+2.50%) -> 3일 후 191,000원 (-2.80% 회복) -> 성공"
                                        // 더 유연한 정규식 사용
                                        const match = trimmed.match(/지지선\s+([\d,.]+)원\s+탐지.*?->.*?([\d,.]+)원\s+도달\s*\(([+-]?[\d.]+)%\).*?->.*?3일\s+후\s+([\d,.]+)원\s*\(([+-]?[\d.]+)%\s+(?:회복|돌파)\).*?->\s*(\w+)/);
                                        if (match && supportData.examples.length < 2) {
                                            supportData.examples.push({
                                                level: match[1].replace(/,/g, ''),
                                                touch: match[2].replace(/,/g, ''),
                                                touchPct: match[3],
                                                future: match[4].replace(/,/g, ''),
                                                changePct: match[5],
                                                result: match[6]
                                            });
                                        }
                                    } else if (trimmed.includes('저항선')) {
                                        // "예시: 저항선 213,000.0원 탐지 -> 223,000원 도달 (+4.69%) -> 3일 후 221,500원 (-0.67% 하락) -> 성공"
                                        const match = trimmed.match(/저항선\s+([\d,.]+)원\s+탐지.*?->.*?([\d,.]+)원\s+도달\s*\(([+-]?[\d.]+)%\).*?->.*?3일\s+후\s+([\d,.]+)원\s*\(([+-]?[\d.]+)%\s+(?:하락|상승)\).*?->\s*(\w+)/);
                                        if (match && resistanceData.examples.length < 2) {
                                            resistanceData.examples.push({
                                                level: match[1].replace(/,/g, ''),
                                                touch: match[2].replace(/,/g, ''),
                                                touchPct: match[3],
                                                future: match[4].replace(/,/g, ''),
                                                changePct: match[5],
                                                result: match[6]
                                            });
                                        }
                                    } else if (trimmed.includes('골든크로스')) {
                                        // "예시: 206,500원에서 5일선이 20일선 상향 돌파 (골든크로스) -> 10일 후 229,000원 (+10.90% 변동, 최고가 232,000원) -> 성공"
                                        const match = trimmed.match(/([\d,.]+)원에서.*?5일선이.*?20일선.*?상향.*?돌파.*?골든크로스.*?->.*?10일\s+후\s+([\d,.]+)원\s*\(([+-]?[\d.]+)%\s+변동.*?최고가\s+([\d,.]+)원\).*?->\s*(\w+)/);
                                        if (match && maData.goldenExamples.length < 2) {
                                            maData.goldenExamples.push({
                                                signal: match[1].replace(/,/g, ''),
                                                future: match[2].replace(/,/g, ''),
                                                change: match[3],
                                                high: match[4].replace(/,/g, ''),
                                                result: match[5]
                                            });
                                        }
                                    } else if (trimmed.includes('데드크로스')) {
                                        // "예시: 207,000원에서 5일선이 20일선 하향 돌파 (데드크로스) -> 10일 후 211,000원 (+1.93% 변동, 최저가 204,500원) -> 실패"
                                        const match = trimmed.match(/([\d,.]+)원에서.*?5일선이.*?20일선.*?하향.*?돌파.*?데드크로스.*?->.*?10일\s+후\s+([\d,.]+)원\s*\(([+-]?[\d.]+)%\s+변동.*?최저가\s+([\d,.]+)원\).*?->\s*(\w+)/);
                                        if (match && maData.deathExamples.length < 2) {
                                            maData.deathExamples.push({
                                                signal: match[1].replace(/,/g, ''),
                                                future: match[2].replace(/,/g, ''),
                                                change: match[3],
                                                low: match[4].replace(/,/g, ''),
                                                result: match[5]
                                            });
                                        }
                                    }
                                } else if (trimmed.includes('계산 방법:')) {
                                    // 계산 방법 설명 저장
                                    const methodText = trimmed.replace(/^\s*계산\s+방법:\s*/, '').trim();
                                    if (currentCalcTarget === 'support') {
                                        supportData.calcMethod = methodText;
                                    } else if (currentCalcTarget === 'resistance') {
                                        resistanceData.calcMethod = methodText;
                                    } else if (currentCalcTarget === 'golden') {
                                        maData.goldenCalcMethod = methodText;
                                    } else if (currentCalcTarget === 'death') {
                                        maData.deathCalcMethod = methodText;
                                    }
                                    // 계산 방법을 읽은 후 섹션 종료
                                    inCalculationSection = false;
                                    currentCalcTarget = null;
                                }
                            }
                        });
                        
                        // 디버깅: 파싱 결과 확인
                        debugLog('=== 파싱 결과 ===');
                        console.log('supportData:', JSON.stringify(supportData, null, 2));
                        console.log('resistanceData:', JSON.stringify(resistanceData, null, 2));
                        console.log('maData:', JSON.stringify(maData, null, 2));
                        
                        // 항상 원본 리포트에서 직접 예시 추출 (더 확실한 방법)
                        const fullReport = data.report;
                        const allLines = fullReport.split('\n');
                        
                        // 지지선 예시 추출
                        for (let i = 0; i < allLines.length && supportData.examples.length < 2; i++) {
                            const line = allLines[i].trim();
                            if (line.includes('예시:') && line.includes('지지선') && line.includes('탐지')) {
                                // "예시: 지지선 35,700.0원 탐지 -> 36,350원 도달 (+1.82%) -> 3일 후 37,450원 (+3.03% 회복) -> 성공"
                                const parts = line.split('->').map(p => p.trim());
                                if (parts.length >= 4) {
                                    // parts[0] = "예시: 지지선 35,700.0원 탐지"
                                    // parts[1] = "36,350원 도달 (+1.82%)"
                                    // parts[2] = "3일 후 37,450원 (+3.03% 회복)"
                                    // parts[3] = "성공"
                                    
                                    const levelMatch = parts[0].match(/지지선\s+([\d,.]+)원/);
                                    const touchMatch = parts[1].match(/([\d,.]+)원\s+도달\s*\(([+-]?[\d.]+)%\)/);
                                    const futureMatch = parts[2].match(/3일\s+후\s+([\d,.]+)원\s*\(([+-]?[\d.]+)%\s+(?:회복|돌파)\)/);
                                    const result = parts[parts.length - 1].trim();
                                    
                                    if (levelMatch && touchMatch && futureMatch && result) {
                                        supportData.examples.push({
                                            level: levelMatch[1].replace(/,/g, ''),
                                            touch: touchMatch[1].replace(/,/g, ''),
                                            touchPct: touchMatch[2],
                                            future: futureMatch[1].replace(/,/g, ''),
                                            changePct: futureMatch[2],
                                            result: result
                                        });
                                    }
                                }
                            }
                        }
                        
                        // 저항선 예시 추출
                        for (let i = 0; i < allLines.length && resistanceData.examples.length < 2; i++) {
                            const line = allLines[i].trim();
                            if (line.includes('예시:') && line.includes('저항선') && line.includes('탐지')) {
                                const parts = line.split('->').map(p => p.trim());
                                if (parts.length >= 4) {
                                    const levelMatch = parts[0].match(/저항선\s+([\d,.]+)원/);
                                    const touchMatch = parts[1].match(/([\d,.]+)원\s+도달\s*\(([+-]?[\d.]+)%\)/);
                                    const futureMatch = parts[2].match(/3일\s+후\s+([\d,.]+)원\s*\(([+-]?[\d.]+)%\s+(?:하락|상승)\)/);
                                    const result = parts[parts.length - 1].trim();
                                    
                                    if (levelMatch && touchMatch && futureMatch && result) {
                                        resistanceData.examples.push({
                                            level: levelMatch[1].replace(/,/g, ''),
                                            touch: touchMatch[1].replace(/,/g, ''),
                                            touchPct: touchMatch[2],
                                            future: futureMatch[1].replace(/,/g, ''),
                                            changePct: futureMatch[2],
                                            result: result
                                        });
                                    }
                                }
                            }
                        }
                        
                        // 골든크로스 예시 추출
                        for (let i = 0; i < allLines.length && maData.goldenExamples.length < 2; i++) {
                            const line = allLines[i].trim();
                            if (line.includes('예시:') && line.includes('골든크로스')) {
                                // "예시: 41,800원에서 5일선이 20일선 상향 돌파 (골든크로스) -> 10일 후 39,050원 (-6.58% 변동, 최고가 46,000원) -> 성공"
                                const parts = line.split('->').map(p => p.trim());
                                if (parts.length >= 3) {
                                    // parts[0] = "예시: 41,800원에서 5일선이 20일선 상향 돌파 (골든크로스)"
                                    // parts[1] = "10일 후 39,050원 (-6.58% 변동, 최고가 46,000원)"
                                    // parts[2] = "성공"
                                    
                                    const signalMatch = parts[0].match(/([\d,.]+)원에서/);
                                    const futureMatch = parts[1].match(/10일\s+후\s+([\d,.]+)원\s*\(([+-]?[\d.]+)%\s+변동/);
                                    const highMatch = parts[1].match(/최고가\s+([\d,.]+)원/);
                                    const result = parts[parts.length - 1].trim();
                                    
                                    if (signalMatch && futureMatch && highMatch && result) {
                                        maData.goldenExamples.push({
                                            signal: signalMatch[1].replace(/,/g, ''),
                                            future: futureMatch[1].replace(/,/g, ''),
                                            change: futureMatch[2],
                                            high: highMatch[1].replace(/,/g, ''),
                                            result: result
                                        });
                                    }
                                }
                            }
                        }
                        
                        // 데드크로스 예시 추출
                        for (let i = 0; i < allLines.length && maData.deathExamples.length < 2; i++) {
                            const line = allLines[i].trim();
                            if (line.includes('예시:') && line.includes('데드크로스')) {
                                // "예시: 39,300원에서 5일선이 20일선 하향 돌파 (데드크로스) -> 10일 후 45,100원 (+14.76% 변동, 최저가 38,850원) -> 실패"
                                const parts = line.split('->').map(p => p.trim());
                                if (parts.length >= 3) {
                                    const signalMatch = parts[0].match(/([\d,.]+)원에서/);
                                    const futureMatch = parts[1].match(/10일\s+후\s+([\d,.]+)원\s*\(([+-]?[\d.]+)%\s+변동/);
                                    const lowMatch = parts[1].match(/최저가\s+([\d,.]+)원/);
                                    const result = parts[parts.length - 1].trim();
                                    
                                    if (signalMatch && futureMatch && lowMatch && result) {
                                        maData.deathExamples.push({
                                            signal: signalMatch[1].replace(/,/g, ''),
                                            future: futureMatch[1].replace(/,/g, ''),
                                            change: futureMatch[2],
                                            low: lowMatch[1].replace(/,/g, ''),
                                            result: result
                                        });
                                    }
                                }
                            }
                        }
                        
                        debugLog('=== 최종 파싱 결과 ===');
                        console.log('supportData examples:', supportData.examples.length, supportData.examples);
                        console.log('resistanceData examples:', resistanceData.examples.length, resistanceData.examples);
                        console.log('maData goldenExamples:', maData.goldenExamples.length, maData.goldenExamples);
                        console.log('maData deathExamples:', maData.deathExamples.length, maData.deathExamples);
                        
                        // 결과 카드 생성 - 가로 레이아웃으로 변경 (4열로 변경하여 더 컴팩트하게, 가운데 정렬)
                        html += '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; align-items: start; width: 100%; max-width: 100%; justify-items: stretch;">';
                        
                        // 지지/저항선 카드
                        if (supportData.accuracy !== undefined || resistanceData.accuracy !== undefined) {
                            const avgAccuracy = supportData.accuracy && resistanceData.accuracy 
                                ? ((supportData.accuracy + resistanceData.accuracy) / 2).toFixed(1)
                                : (supportData.accuracy || resistanceData.accuracy || 0).toFixed(1);
                            const color = avgAccuracy >= 70 ? 'var(--positive)' : avgAccuracy >= 60 ? 'var(--primary)' : 'var(--negative)';
                            
                            html += `
                                <div style="background: var(--card); border-radius: 12px; padding: 0.75rem; border: 1px solid var(--card-border); box-shadow: 0 2px 8px rgba(0,0,0,0.05); width: 100%; height: 100%;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                                        <div style="width: 32px; height: 32px; background: linear-gradient(135deg, var(--primary), #0052a3); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">📈</div>
                                        <div style="flex: 1; min-width: 0;">
                                            <h3 style="margin: 0; color: var(--text); font-size: 0.9rem; font-weight: 700; line-height: 1.2;">지지/저항선</h3>
                                            <p style="margin: 0.15rem 0 0 0; color: var(--text-muted); font-size: 0.7rem;">평균: <strong style="color: ${color};">${avgAccuracy}%</strong></p>
                                        </div>
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                        ${supportData.accuracy !== undefined ? `
                                            <div style="padding: 0.5rem; background: var(--surface); border-radius: 6px;">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                                                    <span style="color: var(--text-muted); font-size: 0.7rem;">지지선</span>
                                                    <strong style="color: ${supportData.accuracy >= 70 ? 'var(--positive)' : supportData.accuracy >= 60 ? 'var(--primary)' : 'var(--negative)'}; font-size: 0.85rem;">${supportData.accuracy.toFixed(1)}%</strong>
                                                </div>
                                                <div style="height: 4px; background: var(--card-border); border-radius: 2px; overflow: hidden;">
                                                    <div style="height: 100%; width: ${supportData.accuracy}%; background: ${supportData.accuracy >= 70 ? 'var(--positive)' : supportData.accuracy >= 60 ? 'var(--primary)' : 'var(--negative)'};"></div>
                                                </div>
                                                ${supportData.hits !== undefined ? `<p style="margin: 0.25rem 0 0 0; color: var(--text-muted); font-size: 0.65rem;">성공: ${supportData.hits}회 / 실패: ${supportData.misses || 0}회</p>` : ''}
                                                ${supportData.examples && supportData.examples.length > 0 ? `
                                                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--card-border);">
                                                        <p style="margin: 0 0 0.25rem 0; color: var(--text-muted); font-size: 0.65rem; font-weight: 600;">계산:</p>
                                                        ${supportData.examples.slice(0, 1).map(ex => `
                                                            <div style="padding: 0.4rem; background: var(--card); border-radius: 4px; border-left: 2px solid ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'};">
                                                                <p style="margin: 0; color: var(--text); font-size: 0.65rem; line-height: 1.3;">
                                                                    지지선 ${parseInt(ex.level).toLocaleString()}원 → ${parseInt(ex.touch).toLocaleString()}원 (${ex.touchPct}%) → ${parseInt(ex.future).toLocaleString()}원 (${ex.changePct}%) <span style="color: ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'}; font-weight: 600;">${ex.result}</span>
                                                                </p>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        ` : ''}
                                        ${resistanceData.accuracy !== undefined ? `
                                            <div style="padding: 0.5rem; background: var(--surface); border-radius: 6px;">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                                                    <span style="color: var(--text-muted); font-size: 0.7rem;">저항선</span>
                                                    <strong style="color: ${resistanceData.accuracy >= 70 ? 'var(--positive)' : resistanceData.accuracy >= 60 ? 'var(--primary)' : 'var(--negative)'}; font-size: 0.85rem;">${resistanceData.accuracy.toFixed(1)}%</strong>
                                                </div>
                                                <div style="height: 4px; background: var(--card-border); border-radius: 2px; overflow: hidden;">
                                                    <div style="height: 100%; width: ${resistanceData.accuracy}%; background: ${resistanceData.accuracy >= 70 ? 'var(--positive)' : resistanceData.accuracy >= 60 ? 'var(--primary)' : 'var(--negative)'};"></div>
                                                </div>
                                                ${resistanceData.hits !== undefined ? `<p style="margin: 0.25rem 0 0 0; color: var(--text-muted); font-size: 0.65rem;">성공: ${resistanceData.hits}회 / 실패: ${resistanceData.misses || 0}회</p>` : ''}
                                                ${resistanceData.examples && resistanceData.examples.length > 0 ? `
                                                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--card-border);">
                                                        <p style="margin: 0 0 0.25rem 0; color: var(--text-muted); font-size: 0.65rem; font-weight: 600;">계산:</p>
                                                        ${resistanceData.examples.slice(0, 1).map(ex => `
                                                            <div style="padding: 0.4rem; background: var(--card); border-radius: 4px; border-left: 2px solid ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'};">
                                                                <p style="margin: 0; color: var(--text); font-size: 0.65rem; line-height: 1.3;">
                                                                    저항선 ${parseInt(ex.level).toLocaleString()}원 → ${parseInt(ex.touch).toLocaleString()}원 (${ex.touchPct}%) → ${parseInt(ex.future).toLocaleString()}원 (${ex.changePct}%) <span style="color: ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'}; font-weight: 600;">${ex.result}</span>
                                                                </p>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                        }
                        
                        // 추세선 카드
                        if (trendData.accuracy !== undefined) {
                            const color = trendData.accuracy >= 70 ? 'var(--positive)' : trendData.accuracy >= 60 ? 'var(--primary)' : 'var(--negative)';
                            html += `
                                <div style="background: var(--card); border-radius: 16px; padding: 1.5rem; border: 1px solid var(--card-border); box-shadow: 0 2px 8px rgba(0,0,0,0.05); max-height: 85vh; overflow-y: auto;">
                                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
                                        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, var(--accent), #7c3aed); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">📉</div>
                                        <div>
                                            <h3 style="margin: 0; color: var(--text); font-size: 1.25rem; font-weight: 700;">추세선 정확도</h3>
                                            <p style="margin: 0.25rem 0 0 0; color: var(--text-muted); font-size: 0.85rem;">예측 정확도</p>
                                        </div>
                                    </div>
                                    <div style="text-align: center; padding: 1.5rem; background: var(--surface); border-radius: 12px;">
                                        <div style="font-size: 3rem; font-weight: 700; color: ${color}; margin-bottom: 0.5rem;">${trendData.accuracy.toFixed(1)}%</div>
                                        <div style="height: 8px; background: var(--card-border); border-radius: 4px; overflow: hidden; margin-top: 1rem;">
                                            <div style="height: 100%; width: ${trendData.accuracy}%; background: ${color}; transition: width 0.3s ease;"></div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }
                        
                        // 이동평균선 카드
                        if (maData.goldenAccuracy !== undefined || maData.deathAccuracy !== undefined) {
                            const avgAccuracy = maData.goldenAccuracy && maData.deathAccuracy 
                                ? ((maData.goldenAccuracy + maData.deathAccuracy) / 2).toFixed(1)
                                : (maData.goldenAccuracy || maData.deathAccuracy || 0).toFixed(1);
                            const color = avgAccuracy >= 70 ? 'var(--positive)' : avgAccuracy >= 60 ? 'var(--primary)' : 'var(--negative)';
                            
                            html += `
                                <div style="background: var(--card); border-radius: 12px; padding: 0.75rem; border: 1px solid var(--card-border); box-shadow: 0 2px 8px rgba(0,0,0,0.05); width: 100%; height: 100%;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                                        <div style="width: 32px; height: 32px; background: linear-gradient(135deg, var(--positive), #1db954); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">📊</div>
                                        <div style="flex: 1; min-width: 0;">
                                            <h3 style="margin: 0; color: var(--text); font-size: 0.9rem; font-weight: 700; line-height: 1.2;">이동평균선</h3>
                                            <p style="margin: 0.15rem 0 0 0; color: var(--text-muted); font-size: 0.7rem;">평균: <strong style="color: ${color};">${avgAccuracy}%</strong></p>
                                        </div>
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                        ${maData.goldenAccuracy !== undefined ? `
                                            <div style="padding: 0.5rem; background: var(--surface); border-radius: 6px;">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                                                    <span style="color: var(--text-muted); font-size: 0.7rem;">골든크로스</span>
                                                    <strong style="color: ${maData.goldenAccuracy >= 70 ? 'var(--positive)' : maData.goldenAccuracy >= 60 ? 'var(--primary)' : 'var(--negative)'}; font-size: 0.85rem;">${maData.goldenAccuracy.toFixed(1)}%</strong>
                                                </div>
                                                <div style="height: 4px; background: var(--card-border); border-radius: 2px; overflow: hidden;">
                                                    <div style="height: 100%; width: ${maData.goldenAccuracy}%; background: ${maData.goldenAccuracy >= 70 ? 'var(--positive)' : maData.goldenAccuracy >= 60 ? 'var(--primary)' : 'var(--negative)'};"></div>
                                                </div>
                                                ${maData.goldenHits !== undefined ? `<p style="margin: 0.25rem 0 0 0; color: var(--text-muted); font-size: 0.65rem;">성공: ${maData.goldenHits}회 / 실패: ${maData.goldenMisses || 0}회</p>` : ''}
                                                ${maData.goldenExamples && maData.goldenExamples.length > 0 ? `
                                                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--card-border);">
                                                        <p style="margin: 0 0 0.25rem 0; color: var(--text-muted); font-size: 0.65rem; font-weight: 600;">계산:</p>
                                                        ${maData.goldenExamples.slice(0, 1).map(ex => `
                                                            <div style="padding: 0.4rem; background: var(--card); border-radius: 4px; border-left: 2px solid ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'};">
                                                                <p style="margin: 0; color: var(--text); font-size: 0.65rem; line-height: 1.3;">
                                                                    ${parseInt(ex.signal).toLocaleString()}원 골든크로스 → ${parseInt(ex.future).toLocaleString()}원 (${parseFloat(ex.change) >= 0 ? '+' : ''}${ex.change}%) ${ex.high ? `최고: ${parseInt(ex.high).toLocaleString()}원` : ''} <span style="color: ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'}; font-weight: 600;">${ex.result}</span>
                                                                </p>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        ` : ''}
                                        ${maData.deathAccuracy !== undefined ? `
                                            <div style="padding: 0.5rem; background: var(--surface); border-radius: 6px;">
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                                                    <span style="color: var(--text-muted); font-size: 0.7rem;">데드크로스</span>
                                                    <strong style="color: ${maData.deathAccuracy >= 70 ? 'var(--positive)' : maData.deathAccuracy >= 60 ? 'var(--primary)' : 'var(--negative)'}; font-size: 0.85rem;">${maData.deathAccuracy.toFixed(1)}%</strong>
                                                </div>
                                                <div style="height: 4px; background: var(--card-border); border-radius: 2px; overflow: hidden;">
                                                    <div style="height: 100%; width: ${maData.deathAccuracy}%; background: ${maData.deathAccuracy >= 70 ? 'var(--positive)' : maData.deathAccuracy >= 60 ? 'var(--primary)' : 'var(--negative)'};"></div>
                                                </div>
                                                ${maData.deathHits !== undefined ? `<p style="margin: 0.25rem 0 0 0; color: var(--text-muted); font-size: 0.65rem;">성공: ${maData.deathHits}회 / 실패: ${maData.deathMisses || 0}회</p>` : ''}
                                                ${maData.deathExamples && maData.deathExamples.length > 0 ? `
                                                    <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--card-border);">
                                                        <p style="margin: 0 0 0.25rem 0; color: var(--text-muted); font-size: 0.65rem; font-weight: 600;">계산:</p>
                                                        ${maData.deathExamples.slice(0, 1).map(ex => `
                                                            <div style="padding: 0.4rem; background: var(--card); border-radius: 4px; border-left: 2px solid ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'};">
                                                                <p style="margin: 0; color: var(--text); font-size: 0.65rem; line-height: 1.3;">
                                                                    ${parseInt(ex.signal).toLocaleString()}원 데드크로스 → ${parseInt(ex.future).toLocaleString()}원 (${parseFloat(ex.change) >= 0 ? '+' : ''}${ex.change}%) ${ex.low ? `최저: ${parseInt(ex.low).toLocaleString()}원` : ''} <span style="color: ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'}; font-weight: 600;">${ex.result}</span>
                                                                </p>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                        }
                        
                        // 추가 분석 항목들 파싱 및 표시
                        console.log("추가 분석 데이터 확인:", additionalData);
                        if (additionalData && additionalData.success && additionalData.report) {
                            debugLog("추가 분석 리포트 파싱 시작");
                            const additionalReportLines = additionalData.report.split('\n');
                            debugLog("추가 분석 리포트 라인 수:", additionalReportLines.length);
                            let rsiData = {};
                            let macdData = {};
                            let bbData = {};
                            let riskData = {};
                            let currentSection = null;
                            
                            additionalReportLines.forEach((line, index) => {
                                const trimmed = line.trim();
                                const nextLine = index < additionalReportLines.length - 1 ? additionalReportLines[index + 1].trim() : '';
                                
                                if (trimmed.includes('[RSI 분석]')) {
                                    currentSection = 'rsi';
                                } else if (trimmed.includes('[MACD 분석]')) {
                                    currentSection = 'macd';
                                } else if (trimmed.includes('[볼린저 밴드 분석]')) {
                                    currentSection = 'bb';
                                } else if (trimmed.includes('[리스크 분석]')) {
                                    currentSection = 'risk';
                                } else if (trimmed.includes('전체 정확도:')) {
                                    const match = trimmed.match(/전체 정확도:\s*([\d.]+)%/);
                                    if (match) {
                                        if (currentSection === 'rsi') rsiData.overallAccuracy = parseFloat(match[1]);
                                        else if (currentSection === 'macd') macdData.overallAccuracy = parseFloat(match[1]);
                                        else if (currentSection === 'bb') bbData.overallAccuracy = parseFloat(match[1]);
                                    }
                                } else if (trimmed.includes('과매도 신호') || trimmed.includes('과매수 신호')) {
                                    const match = trimmed.match(/(과매도|과매수)\s+신호.*?:\s*([\d.]+)%/);
                                    if (match && currentSection === 'rsi') {
                                        if (match[1] === '과매도') {
                                            rsiData.oversoldAccuracy = parseFloat(match[2]);
                                        } else {
                                            rsiData.overboughtAccuracy = parseFloat(match[2]);
                                        }
                                    }
                                    // 다음 줄에서 성공/전체 횟수 찾기
                                    const countMatch = nextLine.match(/성공:\s*(\d+)회\s*\/\s*전체:\s*(\d+)회/);
                                    if (countMatch && currentSection === 'rsi') {
                                        if (trimmed.includes('과매도')) {
                                            rsiData.oversoldCorrect = parseInt(countMatch[1]);
                                            rsiData.oversoldTotal = parseInt(countMatch[2]);
                                        } else {
                                            rsiData.overboughtCorrect = parseInt(countMatch[1]);
                                            rsiData.overboughtTotal = parseInt(countMatch[2]);
                                        }
                                    }
                                } else if (trimmed.includes('골든크로스') || trimmed.includes('데드크로스')) {
                                    const match = trimmed.match(/(골든크로스|데드크로스).*?:\s*([\d.]+)%/);
                                    if (match && currentSection === 'macd') {
                                        if (match[1] === '골든크로스') {
                                            macdData.goldenAccuracy = parseFloat(match[2]);
                                        } else {
                                            macdData.deathAccuracy = parseFloat(match[2]);
                                        }
                                    }
                                    // 다음 줄에서 성공/전체 횟수 찾기
                                    const countMatch = nextLine.match(/성공:\s*(\d+)회\s*\/\s*전체:\s*(\d+)회/);
                                    if (countMatch && currentSection === 'macd') {
                                        if (trimmed.includes('골든크로스')) {
                                            macdData.goldenCorrect = parseInt(countMatch[1]);
                                            macdData.goldenTotal = parseInt(countMatch[2]);
                                        } else {
                                            macdData.deathCorrect = parseInt(countMatch[1]);
                                            macdData.deathTotal = parseInt(countMatch[2]);
                                        }
                                    }
                                } else if (trimmed.includes('하단 밴드 터치') || trimmed.includes('상단 밴드 터치')) {
                                    const match = trimmed.match(/(하단|상단)\s+밴드\s+터치.*?:\s*([\d.]+)%/);
                                    if (match && currentSection === 'bb') {
                                        if (match[1] === '하단') {
                                            bbData.lowerAccuracy = parseFloat(match[2]);
                                        } else {
                                            bbData.upperAccuracy = parseFloat(match[2]);
                                        }
                                    }
                                    // 다음 줄에서 성공/전체 횟수 찾기
                                    const countMatch = nextLine.match(/성공:\s*(\d+)회\s*\/\s*전체:\s*(\d+)회/);
                                    if (countMatch && currentSection === 'bb') {
                                        if (trimmed.includes('하단')) {
                                            bbData.lowerCorrect = parseInt(countMatch[1]);
                                            bbData.lowerTotal = parseInt(countMatch[2]);
                                        } else {
                                            bbData.upperCorrect = parseInt(countMatch[1]);
                                            bbData.upperTotal = parseInt(countMatch[2]);
                                        }
                                    }
                                } else if (trimmed.includes('변동성:') && currentSection === 'risk') {
                                    const match = trimmed.match(/변동성:\s*([\d.]+)%\s*\((\w+)\)/);
                                    if (match) {
                                        riskData.volatility = parseFloat(match[1]);
                                        riskData.volatilityGrade = match[2];
                                    }
                                } else if (trimmed.includes('최대 낙폭') && currentSection === 'risk') {
                                    const match = trimmed.match(/최대 낙폭.*?:\s*([\d.]+)%\s*\((\w+)\)/);
                                    if (match) {
                                        riskData.mdd = parseFloat(match[1]);
                                        riskData.mddGrade = match[2];
                                    }
                                } else if (trimmed.includes('샤프 비율:') && currentSection === 'risk') {
                                    const match = trimmed.match(/샤프 비율:\s*([\d.]+)/);
                                    if (match) {
                                        riskData.sharpeRatio = parseFloat(match[1]);
                                    }
                                } else if (trimmed.includes('예시:') && trimmed.includes('RSI')) {
                                    // RSI 예시 파싱
                                    // 형식: 예시: RSI 16.1 (과매도) -> 64,700원 매수 신호 -> 5일 후 69,300원 (+7.11% 변동) -> 성공
                                    const rsiMatch = trimmed.match(/RSI\s+([\d.]+)\s+\(과(매도|매수)\)/);
                                    const priceMatch = trimmed.match(/([\d,.]+)원\s+(매수|매도)\s+신호/);
                                    const futureMatch = trimmed.match(/5일\s+후\s+([\d,.]+)원\s+\(([+-]?[\d.]+)%\s+변동\)/);
                                    // 더 유연한 resultMatch - 라인 끝의 -> 성공/실패 찾기
                                    const resultMatch = trimmed.match(/->\s*(성공|실패)/);
                                    
                                    if (rsiMatch && priceMatch && futureMatch && resultMatch) {
                                        if (!rsiData.examples) rsiData.examples = [];
                                        if (rsiData.examples.length < 4) { // 과매도와 과매수 각각 2개씩
                                            rsiData.examples.push({
                                                rsi: rsiMatch[1],
                                                type: rsiMatch[2],
                                                signalPrice: priceMatch[1].replace(/,/g, ''),
                                                futurePrice: futureMatch[1].replace(/,/g, ''),
                                                changePct: futureMatch[2],
                                                result: resultMatch[1]
                                            });
                                        }
                                    }
                                } else if (trimmed.includes('예시:') && trimmed.includes('MACD')) {
                                    // MACD 예시 파싱
                                    // 형식: 예시: MACD 531.11 > Signal 406.44 (골든크로스) -> 81,000원 매수 신호 -> 10일 후 89,000원 (+9.88% 변동) -> 성공
                                    // MACD 값이 음수일 수 있으므로 정규식 수정 - 더 유연하게
                                    let macdMatch = trimmed.match(/MACD\s+([+-]?[\d.]+)\s+[><]\s+Signal\s+([+-]?[\d.]+)/);
                                    if (!macdMatch) {
                                        // 대체 패턴 시도 (공백이 여러 개일 수 있음)
                                        macdMatch = trimmed.match(/MACD\s+([+-]?[\d.]+).*?Signal\s+([+-]?[\d.]+)/);
                                    }
                                    const priceMatch = trimmed.match(/([\d,.]+)원\s+(매수|매도)\s+신호/);
                                    const futureMatch = trimmed.match(/10일\s+후\s+([\d,.]+)원\s+\(([+-]?[\d.]+)%\s+변동\)/);
                                    // 더 유연한 resultMatch
                                    const resultMatch = trimmed.match(/->\s*(성공|실패)/);
                                    
                                    console.log("MACD 예시 라인:", trimmed);
                                    console.log("MACD 파싱 결과:", { macdMatch: macdMatch ? macdMatch[0] : null, priceMatch: priceMatch ? priceMatch[0] : null, futureMatch: futureMatch ? futureMatch[0] : null, resultMatch: resultMatch ? resultMatch[0] : null });
                                    
                                    if (macdMatch && priceMatch && futureMatch && resultMatch) {
                                        if (!macdData.examples) macdData.examples = [];
                                        if (macdData.examples.length < 4) { // 골든크로스와 데드크로스 각각 2개씩
                                            macdData.examples.push({
                                                macd: macdMatch[1],
                                                signal: macdMatch[2],
                                                type: trimmed.includes('골든크로스') ? 'golden' : 'death',
                                                signalPrice: priceMatch[1].replace(/,/g, ''),
                                                futurePrice: futureMatch[1].replace(/,/g, ''),
                                                changePct: futureMatch[2],
                                                result: resultMatch[1]
                                            });
                                            console.log("MACD 예시 추가됨, 현재 개수:", macdData.examples.length);
                                        }
                                    }
                                } else if (trimmed.includes('예시:') && trimmed.includes('밴드')) {
                                    // 볼린저 밴드 예시 파싱
                                    // 형식: 예시: 가격 77,200원이 하단 밴드 76,755원 터치 -> 매수 신호 -> 5일 후 68,100원 (-11.79% 변동) -> 실패
                                    const priceMatch = trimmed.match(/가격\s+([\d,.]+)원이\s+(하단|상단)\s+밴드\s+([\d,.]+)원\s+터치/);
                                    const futureMatch = trimmed.match(/5일\s+후\s+([\d,.]+)원\s+\(([+-]?[\d.]+)%\s+변동\)/);
                                    // 더 유연한 resultMatch
                                    const resultMatch = trimmed.match(/->\s*(성공|실패)/);
                                    
                                    if (priceMatch && futureMatch && resultMatch) {
                                        if (!bbData.examples) bbData.examples = [];
                                        if (bbData.examples.length < 4) { // 하단 밴드와 상단 밴드 각각 2개씩
                                            bbData.examples.push({
                                                price: priceMatch[1].replace(/,/g, ''),
                                                bandType: priceMatch[2],
                                                bandLevel: priceMatch[3].replace(/,/g, ''),
                                                futurePrice: futureMatch[1].replace(/,/g, ''),
                                                changePct: futureMatch[2],
                                                result: resultMatch[1]
                                            });
                                        }
                                    }
                                }
                            });

                            if ((!macdData.examples || macdData.examples.length === 0) && maData) {
                                macdData.examples = [];
                                if (maData.goldenExamples && maData.goldenExamples.length) {
                                    maData.goldenExamples.slice(0, 2).forEach((ex) => {
                                        macdData.examples.push({
                                            macd: '-',
                                            signal: '-',
                                            type: 'golden',
                                            signalPrice: ex.signal,
                                            futurePrice: ex.future,
                                            changePct: ex.change,
                                            result: ex.result,
                                            extra: ex.high ? `최고가 ${Number(ex.high).toLocaleString()}원` : ''
                                        });
                                    });
                                }
                                if (maData.deathExamples && maData.deathExamples.length) {
                                    maData.deathExamples.slice(0, 2).forEach((ex) => {
                                        macdData.examples.push({
                                            macd: '-',
                                            signal: '-',
                                            type: 'death',
                                            signalPrice: ex.signal,
                                            futurePrice: ex.future,
                                            changePct: ex.change,
                                            result: ex.result,
                                            extra: ex.low ? `최저가 ${Number(ex.low).toLocaleString()}원` : ''
                                        });
                                    });
                                }
                            }


                            // 추가 분석 카드 생성
                            html += `
                                <div style="background: var(--card); border-radius: 12px; padding: 0.75rem; border: 1px solid var(--card-border); box-shadow: 0 2px 8px rgba(0,0,0,0.05); grid-column: 1 / -1; width: 100%;">
                                    <h3 style="margin: 0 0 0.75rem 0; color: var(--text); font-size: 0.9rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
                                        <span>📊</span> 추가 분석
                                    </h3>
                                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; width: 100%;">
                            `;
                            
                            // RSI 분석 카드
                            if (rsiData.overallAccuracy !== undefined) {
                                const color = rsiData.overallAccuracy >= 70 ? 'var(--positive)' : rsiData.overallAccuracy >= 60 ? 'var(--primary)' : 'var(--negative)';
                                html += `
                                    <div style="padding: 0.5rem; background: var(--surface); border-radius: 6px; border: 1px solid var(--card-border);">
                                        <div style="display: flex; align-items: center; gap: 0.25rem; margin-bottom: 0.5rem;">
                                            <span style="font-size: 0.9rem;">📈</span>
                                            <h4 style="margin: 0; color: var(--text); font-size: 0.75rem; font-weight: 600;">RSI</h4>
                                        </div>
                                        <div style="text-align: center; margin-bottom: 0.5rem;">
                                            <div style="font-size: 1rem; font-weight: 700; color: ${color};">${rsiData.overallAccuracy.toFixed(1)}%</div>
                                            <p style="margin: 0.15rem 0 0 0; color: var(--text-muted); font-size: 0.65rem;">전체</p>
                                        </div>
                                        ${rsiData.oversoldAccuracy !== undefined ? `
                                            <div style="margin-bottom: 0.5rem;">
                                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.15rem;">
                                                    <span style="font-size: 0.65rem; color: var(--text-muted);">과매도</span>
                                                    <strong style="color: ${rsiData.oversoldAccuracy >= 70 ? 'var(--positive)' : 'var(--negative)'}; font-size: 0.7rem;">${rsiData.oversoldAccuracy.toFixed(1)}%</strong>
                                                </div>
                                                <p style="margin: 0; font-size: 0.6rem; color: var(--text-muted);">${rsiData.oversoldCorrect || 0}/${rsiData.oversoldTotal || 0}</p>
                                            </div>
                                        ` : ''}
                                        ${rsiData.overboughtAccuracy !== undefined ? `
                                            <div style="margin-bottom: 0.5rem;">
                                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.15rem;">
                                                    <span style="font-size: 0.65rem; color: var(--text-muted);">과매수</span>
                                                    <strong style="color: ${rsiData.overboughtAccuracy >= 70 ? 'var(--positive)' : 'var(--negative)'}; font-size: 0.7rem;">${rsiData.overboughtAccuracy.toFixed(1)}%</strong>
                                                </div>
                                                <p style="margin: 0; font-size: 0.6rem; color: var(--text-muted);">${rsiData.overboughtCorrect || 0}/${rsiData.overboughtTotal || 0}</p>
                                            </div>
                                        ` : ''}
                                        ${rsiData.examples && rsiData.examples.length > 0 ? `
                                            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--card-border);">
                                                <p style="margin: 0 0 0.25rem 0; color: var(--text-muted); font-size: 0.65rem; font-weight: 600;">계산:</p>
                                                ${rsiData.examples.slice(0, 1).map(ex => `
                                                    <div style="padding: 0.4rem; background: var(--card); border-radius: 4px; border-left: 2px solid ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'};">
                                                        <p style="margin: 0; color: var(--text); font-size: 0.65rem; line-height: 1.3;">
                                                            RSI ${ex.rsi} → ${parseInt(ex.signalPrice).toLocaleString()}원 → ${parseInt(ex.futurePrice).toLocaleString()}원 (${parseFloat(ex.changePct) >= 0 ? '+' : ''}${ex.changePct}%) <span style="color: ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'}; font-weight: 600;">${ex.result}</span>
                                                        </p>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }
                            
                            // MACD 분석 카드
                            if (macdData.overallAccuracy !== undefined) {
                                const color = macdData.overallAccuracy >= 70 ? 'var(--positive)' : macdData.overallAccuracy >= 60 ? 'var(--primary)' : 'var(--negative)';
                                html += `
                                    <div style="padding: 0.5rem; background: var(--surface); border-radius: 6px; border: 1px solid var(--card-border);">
                                        <div style="display: flex; align-items: center; gap: 0.25rem; margin-bottom: 0.5rem;">
                                            <span style="font-size: 0.9rem;">📉</span>
                                            <h4 style="margin: 0; color: var(--text); font-size: 0.75rem; font-weight: 600;">MACD</h4>
                                        </div>
                                        <div style="text-align: center; margin-bottom: 0.5rem;">
                                            <div style="font-size: 1rem; font-weight: 700; color: ${color};">${macdData.overallAccuracy.toFixed(1)}%</div>
                                            <p style="margin: 0.15rem 0 0 0; color: var(--text-muted); font-size: 0.65rem;">전체</p>
                                        </div>
                                        ${macdData.goldenAccuracy !== undefined ? `
                                            <div style="margin-bottom: 0.5rem;">
                                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.15rem;">
                                                    <span style="font-size: 0.65rem; color: var(--text-muted);">골든</span>
                                                    <strong style="color: ${macdData.goldenAccuracy >= 70 ? 'var(--positive)' : 'var(--negative)'}; font-size: 0.7rem;">${macdData.goldenAccuracy.toFixed(1)}%</strong>
                                                </div>
                                                <p style="margin: 0; font-size: 0.6rem; color: var(--text-muted);">${macdData.goldenCorrect || 0}/${macdData.goldenTotal || 0}</p>
                                            </div>
                                        ` : ''}
                                        ${macdData.deathAccuracy !== undefined ? `
                                            <div style="margin-bottom: 0.5rem;">
                                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.15rem;">
                                                    <span style="font-size: 0.65rem; color: var(--text-muted);">데드</span>
                                                    <strong style="color: ${macdData.deathAccuracy >= 70 ? 'var(--positive)' : 'var(--negative)'}; font-size: 0.7rem;">${macdData.deathAccuracy.toFixed(1)}%</strong>
                                                </div>
                                                <p style="margin: 0; font-size: 0.6rem; color: var(--text-muted);">${macdData.deathCorrect || 0}/${macdData.deathTotal || 0}</p>
                                            </div>
                                        ` : ''}
                                        ${macdData.examples && macdData.examples.length > 0 ? `
                                            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--card-border);">
                                                <p style="margin: 0 0 0.25rem 0; color: var(--text-muted); font-size: 0.65rem; font-weight: 600;">계산:</p>
                                                ${macdData.examples.slice(0, 2).map(ex => `
                                                    <div style="padding: 0.4rem; background: var(--card); border-radius: 4px; border-left: 2px solid ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'}; margin-bottom: 0.25rem;">
                                                        <p style="margin: 0; color: var(--text); font-size: 0.65rem; line-height: 1.3;">
                                                            ${ex.type === 'golden' ? '골든' : '데드'} → ${parseInt(ex.signalPrice).toLocaleString()}원 → ${parseInt(ex.futurePrice).toLocaleString()}원 (${parseFloat(ex.changePct) >= 0 ? '+' : ''}${ex.changePct}%) ${ex.extra ? ex.extra : ''} <span style="color: ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'}; font-weight: 600;">${ex.result}</span>
                                                        </p>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }
                            
                            // 볼린저 밴드 분석 카드
                            if (bbData.overallAccuracy !== undefined) {
                                const color = bbData.overallAccuracy >= 70 ? 'var(--positive)' : bbData.overallAccuracy >= 60 ? 'var(--primary)' : 'var(--negative)';
                                html += `
                                    <div style="padding: 0.5rem; background: var(--surface); border-radius: 6px; border: 1px solid var(--card-border);">
                                        <div style="display: flex; align-items: center; gap: 0.25rem; margin-bottom: 0.5rem;">
                                            <span style="font-size: 0.9rem;">📊</span>
                                            <h4 style="margin: 0; color: var(--text); font-size: 0.75rem; font-weight: 600;">볼린저</h4>
                                        </div>
                                        <div style="text-align: center; margin-bottom: 0.5rem;">
                                            <div style="font-size: 1rem; font-weight: 700; color: ${color};">${bbData.overallAccuracy.toFixed(1)}%</div>
                                            <p style="margin: 0.15rem 0 0 0; color: var(--text-muted); font-size: 0.65rem;">전체</p>
                                        </div>
                                        ${bbData.lowerAccuracy !== undefined ? `
                                            <div style="margin-bottom: 0.5rem;">
                                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.15rem;">
                                                    <span style="font-size: 0.65rem; color: var(--text-muted);">하단</span>
                                                    <strong style="color: ${bbData.lowerAccuracy >= 70 ? 'var(--positive)' : 'var(--negative)'}; font-size: 0.7rem;">${bbData.lowerAccuracy.toFixed(1)}%</strong>
                                                </div>
                                                <p style="margin: 0; font-size: 0.6rem; color: var(--text-muted);">${bbData.lowerCorrect || 0}/${bbData.lowerTotal || 0}</p>
                                            </div>
                                        ` : ''}
                                        ${bbData.upperAccuracy !== undefined ? `
                                            <div style="margin-bottom: 0.5rem;">
                                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.15rem;">
                                                    <span style="font-size: 0.65rem; color: var(--text-muted);">상단</span>
                                                    <strong style="color: ${bbData.upperAccuracy >= 70 ? 'var(--positive)' : 'var(--negative)'}; font-size: 0.7rem;">${bbData.upperAccuracy.toFixed(1)}%</strong>
                                                </div>
                                                <p style="margin: 0; font-size: 0.6rem; color: var(--text-muted);">${bbData.upperCorrect || 0}/${bbData.upperTotal || 0}</p>
                                            </div>
                                        ` : ''}
                                        ${bbData.examples && bbData.examples.length > 0 ? `
                                            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--card-border);">
                                                <p style="margin: 0 0 0.25rem 0; color: var(--text-muted); font-size: 0.65rem; font-weight: 600;">계산:</p>
                                                ${bbData.examples.slice(0, 2).map(ex => `
                                                    <div style="padding: 0.4rem; background: var(--card); border-radius: 4px; border-left: 2px solid ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'}; margin-bottom: 0.25rem;">
                                                        <p style="margin: 0; color: var(--text); font-size: 0.65rem; line-height: 1.3;">
                                                            ${parseInt(ex.price).toLocaleString()}원 ${ex.bandType} 터치 → ${parseInt(ex.futurePrice).toLocaleString()}원 (${parseFloat(ex.changePct) >= 0 ? '+' : ''}${ex.changePct}%) <span style="color: ${ex.result === '성공' ? 'var(--positive)' : 'var(--negative)'}; font-weight: 600;">${ex.result}</span>
                                                        </p>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }
                            
                            // 리스크 분석 카드
                            if (riskData.volatility !== undefined) {
                                html += `
                                    <div style="padding: 1rem; background: var(--surface); border-radius: 8px; border: 1px solid var(--card-border);">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                                            <span style="font-size: 1.25rem;">⚠️</span>
                                            <h4 style="margin: 0; color: var(--text); font-size: 1rem; font-weight: 600;">리스크 분석</h4>
                                        </div>
                                        ${riskData.volatility !== undefined ? `
                                            <div style="margin-bottom: 0.75rem;">
                                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                                    <span style="font-size: 0.85rem; color: var(--text-muted);">변동성</span>
                                                    <strong style="color: ${riskData.volatilityGrade === '낮음' ? 'var(--positive)' : riskData.volatilityGrade === '보통' ? 'var(--primary)' : 'var(--negative)'};">${riskData.volatility.toFixed(2)}%</strong>
                                                </div>
                                                <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted);">등급: ${riskData.volatilityGrade}</p>
                                                <p style="margin: 0.25rem 0 0 0; font-size: 0.7rem; color: var(--text-muted); line-height: 1.4;">
                                                    계산 방법: 일일 수익률의 표준편차를 연율화 (√252 곱하기)
                                                </p>
                                            </div>
                                        ` : ''}
                                        ${riskData.mdd !== undefined ? `
                                            <div style="margin-bottom: 0.75rem;">
                                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                                    <span style="font-size: 0.85rem; color: var(--text-muted);">최대 낙폭 (MDD)</span>
                                                    <strong style="color: ${riskData.mddGrade === '낮음' ? 'var(--positive)' : riskData.mddGrade === '보통' ? 'var(--primary)' : 'var(--negative)'};">${riskData.mdd.toFixed(2)}%</strong>
                                                </div>
                                                <p style="margin: 0; font-size: 0.75rem; color: var(--text-muted);">등급: ${riskData.mddGrade}</p>
                                                <p style="margin: 0.25rem 0 0 0; font-size: 0.7rem; color: var(--text-muted); line-height: 1.4;">
                                                    계산 방법: 누적 수익률의 최고점 대비 최대 하락폭
                                                </p>
                                            </div>
                                        ` : ''}
                                        ${riskData.sharpeRatio !== undefined ? `
                                            <div>
                                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                                    <span style="font-size: 0.85rem; color: var(--text-muted);">샤프 비율</span>
                                                    <strong style="color: ${riskData.sharpeRatio > 1 ? 'var(--positive)' : riskData.sharpeRatio > 0 ? 'var(--primary)' : 'var(--negative)'};">${riskData.sharpeRatio.toFixed(2)}</strong>
                                                </div>
                                                <p style="margin: 0.25rem 0 0 0; font-size: 0.7rem; color: var(--text-muted); line-height: 1.4;">
                                                    계산 방법: (평균 수익률 / 변동성)
                                                </p>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }
                            
                            html += `
                                    </div>
                                </div>
                            `;
                        } else {
                            // 추가 분석 데이터가 없을 때 기본 설명 표시
                            html += `
                                <div style="background: var(--card); border-radius: 16px; padding: 1.5rem; border: 1px solid var(--card-border); box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-top: 1.5rem;">
                                    <h3 style="margin: 0 0 1.25rem 0; color: var(--text); font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
                                        <span>📊</span> 추가 분석
                                    </h3>
                                    <p style="margin: 0; color: var(--text-muted); font-size: 0.9rem;">
                                        추가 분석 데이터를 불러오는 중입니다...
                                    </p>
                                </div>
                            `;
                        }
                        
                        html += '</div></div>';
                        // 결과를 가운데 정렬하기 위한 래퍼 추가
                        indicatorReliabilityContent.innerHTML = `<div style="width: 100%; max-width: 100%; display: flex; flex-direction: column; align-items: center;">${html}</div>`;
                    } else {
                        indicatorReliabilityContent.innerHTML = `
                            <div style="padding: 2rem; text-align: center;">
                                <p style="color: var(--text-muted);">결과를 표시할 수 없습니다.</p>
                            </div>
                        `;
                    }
                } catch (error) {
                    console.error("지표 신뢰도 테스트 오류:", error);
                    indicatorReliabilityContent.innerHTML = `
                        <div style="padding: 2rem; text-align: center;">
                            <p style="color: var(--negative); margin-bottom: 1rem;">테스트 실행 중 오류 발생</p>
                            <p style="color: var(--text-muted);">${error.message}</p>
                        </div>
                    `;
                }
            });

            // 모달 닫기는 헤더의 X 버튼과 모달 외부 클릭으로 처리됨 (위에서 정의됨)

            // 모달 외부 클릭 시 닫기
            indicatorReliabilityModal.addEventListener("click", (e) => {
                if (e.target === indicatorReliabilityModal) {
                    indicatorReliabilityModal.style.display = "none";
                    indicatorReliabilityModal.style.opacity = "0";
                    indicatorReliabilityModal.style.visibility = "hidden";
                }
            });
        } else {
            console.error("지표 신뢰도 모달 요소를 찾을 수 없습니다:", {
                button: indicatorReliabilityBtn,
                modal: indicatorReliabilityModal
            });
        }

        toolButtons.forEach(button => {
            button.addEventListener("click", () => {
                toolButtons.forEach(btn => btn.classList.remove("active"));
                button.classList.add("active");
                drawingTool = button.dataset.tool || "brush";
            });
        });
    };

    // 이동평균선 그리기
    const drawMovingAverages = (candlestickData) => {
        if (!chartInstance || !candlestickData || candlestickData.length === 0) return;
        
        try {
            // 기존 이동평균선 제거
            if (chartSeries.ma5) {
                try {
                    chartInstance.removeSeries(chartSeries.ma5);
                } catch (e) {
                    console.warn("MA5 제거 실패:", e);
                }
            }
            if (chartSeries.ma20) {
                try {
                    chartInstance.removeSeries(chartSeries.ma20);
                } catch (e) {
                    console.warn("MA20 제거 실패:", e);
                }
            }
            if (chartSeries.ma60) {
                try {
                    chartInstance.removeSeries(chartSeries.ma60);
                } catch (e) {
                    console.warn("MA60 제거 실패:", e);
                }
            }
            if (chartSeries.ma120) {
                try {
                    chartInstance.removeSeries(chartSeries.ma120);
                } catch (e) {
                    console.warn("MA120 제거 실패:", e);
                }
            }
            
            // 이동평균 계산
            const closes = candlestickData.map(d => d.close);
            const calculateMA = (period) => {
                const ma = [];
                for (let i = 0; i < closes.length; i++) {
                    if (i < period - 1) {
                        ma.push(null);
                    } else {
                        const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
                        ma.push(sum / period);
                    }
                }
                return ma;
            };
            
            const ma5 = calculateMA(5);
            const ma20 = calculateMA(20);
            const ma60 = calculateMA(60);
            const ma120 = calculateMA(120);
            
            // MA5 그리기
            if (candlestickData.length >= 5) {
                const ma5Data = candlestickData.map((d, i) => ({
                    time: d.time,
                    value: ma5[i]
                })).filter(d => d.value !== null);
                
                if (ma5Data.length > 0) {
                    chartSeries.ma5 = chartInstance.addLineSeries({
                        color: '#ff6b6b',
                        lineWidth: 1,
                        title: 'MA5',
                        priceFormat: {
                            type: 'price',
                            precision: 2,
                            minMove: 0.01,
                        },
                    });
                    chartSeries.ma5.setData(ma5Data);
                }
            }
            
            // MA20 그리기
            if (candlestickData.length >= 20) {
                const ma20Data = candlestickData.map((d, i) => ({
                    time: d.time,
                    value: ma20[i]
                })).filter(d => d.value !== null);
                
                if (ma20Data.length > 0) {
                    chartSeries.ma20 = chartInstance.addLineSeries({
                        color: '#4ecdc4',
                        lineWidth: 1,
                        title: 'MA20',
                        priceFormat: {
                            type: 'price',
                            precision: 2,
                            minMove: 0.01,
                        },
                    });
                    chartSeries.ma20.setData(ma20Data);
                }
            }
            
            // MA60 그리기
            if (candlestickData.length >= 60) {
                const ma60Data = candlestickData.map((d, i) => ({
                    time: d.time,
                    value: ma60[i]
                })).filter(d => d.value !== null);
                
                if (ma60Data.length > 0) {
                    chartSeries.ma60 = chartInstance.addLineSeries({
                        color: '#45b7d1',
                        lineWidth: 1,
                        title: 'MA60',
                        priceFormat: {
                            type: 'price',
                            precision: 2,
                            minMove: 0.01,
                        },
                    });
                    chartSeries.ma60.setData(ma60Data);
                }
            }
            
            // MA120 그리기
            if (candlestickData.length >= 120) {
                const ma120Data = candlestickData.map((d, i) => ({
                    time: d.time,
                    value: ma120[i]
                })).filter(d => d.value !== null);
                
                if (ma120Data.length > 0) {
                    chartSeries.ma120 = chartInstance.addLineSeries({
                        color: '#96ceb4',
                        lineWidth: 1,
                        title: 'MA120',
                        priceFormat: {
                            type: 'price',
                            precision: 2,
                            minMove: 0.01,
                        },
                    });
                    chartSeries.ma120.setData(ma120Data);
                }
            }
        } catch (error) {
            console.error("이동평균선 그리기 오류:", error);
        }
    };

    // Visible range 변경 감지 및 선 재조정
    const setupVisibleRangeListener = () => {
        if (!chartInstance) return;
        
        // 기존 구독 제거
        if (visibleRangeSubscription) {
            try {
                chartInstance.timeScale().unsubscribeVisibleTimeRangeChange(visibleRangeSubscription);
            } catch (e) {
                console.warn("구독 제거 실패:", e);
            }
        }
        
        // Visible range 변경 감지
        visibleRangeSubscription = chartInstance.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
            if (!timeRange || !currentAnalysis || !currentCandlestickData) return;
            
            // 보이는 범위에 맞춰 선 재조정
            updateLinesForVisibleRange(timeRange);
        });
    };

    // 보이는 범위에 맞춰 선 업데이트
    const updateLinesForVisibleRange = (timeRange) => {
        if (!chartInstance || !currentAnalysis || !currentCandlestickData) return;
        
        try {
            const series = chartSeries.candlestick || chartInstance.getSeries()[0];
            if (!series) return;
            
            // 보이는 범위의 데이터 필터링
            const visibleData = currentCandlestickData.filter(d => {
                const time = typeof d.time === 'number' ? d.time : parseInt(d.time);
                return time >= timeRange.from && time <= timeRange.to;
            });
            
            if (visibleData.length === 0) return;
            
            // 보이는 범위의 가격 범위 계산
            const visibleHighs = visibleData.map(d => d.high);
            const visibleLows = visibleData.map(d => d.low);
            const visibleCloses = visibleData.map(d => d.close);
            const minPrice = Math.min(...visibleLows);
            const maxPrice = Math.max(...visibleHighs);
            const priceRange = maxPrice - minPrice;
            
            // 기존 선 제거
            chartSeries.supportLines.forEach(line => {
                try {
                    series.removePriceLine(line);
                } catch (e) {
                    console.warn("지지선 제거 실패:", e);
                }
            });
            chartSeries.resistanceLines.forEach(line => {
                try {
                    series.removePriceLine(line);
                } catch (e) {
                    console.warn("저항선 제거 실패:", e);
                }
            });
            chartSeries.supportLines = [];
            chartSeries.resistanceLines = [];
            
            // 보이는 범위 내의 지지/저항선만 필터링
            const visibleSupports = currentAnalysis.support_resistance
                .filter(sr => sr.type === "support" && sr.level >= minPrice - priceRange * 0.1 && sr.level <= maxPrice + priceRange * 0.1)
                .sort((a, b) => b.level - a.level) // 높은 순서대로
                .slice(0, 3);
            
            const visibleResistances = currentAnalysis.support_resistance
                .filter(sr => sr.type === "resistance" && sr.level >= minPrice - priceRange * 0.1 && sr.level <= maxPrice + priceRange * 0.1)
                .sort((a, b) => a.level - b.level) // 낮은 순서대로
                .slice(0, 3);
            
            // 지지선 그리기
            visibleSupports.forEach(sr => {
                try {
                    const line = series.createPriceLine({
                        price: sr.level,
                        color: '#26de81',
                        lineWidth: 2,
                        lineStyle: 2, // dashed
                        axisLabelVisible: true,
                        title: `지지선 ${Math.round(sr.level).toLocaleString()}`,
                    });
                    chartSeries.supportLines.push(line);
                } catch (e) {
                    console.warn("지지선 그리기 실패:", e);
                }
            });
            
            // 저항선 그리기
            visibleResistances.forEach(sr => {
                try {
                    const line = series.createPriceLine({
                        price: sr.level,
                        color: '#ff4757',
                        lineWidth: 2,
                        lineStyle: 2, // dashed
                        axisLabelVisible: true,
                        title: `저항선 ${Math.round(sr.level).toLocaleString()}`,
                    });
                    chartSeries.resistanceLines.push(line);
                } catch (e) {
                    console.warn("저항선 그리기 실패:", e);
                }
            });
            
            // 목표가/손절가는 항상 표시 (보이는 범위와 관계없이)
            // 기존 목표가/손절가 선은 유지 (제거하지 않음)
            
        } catch (error) {
            console.error("선 업데이트 오류:", error);
        }
    };

    // 차트에 선 그리기 함수 (지지/저항선, 목표가, 손절가)
    const drawChartLines = (analysis) => {
        if (!chartInstance || !analysis) return;
        
        try {
            // 기존 선 제거
            chartSeries.supportLines.forEach(line => {
                try {
                    const series = chartSeries.candlestick || chartInstance.getSeries()[0];
                    if (series) {
                        series.removePriceLine(line);
                    }
                } catch (e) {
                    console.warn("지지선 제거 실패:", e);
                }
            });
            chartSeries.resistanceLines.forEach(line => {
                try {
                    const series = chartSeries.candlestick || chartInstance.getSeries()[0];
                    if (series) {
                        series.removePriceLine(line);
                    }
                } catch (e) {
                    console.warn("저항선 제거 실패:", e);
                }
            });
            chartSeries.targetLines.forEach(line => {
                try {
                    const series = chartSeries.candlestick || chartInstance.getSeries()[0];
                    if (series) {
                        series.removePriceLine(line);
                    }
                } catch (e) {
                    console.warn("목표가 선 제거 실패:", e);
                }
            });
            chartSeries.stopLossLines.forEach(line => {
                try {
                    const series = chartSeries.candlestick || chartInstance.getSeries()[0];
                    if (series) {
                        series.removePriceLine(line);
                    }
                } catch (e) {
                    console.warn("손절가 선 제거 실패:", e);
                }
            });
            chartSeries.supportLines = [];
            chartSeries.resistanceLines = [];
            chartSeries.targetLines = [];
            chartSeries.stopLossLines = [];
            
            const series = chartSeries.candlestick || chartInstance.getSeries()[0];
            if (!series) return;
            
            // 현재 보이는 범위 가져오기
            const visibleRange = chartInstance.timeScale().getVisibleRange();
            if (visibleRange && currentCandlestickData) {
                // 보이는 범위에 맞춰 선 그리기
                updateLinesForVisibleRange(visibleRange);
            } else {
                // 초기 로드 시 전체 범위에서 가장 가까운 선만 표시
                if (currentCandlestickData && currentCandlestickData.length > 0) {
                    const lastPrice = currentCandlestickData[currentCandlestickData.length - 1].close;
                    const supports = analysis.support_resistance
                        .filter(sr => sr.type === "support" && sr.level < lastPrice)
                        .sort((a, b) => b.level - a.level)
                        .slice(0, 3);
                    const resistances = analysis.support_resistance
                        .filter(sr => sr.type === "resistance" && sr.level > lastPrice)
                        .sort((a, b) => a.level - b.level)
                        .slice(0, 3);
                    
                    supports.forEach(sr => {
                        try {
                            const line = series.createPriceLine({
                                price: sr.level,
                                color: '#26de81',
                                lineWidth: 2,
                                lineStyle: 2,
                                axisLabelVisible: true,
                                title: `지지선 ${Math.round(sr.level).toLocaleString()}`,
                            });
                            chartSeries.supportLines.push(line);
                        } catch (e) {
                            console.warn("지지선 그리기 실패:", e);
                        }
                    });
                    
                    resistances.forEach(sr => {
                        try {
                            const line = series.createPriceLine({
                                price: sr.level,
                                color: '#ff4757',
                                lineWidth: 2,
                                lineStyle: 2,
                                axisLabelVisible: true,
                                title: `저항선 ${Math.round(sr.level).toLocaleString()}`,
                            });
                            chartSeries.resistanceLines.push(line);
                        } catch (e) {
                            console.warn("저항선 그리기 실패:", e);
                        }
                    });
                }
            }
            
            // 목표가 선 그리기
            if (analysis.trading_signal && analysis.trading_signal.target_price) {
                try {
                    const line = series.createPriceLine({
                        price: analysis.trading_signal.target_price,
                        color: '#4ac9ff',
                        lineWidth: 2,
                        lineStyle: 0, // solid
                        axisLabelVisible: true,
                        title: `목표가 ${Math.round(analysis.trading_signal.target_price).toLocaleString()}`,
                    });
                    chartSeries.targetLines.push(line);
                } catch (e) {
                    console.warn("목표가 선 그리기 실패:", e);
                }
            }
            
            // 손절가 선 그리기
            if (analysis.trading_signal && analysis.trading_signal.stop_loss) {
                try {
                    const line = series.createPriceLine({
                        price: analysis.trading_signal.stop_loss,
                        color: '#ff6b6b',
                        lineWidth: 2,
                        lineStyle: 0, // solid
                        axisLabelVisible: true,
                        title: `손절가 ${Math.round(analysis.trading_signal.stop_loss).toLocaleString()}`,
                    });
                    chartSeries.stopLossLines.push(line);
                } catch (e) {
                    console.warn("손절가 선 그리기 실패:", e);
                }
            }
            
        } catch (error) {
            console.error("차트 선 그리기 오류:", error);
        }
    };

    // 차트 렌더링 (TradingView Lightweight Charts 사용)
    const renderChart = (data) => {
        if (!dashboardChart) {
            console.error("차트 컨테이너를 찾을 수 없습니다.");
            return;
        }

        // 데이터 유효성 검사
        if (!data || !data.data || !data.data.timestamps || data.data.timestamps.length === 0) {
            console.error("차트 데이터가 없습니다:", data);
            dashboardChart.innerHTML = "<p style='padding: 2rem; text-align: center; color: var(--text-muted);'>차트 데이터를 불러올 수 없습니다.</p>";
            currentCandlestickData = null;
            updateCrosshairLabelToLatest();
            return;
        }

        // Lightweight Charts 라이브러리 확인
        if (typeof LightweightCharts === 'undefined') {
            console.error("Lightweight Charts 라이브러리가 로드되지 않았습니다.");
            dashboardChart.innerHTML = "<p style='padding: 2rem; text-align: center; color: var(--text-muted);'>차트 라이브러리를 불러올 수 없습니다.</p>";
            currentCandlestickData = null;
            updateCrosshairLabelToLatest();
            return;
        }

        // 기존 차트 인스턴스 제거
        if (chartInstance) {
            try {
                // Visible range 구독 제거
                if (visibleRangeSubscription) {
                    try {
                        chartInstance.timeScale().unsubscribeVisibleTimeRangeChange(visibleRangeSubscription);
                    } catch (e) {
                        console.warn("구독 제거 실패:", e);
                    }
                    visibleRangeSubscription = null;
                }
                if (crosshairMoveHandler) {
                    try {
                        chartInstance.unsubscribeCrosshairMove(crosshairMoveHandler);
                    } catch (e) {
                        console.warn("크로스헤어 구독 제거 실패:", e);
                    }
                    crosshairMoveHandler = null;
                }
                chartInstance.remove();
            } catch (e) {
                console.warn("기존 차트 제거 실패:", e);
            }
        }

        // 컨테이너 크기 확인
        const width = dashboardChart.clientWidth || 800;
        const height = dashboardChart.clientHeight || 400;

        if (width === 0 || height === 0) {
            console.warn("차트 컨테이너 크기가 0입니다. 기본값을 사용합니다.");
        }

        try {
            // Lightweight Charts 생성
            chartInstance = LightweightCharts.createChart(dashboardChart, {
                width: width,
                height: height,
                layout: {
                    background: { type: 'solid', color: 'transparent' },
                    textColor: getComputedStyle(document.documentElement).getPropertyValue('--text') || '#1a1a1a',
                },
                grid: {
                    vertLines: { color: 'rgba(0, 0, 0, 0.1)' },
                    horzLines: { color: 'rgba(0, 0, 0, 0.1)' },
                },
                timeScale: {
                    timeVisible: true,
                    secondsVisible: false,
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                },
                rightPriceScale: {
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    entireTextOnly: true,
                },
                localization: {
                    priceFormatter: price => Math.round(price).toLocaleString(),
                },
            });

            // 캔들스틱 데이터 준비 (OHLC 데이터가 있는 경우)
            const hasOHLC = data.data.opens && data.data.highs && data.data.lows && data.data.closes &&
                data.data.opens.length > 0 && data.data.highs.length > 0 &&
                data.data.lows.length > 0 && data.data.closes.length > 0;

            if (hasOHLC) {
                chartSeries.line = null;
                // 캔들스틱 차트
                const candlestickSeries = chartInstance.addCandlestickSeries({
                    upColor: '#26de81',
                    downColor: '#ff4757',
                    borderVisible: false,
                    wickUpColor: '#26de81',
                    wickDownColor: '#ff4757',
                    priceFormat: {
                        type: 'price',
                        precision: 0,
                        minMove: 1,
                    },
                });
                chartSeries.candlestick = candlestickSeries;

                const candlestickData = data.data.timestamps.map((ts, i) => {
                    const timestamp = typeof ts === 'number' ? ts : parseInt(ts);
                    return {
                        time: timestamp,
                        open: parseFloat(data.data.opens[i]),
                        high: parseFloat(data.data.highs[i]),
                        low: parseFloat(data.data.lows[i]),
                        close: parseFloat(data.data.closes[i]),
                    };
                }).filter(item => !isNaN(item.time) && !isNaN(item.open) && !isNaN(item.high) && !isNaN(item.low) && !isNaN(item.close));

                if (candlestickData.length > 0) {
                    currentCandlestickData = candlestickData; // 데이터 저장
                    candlestickSeries.setData(candlestickData);
                    
                    // 이동평균선 계산 및 그리기
                    drawMovingAverages(candlestickData);
                    
                    // Visible range 변경 감지 및 선 재조정
                    setupVisibleRangeListener();

                    // "일에는 하루하루 다 뜨게해야지" -> 11일~22일 처럼 약 12일 정도가 보이도록 설정
                    // 사용자의 구체적인 요청: "11일, 12일... 22일이 딱 보이도록"
                    const totalBars = candlestickData.length;
                    let visibleBars = 0;

                    if (currentPeriod === "day") {
                        // 일봉: 약 12개 봉 표시
                        visibleBars = 12;
                    } else if (currentPeriod === "week") {
                        // 주봉: 약 12주 (3달)
                        visibleBars = 12;
                    } else if (currentPeriod === "month") {
                        // 월봉: 약 12개월 (1년)
                        visibleBars = 12;
                    } else if (currentPeriod === "year") {
                        // 연봉: 약 10년
                        visibleBars = 10;
                    }

                    if (visibleBars > 0) {
                        chartInstance.timeScale().setVisibleLogicalRange({
                            from: totalBars - visibleBars,
                            to: totalBars
                        });
                    } else {
                        chartInstance.timeScale().fitContent();
                    }

                    updateCrosshairLabelToLatest();
                    subscribeCrosshairLabel();

                } else {
                    console.error("유효한 캔들스틱 데이터가 없습니다.");
                    currentCandlestickData = null;
                    updateCrosshairLabelToLatest();
                }
            } else if (data.data.closes && data.data.closes.length > 0) {
                // 라인 차트 (종가만 있는 경우)
                const lineSeries = chartInstance.addLineSeries({
                    color: '#4ac9ff',
                    lineWidth: 2,
                    priceFormat: {
                        type: 'price',
                        precision: 2,
                        minMove: 0.01,
                    },
                });

                const lineData = data.data.timestamps.map((ts, i) => {
                    const timestamp = typeof ts === 'number' ? ts : parseInt(ts);
                    return {
                        time: timestamp,
                        value: parseFloat(data.data.closes[i]),
                    };
                }).filter(item => !isNaN(item.time) && !isNaN(item.value));

                if (lineData.length > 0) {
                    chartSeries.line = lineSeries;
                    chartSeries.candlestick = null;
                    currentCandlestickData = lineData.map(point => ({
                        time: point.time,
                        close: point.value
                    }));
                    lineSeries.setData(lineData);
                    chartInstance.timeScale().fitContent();
                    updateCrosshairLabelToLatest();
                    subscribeCrosshairLabel();
                } else {
                    console.error("유효한 라인 데이터가 없습니다.");
                    currentCandlestickData = null;
                    updateCrosshairLabelToLatest();
                }
            } else {
                console.error("차트 데이터 형식이 올바르지 않습니다.");
                currentCandlestickData = null;
                updateCrosshairLabelToLatest();
            }

            // 차트 크기 조정
            const resizeObserver = new ResizeObserver(entries => {
                if (entries.length === 0 || entries[0].target !== dashboardChart || !chartInstance) return;
                const { width, height } = entries[0].contentRect;
                if (width > 0 && height > 0) {
                    chartInstance.applyOptions({ width, height });
                }
            });

            resizeObserver.observe(dashboardChart);
        } catch (error) {
            console.error("차트 렌더링 오류:", error);
            dashboardChart.innerHTML = `<p style='padding: 2rem; text-align: center; color: var(--text-muted);'>차트를 표시할 수 없습니다: ${error.message}</p>`;
        }
    };

    // 가격 정보 업데이트
    const updatePriceInfo = async (chartData) => {
        try {
            const quoteResponse = await fetch(`${API_BASE}/api/market/quote?symbol=${currentSymbol}`);
            if (!quoteResponse.ok) return;

            const quote = await quoteResponse.json();

            const currentPriceEl = document.getElementById("current-price");
            const priceChangeEl = document.getElementById("price-change");
            const pricePercentEl = document.getElementById("price-percent");
            const chartHighEl = document.getElementById("chart-high");
            const chartLowEl = document.getElementById("chart-low");
            const chartOpenEl = document.getElementById("chart-open");

            if (currentPriceEl) currentPriceEl.textContent = quote.current.toLocaleString();
            if (priceChangeEl) {
                priceChangeEl.textContent = `${quote.change >= 0 ? "+" : ""}${quote.change.toLocaleString()}`;
                priceChangeEl.className = `price-change ${quote.change >= 0 ? "positive" : "negative"}`;
            }
            if (pricePercentEl) {
                pricePercentEl.textContent = `(${quote.change >= 0 ? "+" : ""}${Math.round(quote.percent)}%)`;
            }
            if (chartHighEl && quote.high) chartHighEl.textContent = quote.high.toLocaleString();
            if (chartLowEl && quote.low) chartLowEl.textContent = quote.low.toLocaleString();
            if (chartOpenEl && quote.open) chartOpenEl.textContent = quote.open.toLocaleString();
        } catch (error) {
            console.error("가격 정보 업데이트 오류:", error);
        }
    };

    // 호가 데이터 로드
    const loadOrderbook = async () => {
        console.log("loadOrderbook 호출됨, currentSymbol:", currentSymbol);
        if (!currentSymbol) {
            console.warn("loadOrderbook: currentSymbol이 없습니다.");
            return;
        }

        const sellList = document.getElementById("orderbook-sell-list");
        const buyList = document.getElementById("orderbook-buy-list");

        try {
            console.log(`호가 데이터 요청: symbol=${currentSymbol}`);
            const response = await fetch(`${API_BASE}/api/market/orderbook?symbol=${currentSymbol}`);
            if (!response.ok) throw new Error("호가 데이터 로드 실패");

            const data = await response.json();

            if (sellList) {
                // Asks (Sell) - Display in reverse order (High price on top)
                // Data comes as [95300, 95200...] (Descending)
                // We want to display them as is.
                sellList.innerHTML = data.asks.map(item => `
                <div class="orderbook-item">
                    <span class="orderbook-price">${item.price.toLocaleString()}</span>
                    <span class="orderbook-volume">${item.volume.toLocaleString()}</span>
                </div>
            `).join("");
            }

            if (buyList) {
                // Bids (Buy) - Display in order (High price on top)
                // Data comes as [94800, 94700...] (Descending)
                buyList.innerHTML = data.bids.map(item => `
                <div class="orderbook-item">
                    <span class="orderbook-price">${item.price.toLocaleString()}</span>
                    <span class="orderbook-volume">${item.volume.toLocaleString()}</span>
                </div>
            `).join("");
            }

            // 스프레드 제거됨

        } catch (error) {
            console.warn("호가 데이터 로드 실패:", error);
            // 실패 시 기존 더미 데이터 유지하거나 에러 표시 (여기서는 조용히 실패)
        }
    };

    // 종목 선택 (loadChartData와 loadOrderbook 정의 이후에 배치)
    // 종목별 뉴스 로드
    const loadStockNews = async (symbol) => {
        const newsList = document.getElementById("dashboard-news-list");
        if (!newsList) {
            console.warn("dashboard-news-list 요소를 찾을 수 없습니다.");
            return;
        }
        
        if (!symbol) {
            console.warn("종목 심볼이 없어 뉴스를 로드할 수 없습니다.");
            newsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">종목을 선택해주세요.</p>';
            return;
        }
        
        try {
            newsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">뉴스 로딩 중...</p>';
            
            console.log(`종목별 뉴스 로드 시작: ${symbol}`);
            const response = await fetch(`${API_BASE}/api/news/symbol/${symbol}`);
            if (!response.ok) {
                throw new Error(`뉴스 로드 실패: ${response.status}`);
            }
            
            const articles = await response.json();
            console.log(`종목별 뉴스 로드 완료: ${articles.length}개`);
            
            if (articles.length === 0) {
                newsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">관련 뉴스가 없습니다.</p>';
                return;
            }
            
            // 최대 10개까지 표시 (더 많은 뉴스 제공)
            const displayArticles = articles.slice(0, 10);
            
            newsList.innerHTML = displayArticles.map(article => {
                const headline = article.headline_ko || article.headline || "제목 없음";
                const summary = article.summary_ko || article.summary || "";
                const url = article.url || "#";
                const source = article.source || "출처 없음";
                const publishedAt = article.published_at ? new Date(article.published_at).toLocaleDateString("ko-KR") : "";
                
                return `
                    <div class="dashboard-news-item">
                        <a href="${url}" target="_blank" rel="noopener noreferrer">
                            <h4>${headline}</h4>
                            ${summary ? `<p>${summary}</p>` : ''}
                            <div class="news-meta">
                                <span>${source}</span>
                                ${publishedAt ? `<span>•</span><span>${publishedAt}</span>` : ''}
                            </div>
                        </a>
                    </div>
                `;
            }).join("");
            
        } catch (error) {
            console.error("뉴스 로드 오류:", error);
            newsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">뉴스를 불러오는 중 오류가 발생했습니다.</p>';
        }
    };
    
    window.selectSymbol = async (symbol, name) => {
        if (!symbol) {
            console.error("심볼이 없습니다:", { symbol, name });
            alert("종목을 선택할 수 없습니다. 심볼이 없습니다.");
            return;
        }

        console.log("종목 선택 시작:", { symbol, name, currentSymbol: currentSymbol });
        
        // currentSymbol을 먼저 업데이트 (loadChartData가 이를 사용함)
        currentSymbol = symbol;
        
        // 로컬 스토리지에 저장
        localStorage.setItem("lastSelectedSymbol", symbol);
        if (name) {
            localStorage.setItem("lastSelectedSymbolName", name);
        }

        // UI 업데이트
        if (dashboardSymbol) dashboardSymbol.textContent = symbol;
        if (dashboardName) dashboardName.textContent = name || symbol;

        // 검색 모달 닫기
        if (searchModalOverlay) {
            searchModalOverlay.style.display = "none";
        }
        if (modalSearchInput) {
            modalSearchInput.value = "";
        }

        updateFavoriteStatus();
        updateFavoritesHeartStatus();
        
        console.log("데이터 로드 시작...");
        
        // 가격 정보 먼저 업데이트 (빠른 피드백)
        try {
            console.log("가격 정보 업데이트 시작...");
            await updatePriceInfo(null);
            console.log("가격 정보 업데이트 완료");
        } catch (error) {
            console.error("가격 정보 업데이트 실패:", error);
        }
        
        // 차트와 호가 데이터 즉시 로드
        try {
            debugLog("차트 데이터 로드 시작...");
            await loadChartData();
            debugLog("차트 데이터 로드 완료");
        } catch (error) {
            console.error("차트 데이터 로드 실패:", error);
        }
        
        try {
            console.log("호가 데이터 로드 시작...");
            await loadOrderbook();
            console.log("호가 데이터 로드 완료");
        } catch (error) {
            console.error("호가 데이터 로드 실패:", error);
        }
        
        
        console.log("종목 선택 완료:", { symbol, name });
    };

    // 즐겨찾기 목록 업데이트
    const updateFavoriteList = () => {
        // 대시보드 즐겨찾기 리스트 (새로 추가된 컴포넌트)
        const dashboardFavoritesList = document.getElementById("favorites-list");
        // 모달 즐겨찾기 리스트
        const modalFavoriteList = document.getElementById("favorite-stocks-list");
        
        // 대시보드 즐겨찾기 리스트 업데이트
        if (dashboardFavoritesList) {
            if (favorites.length === 0) {
                dashboardFavoritesList.innerHTML = '<p class="empty-message">즐겨찾기한 종목이 없습니다.</p>';
            } else {
                dashboardFavoritesList.innerHTML = favorites.map(fav => {
                    const symbol = fav.symbol;
                    const name = fav.name || symbol;
                    return `
                        <div class="favorite-stock-item" onclick="selectSymbol('${symbol}', '${name}')">
                            <div class="stock-info">
                                <span class="stock-name">${name}</span>
                                <span class="stock-symbol">${symbol}</span>
                            </div>
                        </div>
                    `;
                }).join("");
            }
        }
        
        // 모달 즐겨찾기 리스트 업데이트
        if (modalFavoriteList) {
            if (favorites.length === 0) {
                modalFavoriteList.innerHTML = '<p class="empty-message">즐겨찾기한 종목이 없습니다.</p>';
            } else {
                modalFavoriteList.innerHTML = favorites.map(fav => {
                    const symbol = fav.symbol;
                    const name = fav.name || symbol;
                    return `
                        <div class="favorite-stock-item">
                            <div class="stock-info" onclick="selectSymbol('${symbol}', '${name}')" style="cursor: pointer;">
                                <span class="stock-name">${name}</span>
                                <span class="stock-symbol">${symbol}</span>
                            </div>
                            <button class="remove-btn" onclick="removeFavorite('${symbol}')">삭제</button>
                        </div>
                    `;
                }).join("");
            }
        }
    };

    window.removeFavorite = async (symbol) => {
        const index = favorites.findIndex(f => f.symbol === symbol);
        if (index > -1) {
            try {
                // 백엔드에서 제거
                const response = await fetch(`${AUTH_API_BASE}/api/favorites/${symbol}`, {
                    method: "DELETE",
                    credentials: "include",
                });
                if (response.ok) {
                    favorites.splice(index, 1);
                    localStorage.setItem("dashboardFavorites", JSON.stringify(favorites.map(f => f.symbol)));
                    updateFavoriteStatus();
                    updateFavoriteList();
                } else {
                    throw new Error("즐겨찾기 제거 실패");
                }
            } catch (error) {
                console.error("즐겨찾기 제거 오류:", error);
                // 백엔드 실패 시 로컬에서만 제거
                favorites.splice(index, 1);
                localStorage.setItem("dashboardFavorites", JSON.stringify(favorites.map(f => f.symbol)));
                updateFavoriteStatus();
                updateFavoriteList();
            }
        }
    };
    
    // 즐겨찾기 하트 버튼 클릭 이벤트
    if (favoritesHeartBtn) {
        favoritesHeartBtn.addEventListener("click", async () => {
            if (!currentSymbol) {
                alert("먼저 종목을 선택해주세요.");
                return;
            }

            const index = favorites.findIndex(f => f.symbol === currentSymbol);
            let isFavorite = index > -1;
            
            try {
                // 백엔드 API 호출
                if (isFavorite) {
                    // 즐겨찾기 제거
                    const response = await fetch(`${AUTH_API_BASE}/api/favorites/${currentSymbol}`, {
                        method: "DELETE",
                        credentials: "include",
                    });
                    if (response.ok) {
                        favorites.splice(index, 1);
                    } else {
                        throw new Error("즐겨찾기 제거 실패");
                    }
                } else {
                    // 즐겨찾기 추가
                    const name = dashboardName ? dashboardName.textContent : currentSymbolName || currentSymbol;
                    const response = await fetch(`${AUTH_API_BASE}/api/favorites`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ symbol: currentSymbol, name: name }),
                    });
                    if (response.ok) {
                        const data = await response.json();
                        favorites.push({ symbol: data.symbol, name: data.name });
                    } else {
                        throw new Error("즐겨찾기 추가 실패");
                    }
                }
                
                localStorage.setItem("dashboardFavorites", JSON.stringify(favorites.map(f => f.symbol)));
                updateFavoriteStatus();
                updateFavoritesHeartStatus();
                updateFavoriteList();
            } catch (error) {
                console.error("즐겨찾기 토글 오류:", error);
                // 백엔드 실패 시 로컬 스토리지에만 저장 (기존 동작 유지)
                if (isFavorite) {
                    favorites.splice(index, 1);
                } else {
                    const name = dashboardName ? dashboardName.textContent : currentSymbolName || currentSymbol;
                    favorites.push({ symbol: currentSymbol, name: name });
                }
                localStorage.setItem("dashboardFavorites", JSON.stringify(favorites.map(f => f.symbol)));
                updateFavoriteStatus();
                updateFavoritesHeartStatus();
                updateFavoriteList();
            }
        });
    }
    
    initDrawingMode();
    
    // 초기화: 백엔드에서 즐겨찾기 목록 로드
    loadFavoritesFromBackend();

    // 초기 차트 로드 (저장된 종목이 있는 경우)
    if (currentSymbol) {
        loadChartData();
        loadOrderbook();
        updateFavoriteStatus();
    }
};

