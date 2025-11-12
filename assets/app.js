const API_BASE = "http://localhost:8000";
const AUTH_API_BASE = "http://localhost:8080";

const AUTH_STORAGE_KEY = "breakingShareUser";

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

const fallbackNewsFeed = [
    {
        title: "연준 위원 완화적 발언, 기술주 랠리 촉발",
        summary: "연준 위원들이 인플레이션 완화 신호를 강조하며 빅테크 주가가 일제히 상승했습니다. 시장은 2026년 초 금리 인하 가능성을 선반영하고 있습니다.",
        sentiment: "positive",
        time: "1시간 전"
    },
    {
        title: "반도체 공급망 긴장, 일부 업체 생산 차질 우려",
        summary: "대만 지진 이후 주요 파운드리의 가동률이 일시적으로 낮아지면서 서버 및 AI 반도체 공급에 변동성이 생길 수 있다는 분석이 제기됩니다.",
        sentiment: "caution",
        time: "3시간 전"
    },
    {
        title: "원/달러 환율, 위험선호 심리 회복으로 하락",
        summary: "달러 강세가 완화되며 신흥국 통화가 일제히 반등했습니다. 환율 안정으로 수입 물가 부담이 다소 줄어들 전망입니다.",
        sentiment: "neutral",
        time: "5시간 전"
    },
    {
        title: "친환경 인프라 법안, 상원 통과 임박",
        summary: "미국 상원이 4,500억 달러 규모의 친환경 인프라 법안을 표결에 부칠 예정입니다. 관련 ETF와 원자재 가격이 선제적으로 반응했습니다.",
        sentiment: "positive",
        time: "8시간 전"
    }
];

const fallbackMarketOverview = [
    { symbol: "KOSPI", price: "2,650.45", change: "+18.72", changeRate: "+0.71%" },
    { symbol: "KOSDAQ", price: "860.12", change: "-3.48", changeRate: "-0.40%" },
    { symbol: "NASDAQ", price: "16,502.33", change: "+142.18", changeRate: "+0.87%" },
    { symbol: "S&P 500", price: "5,210.44", change: "+32.05", changeRate: "+0.62%" },
    { symbol: "XLK (IT)", price: "212.54", change: "+2.84", changeRate: "+1.36%" },
    { symbol: "XLE (에너지)", price: "91.22", change: "-0.95", changeRate: "-1.03%" }
];

const fallbackToolkits = [
    {
        name: "프리마켓 체커",
        description: "개장 전 선물, 통화, 채권의 변화량을 한눈에 확인하고 장 초반 전략을 세워보세요.",
        tags: ["선물", "퀀트 시그널"],
        link: "#"
    },
    {
        name: "알파 스캐너",
        description: "이익 모멘텀, 기관 수급, 가격 모멘텀을 조합한 종합 점수로 종목을 필터링합니다.",
        tags: ["스코어링", "백테스트"],
        link: "#"
    },
    {
        name: "리스크 다이어리",
        description: "변동성 지표와 스프레드를 추적해 포트폴리오 리스크를 사전에 감지하세요.",
        tags: ["파생상품", "변동성"],
        link: "#"
    },
    {
        name: "이벤트 캘린더",
        description: "실적 발표, 중앙은행 회의, 경제지표 등 주요 이벤트를 놓치지 않도록 정리합니다.",
        tags: ["매크로", "캘린더"],
        link: "#"
    }
];

const fallbackPolicyItems = [
    "모든 정보는 교육 목적으로 제공되며 투자 판단의 최종 책임은 본인에게 있습니다.",
    "허위 정보, 타인 비방, 불법 리딩 등은 즉시 제재됩니다.",
    "시장 변동성 확대 시 손절 기준과 포지션 사이징을 명확히 설정하세요.",
    "데이터 및 툴 이용 시 외부 유출 금지 원칙을 지켜주세요.",
    "24시간 고객센터를 통해 문의를 접수하면 12시간 이내 답변해드립니다."
];

const fallbackRecommendations = [
    {
        ticker: "NVDA",
        name: "엔비디아",
        thesis: "AI 가속기 수요와 데이터센터 투자 확대로 2026년까지 매출 성장 가속 예상.",
        target: "$132",
        timeline: "6-12개월",
        conviction: "High"
    },
    {
        ticker: "TSLA",
        name: "테슬라",
        thesis: "에너지 저장장치 부문의 수익비중 확대와 자율주행 구독화가 밸류에이션을 지지.",
        target: "$286",
        timeline: "12-18개월",
        conviction: "Medium"
    },
    {
        ticker: "AAPL",
        name: "애플",
        thesis: "생태계 기반 구독 서비스 매출 성장과 MR 헤드셋 출시가 EPS 상승을 견인.",
        target: "$225",
        timeline: "6-12개월",
        conviction: "Medium"
    },
    {
        ticker: "SOXL",
        name: "Direxion Daily Semiconductor Bull 3X",
        thesis: "단기 레버리지 상품, 가격 변동성이 매우 높으므로 엄격한 위험관리가 필요.",
        target: "$65",
        timeline: "1-3개월",
        conviction: "Speculative"
    }
];

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
        }));
    } catch (error) {
        console.warn("실시간 뉴스 로드 실패, 기본 데이터를 사용합니다.", error);
        return fallbackNewsFeed;
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

const updateAuthUI = () => {
    const toggle = document.getElementById("auth-toggle");
    const status = document.getElementById("auth-status");
    const displayName = document.getElementById("auth-display-name");
    const logout = document.getElementById("auth-logout");

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
    }
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
        if (!response.ok) throw new Error("시장 개요 API 실패");
        const data = await response.json();
        return data.map((item) => ({
            symbol: item.symbol,
            name: item.name ?? "",
            current: parseNumberValue(item.current),
            change: parseNumberValue(item.change),
            percent: parseNumberValue(item.percent),
        }));
    } catch (error) {
        console.warn("실시간 시장 데이터 로드 실패, 기본 데이터를 사용합니다.", error);
        return fallbackMarketOverview.map((item) => ({
            symbol: item.symbol,
            name: item.name ?? "",
            current: parseNumberValue(item.price),
            change: parseNumberValue(item.change),
            percent: parseNumberValue(item.changeRate),
        }));
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

    items.forEach((item) => {
        const badge = sentimentBadge(item.sentiment);
        const article = document.createElement("article");
        article.className = "card";
        article.innerHTML = `
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
    if (!tbody) return;
    tbody.innerHTML = "";

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

const populateTools = (items) => {
    const container = document.getElementById("tools-list");
    if (!container) return;
    container.innerHTML = "";

    items.forEach((tool) => {
        const card = document.createElement("article");
        card.className = "card";
        card.innerHTML = `
            <div>
                <h3>${tool.name}</h3>
                <p>${tool.description}</p>
            </div>
            <div class="tool-actions">
                ${tool.tags.map((tag) => `<span class="badge">#${tag}</span>`).join("")}
                <a href="${tool.link}" aria-label="${tool.name} 자세히 보기">바로가기 →</a>
            </div>
        `;
        container.appendChild(card);
    });
};

const populatePolicies = (items) => {
    const list = document.getElementById("policy-list");
    if (!list) return;
    list.innerHTML = "";

    items.forEach((policy) => {
        const item = document.createElement("li");
        item.textContent = policy;
        list.appendChild(item);
    });
};

const populateRecommendations = (items) => {
    const container = document.getElementById("recommendations-list");
    if (!container) return;
    container.innerHTML = "";

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

const fetchAIRecommendations = async () => {
    try {
        const tickers = fallbackRecommendations.map((item) => item.ticker);
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
        console.warn("AI 추천 로드 실패, 기본 데이터를 사용합니다.", error);
        return fallbackRecommendations;
    }
};

const bootstrap = async () => {
    await initAuth();

    const hasMarketTable = document.getElementById("market-table");
    const hasNewsGrid = document.getElementById("news-list");
    const hasToolsGrid = document.getElementById("tools-list");
    const hasPolicyList = document.getElementById("policy-list");
    const hasRecommendations = document.getElementById("recommendations-list");
    const highlight = document.getElementById("highlight-summary");

    let newsItems = [];

    if (hasMarketTable) {
        const marketItems = await fetchMarketOverview();
        populateMarket(marketItems);
    }

    if (hasNewsGrid || highlight) {
        newsItems = await fetchLiveNews();
    }

    if (hasNewsGrid) {
        populateNews(newsItems);
    }

    if (hasToolsGrid) {
        populateTools(fallbackToolkits);
    }

    if (hasPolicyList) {
        populatePolicies(fallbackPolicyItems);
    }

    if (hasRecommendations) {
        const recommendationItems = await fetchAIRecommendations();
        populateRecommendations(recommendationItems);
    }

    updateHighlightDate();

    if (highlight && newsItems.length) {
        const combined = newsItems
            .slice(0, 2)
            .map((item) => `${item.title}. ${item.summary}`)
            .join(" ");
        highlight.textContent = await summarizeWithAI(combined);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    bootstrap();
});

