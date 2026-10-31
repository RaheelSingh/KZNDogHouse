// Password reset pages: one request per click, plus a live countdown
// on the "Resend code" button. Loaded only on the three reset pages.
(() => {
    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    };

    const setupSingleSubmit = (form) => {
        const button = form.querySelector('button[type="submit"]');
        if (!button) return;

        form.addEventListener("submit", (event) => {
            // A request is already on its way: ignore any extra clicks.
            if (form.dataset.submitting === "true") {
                event.preventDefault();
                return;
            }

            // Wait one tick so jQuery validation can cancel the submit first.
            // If validation blocked it, leave the button usable.
            setTimeout(() => {
                if (event.defaultPrevented) return;
                form.dataset.submitting = "true";
                button.disabled = true;
                button.textContent = button.dataset.busyText || "Please wait…";
            }, 0);
        });
    };

    const setupCountdown = (button) => {
        const startSeconds = parseInt(button.dataset.countdownSeconds || "0", 10);
        if (!Number.isFinite(startSeconds) || startSeconds <= 0) return;

        const readyText = button.dataset.readyText || button.textContent;
        const template = button.dataset.countdownText || "Try again in {time}";
        const endAt = Date.now() + startSeconds * 1000;
        let timer = null;

        const tick = () => {
            const secondsLeft = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));

            if (secondsLeft <= 0) {
                button.disabled = false;
                button.textContent = readyText;
                if (timer) clearInterval(timer);
                return;
            }

            button.disabled = true;
            button.textContent = template.replace("{time}", formatTime(secondsLeft));
        };

        tick();
        timer = setInterval(tick, 1000);
    };

    const init = () => {
        document.querySelectorAll("form[data-single-submit]").forEach(setupSingleSubmit);
        document.querySelectorAll("[data-countdown-seconds]").forEach(setupCountdown);
    };

    // If the browser restores this page from its back/forward cache,
    // reload it so buttons and countdowns match the server again.
    window.addEventListener("pageshow", (event) => {
        if (event.persisted) window.location.reload();
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();