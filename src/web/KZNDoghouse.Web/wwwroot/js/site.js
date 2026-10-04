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

        const groups = Array.from(
            target.querySelectorAll("[data-portal-group]"));

        const searchInput =
            toolbar.querySelector("[data-portal-search]");

        const filterInputs = Array.from(
            toolbar.querySelectorAll("[data-portal-filter-field]"));

        const dateFromInputs = Array.from(
            toolbar.querySelectorAll("[data-portal-date-from]"));

        const dateToInputs = Array.from(
            toolbar.querySelectorAll("[data-portal-date-to]"));

        const sortButton =
            toolbar.querySelector("[data-portal-sort-toggle]");

        const resetButton =
            toolbar.querySelector("[data-portal-filter-reset]");

        const emptyTargetId =
            toolbar.dataset.portalEmpty;

        const emptyTarget = emptyTargetId
            ? document.getElementById(emptyTargetId)
            : null;

        const resultCountId =
            toolbar.dataset.portalResultCount;

        const resultCount = resultCountId
            ? document.getElementById(resultCountId)
            : null;

        const controls = [
            ...(searchInput ? [searchInput] : []),
            ...filterInputs,
            ...dateFromInputs,
            ...dateToInputs
        ];

        const defaults = new Map(
            controls.map((control) => [
                control,
                control.value
            ]));

        const initialSortDirection =
            sortButton?.dataset.sortDirection ?? "asc";

        const normalise = (value) =>
            (value ?? "")
                .toString()
                .trim()
                .toLowerCase();

        const updateSortButton = () => {
            if (!sortButton) {
                return;
            }

            const direction =
                sortButton.dataset.sortDirection ?? "asc";

            const label = direction === "desc"
                ? sortButton.dataset.sortDescLabel ?? "Descending"
                : sortButton.dataset.sortAscLabel ?? "Ascending";

            const labelTarget =
                sortButton.querySelector("[data-portal-sort-label]");

            if (labelTarget) {
                labelTarget.textContent = label;
            }

            sortButton.classList.toggle(
                "is-desc",
                direction === "desc");

            const field =
                sortButton.dataset.sortField ?? "";

            const friendlyField = field
                .replace(/^sort/, "")
                .replace(/([A-Z])/g, " $1")
                .trim()
                .toLowerCase();

            const description = friendlyField
                ? `Sort ${friendlyField}, ${label}`
                : `Sort ${label}`;

            sortButton.title = description;
            sortButton.setAttribute(
                "aria-label",
                description);
        };

        const compareRows = (a, b) => {
            if (!sortButton) {
                return 0;
            }

            const aPinned =
                a.dataset.pinned === "true";

            const bPinned =
                b.dataset.pinned === "true";

            if (aPinned !== bPinned) {
                return aPinned ? -1 : 1;
            }

            const field =
                sortButton.dataset.sortField;

            if (!field) {
                return 0;
            }

            const type =
                sortButton.dataset.sortType ?? "text";

            const direction =
                sortButton.dataset.sortDirection ?? "asc";

            const aValue =
                a.dataset[field] ?? "";

            const bValue =
                b.dataset[field] ?? "";

            let comparison = 0;

            if (type === "date") {
                comparison =
                    new Date(aValue).getTime()
                    - new Date(bValue).getTime();
            }
            else if (type === "number") {
                comparison =
                    Number(aValue)
                    - Number(bValue);
            }
            else {
                comparison = aValue.localeCompare(
                    bValue,
                    undefined,
                    { sensitivity: "base" });
            }

            return direction === "desc"
                ? -comparison
                : comparison;
        };

        const applyFilters = () => {
            const query = normalise(
                searchInput?.value);

            rows.forEach((row) => {
                const searchable = normalise(
                    row.dataset.search);

                let matches =
                    !query || searchable.includes(query);

                filterInputs.forEach((input) => {
                    if (!matches || !input.value) {
                        return;
                    }

                    const field =
                        input.dataset.portalFilterField;

                    const rowValue = field
                        ? normalise(row.dataset[field])
                        : "";

                    if (rowValue !== normalise(input.value)) {
                        matches = false;
                    }
                });

                dateFromInputs.forEach((input) => {
                    if (!matches || !input.value) {
                        return;
                    }

                    const field =
                        input.dataset.portalDateFrom;

                    const rowDate = field
                        ? row.dataset[field] ?? ""
                        : "";

                    if (!rowDate || rowDate < input.value) {
                        matches = false;
                    }
                });

                dateToInputs.forEach((input) => {
                    if (!matches || !input.value) {
                        return;
                    }

                    const field =
                        input.dataset.portalDateTo;

                    const rowDate = field
                        ? row.dataset[field] ?? ""
                        : "";

                    if (!rowDate || rowDate > input.value) {
                        matches = false;
                    }
                });

                row.hidden = !matches;
            });

            if (sortButton) {
                rows
                    .slice()
                    .sort(compareRows)
                    .forEach((row) => {
                        target.appendChild(row);
                    });
            }

            groups.forEach((group) => {
                const visibleRows = Array.from(
                    group.querySelectorAll("[data-portal-row]"))
                    .some((row) => !row.hidden);

                group.hidden = !visibleRows;
            });

            const visibleCount = rows
                .filter((row) => !row.hidden)
                .length;

            if (resultCount) {
                resultCount.textContent =
                    `${visibleCount} ${visibleCount === 1 ? "result" : "results"}`;
            }

            if (emptyTarget) {
                emptyTarget.hidden =
                    visibleCount > 0;
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

        dateFromInputs.forEach((input) => {
            input.addEventListener(
                "change",
                applyFilters);
        });

        dateToInputs.forEach((input) => {
            input.addEventListener(
                "change",
                applyFilters);
        });

        sortButton?.addEventListener(
            "click",
            () => {
                const direction =
                    sortButton.dataset.sortDirection ?? "asc";

                sortButton.dataset.sortDirection =
                    direction === "asc"
                        ? "desc"
                        : "asc";

                updateSortButton();
                applyFilters();
            });

        resetButton?.addEventListener(
            "click",
            () => {
                controls.forEach((control) => {
                    control.value =
                        defaults.get(control) ?? "";
                });

                if (sortButton) {
                    sortButton.dataset.sortDirection =
                        initialSortDirection;

                    updateSortButton();
                }

                applyFilters();
            });

        updateSortButton();
        applyFilters();
    });
});
