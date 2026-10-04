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


document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-portal-filter]").forEach((toolbar) => {
        const targetId = toolbar.dataset.portalFilter;
        const target = document.getElementById(targetId);

        if (!target) {
            return;
        }

        const rows = Array.from(
            target.querySelectorAll("[data-portal-row]"));

        const searchInput =
            toolbar.querySelector("[data-portal-search]");

        const filterInputs = Array.from(
            toolbar.querySelectorAll("[data-portal-filter-field]"));

        const sortInput =
            toolbar.querySelector("[data-portal-sort]");

        const emptyTargetId =
            toolbar.dataset.portalEmpty;

        const emptyTarget = emptyTargetId
            ? document.getElementById(emptyTargetId)
            : null;

        const applyFilters = () => {
            const query =
                (searchInput?.value ?? "")
                    .trim()
                    .toLowerCase();

            rows.forEach((row) => {
                const searchable =
                    (row.dataset.search ?? "")
                        .toLowerCase();

                let matches =
                    !query || searchable.includes(query);

                filterInputs.forEach((input) => {
                    if (!matches || !input.value) {
                        return;
                    }

                    const field =
                        input.dataset.portalFilterField;

                    const rowValue =
                        field
                            ? row.dataset[field] ?? ""
                            : "";

                    if (rowValue !== input.value) {
                        matches = false;
                    }
                });

                row.hidden = !matches;
            });

            const visibleRows =
                rows.filter((row) => !row.hidden);

            const sortValue =
                sortInput?.value ?? "name-asc";

            visibleRows.sort((a, b) => {
                const aPinned =
                    a.dataset.pinned === "true";

                const bPinned =
                    b.dataset.pinned === "true";

                if (aPinned !== bPinned) {
                    return aPinned ? -1 : 1;
                }

                const aName =
                    a.dataset.sortName ?? "";

                const bName =
                    b.dataset.sortName ?? "";

                const comparison =
                    aName.localeCompare(
                        bName,
                        undefined,
                        { sensitivity: "base" });

                return sortValue === "name-desc"
                    ? -comparison
                    : comparison;
            });

            visibleRows.forEach((row) => {
                target.appendChild(row);
            });

            if (emptyTarget) {
                emptyTarget.hidden =
                    visibleRows.length > 0;
            }
        };

        searchInput?.addEventListener(
            "input",
            applyFilters);

        filterInputs.forEach((input) => {
            input.addEventListener(
                "change",
                applyFilters);
        });

        sortInput?.addEventListener(
            "change",
            applyFilters);

        applyFilters();
    });
});
