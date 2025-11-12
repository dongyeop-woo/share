const MARKET_DEFAULT_SYMBOL = "SPY";
let chartInstance = null;
let currentSymbol = null;

const overviewContainer = document.getElementById("market-overview-grid");
const searchForm = document.getElementById("symbol-search-form");
const searchInput = document.getElementById("symbol-search-input");
const searchResults = document.getElementById("search-results");

const detailSymbol = document.getElementById("detail-symbol");
const detailName = document.getElementById("detail-name");
const detailPrice = document.getElementById("detail-price");
const detailChange = document.getElementById("detail-change");
const detailUpdated = document.getElementById("detail-updated");
const detailHigh = document.getElementById("detail-high");
const detailLow = document.getElementById("detail-low");
const detailOpen = document.getElementById("detail-open");
const detailPrevious = document.getElementById("detail-previous");

const createCard = (item) => {
    const card = document.createElement("article");
    card.className = "market-card";
    card.dataset.symbol = item.symbol;
    card.innerHTML = `
        <header>
            <strong>${item.symbol}</strong>
            <span>${item.name ?? ""}</span>
        </header>
        <div class="market-card-price">${formatPrice(item.current)}</div>
        <div class="market-card-change ${item.change > 0 ? "change-positive" : item.change < 0 ? "change-negative" : ""}">
            ${formatSigned(item.change)} (${formatSigned(item.percent, "%")})
        </div>
    `;
    card.addEventListener("click", () => {
        loadSymbol(item.symbol, item.name);
        setActiveCard(item.symbol);
    });
    return card;
};

const setActiveCard = (symbol) => {
    document.querySelectorAll(".market-card.active").forEach((card) => card.classList.remove("active"));
    const target = overviewContainer?.querySelector(`[data-symbol="${symbol}"]`);
    if (target) {
        target.classList.add("active");
    }
};

const formatPrice = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
    return Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatSigned = (value, suffix = "") => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
    const num = Number(value);
    const sign = num > 0 ? "+" : num < 0 ? "" : "";
    return `${sign}${num.toFixed(2)}${suffix}`;
};

const renderOverview = (items) => {
    if (!overviewContainer) return;
    overviewContainer.innerHTML = "";
    items.forEach((item) => {
        overviewContainer.appendChild(createCard(item));
    });
};

const fetchQuote = async (symbol) => {
    const response = await fetch(`${API_BASE}/api/market/quote?symbol=${encodeURIComponent(symbol)}`);
    let data = null;
    try {
        data = await response.json();
    } catch (error) {
        // ignore parse error
    }
    if (!response.ok) {
        const message = data?.detail ?? "시세 조회 실패";
        const err = new Error(message);
        err.status = response.status;
        throw err;
    }
    return data;
};

const fetchCandles = async (symbol, options = {}) => {
    const params = new URLSearchParams({
        symbol,
        resolution: options.resolution ?? "D",
        range_days: options.rangeDays ?? 60,
    });
    const response = await fetch(`${API_BASE}/api/market/candles?${params.toString()}`);
    let data = null;
    try {
        data = await response.json();
    } catch (error) {
        // ignore parse error
    }
    if (!response.ok) {
        const message = data?.detail ?? "차트 데이터 조회 실패";
        const err = new Error(message);
        err.status = response.status;
        throw err;
    }
    return data;
};

const renderQuote = (quote) => {
    if (!quote) return;
    currentSymbol = quote.symbol;
    detailSymbol.textContent = quote.symbol;
    detailName.textContent = quote.name ?? "";
    detailPrice.textContent = formatPrice(quote.current);

    detailChange.classList.remove("change-positive", "change-negative");
    if (quote.change > 0) {
        detailChange.classList.add("change-positive");
    } else if (quote.change < 0) {
        detailChange.classList.add("change-negative");
    }
    detailChange.textContent = `${formatSigned(quote.change)} (${formatSigned(quote.percent, "%")})`;

    const updated = new Date(quote.timestamp);
    detailUpdated.textContent = `업데이트: ${updated.toLocaleString("ko-KR", { hour12: false })} (최대 5분 지연)`;

    detailHigh.textContent = formatPrice(quote.high);
    detailLow.textContent = formatPrice(quote.low);
    detailOpen.textContent = formatPrice(quote.open);
        detailPrevious.textContent = formatPrice(quote.previous_close ?? quote.previousClose);
};

const renderChart = (symbol, candles) => {
    const ctx = document.getElementById("market-chart");
    if (!ctx) return;

    const labels = candles.data.timestamps.map((ts) =>
        new Date(ts * 1000).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }),
    );

    const dataset = candles.data.closes;

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: `${symbol} 종가`,
                    data: dataset,
                    fill: false,
                    borderColor: "#4ac9ff",
                    borderWidth: 2,
                    tension: 0.2,
                    pointRadius: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 8,
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.05)",
                    },
                },
                y: {
                    ticks: {
                        callback: (value) => Number(value).toFixed(2),
                    },
                    grid: {
                        color: "rgba(255, 255, 255, 0.05)",
                    },
                },
            },
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    mode: "index",
                    intersect: false,
                },
            },
        },
    });
};

const loadSymbol = async (symbol, name) => {
    try {
        detailSymbol.textContent = `${symbol.toUpperCase()}`;
        detailName.textContent = name ?? "";
        detailPrice.textContent = "로딩 중...";
        detailChange.textContent = "";
        detailUpdated.textContent = "";
        detailChange.classList.remove("change-positive", "change-negative");

        const [quote, candles] = await Promise.all([fetchQuote(symbol), fetchCandles(symbol)]);
        renderQuote(quote);
        renderChart(symbol, candles);
    } catch (error) {
        console.error(error);
        detailPrice.textContent =
            error.status === 404 ? "해당 종목의 데이터를 찾을 수 없습니다." : "데이터를 불러오지 못했습니다.";
        detailChange.textContent = error.message ?? "";
        detailUpdated.textContent = "";
        detailHigh.textContent = "-";
        detailLow.textContent = "-";
        detailOpen.textContent = "-";
        detailPrevious.textContent = "-";
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
    }
};

const renderSearchResults = (items) => {
    if (!searchResults) return;
    searchResults.innerHTML = "";
    if (!items.length) {
        searchResults.innerHTML = `<p class="search-empty">검색 결과가 없습니다.</p>`;
        return;
    }

    const list = document.createElement("ul");
    items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "search-result-item";
        li.innerHTML = `
            <strong>${item.symbol}</strong>
            <span>${item.description}</span>
            <span class="search-meta">${item.exchange ?? ""}</span>
        `;
        li.addEventListener("click", () => {
            searchResults.innerHTML = "";
            loadSymbol(item.symbol, item.description);
            setActiveCard(item.symbol);
        });
        list.appendChild(li);
    });

    searchResults.appendChild(list);
};

const handleSearch = async (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (!query) {
        searchResults.innerHTML = "";
        return;
    }

    searchResults.innerHTML = `<p class="search-loading">검색 중...</p>`;

    try {
        const response = await fetch(`${API_BASE}/api/market/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("검색 API 실패");
        const data = await response.json();
        renderSearchResults(data);
    } catch (error) {
        console.error(error);
        searchResults.innerHTML = `<p class="search-error">검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>`;
    }
};

const initMarketPage = async () => {
    if (searchForm) {
        searchForm.addEventListener("submit", handleSearch);
    }

    const overview = await fetchMarketOverview();
    if (overview.length) {
        renderOverview(overview);
        setActiveCard(overview[0].symbol);
        await loadSymbol(overview[0].symbol, overview[0].name);
    } else {
        detailPrice.textContent = "시장 데이터를 불러오지 못했습니다.";
    }
};

document.addEventListener("DOMContentLoaded", () => {
    if (overviewContainer) {
        initMarketPage();
    }
});

