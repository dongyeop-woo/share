const collectLoginPayload = (form) => {
    const username = form.username.value.trim();
    const password = form.password.value;

    if (!username || !password) {
        throw new Error("아이디와 비밀번호를 입력해주세요.");
    }

    if (username.length < 3 || username.length > 20) {
        throw new Error("아이디는 3자 이상 20자 이하여야 합니다.");
    }

    if (password.length < 8 || password.length > 64) {
        throw new Error("비밀번호는 8자 이상 64자 이하여야 합니다.");
    }

    return { username, password };
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
        const user = await loginUser(payload);
        setAuthUser(user);
        setAuthMessage("로그인 성공!", "success");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 500);
    } catch (error) {
        setAuthMessage(error.message ?? "로그인에 실패했습니다.", "error");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("auth-form");
    form?.addEventListener("submit", handleLoginSubmit);
});

