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
                frame.classList.toggle(
                    "is-active",
                    frameIndex === index);
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
    initPublicDogCycles();
    initPublicEventExplorer();
    initPublicEventHeroSlideshow();
    initPublicPawVideos();
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

function initPublicPawVideos() {
    const videos = Array.from(
        document.querySelectorAll(
            "video[data-paw-video]"));

    if (!videos.length) {
        return;
    }

    const pauseAll = () => {
        videos.forEach((video) =>
            video.pause());
    };

    if (publicReducedMotion.matches
        || !("IntersectionObserver" in window))
    {
        pauseAll();
        return;
    }

    const visibleVideos = new Set();

    const syncVideo = (video) => {
        const shouldPlay =
            visibleVideos.has(video)
            && document.visibilityState === "visible";

        if (shouldPlay) {
            video.play().catch(() => {});
        }
        else {
            video.pause();
        }
    };

    const observer =
        new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const video = entry.target;

                if (entry.isIntersecting) {
                    visibleVideos.add(video);
                }
                else {
                    visibleVideos.delete(video);
                }

                syncVideo(video);
            });
        }, {
            threshold: 0.12,
            rootMargin: "80px 0px"
        });

    videos.forEach((video) =>
        observer.observe(video));

    document.addEventListener(
        "visibilitychange",
        () => {
            videos.forEach(syncVideo);
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
            featureImage.src = image;
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

