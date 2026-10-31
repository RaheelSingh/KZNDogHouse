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

        // Support links from Calendar directly to a specific event's applicants.
        if (targetId === "volunteerApplicationRows") {
            const eventId = new URLSearchParams(window.location.search).get("event");
            const eventFilter = filterInputs.find((input) => input.dataset.portalFilterField === "event");
            if (eventId && eventFilter && Array.from(eventFilter.options).some((option) => option.value === eventId)) {
                eventFilter.value = eventId;
            }
        }

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


document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-dog-gallery]").forEach((gallery) => {
        const frames = Array.from(
            gallery.querySelectorAll("[data-gallery-frame]"));

        if (frames.length <= 1) {
            return;
        }

        const indicators = Array.from(
            gallery.querySelectorAll("[data-gallery-indicator]"));

        const previousButton =
            gallery.querySelector("[data-gallery-previous]");

        const nextButton =
            gallery.querySelector("[data-gallery-next]");

        const reduceMotion =
            window.matchMedia(
                "(prefers-reduced-motion: reduce)");

        let index = 0;
        let timer = null;
        let inViewport = false;
        let pausedByInteraction = false;

        const show = (newIndex) => {
            index =
                (newIndex + frames.length)
                % frames.length;

            frames.forEach((frame, frameIndex) => {
                const active = frameIndex === index;
                frame.classList.toggle("is-active", active);
                if (!active && frame.tagName === "VIDEO") frame.pause();
            });

            indicators.forEach((indicator, indicatorIndex) => {
                const isActive =
                    indicatorIndex === index;

                indicator.classList.toggle(
                    "is-active",
                    isActive);

                indicator.setAttribute(
                    "aria-current",
                    isActive ? "true" : "false");
            });
        };

        const stopTimer = () => {
            if (timer !== null) {
                window.clearInterval(timer);
                timer = null;
            }
        };

        const syncTimer = () => {
            const autoplay =
                gallery.dataset.galleryAutoplay === "true";

            const shouldRun =
                autoplay
                && !reduceMotion.matches
                && inViewport
                && !pausedByInteraction
                && document.visibilityState === "visible";

            if (!shouldRun) {
                stopTimer();
                return;
            }

            if (timer !== null) {
                return;
            }

            const configured = Number(
                gallery.dataset.galleryInterval
                ?? 10000);

            const interval =
                Number.isFinite(configured)
                && configured >= 3000
                    ? configured
                    : 10000;

            timer = window.setInterval(
                () => show(index + 1),
                interval);
        };

        const restartAfterManualChange = () => {
            stopTimer();
            syncTimer();
        };

        previousButton?.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                show(index - 1);
                restartAfterManualChange();
            });

        nextButton?.addEventListener(
            "click",
            (event) => {
                event.preventDefault();
                event.stopPropagation();
                show(index + 1);
                restartAfterManualChange();
            });

        indicators.forEach(
            (indicator, indicatorIndex) => {
                indicator.addEventListener(
                    "click",
                    (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        show(indicatorIndex);
                        restartAfterManualChange();
                    });
            });

        gallery.addEventListener(
            "mouseenter",
            () => {
                pausedByInteraction = true;
                syncTimer();
            });

        gallery.addEventListener(
            "mouseleave",
            () => {
                pausedByInteraction = false;
                syncTimer();
            });

        gallery.addEventListener(
            "focusin",
            () => {
                pausedByInteraction = true;
                syncTimer();
            });

        gallery.addEventListener(
            "focusout",
            () => {
                pausedByInteraction = false;
                syncTimer();
            });

        if ("IntersectionObserver" in window) {
            const observer =
                new IntersectionObserver((entries) => {
                    inViewport =
                        entries.some((entry) =>
                            entry.isIntersecting);

                    syncTimer();
                }, {
                    threshold: 0.08,
                    rootMargin: "120px 0px"
                });

            observer.observe(gallery);
        }
        else {
            inViewport = true;
        }

        document.addEventListener(
            "visibilitychange",
            syncTimer);

        show(0);
        syncTimer();
    });
});


document.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-submit-once='true']");

    if (!form) {
        return;
    }

    if (form.dataset.submitting === "true") {
        event.preventDefault();
        return;
    }

    if (!form.checkValidity()) {
        return;
    }

    form.dataset.submitting = "true";

    const submitButton = form.querySelector("button[type='submit']");

    if (submitButton) {
        submitButton.disabled = true;

        const currentLabel = submitButton.textContent?.trim();

        if (currentLabel) {
            submitButton.dataset.originalLabel = currentLabel;
        }

        submitButton.textContent = "Saving...";
    }
});

// Keep Calendar/Inventory result panes aligned without repeatedly forcing layout.
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-equal-workspace]").forEach((workspace) => {
        const formCard = workspace.querySelector("[data-equal-workspace-form]");
        const filterCard = workspace.querySelector(".portal-workspace-filter-card");
        const scrollArea = workspace.querySelector("[data-equal-workspace-scroll]");

        if (!formCard || !filterCard || !scrollArea) {
            return;
        }

        let animationFrame = 0;

        const updateHeight = () => {
            animationFrame = 0;

            if (window.matchMedia("(max-width: 1199.98px)").matches) {
                scrollArea.style.height = "";
                scrollArea.style.maxHeight = "";
                return;
            }

            const workspaceStyles = window.getComputedStyle(workspace);
            const gap =
                Number.parseFloat(
                    workspaceStyles.rowGap
                    || workspaceStyles.gap
                    || "16")
                || 16;

            const available =
                formCard.getBoundingClientRect().height
                - filterCard.getBoundingClientRect().height
                - gap;

            const target = Math.max(
                260,
                Math.round(available));

            scrollArea.style.height = `${target}px`;
            scrollArea.style.maxHeight = `${target}px`;
        };

        const queueHeightUpdate = () => {
            if (animationFrame) {
                window.cancelAnimationFrame(animationFrame);
            }

            animationFrame =
                window.requestAnimationFrame(updateHeight);
        };

        queueHeightUpdate();

        window.addEventListener(
            "resize",
            queueHeightUpdate,
            { passive: true });

        if ("ResizeObserver" in window) {
            const observer =
                new ResizeObserver(queueHeightUpdate);

            observer.observe(formCard);
            observer.observe(filterCard);
        }
    });
});

// Calendar visibility is visually cumulative: public events appear internally as well.
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-calendar-visibility]").forEach((control) => {
        const internalInput = control.querySelector("#visInternal");
        const publicInput = control.querySelector("#visPublic");
        const internalLabel = control.querySelector("[data-calendar-visibility-internal]");
        const publicLabel = control.querySelector("[data-calendar-visibility-public]");

        if (!internalInput || !publicInput || !internalLabel || !publicLabel) {
            return;
        }

        const sync = () => {
            internalLabel.classList.add("is-selected");
            publicLabel.classList.toggle("is-selected", publicInput.checked);
        };

        internalInput.addEventListener("change", sync);
        publicInput.addEventListener("change", sync);
        sync();
    });
});


// Public site motion and interactive event history.
document.addEventListener("DOMContentLoaded", () => {
    initPublicReveal();
    initPublicPawTrails();
    initPublicDogCycles();
    initPublicEventExplorer();
    initPublicEventHeroSlideshow();
});

const publicReducedMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)");

function createVisibilityAwareTicker(
    element,
    interval,
    callback)
{
    if (publicReducedMotion.matches
        || !("IntersectionObserver" in window))
    {
        return;
    }

    let timer = null;
    let inViewport = false;

    const stop = () => {
        if (timer !== null) {
            window.clearInterval(timer);
            timer = null;
        }
    };

    const sync = () => {
        const shouldRun =
            inViewport
            && document.visibilityState === "visible";

        if (!shouldRun) {
            stop();
            return;
        }

        if (timer === null) {
            timer = window.setInterval(
                callback,
                interval);
        }
    };

    const observer =
        new IntersectionObserver((entries) => {
            inViewport =
                entries.some((entry) =>
                    entry.isIntersecting);

            sync();
        }, {
            threshold: 0.08,
            rootMargin: "120px 0px"
        });

    observer.observe(element);

    document.addEventListener(
        "visibilitychange",
        sync);
}

function initPublicPawTrails() {
    const trails = Array.from(
        document.querySelectorAll(".public-paw-trail"));

    if (!trails.length) {
        return;
    }

    if (publicReducedMotion.matches
        || !("IntersectionObserver" in window))
    {
        trails.forEach((trail) =>
            trail.classList.add("is-active"));

        return;
    }

    const observer =
        new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                entry.target.classList.toggle(
                    "is-active",
                    entry.isIntersecting);
            });
        }, {
            threshold: 0.08,
            rootMargin: "80px 0px"
        });

    trails.forEach((trail) =>
        observer.observe(trail));
}

function initPublicReveal() {
    const targets = document.querySelectorAll([
        ".public-section",
        ".public-banner",
        ".public-cta-card",
        ".public-event-feature"
    ].join(","));

    if (!targets.length) {
        return;
    }

    if (publicReducedMotion.matches
        || !("IntersectionObserver" in window))
    {
        targets.forEach((target) =>
            target.classList.add("is-visible"));

        return;
    }

    targets.forEach((target) =>
        target.classList.add("public-reveal"));

    const observer =
        new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, {
            threshold: 0.06,
            rootMargin: "0px 0px -24px 0px"
        });

    targets.forEach((target) =>
        observer.observe(target));
}

function initPublicDogCycles() {
    document
        .querySelectorAll("[data-dog-cycle]")
        .forEach((cycle) => {
            const frames = Array.from(
                cycle.querySelectorAll("[data-dog-frame]"));

            const captions = Array.from(
                cycle.querySelectorAll("[data-dog-caption]"));

            if (!frames.length) {
                return;
            }

            let index = 0;

            const configured = Number(
                cycle.dataset.dogCycleInterval ?? 7000);

            const interval =
                Number.isFinite(configured)
                && configured >= 4000
                    ? configured
                    : 7000;

            const show = (next) => {
                index =
                    (next + frames.length)
                    % frames.length;

                frames.forEach((frame, frameIndex) => {
                    const active =
                        frameIndex === index;

                    frame.classList.toggle(
                        "is-active",
                        active);

                    frame.setAttribute(
                        "aria-hidden",
                        active ? "false" : "true");
                });

                captions.forEach((caption, captionIndex) => {
                    const active =
                        captionIndex === index;

                    caption.classList.toggle(
                        "is-active",
                        active);

                    caption.setAttribute(
                        "aria-hidden",
                        active ? "false" : "true");
                });
            };

            show(0);

            if (frames.length > 1) {
                createVisibilityAwareTicker(
                    cycle,
                    interval,
                    () => show(index + 1));
            }
        });
}

function initPublicEventHeroSlideshow() {
    document
        .querySelectorAll("[data-event-hero-slideshow]")
        .forEach((hero) => {
            const slides = Array.from(
                hero.querySelectorAll("[data-event-hero-slide]"));

            if (!slides.length) {
                return;
            }

            let index = 0;

            slides.forEach((slide, slideIndex) =>
                slide.classList.toggle(
                    "is-active",
                    slideIndex === 0));

            if (slides.length <= 1) {
                return;
            }

            createVisibilityAwareTicker(
                hero,
                6500,
                () => {
                    slides[index]
                        .classList.remove("is-active");

                    index =
                        (index + 1)
                        % slides.length;

                    slides[index]
                        .classList.add("is-active");
                });
        });
}

function initPublicEventExplorer() {
    const explorer =
        document.querySelector(
            "[data-public-event-explorer]");

    if (!explorer) {
        return;
    }

    const sources = Array.from(
        explorer.querySelectorAll(
            "[data-event-source]"));

    if (!sources.length) {
        return;
    }

    const featureImage =
        explorer.querySelector("[data-feature-image]");

    const featureMonth =
        explorer.querySelector("[data-feature-month]");

    const featureDay =
        explorer.querySelector("[data-feature-day]");

    const featureCategory =
        explorer.querySelector("[data-feature-category]");

    const featureTitle =
        explorer.querySelector("[data-feature-title]");

    const featureDescription =
        explorer.querySelector("[data-feature-description]");

    const featureDate =
        explorer.querySelector("[data-feature-date]");

    const featureTime =
        explorer.querySelector("[data-feature-time]");

    const featureLocation =
        explorer.querySelector("[data-feature-location]");

    const featureRsvp =
        explorer.querySelector("[data-feature-rsvp]");

    const featureEnded =
        explorer.querySelector("[data-feature-ended]");

    const feature =
        explorer.querySelector("[data-event-feature]");

    const update = (source) => {
        const isPast =
            source.dataset.isPast === "true";

        const image =
            source.dataset.image ?? "";

        featureMonth.textContent =
            source.dataset.month ?? "";

        featureDay.textContent =
            source.dataset.day ?? "";

        featureCategory.textContent =
            source.dataset.category ?? "";

        featureTitle.textContent =
            source.dataset.title ?? "";

        featureDescription.textContent =
            source.dataset.description ?? "";

        featureDate.textContent =
            source.dataset.date ?? "";

        featureTime.textContent =
            source.dataset.time ?? "";

        const location =
            source.dataset.location ?? "";

        featureLocation.textContent =
            location;

        featureLocation.classList.toggle(
            "d-none",
            !location);

        if (featureImage) {
            if (image) {
                featureImage.src = image;
                featureImage.alt = `Image for ${source.dataset.title ?? "event"}`;
            }
            else {
                featureImage.removeAttribute("src");
                featureImage.alt = "";
            }

            featureImage.classList.toggle(
                "d-none",
                !image);

            featureImage
                .closest(".public-event-feature-date")
                ?.classList.toggle(
                    "has-image",
                    Boolean(image));
        }

        featureRsvp.classList.toggle(
            "d-none",
            isPast);

        featureEnded.classList.toggle(
            "d-none",
            !isPast);

        if (!isPast) {
            featureRsvp.href =
                source.dataset.rsvp
                || "/contact";
        }

        sources.forEach((item) => {
            item.classList.remove("is-active");

            const wrapper =
                item.closest(
                    "[data-event-source-wrapper]");

            wrapper?.classList.remove("d-none");
        });

        source.classList.add("is-active");

        if (!isPast) {
            source
                .closest("[data-event-source-wrapper]")
                ?.classList.add("d-none");
        }

        feature?.scrollIntoView({
            behavior:
                publicReducedMotion.matches
                    ? "auto"
                    : "smooth",
            block: "start"
        });
    };

    sources.forEach((source) => {
        source.addEventListener(
            "click",
            () => update(source));
    });

    const defaultSource =
        sources.find((source) =>
            source.dataset.defaultFeature === "true");

    defaultSource
        ?.closest("[data-event-source-wrapper]")
        ?.classList.add("d-none");
}


document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-volunteer-config]").forEach((container) => {
        const toggle = container.querySelector("[data-volunteer-toggle]");
        const fields = container.querySelector("[data-volunteer-fields]");
        const requiredFields = Array.from(
            container.querySelectorAll("[data-volunteer-required]"));

        if (!toggle || !fields) {
            return;
        }

        const update = () => {
            const enabled = toggle.checked;
            fields.hidden = !enabled;
            requiredFields.forEach((field) => {
                field.required = enabled;
                if (!enabled) {
                    field.setCustomValidity("");
                }
            });
        };

        toggle.addEventListener("change", update);
        update();
    });
});


// Apply consistent required-field affordances and reject obviously invalid
// uploads before a form reaches the server. Server-side validation remains
// authoritative; this simply gives users immediate feedback.
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("input, select, textarea").forEach((control) => {
        const isRequired =
            control.dataset.optionalField !== "true"
            && control.type !== "checkbox"
            && (control.required || control.hasAttribute("data-val-required"));

        if (!isRequired) {
            return;
        }

        const labels = Array.from(control.labels ?? []);
        // Authentication forms should show required markers only after
        // validation finds an empty field. A volunteer opt-in checkbox is
        // always optional, even if generated metadata says otherwise.
        if (!control.closest(".auth-form")) {
            labels.forEach((label) => label.classList.add("is-required"));
        }
    });

    document.querySelectorAll(".auth-form").forEach((form) => {
        const updateFieldMarker = (control) => {
            if (!(control instanceof HTMLInputElement)) return;
            if (control.type === "checkbox" || control.type === "hidden") return;
            const required = control.required || control.hasAttribute("data-val-required");
            const hasError = control.classList.contains("input-validation-error")
                || control.getAttribute("aria-invalid") === "true";
            const isEmpty = !control.value.trim();
            for (const label of Array.from(control.labels ?? [])) {
                label.classList.toggle("auth-empty-error", required && isEmpty && hasError);
            }
        };
        // Existing server-side errors are rendered as input-validation-error.
        form.querySelectorAll("input").forEach(updateFieldMarker);
        form.addEventListener("invalid", (event) => {
            if (event.target instanceof HTMLInputElement) {
                event.target.classList.add("input-validation-error");
                updateFieldMarker(event.target);
            }
        }, true);
        form.addEventListener("input", (event) => updateFieldMarker(event.target));
        form.addEventListener("change", (event) => updateFieldMarker(event.target));
        // ASP.NET unobtrusive validation may add its error classes on submit
        // without firing a native invalid event.
        form.addEventListener("submit", () => {
            requestAnimationFrame(() => {
                form.querySelectorAll("input").forEach(updateFieldMarker);
            });
        });
    });

    document.querySelectorAll('input[type="file"]').forEach((input) => {
        const acceptsImages =
            (input.accept ?? "").toLowerCase().includes("image/");

        const maxBytes = Number(
            input.dataset.maxFileBytes
            || (acceptsImages ? 5 * 1024 * 1024 : 0));

        const maxFiles = Number(input.dataset.maxFiles || 0);

        if (!maxBytes && !maxFiles) {
            return;
        }

        const feedback = document.createElement("div");
        feedback.className = "file-validation-feedback";
        feedback.setAttribute("role", "alert");
        input.insertAdjacentElement("afterend", feedback);

        const validate = () => {
            const files = Array.from(input.files ?? []);
            let message = "";

            if (maxFiles && files.length > maxFiles) {
                message = `Choose no more than ${maxFiles} files.`;
            }

            const oversized = files.find((file) => maxBytes && file.size > maxBytes);
            if (!message && oversized) {
                const limitMb = Math.round(maxBytes / 1024 / 1024);
                message = `${oversized.name} is too large. Images must be ${limitMb} MB or smaller.`;
            }

            const unsupported = files.find((file) =>
                acceptsImages
                && file.type
                && !["image/jpeg", "image/png", "image/webp"].includes(file.type));

            if (!message && unsupported) {
                message = `${unsupported.name} is not supported. Use JPG, PNG or WebP.`;
            }

            input.setCustomValidity(message);
            input.classList.toggle("is-invalid", Boolean(message));
            feedback.textContent = message;
            feedback.hidden = !message;
        };

        input.addEventListener("change", validate);
        input.closest("form")?.addEventListener("submit", validate);
        feedback.hidden = true;
    });
});

// Password visibility for the public sign-in and registration forms.
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
        const container = button.closest(".auth-password-wrap");
        const input = container?.querySelector("input");
        if (!input) return;
        button.addEventListener("click", () => {
            const reveal = input.type === "password";
            input.type = reveal ? "text" : "password";
            button.setAttribute("aria-pressed", String(reveal));
            button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
            button.title = reveal ? "Hide password" : "Show password";
        });
    });
});


// Event scheduling: separate date and time inputs, so users can type HH:MM
// rather than spinning through a long native combined date/time picker.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.portal-body form input[type="datetime-local"]').forEach(original => {
    if (!original.name || original.dataset.splitReady) return;
    original.dataset.splitReady = 'true';
    const wrapper = document.createElement('div');
    wrapper.className = 'portal-inline-datetime';
    const date = document.createElement('input');
    date.type = 'date'; date.className = 'form-control';
    date.setAttribute('aria-label', 'Date');
    const time = document.createElement('input');
    time.type = 'time'; time.step = '60'; time.className = 'form-control';
    time.setAttribute('aria-label', 'Time (24-hour format)');
    const [initialDate, initialTime] = (original.value || '').split('T');
    date.value = initialDate || '';
    time.value = (initialTime || '').slice(0, 5);
    if (original.required) { date.required = true; time.required = true; }
    const sync = () => { original.value = date.value && time.value ? `${date.value}T${time.value}` : ''; };
    date.addEventListener('change', sync);
    time.addEventListener('change', sync);
    wrapper.append(date, time);
    original.type = 'hidden';
    original.insertAdjacentElement('afterend', wrapper);
    sync();
  });
});

// Portal routes should open at their headings, even after visiting a long
// record list. This avoids sticky headers obscuring the title on an empty tab.
if (document.body.classList.contains('portal-body')) {
  try { window.history.scrollRestoration = 'manual'; } catch { /* unsupported */ }
  window.addEventListener('load', () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }), { once: true });
}

// Keep open pages current without reloading active forms or undoing staff input.
// HTML snapshots are compared, rather than reloading on a blind timer. Only
// visible, idle pages are refreshed; a pending edit shows a refresh prompt.
(() => {
    const portal = document.getElementById('portal-main-content');
    const publicPage = !portal && document.querySelector('main');
    if (!portal && !publicPage) return;
    const content = portal || publicPage;
    let changedByUser = false;
    let checking = false;
    let notice = null;
    let lastSnapshot = null;
    const secured = !!portal || document.body.dataset.authSession?.toLowerCase() === 'true';

    document.addEventListener('input', (e) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement ||
            e.target instanceof HTMLSelectElement || e.target?.isContentEditable) changedByUser = true;
    }, { capture: true });
    document.addEventListener('change', (e) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement ||
            e.target instanceof HTMLSelectElement) changedByUser = true;
    }, { capture: true });

    const hasActiveEditing = () => changedByUser ||
        !!document.querySelector('.modal.show, .offcanvas.show') ||
        (document.activeElement instanceof HTMLElement &&
          !!document.activeElement.closest('form') &&
          document.activeElement.matches('input,textarea,select,[contenteditable]'));

    function showUpdates() {
        if (notice) return;
        notice = document.createElement('button');
        notice.type = 'button';
        notice.className = 'btn btn-sm btn-success';
        notice.textContent = 'New updates available - refresh';
        notice.setAttribute('aria-label', 'Refresh to view updated information');
        Object.assign(notice.style, { position: 'fixed', bottom: '24px', right: '20px', zIndex: '1055' });
        notice.addEventListener('click', () => window.location.reload());
        document.body.appendChild(notice);
    }

    async function sync() {
        if (checking || document.visibilityState !== 'visible') return;
        checking = true;
        try {
            if (secured) {
                const status = await fetch('/Auth/SessionStatus', {
                    credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }
                });
                if (!status.ok || !status.headers.get('content-type')?.includes('application/json')) {
                    window.location.replace('/Auth/Login');
                    return;
                }
                // Update notification badge without requiring a full reload.
                const badge = document.getElementById('portalNotificationBadge');
                if (badge?.dataset.unreadUrl) {
                    const countRes = await fetch(badge.dataset.unreadUrl, { credentials: 'same-origin', cache: 'no-store' });
                    if (countRes.ok) {
                        const { count } = await countRes.json();
                        const number = Number(count ?? 0);
                        badge.hidden = number === 0;
                        badge.textContent = number > 99 ? '99+' : String(number);
                    }
                }
            }
            const response = await fetch(window.location.href, {
                credentials: 'same-origin', cache: 'no-store', headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (!response.ok || response.redirected && response.url.includes('/Auth/Login')) return;
            const other = new DOMParser().parseFromString(await response.text(), 'text/html');
            const fresh = portal ? other.getElementById('portal-main-content') : other.querySelector('main');
            if (!fresh) return;
            // Compare successive *server* snapshots, not client DOM: carousels,
            // dropdowns and JS widgets legitimately mutate the local page.
            const snapshot = fresh.innerHTML.trim().replace(
                /(name="__RequestVerificationToken"[^>]*value=")[^"]+/g, '$1[csrf]');
            if (lastSnapshot === null) { lastSnapshot = snapshot; return; }
            if (lastSnapshot === snapshot) return;
            lastSnapshot = snapshot;
            if (hasActiveEditing() || document.hidden) showUpdates();
            else window.location.reload();
        } catch (err) { console.debug('[updates] will retry:', err); }
        finally { checking = false; }
    }
    void sync();
    const timer = window.setInterval(sync, 45000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void sync();
    });
    window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
})();
