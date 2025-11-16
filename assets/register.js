const collectRegisterPayload = (form) => {
    const username = form.username.value.trim();
    const password = form.password.value;
    const displayName = form.displayName?.value.trim();

    if (!username || !password || !displayName) {
        throw new Error("모든 필드를 입력해주세요.");
    }

    if (username.length < 3 || username.length > 20) {
        throw new Error("아이디는 3자 이상 20자 이하여야 합니다.");
    }

    if (password.length < 8 || password.length > 64) {
        throw new Error("비밀번호는 8자 이상 64자 이하여야 합니다.");
    }

    if (displayName.length < 1 || displayName.length > 40) {
        throw new Error("닉네임은 1자 이상 40자 이하여야 합니다.");
    }

    return { username, password, displayName };
};

const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    const form = event.target;

    let payload;
    try {
        payload = collectRegisterPayload(form);
    } catch (error) {
        setAuthMessage(error.message, "error");
        return;
    }

    setAuthMessage("처리 중입니다...");

    try {
        const user = await registerUser(payload);
        setAuthUser(user);
        setAuthMessage("회원가입이 완료되었습니다.", "success");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 500);
    } catch (error) {
        setAuthMessage(error.message ?? "회원가입에 실패했습니다.", "error");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("register-form");
    form?.addEventListener("submit", handleRegisterSubmit);
});

