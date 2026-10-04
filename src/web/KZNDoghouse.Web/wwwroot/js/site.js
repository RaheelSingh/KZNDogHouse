document.addEventListener("DOMContentLoaded", async () => {
    const badge =
        document.getElementById("portalNotificationBadge");

    if (!badge) {
        return;
    }

    const url =
        badge.dataset.unreadUrl;

    if (!url) {
        return;
    }

    try {
        const response = await fetch(url, {
            method: "GET",
            credentials: "same-origin",
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            }
        });

        if (!response.ok) {
            return;
        }

        const result = await response.json();
        const count = Number(result.count ?? 0);

        if (count <= 0) {
            badge.hidden = true;
            return;
        }

        badge.textContent =
            count > 99
                ? "99+"
                : count.toString();

        badge.hidden = false;
    }
    catch {
        badge.hidden = true;
    }
});
