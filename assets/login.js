const loginState = {
    mode: "login"
};

const loginSwitchMode = (mode) => {
    loginState.mode = mode;
    if (typeof authState !== "undefined") {
        authState.mode = mode;
    }

    document.querySelectorAll(".auth-tab").forEach((tab) => {
        const isActive = tab.dataset.mode === mode;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    const displayField = document.getElementById("auth-displayname-field");
    const submit = document.getElementById("auth-submit");
    if (displayField) {
        displayField.hidden = mode !== "register";
    }
    if (submit) {
        submit.textContent = mode === "register" ? "회원가입" : "로그인";
    }

    if (typeof setAuthMessage === "function") {
        setAuthMessage("");
    }
};

const collectLoginPayload = (form) => {
    const email = form.email.value.trim();
    const password = form.password.value;
    const displayName = form.displayName?.value.trim();

    if (!email || !password) {
        throw new Error("이메일과 비밀번호를 입력해주세요.");
    }

    const payload = { email, password };
    if (loginState.mode === "register") {
        if (!displayName) {
            throw new Error("닉네임을 입력해주세요.");
        }
        payload.displayName = displayName;
    }
    return payload;
};

const handleLoginSubmit = async (event) => {
    event.preventDefault();
    const form = event.target;

    let payload;
    try {
        payload = collectLoginPayload(form);
    } catch (error) {
        setAuthMessage(error.message, "error");
        return;
    }

    setAuthMessage("처리 중입니다...");

    try {
        const user =
            loginState.mode === "register" ? await registerUser(payload) : await loginUser(payload);
        setAuthUser(user);
        setAuthMessage(
            loginState.mode === "register" ? "회원가입이 완료되었습니다." : "로그인 성공!",
            "success",
        );
        setTimeout(() => {
            window.location.href = "index.html";
        }, 500);
    } catch (error) {
        setAuthMessage(error.message ?? "요청에 실패했습니다.", "error");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    loginSwitchMode(loginState.mode);

    const tabs = document.querySelectorAll(".auth-tab");
    tabs.forEach((tab) =>
        tab.addEventListener("click", () => {
            loginSwitchMode(tab.dataset.mode);
        }),
    );

    const form = document.getElementById("auth-form");
    form?.addEventListener("submit", handleLoginSubmit);
});

