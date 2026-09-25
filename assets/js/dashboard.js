(function () {
    "use strict";

    function stashGet(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            if (raw) {
                return JSON.parse(raw);
            }
        } catch (error) {
            return fallback;
        }
        return fallback;
    }

    function stashSet(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    var account = window.bioTrailAccount;
    var params = new URLSearchParams(window.location.search);
    var requestedUsername = (params.get("username") || "").toLowerCase();
    var requestedName = params.get("name") || "";

    var storedProfile = stashGet("biotrail_profile", {});
    var profile = {
        username: (storedProfile.username || requestedUsername || "mytrail").toLowerCase(),
        name: (storedProfile.name || requestedName || "BioTrail creator").replace(/-/g, " "),
        role: storedProfile.role || "Creative director & storyteller",
        bio: storedProfile.bio || "Bringing my projects, writing and shop into one place — follow along wherever you like.",
        avatar: storedProfile.avatar || null
    };

    var pages = account.getPages();
    var activePage;
    var creatingNew = params.get("new") === "1";
    if (creatingNew) {
        activePage = account.createPage();
        pages.push(activePage);
        account.savePages(pages);
    } else {
        activePage = pages.filter(function (page) {
            return page.id === (params.get("page") || "");
        })[0] || pages[0];
    }
    if (!activePage) {
        activePage = account.createPage();
        pages.push(activePage);
        account.savePages(pages);
    }
    var activePageId = activePage.id;

    if (creatingNew) {
        try {
            window.history.replaceState(null, "", "dashboard.html?page=" + encodeURIComponent(activePage.id));
        } catch (error) {
            window.location.replace("dashboard.html?page=" + encodeURIComponent(activePage.id));
        }
    }

    var links = activePage.links;
    var theme = activePage.theme;
    var undoStack = [];
    var undoButton = document.getElementById("dashboard-undo");
    var settingsUndoCaptured = false;

    stashSet("biotrail_profile", profile);

    function cloneState(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function captureDashboardState() {
        return {
            profile: cloneState(profile),
            pages: cloneState(pages),
            activePageId: activePage.id
        };
    }

    function updateUndoButton() {
        var latest = undoStack[undoStack.length - 1];
        undoButton.disabled = !latest;
        undoButton.title = latest ? "Undo " + latest.label : "Nothing to undo yet";
        undoButton.setAttribute("aria-label", latest ? "Undo " + latest.label : "Nothing to undo yet");
    }

    function pushUndo(label) {
        var snapshot = captureDashboardState();
        var signature = JSON.stringify(snapshot);
        var latest = undoStack[undoStack.length - 1];

        if (latest && latest.signature === signature) {
            return;
        }

        undoStack.push({ label: label, state: snapshot, signature: signature });
        if (undoStack.length > 15) {
            undoStack.shift();
        }
        updateUndoButton();
    }

    function restoreDashboardState(snapshot) {
        profile = cloneState(snapshot.profile);
        pages = cloneState(snapshot.pages);
        activePageId = snapshot.activePageId;
        activePage = pages.filter(function (page) { return page.id === activePageId; })[0] || pages[0];
        links = activePage.links || [];
        theme = activePage.theme || {};
        activePage.links = links;
        activePage.theme = theme;

        stashSet("biotrail_profile", profile);
        account.savePages(pages);
        document.querySelectorAll(".dash-swatches button.is-selected").forEach(function (button) {
            button.classList.remove("is-selected");
        });
        applyThemeSelections();
        populateProfileForm();
        renderProfileCard();
        renderPageMeta();
        renderLinks(document.getElementById("links-search").value);
        renderAnalytics();
        refreshGroupOptions();
        settingsUndoCaptured = false;
        syncPreview();
    }

    function undoLastChange() {
        var entry = undoStack.pop();
        if (!entry) {
            return;
        }
        restoreDashboardState(entry.state);
        updateUndoButton();
        toast("Undid " + entry.label + ".");
    }

    undoButton.addEventListener("click", undoLastChange);
    updateUndoButton();

    function persistPage() {
        account.savePages(pages);
    }

    // Keep the editor, saved page and both previews on the same state.
    function persistEditorState() {
        activePage.theme = theme;
        stashSet("biotrail_profile", profile);
        persistPage();
        syncPreview();
    }

    var icons = window.bioTrailDashIcons || {};

    function iconSvg(iconName) {
        return '<svg class="material-icon" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="' + (icons[iconName] || icons.link || "") + '"/></svg>';
    }

    function fillStaticIcons() {
        document.querySelectorAll("[data-icon]").forEach(function (svg) {
            var iconName = svg.getAttribute("data-icon");
            if (icons[iconName]) {
                svg.innerHTML = '<path d="' + icons[iconName] + '"/>';
            }
        });
    }

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"]/g, function (char) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char];
        });
    }

    // --- F7: link scheduling ----------------------------------------
    // Visibility state from a link's schedule window.
    function scheduleInfo(link) {
        var schedule = link && link.schedule;
        if (!schedule) {
            return null;
        }
        var now = Date.now();
        var start = schedule.start ? new Date(schedule.start).getTime() : null;
        var end = schedule.end ? new Date(schedule.end).getTime() : null;
        var visible = true;
        if (start && now < start) {
            visible = false;
        }
        if (end && now > end) {
            visible = false;
        }
        return { visible: visible, start: start, end: end };
    }

    // --- F11: link groups ---------------------------------------------------
    // Keep the modal's datalist of existing groups in sync with saved links.
    function refreshGroupOptions() {
        var datalist = document.getElementById("link-group-options");
        if (!datalist) {
            return;
        }
        var seen = {};
        var values = ["General"];
        links.forEach(function (link) {
            var group = String(link.group || "").trim();
            if (group && group !== "General" && !seen[group]) {
                seen[group] = true;
                values.push(group);
            }
        });
        datalist.innerHTML = values.map(function (group) {
            return '<option value="' + escapeHtml(group) + '"></option>';
        }).join("");
    }

    // --- F12: social-link auto-detection ------------------------------------
    // Recognise a social profile from its URL, then suggest icon + label.
    var SOCIAL_LINKS = [
        { hosts: ["youtube.com", "youtu.be"], icon: "smart_display", label: "YouTube", title: "Watch on YouTube" },
        { hosts: ["twitter.com", "x.com"], icon: "share", label: "X / Twitter", title: "Follow on X" },
        { hosts: ["facebook.com", "fb.com"], icon: "share", label: "Facebook", title: "Follow on Facebook" },
        { hosts: ["instagram.com"], icon: "star", label: "Instagram", title: "Follow on Instagram" },
        { hosts: ["tiktok.com"], icon: "bolt", label: "TikTok", title: "Follow on TikTok" },
        { hosts: ["linkedin.com"], icon: "monitoring", label: "LinkedIn", title: "Connect on LinkedIn" },
        { hosts: ["github.com", "github.io"], icon: "rocket_launch", label: "GitHub", title: "View my GitHub" },
        { hosts: ["twitch.tv"], icon: "monitoring", label: "Twitch", title: "Watch on Twitch" },
        { hosts: ["discord.com", "discord.gg"], icon: "mail", label: "Discord", title: "Join my Discord" },
        { hosts: ["spotify.com"], icon: "star", label: "Spotify", title: "Listen on Spotify" },
        { hosts: ["soundcloud.com"], icon: "star", label: "SoundCloud", title: "Listen on SoundCloud" },
        { hosts: ["t.me", "telegram.me"], icon: "bolt", label: "Telegram", title: "Message on Telegram" },
        { hosts: ["whatsapp.com", "wa.me"], icon: "mail", label: "WhatsApp", title: "Chat on WhatsApp" },
        { hosts: ["reddit.com"], icon: "link", label: "Reddit", title: "Follow on Reddit" },
        { hosts: ["pinterest.com"], icon: "star", label: "Pinterest", title: "Follow on Pinterest" }
    ];

    function detectSocial(value) {
        if (!value) {
            return null;
        }
        var raw = String(value).trim();
        var url = null;
        try {
            url = new URL(/^https?:/i.test(raw) ? raw : "https://" + raw);
        } catch (error) {
            return null;
        }
        var host = url.hostname.replace(/^www\./, "").toLowerCase();
        for (var i = 0; i < SOCIAL_LINKS.length; i += 1) {
            var entry = SOCIAL_LINKS[i];
            for (var h = 0; h < entry.hosts.length; h += 1) {
                var candidate = entry.hosts[h].toLowerCase();
                if (host === candidate || host.slice(-(candidate.length + 1)) === "." + candidate) {
                    return entry;
                }
            }
        }
        return null;
    }

    function toast(message) {
        var toastEl = document.getElementById("dash-toast");
        toastEl.textContent = message;
        toastEl.hidden = false;
        toastEl.classList.remove("is-showing");
        void toastEl.offsetWidth;
        toastEl.classList.add("is-showing");
    }

    document.getElementById("dash-toast").addEventListener("animationend", function () {
        this.classList.remove("is-showing");
        this.hidden = true;
    });

    function initials(value) {
        return value.trim().split(/\s+/).map(function (word) { return word.charAt(0); }).join("").slice(0, 2).toUpperCase();
    }

    var previewFrame = document.getElementById("live-preview-frame");

    function syncPreview() {
        if (!previewFrame || !previewFrame.contentWindow) {
            return;
        }
        previewFrame.contentWindow.postMessage({
            type: "biotrail:preview-update",
            pageId: activePage.id,
            title: activePage.title,
            handle: activePage.handle,
            profile: Object.assign({}, profile),
            links: links.map(function (link) { return Object.assign({}, link); }),
            theme: Object.assign({}, theme)
        }, window.location.origin === "null" ? "*" : window.location.origin);
    }

    function renderDashboardAvatar() {
        var avatarEl = document.getElementById("dash-avatar");
        if (profile.avatar) {
            avatarEl.innerHTML = '<img src="' + profile.avatar + '" alt="">';
        } else {
            avatarEl.textContent = initials(profile.name);
        }
        var preview = document.getElementById("avatar-preview");
        if (preview) {
            if (profile.avatar) {
                preview.innerHTML = '<img src="' + profile.avatar + '" alt="">';
            } else {
                preview.textContent = initials(profile.name);
            }
        }
    }

    function renderProfileCard() {
        renderDashboardAvatar();
        document.getElementById("dash-display-name").textContent = profile.name;
        document.getElementById("dash-handle-name").textContent = activePage.handle || profile.username;
        document.getElementById("settings-url-hint").textContent = "biotrail.me/" + profile.username;
        syncPreview();
    }

    function renderPageMeta() {
        document.querySelector(".dash-kicker").textContent = "Page · " + (activePage.title || "Untitled");
        document.getElementById("settings-page-name").value = activePage.title || "";
        document.getElementById("settings-page-handle").value = activePage.handle || "";
        document.getElementById("settings-page-hint").textContent = "biotrail.me/" + (activePage.handle || "");
        syncPreview();
    }

    // --- F3: analytics rendering --------------------------------------------
    // Short weekday label from a YYYY-MM-DD key, computed via UTC to avoid TZ drift.
    function weekdayLabel(dateKey) {
        var parts = String(dateKey).split("-");
        var weekday = new Date(Date.UTC(parts[0], parseInt(parts[1], 10) - 1, parts[2])).getUTCDay();
        return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday];
    }

    // Interactive seven-day line chart fed by the real recorded view series.
    function renderLineChart(series) {
        var chart = document.getElementById("analytics-line-chart");
        var days = series.map(function (point) { return weekdayLabel(point.day); });
        var values = series.map(function (point) { return point.views; });
        var peak = Math.max.apply(null, values);
        var maxValue = peak === 0 ? 10 : Math.ceil(peak / 50) * 50;

        var width = 620;
        var baseline = 198;
        var top = 38;
        var startX = 48;
        var step = 88;
        var points = values.map(function (value, index) {
            return {
                day: days[index],
                value: value,
                x: startX + (step * index),
                y: baseline - ((value / maxValue) * (baseline - top))
            };
        });

        var linePath = "M " + points[0].x + " " + points[0].y;
        for (var i = 1; i < points.length; i += 1) {
            var previous = points[i - 1];
            var current = points[i];
            var middle = (previous.x + current.x) / 2;
            linePath += " C " + middle + " " + previous.y + ", " + middle + " " + current.y + ", " + current.x + " " + current.y;
        }

        var grid = [48, 98, 148, 198].map(function (y, index) {
            var label = Math.round(maxValue * ((3 - index) / 3));
            return '<line x1="42" y1="' + y + '" x2="592" y2="' + y + '"/><text x="4" y="' + (y + 4) + '">' + label + "</text>";
        }).join("");

        var pointMarkup = points.map(function (point) {
            var tooltipX = Math.max(8, Math.min(width - 116, point.x - 52));
            var tooltipY = Math.max(5, point.y - 58);
            return '<g class="dash-chart-point" tabindex="0" role="img" aria-label="' + point.day + ": " + point.value + ' views">' +
                '<circle cx="' + point.x + '" cy="' + point.y + '" r="6"/>' +
                '<g class="dash-chart-tooltip" transform="translate(' + tooltipX + " " + tooltipY + ')">' +
                '<rect width="108" height="44" rx="11"/>' +
                '<text x="12" y="18">' + point.day + '</text>' +
                '<text class="dash-chart-tooltip-value" x="12" y="34">' + point.value + ' views</text>' +
                "</g></g>";
        }).join("");

        var dayLabels = points.map(function (point) {
            return '<text x="' + point.x + '" y="226" text-anchor="middle">' + point.day + "</text>";
        }).join("");

        chart.innerHTML = '<svg viewBox="0 0 620 242" role="img" aria-label="Daily page views over the last seven days">' +
            '<defs><linearGradient id="dash-chart-area" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#cfff1a" stop-opacity=".34"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/>' +
            '</linearGradient></defs>' +
            '<g class="dash-chart-grid">' + grid + '</g>' +
            '<g class="dash-chart-axis">' + dayLabels + '</g>' +
            '<path class="dash-chart-area" d="' + linePath + " L " + points[points.length - 1].x + " " + baseline + " L " + points[0].x + " " + baseline + ' Z"/>' +
            '<path class="dash-chart-line" pathLength="1" d="' + linePath + '"/>' +
            '<g class="dash-chart-points">' + pointMarkup + "</g></svg>";
    }

    function renderAnalytics() {
        var stats = window.bioTrailStats ? window.bioTrailStats.summary(activePageId, links) : null;
        var series;
        if (stats) {
            series = stats.series;
        } else {
            series = [];
            var now = new Date();
            for (var d = 6; d >= 0; d -= 1) {
                var day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
                series.push({
                    day: day.getFullYear() + "-" + ("0" + (day.getMonth() + 1)).slice(-2) + "-" + ("0" + day.getDate()).slice(-2),
                    views: 0
                });
            }
        }
        var views = stats ? stats.views : 0;
        var clicks = stats ? stats.clicks : 0;
        var ctr = stats ? stats.ctr : 0;

        document.getElementById("stat-views").textContent = views.toLocaleString();
        document.getElementById("stat-clicks").textContent = clicks.toLocaleString();
        document.getElementById("stat-ctr").textContent = ctr + "%";

        var statsEl = document.querySelector(".dash-stats");
        if (stats && statsEl) {
            var viewsTrendEl = statsEl.querySelector(".dash-stat.is-views .dash-stat-trend");
            if (viewsTrendEl) {
                viewsTrendEl.textContent = (stats.viewsTrend >= 0 ? "+" : "") + stats.viewsTrend + "%";
            }
            var clicksTrendEl = statsEl.querySelector(".dash-stat.is-clicks .dash-stat-trend");
            if (clicksTrendEl) {
                clicksTrendEl.textContent = (stats.clicksTrend >= 0 ? "+" : "") + stats.clicksTrend + "%";
            }
        }

        renderLineChart(series);

        var topList = document.getElementById("top-links");
        var ranked = stats ? stats.topLinks : [];
        if (ranked.length === 0) {
            ranked = links.slice(0, 4).map(function (link) {
                return { title: link.title, url: link.url, icon: link.icon, clicks: 0 };
            });
        }
        topList.innerHTML = ranked.slice(0, 4).map(function (link) {
            return '<div class="dash-top-link"><span class="dash-link-thumb">' + iconSvg(link.icon) +
                "</span><div><strong>" + escapeHtml(link.title) +
                "</strong><small>" + link.clicks.toLocaleString() + " clicks</small></div></div>";
        }).join("");
    }

    // --- F7/F11/F13/F15: link list rendering --------------------------------
    // Renders each link card with its group label and schedule/countdown/embed badges.
    function renderLinks(filterValue) {
        var list = document.getElementById("link-card-list");
        var filter = (filterValue || "").toLowerCase().trim();
        var count = 0;

        list.innerHTML = links.map(function (link, index) {
            if (filter && link.title.toLowerCase().indexOf(filter) === -1 && link.url.toLowerCase().indexOf(filter) === -1) {
                return "";
            }
            count += 1;
            var linkBadges = "";
            if (link.countdown) {
                linkBadges += '<span class="dash-badge is-countdown">Countdown</span>';
            } else {
                var linkSchedule = scheduleInfo(link);
                if (linkSchedule && !linkSchedule.visible) {
                    linkBadges += '<span class="dash-badge">Scheduled</span>';
                }
            }
            if (link.embed) {
                linkBadges += '<span class="dash-badge is-embed">Embed</span>';
            }
            return (
                '<div class="dash-link-card' + (link.enabled ? "" : " is-off") + '" data-index="' + index + '">' +
                '<svg class="material-icon dash-drag" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="' + icons.drag_indicator + '"/></svg>' +
                '<span class="dash-link-thumb">' + iconSvg(link.icon) +
                " </span><div class=\"dash-link-meta\"><strong>" + escapeHtml(link.title) + linkBadges +
                "</strong><small>" + escapeHtml(link.url) + "</small>" +
                (link.group && link.group !== "General" ? '<span class="dash-group-label">' + escapeHtml(link.group) + "</span>" : "") +
                "</div>" +
                '<button class="dash-action-move" type="button" data-move="up" aria-label="Move link up">' + iconSvg("arrow_upward") + "</button>" +
                '<button class="dash-action-move" type="button" data-move="down" aria-label="Move link down">' + iconSvg("arrow_downward") + "</button>" +
                '<span class="dash-toggle' + (link.enabled ? " is-on" : "") + '" role="switch" aria-checked="' + link.enabled + '" tabindex="0" aria-label="Toggle ' + escapeHtml(link.title) + '"></span>' +
                '<div class="dash-actions">' +
                '<button class="dash-action-btn" type="button" aria-label="Link actions" aria-expanded="false">' + iconSvg("more_horiz") + "</button>" +
                '<div class="dash-action-menu" hidden>' +
                '<button type="button" data-action="edit">' + iconSvg("edit") + " Edit</button>" +
                '<button type="button" data-action="duplicate">Duplicate</button>' +
                '<button type="button" data-action="delete">' + iconSvg("delete") + " Delete</button>" +
                "</div></div></div>"
            );
        }).join("");

        document.getElementById("links-count-label").textContent = count + (count === 1 ? " link" : " links");
    }

    function saveLinks(message) {
        persistPage();
        syncPreview();
        if (message) {
            toast(message);
        }
    }

    var editingIndex = -1;

    function syncLinkOptionalFields() {
        var visibilityMode = document.getElementById("link-visibility-mode");
        var countdownMode = document.getElementById("link-countdown-mode");
        var scheduleFields = document.getElementById("link-schedule-fields");
        var countdownFields = document.getElementById("link-countdown-fields");

        if (visibilityMode && scheduleFields) {
            scheduleFields.hidden = visibilityMode.value !== "scheduled";
        }
        if (countdownMode && countdownFields) {
            countdownFields.hidden = countdownMode.value !== "countdown";
        }
    }

    function openModal(isEdit) {
        var title = document.getElementById("link-title");
        var url = document.getElementById("link-url");
        var icon = document.getElementById("link-icon");
        var enabled = document.getElementById("link-enabled");
        var message = document.getElementById("link-message");
        var heading = document.getElementById("link-modal-title");
        var group = document.getElementById("link-group");
        var scheduleStart = document.getElementById("link-schedule-start");
        var scheduleEnd = document.getElementById("link-schedule-end");
        var countdown = document.getElementById("link-countdown");
        var embed = document.getElementById("link-embed");
        var visibilityMode = document.getElementById("link-visibility-mode");
        var countdownMode = document.getElementById("link-countdown-mode");
        var advancedOptions = document.getElementById("link-advanced-options");
        var undoEditsButton = document.getElementById("link-undo-edits");

        message.textContent = "";
        message.classList.remove("is-error", "is-success");
        editingIndex = isEdit ? parseInt(editingIndex, 10) : -1;
        undoEditsButton.hidden = !isEdit;

        document.getElementById("link-modal").hidden = false;
        refreshGroupOptions();

        if (isEdit) {
            var link = links[editingIndex];
            heading.textContent = "Edit link";
            title.value = link.title;
            url.value = link.url;
            icon.value = link.icon;
            enabled.classList.toggle("is-on", link.enabled);
            enabled.setAttribute("aria-checked", String(link.enabled));
            group.value = link.group && link.group !== "General" ? link.group : "";
            var schedule = link.schedule;
            scheduleStart.value = (schedule && schedule.start) || "";
            scheduleEnd.value = (schedule && schedule.end) || "";
            countdown.value = link.countdown || "";
            visibilityMode.value = schedule && (schedule.start || schedule.end) ? "scheduled" : "always";
            countdownMode.value = link.countdown ? "countdown" : "standard";
            embed.classList.toggle("is-on", !!link.embed);
            embed.setAttribute("aria-checked", String(!!link.embed));
            advancedOptions.open = Boolean(
                (link.group && link.group !== "General") ||
                visibilityMode.value === "scheduled" ||
                countdownMode.value === "countdown" ||
                link.embed
            );
        } else {
            heading.textContent = "Add new link";
            title.value = "";
            url.value = "";
            icon.value = "link";
            enabled.classList.add("is-on");
            enabled.setAttribute("aria-checked", "true");
            group.value = "";
            scheduleStart.value = "";
            scheduleEnd.value = "";
            countdown.value = "";
            visibilityMode.value = "always";
            countdownMode.value = "standard";
            embed.classList.remove("is-on");
            embed.setAttribute("aria-checked", "false");
            advancedOptions.open = false;
        }

        syncLinkOptionalFields();
        title.focus();
    }

    function closeModal() {
        document.getElementById("link-modal").hidden = true;
    }

    // --- F7/F11/F13/F15: link-modal save ------------------------------------
    // Reads group, schedule window, countdown and embed switches into the link model.
    function saveLinkFromModal(event) {
        event.preventDefault();
        var title = document.getElementById("link-title").value.trim();
        var url = document.getElementById("link-url").value.trim();
        var icon = document.getElementById("link-icon").value;
        var enabled = document.getElementById("link-enabled").classList.contains("is-on");
        var group = document.getElementById("link-group").value.trim() || "General";
        var scheduleStart = document.getElementById("link-schedule-start").value;
        var scheduleEnd = document.getElementById("link-schedule-end").value;
        var countdown = document.getElementById("link-countdown").value;
        var visibilityMode = document.getElementById("link-visibility-mode").value;
        var countdownMode = document.getElementById("link-countdown-mode").value;
        var embed = document.getElementById("link-embed").classList.contains("is-on");
        var validUrl = /^https?:\/\/.+\..+/.test(url);
        var message = document.getElementById("link-message");

        if (!title || !validUrl) {
            message.textContent = "Add a title and a full URL starting with http:// or https://";
            message.classList.add("is-error");
            return;
        }

        if (visibilityMode !== "scheduled") {
            scheduleStart = "";
            scheduleEnd = "";
        }
        if (countdownMode !== "countdown") {
            countdown = "";
        }

        if (visibilityMode === "scheduled" && !scheduleStart && !scheduleEnd) {
            message.textContent = "Choose a start time, an end time, or both for the scheduled window.";
            message.classList.add("is-error");
            document.getElementById("link-schedule-start").focus();
            return;
        }
        if (scheduleStart && scheduleEnd && new Date(scheduleStart).getTime() >= new Date(scheduleEnd).getTime()) {
            message.textContent = "The scheduled end must be later than the start.";
            message.classList.add("is-error");
            document.getElementById("link-schedule-end").focus();
            return;
        }
        if (countdownMode === "countdown" && !countdown) {
            message.textContent = "Choose when the countdown should end.";
            message.classList.add("is-error");
            document.getElementById("link-countdown").focus();
            return;
        }

        message.classList.remove("is-error");

        var nextLink = {
            title: title,
            url: url,
            icon: icon,
            enabled: enabled,
            group: group,
            schedule: (scheduleStart || scheduleEnd) ? { start: scheduleStart || null, end: scheduleEnd || null } : null,
            countdown: countdown || null,
            embed: embed
        };

        pushUndo(editingIndex >= 0 ? "link edit" : "new link");
        if (editingIndex >= 0) {
            links[editingIndex] = nextLink;
        } else {
            links.push(nextLink);
        }

        saveLinks(editingIndex >= 0 ? "Link updated." : "Link added.");
        renderLinks(document.getElementById("links-search").value);
        renderAnalytics();
        closeModal();
    }

    fillStaticIcons();
    renderProfileCard();
    renderPageMeta();
    renderLinks("");
    renderAnalytics();

    document.querySelectorAll(".dash-nav-item[data-panel]").forEach(function (button) {
        button.addEventListener("click", function () {
            var panel = button.getAttribute("data-panel");
            document.querySelectorAll(".dash-nav-item[data-panel]").forEach(function (item) { item.classList.toggle("is-active", item === button); });
            document.querySelectorAll(".dash-panel").forEach(function (section) { section.classList.toggle("is-active", section.getAttribute("data-panel") === panel); });
            var titles = { links: "Links", appearance: "Appearance", analytics: "Analytics", settings: "Settings" };
            document.querySelector(".dash-title h1").textContent = titles[panel] || "Links";
            document.querySelector(".dash-top-actions").hidden = panel !== "links";
        });
    });

    document.getElementById("links-search").addEventListener("input", function (event) {
        renderLinks(event.target.value);
    });

    document.getElementById("add-link-button").addEventListener("click", function () { editingIndex = -1; openModal(false); });
    document.getElementById("add-link-row").addEventListener("click", function () { editingIndex = -1; openModal(false); });

    document.getElementById("link-form").addEventListener("submit", saveLinkFromModal);
    document.getElementById("link-undo-edits").addEventListener("click", function () {
        if (editingIndex >= 0) {
            openModal(true);
            document.getElementById("link-message").textContent = "Your unsaved edits were reset.";
            document.getElementById("link-message").classList.add("is-success");
        }
    });
    document.getElementById("link-cancel").addEventListener("click", closeModal);
    document.getElementById("link-modal-close").addEventListener("click", closeModal);

    document.getElementById("link-modal").addEventListener("click", function (event) {
        if (event.target === this) {
            closeModal();
        }
    });

    var linkEnabledToggle = document.getElementById("link-enabled");
    linkEnabledToggle.addEventListener("click", function () {
        var on = linkEnabledToggle.classList.toggle("is-on");
        linkEnabledToggle.setAttribute("aria-checked", String(on));
    });
    linkEnabledToggle.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            linkEnabledToggle.click();
        }
    });

    var linkEmbedToggle = document.getElementById("link-embed");
    if (linkEmbedToggle) {
        linkEmbedToggle.addEventListener("click", function () {
            var on = linkEmbedToggle.classList.toggle("is-on");
            linkEmbedToggle.setAttribute("aria-checked", String(on));
        });
        linkEmbedToggle.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                linkEmbedToggle.click();
            }
        });
    }

    var linkVisibilityMode = document.getElementById("link-visibility-mode");
    var linkCountdownMode = document.getElementById("link-countdown-mode");
    if (linkVisibilityMode) {
        linkVisibilityMode.addEventListener("change", syncLinkOptionalFields);
    }
    if (linkCountdownMode) {
        linkCountdownMode.addEventListener("change", syncLinkOptionalFields);
    }

    var linkUrlInput = document.getElementById("link-url");
    var linkIconSelect = document.getElementById("link-icon");
    var linkTitleInput = document.getElementById("link-title");
    var linkDetectHint = document.getElementById("link-detect");
    if (linkUrlInput) {
        linkUrlInput.addEventListener("input", function () {
            if (!linkDetectHint) {
                return;
            }
            var detected = detectSocial(linkUrlInput.value);
            if (detected) {
                if (linkIconSelect && detected.icon) {
                    linkIconSelect.value = detected.icon;
                }
                if (linkTitleInput && !linkTitleInput.value.trim() && detected.title) {
                    linkTitleInput.value = detected.title;
                }
                linkDetectHint.textContent = "Detected: " + detected.label + " — icon set.";
                linkDetectHint.classList.add("is-on");
            } else {
                linkDetectHint.textContent = "";
                linkDetectHint.classList.remove("is-on");
            }
        });
    }

    document.getElementById("preview-button").addEventListener("click", function () {
        persistEditorState();
        if (previewFrame) {
            previewFrame.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
            previewFrame.focus({ preventScroll: true });
        }
    });
    var viewPage = document.querySelector(".dash-view-page");
    var previewOpenLink = document.querySelector(".dash-preview-head a");
    if (viewPage) {
        viewPage.setAttribute("href", "profile.html?page=" + encodeURIComponent(activePage.id));
        viewPage.addEventListener("click", function (event) {
            event.preventDefault();
            persistEditorState();
            window.location.href = "profile.html?page=" + encodeURIComponent(activePage.id);
        });
    }
    if (previewOpenLink) {
        previewOpenLink.setAttribute("href", "profile.html?page=" + encodeURIComponent(activePage.id));
        previewOpenLink.addEventListener("click", persistEditorState);
    }

    if (previewFrame) {
        previewFrame.setAttribute("src", "profile.html?page=" + encodeURIComponent(activePage.id));
        previewFrame.addEventListener("load", syncPreview);
    }

    window.addEventListener("message", function (event) {
        if (!previewFrame || event.source !== previewFrame.contentWindow || !event.data || event.data.type !== "biotrail:preview-request") {
            return;
        }
        syncPreview();
    });

    document.getElementById("link-card-list").addEventListener("click", function (event) {
        var card = event.target.closest(".dash-link-card");
        if (!card) {
            return;
        }
        var index = parseInt(card.getAttribute("data-index"), 10);

        var move = event.target.closest("[data-move]");
        if (move) {
            var direction = move.getAttribute("data-move");
            var swapTo = direction === "up" ? index - 1 : index + 1;
            if (swapTo >= 0 && swapTo < links.length) {
                pushUndo("link order change");
                var temp = links[index];
                links[index] = links[swapTo];
                links[swapTo] = temp;
                saveLinks();
                renderLinks(document.getElementById("links-search").value);
            }
            return;
        }

        var toggle = event.target.closest(".dash-toggle");
        if (toggle) {
            pushUndo("link visibility change");
            links[index].enabled = !links[index].enabled;
            saveLinks();
            renderLinks(document.getElementById("links-search").value);
            return;
        }

        var actionButton = event.target.closest(".dash-action-btn");
        if (actionButton) {
            document.querySelectorAll(".dash-action-menu").forEach(function (menu) { menu.hidden = true; });
            var menu = card.querySelector(".dash-action-menu");
            var willOpen = menu.hidden;
            menu.hidden = !willOpen;
            actionButton.setAttribute("aria-expanded", String(willOpen));
            return;
        }

        var action = event.target.closest("[data-action]");
        if (action) {
            var kind = action.getAttribute("data-action");
            card.querySelector(".dash-action-menu").hidden = true;
            if (kind === "edit") {
                editingIndex = index;
                openModal(true);
            } else if (kind === "duplicate") {
                pushUndo("link duplication");
                var copy = Object.assign({}, links[index], { enabled: true, title: links[index].title + " (copy)" });
                links.push(copy);
                saveLinks("Link duplicated.");
                renderLinks(document.getElementById("links-search").value);
            } else if (kind === "delete") {
                pushUndo("link deletion");
                links.splice(index, 1);
                saveLinks("Link deleted.");
                renderLinks(document.getElementById("links-search").value);
                renderAnalytics();
            }
        }
    });

    document.addEventListener("click", function (event) {
        if (!event.target.closest(".dash-actions")) {
            document.querySelectorAll(".dash-action-menu").forEach(function (menu) { menu.hidden = true; });
        }
    });

    document.querySelectorAll("[data-goto-settings]").forEach(function (button) {
        button.addEventListener("click", function () {
            populateProfileForm();
            renderPageMeta();
            document.querySelector('.dash-nav-item[data-panel="settings"]').click();
            document.getElementById("settings-name").focus();
        });
    });

    ["accent-swatches", "shape-options", "background-options", "bgfx-options"].forEach(function (groupId) {
        var group = document.getElementById(groupId);
        group.querySelectorAll("button").forEach(function (button) {
            button.addEventListener("click", function () {
                pushUndo("appearance change");
                group.querySelectorAll("button").forEach(function (item) { item.classList.remove("is-selected"); });
                button.classList.add("is-selected");
                if (groupId === "accent-swatches") {
                    theme.accent = button.getAttribute("data-accent");
                } else if (groupId === "shape-options") {
                    theme.shape = button.getAttribute("data-shape");
                } else if (groupId === "background-options") {
                    theme.bg = button.getAttribute("data-bg");
                } else {
                    theme.bgfx = button.getAttribute("data-bgfx");
                }
                persistPage();
                syncPreview();
                toast("Theme updated.");
            });
        });
    });

    // --- F8/F16: appearance options (bgfx, export, import) -------------------
    function applyThemeSelections() {
        document.querySelectorAll("#accent-swatches [data-accent='" + theme.accent + "']").forEach(function (button) { button.classList.add("is-selected"); });
        document.querySelectorAll("#shape-options [data-shape='" + theme.shape + "']").forEach(function (button) { button.classList.add("is-selected"); });
        document.querySelectorAll("#background-options [data-bg='" + theme.bg + "']").forEach(function (button) { button.classList.add("is-selected"); });
        document.querySelectorAll("#bgfx-options [data-bgfx='" + (theme.bgfx || "plain") + "']").forEach(function (button) { button.classList.add("is-selected"); });
    }
    applyThemeSelections();

    var THEME_ACCENTS = ["lime", "purple", "ink", "coral"];
    var THEME_SHAPES = ["pill", "rounded", "square"];
    var THEME_BGS = ["paper", "ink", "lime"];
    var THEME_BGFX = ["plain", "gradient", "waves", "dots", "aurora"];

    function sanitizeThemeValue(value, allowed, fallback) {
        return (allowed || []).indexOf(value) === -1 ? fallback : value;
    }

// --- F16: theme export / import (biotrail-theme.json) --------------------
    document.getElementById("theme-export").addEventListener("click", function () {
        var payload = { version: 1, theme: Object.assign({}, theme) };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        var link = document.createElement("a");
        link.download = "biotrail-theme.json";
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 0);
        toast("Theme exported.");
    });

    var themeImportInput = document.getElementById("theme-import");
    if (themeImportInput) {
        themeImportInput.addEventListener("change", function () {
            var file = themeImportInput.files && themeImportInput.files[0];
            if (!file) {
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                try {
                    var parsed = JSON.parse(String(reader.result || "{}"));
                    var imported = parsed && parsed.theme ? parsed.theme : parsed;
                    if (!imported || typeof imported !== "object") {
                        throw new Error("bad theme");
                    }
                    pushUndo("theme import");
                    if (imported.accent !== undefined) {
                        theme.accent = sanitizeThemeValue(imported.accent, THEME_ACCENTS, theme.accent);
                    }
                    if (imported.shape !== undefined) {
                        theme.shape = sanitizeThemeValue(imported.shape, THEME_SHAPES, theme.shape);
                    }
                    if (imported.bg !== undefined) {
                        theme.bg = sanitizeThemeValue(imported.bg, THEME_BGS, theme.bg);
                    }
                    if (imported.bgfx !== undefined) {
                        theme.bgfx = sanitizeThemeValue(imported.bgfx, THEME_BGFX, theme.bgfx);
                    }
                    document.querySelectorAll(".dash-swatches button.is-selected").forEach(function (button) { button.classList.remove("is-selected"); });
                    applyThemeSelections();
                    persistPage();
                    syncPreview();
                    toast("Theme imported.");
                } catch (error) {
                    toast("That file is not a valid BioTrail theme.");
                }
                themeImportInput.value = "";
            };
            reader.readAsText(file);
        });
    }

    function fieldValue(id) {
        return document.getElementById(id).value.trim();
    }

    function readProfileFromForm() {
        var name = fieldValue("settings-name");
        var username = fieldValue("settings-username").toLowerCase();
        var role = fieldValue("settings-role");
        var bio = fieldValue("settings-bio");
        profile.name = name || profile.name;
        profile.username = username || profile.username;
        profile.role = role || profile.role;
        profile.bio = bio || profile.bio;
    }

    function populateProfileForm() {
        document.getElementById("settings-name").value = profile.name;
        document.getElementById("settings-username").value = profile.username;
        document.getElementById("settings-role").value = profile.role;
        document.getElementById("settings-bio").value = profile.bio;
        document.getElementById("settings-url-hint").textContent = "biotrail.me/" + profile.username;
    }

    function ensureSettingsUndo() {
        if (!settingsUndoCaptured) {
            pushUndo("profile and page changes");
            settingsUndoCaptured = true;
        }
    }

    ["settings-name", "settings-username", "settings-role", "settings-bio"].forEach(function (id) {
        document.getElementById(id).addEventListener("input", function () {
            ensureSettingsUndo();
            document.getElementById("settings-message").textContent = "";
            document.getElementById("settings-message").className = "auth-message";
            readProfileFromForm();
            renderProfileCard();
            persistEditorState();
        });
    });

    var avatarUpload = document.getElementById("avatar-upload");
    var avatarRemoveButton = document.getElementById("avatar-remove");
    if (avatarUpload) {
        avatarUpload.addEventListener("change", function () {
            var file = avatarUpload.files && avatarUpload.files[0];
            if (!file) {
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                toast("Image must be under 2MB.");
                avatarUpload.value = "";
                return;
            }
            if (!/^image\/(png|jpe?g|gif|webp)$/i.test(file.type)) {
                toast("Please choose a JPG, PNG, GIF or WebP image.");
                avatarUpload.value = "";
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                pushUndo("profile picture change");
                profile.avatar = String(reader.result || "");
                renderProfileCard();
                persistEditorState();
                toast("Profile picture updated.");
            };
            reader.readAsDataURL(file);
        });
        if (avatarRemoveButton) {
            avatarRemoveButton.addEventListener("click", function () {
                if (!profile.avatar) {
                    return;
                }
                pushUndo("profile picture removal");
                profile.avatar = null;
                avatarUpload.value = "";
                renderProfileCard();
                persistEditorState();
                toast("Profile picture removed.");
            });
        }
    }

    ["settings-page-name", "settings-page-handle"].forEach(function (id) {
        document.getElementById(id).addEventListener("input", function () {
            ensureSettingsUndo();
            var name = fieldValue("settings-page-name");
            var handle = fieldValue("settings-page-handle").toLowerCase();
            activePage.title = name || activePage.title;
            activePage.handle = handle || activePage.handle;
            document.getElementById("settings-page-hint").textContent = "biotrail.me/" + (activePage.handle || "");
            renderProfileCard();
            document.querySelector(".dash-kicker").textContent = "Page · " + (activePage.title || "Untitled");
            persistEditorState();
        });
    });

    document.getElementById("settings-form").addEventListener("submit", function (event) {
        event.preventDefault();
        var message = document.getElementById("settings-message");

        message.classList.remove("is-error");
        message.classList.remove("is-success");

        var priorUserName = profile.username.toLowerCase();
        readProfileFromForm();

        if (!profile.name) {
            message.textContent = "Please add a display name.";
            message.classList.add("is-error");
            return;
        }
        if (!/^[a-z0-9_-]{3,20}$/.test(profile.username)) {
            message.textContent = "Username must be 3–20 letters, numbers, underscores or hyphens.";
            message.classList.add("is-error");
            return;
        }

        var pageName = fieldValue("settings-page-name");
        var pageHandle = fieldValue("settings-page-handle").toLowerCase();
        if (!pageName) {
            message.textContent = "Please add a page name.";
            message.classList.add("is-error");
            return;
        }
        if (!/^[a-z0-9_-]{3,20}$/.test(pageHandle)) {
            message.textContent = "Page address must be 3–20 letters, numbers, underscores or hyphens.";
            message.classList.add("is-error");
            return;
        }
        var clash = pages.some(function (page) {
            return page.id !== activePage.id && String(page.handle).toLowerCase() === pageHandle;
        });
        if (clash) {
            message.textContent = "That page address is already taken on your account.";
            message.classList.add("is-error");
            return;
        }

        activePage.title = pageName;
        activePage.handle = pageHandle === priorUserName ? profile.username.toLowerCase() : pageHandle;
        activePage.theme = theme;

        persistEditorState();
        renderProfileCard();
        renderPageMeta();
        message.textContent = "Saved! Your page/profile have been updated.";
        message.classList.add("is-success");
        settingsUndoCaptured = false;
        toast("Saved.");
    });

    populateProfileForm();

    var requestedPanel = params.get("panel");
    var requestedPanelButton = document.querySelector('.dash-nav-item[data-panel="' + requestedPanel + '"]');
    if (requestedPanelButton) {
        requestedPanelButton.click();
        if (requestedPanel === "settings") {
            document.getElementById("settings-name").focus();
        }
    }
    document.body.classList.remove("dash-loading");

    // --- F4: QR trail card ------------------------------------------------

    var THEME_COLORS = { lime: "#d8ff32", purple: "#7c42f5", ink: "#1e1e1e", coral: "#ff7a59" };

    function roundRectPath(ctx, x, y, width, height, radius) {
        radius = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.arcTo(x + width, y, x + width, y + radius, radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
        ctx.lineTo(x + radius, y + height);
        ctx.arcTo(x, y + height, x, y + height - radius, radius);
        ctx.lineTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.closePath();
    }

    function fitText(ctx, text, maxWidth) {
        var value = String(text || "").trim();
        if (ctx.measureText(value).width <= maxWidth) {
            return value;
        }
        while (value.length > 1) {
            value = value.slice(0, -1);
            if (ctx.measureText(value + "\u2026").width <= maxWidth) {
                return value + "\u2026";
            }
        }
        return value;
    }

    function trailCardColors() {
        var bg = theme.bg || "paper";
        var accent = theme.accent || "lime";
        var bgCol = bg === "ink" ? "#1e1e1e" : (bg === "lime" ? "#d8ff32" : "#ffffff");
        var textCol = bg === "ink" ? "#ffffff" : "#1e1e1e";
        var softCol = bg === "ink" ? "rgba(255,255,255,0.64)" : "rgba(30,30,30,0.62)";
        var accentCol = THEME_COLORS[accent] || "#1e1e1e";
        if (bg === "ink" && accentCol === "#1e1e1e") {
            accentCol = "#d8ff32";
        }
        if (bg !== "ink" && accentCol === "#d8ff32") {
            accentCol = "#1e1e1e";
        }
        return { bg: bgCol, text: textCol, soft: softCol, accent: accentCol };
    }

    var trailCardCanvas = document.getElementById("trail-card-canvas");

    function cardHandle() {
        return String(activePage.handle || profile.username || "mytrail").toLowerCase();
    }

    function profileShareUrl() {
        if (/^https?:$/.test(window.location.protocol)) {
            var profileUrl = new URL("profile.html", window.location.href);
            profileUrl.search = "";
            profileUrl.hash = "";
            profileUrl.searchParams.set("page", activePageId);
            return profileUrl.href;
        }
        return "https://biotrail.me/" + cardHandle();
    }

    function trailShareText() {
        return "Visit " + (profile.name || activePage.title || "my") + " BioTrail page";
    }

    function renderTrailCard() {
        if (!trailCardCanvas) {
            return;
        }
        var ctx = trailCardCanvas.getContext("2d");
        var colors = trailCardColors();
        var handle = cardHandle();
        var qr = window.bioTrailQR ? window.bioTrailQR.make(profileShareUrl()) : null;

        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, 900, 540);
        ctx.fillStyle = colors.accent;
        ctx.fillRect(0, 0, 14, 540);

        var plateX = 448;
        var plateY = 60;
        var plateSize = 430;
        ctx.fillStyle = "#ffffff";
        roundRectPath(ctx, plateX, plateY, plateSize, plateSize, 26);
        ctx.fill();

        if (qr) {
            var pad = 32;
            var draw = plateSize - pad * 2;
            var moduleSize = Math.floor(draw / qr.size);
            var offsetX = plateX + pad + Math.floor((draw - (moduleSize * qr.size)) / 2);
            var offsetY = plateY + pad + Math.floor((draw - (moduleSize * qr.size)) / 2);
            ctx.fillStyle = "#1e1e1e";
            for (var row = 0; row < qr.size; row += 1) {
                for (var col = 0; col < qr.size; col += 1) {
                    if (qr.modules[row][col]) {
                        ctx.fillRect(offsetX + (col * moduleSize), offsetY + (row * moduleSize), moduleSize, moduleSize);
                    }
                }
            }
        } else {
            ctx.fillStyle = "#1e1e1e";
            ctx.font = "700 22px 'Plus Jakarta Sans', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("biotrail.me/" + handle, plateX + plateSize / 2, plateY + plateSize / 2);
            ctx.textAlign = "left";
        }

        var name = fitText(ctx, profile.name || activePage.title || "BioTrail creator", 340);
        var role = fitText(ctx, profile.role || "Creative director & storyteller", 340);

        var initials = name.trim().split(/\s+/).map(function (word) { return word.charAt(0); }).join("").slice(0, 2).toUpperCase();
        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.arc(104, 118, 44, 0, Math.PI * 2);
        ctx.fill();
        if (profile.avatar) {
            try {
                var avatarImg = new Image();
                avatarImg.onload = function () {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(104, 118, 44, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(avatarImg, 60, 74, 88, 88);
                    ctx.restore();
                    renderTrailCardText(ctx, colors, name, role, handle);
                };
                avatarImg.src = profile.avatar;
            } catch (error) {
                renderTrailCardText(ctx, colors, name, role, handle);
            }
        } else {
            ctx.fillStyle = colors.accent === "#d8ff32" ? "#1e1e1e" : "#ffffff";
            ctx.font = "700 30px 'Plus Jakarta Sans', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(initials, 104, 126);
            ctx.textAlign = "left";
            renderTrailCardText(ctx, colors, name, role, handle);
        }
    }

    function renderTrailCardText(ctx, colors, name, role, handle) {
        ctx.fillStyle = colors.text;
        ctx.font = "700 42px 'Plus Jakarta Sans', sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(name, 60, 242);

        ctx.fillStyle = colors.soft;
        ctx.font = "500 20px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText(role, 60, 272);

        ctx.fillStyle = colors.accent;
        roundRectPath(ctx, 60, 292, 90, 6, 3);
        ctx.fill();

        ctx.font = "700 26px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText("biotrail.me/" + handle, 60, 340);

        ctx.fillStyle = colors.soft;
        ctx.font = "600 15px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText("SCAN TO OPEN MY BIOTRAIL PAGE", 60, 384);

        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.arc(64, 490, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colors.text;
        ctx.font = "700 20px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText("BioTrail", 82, 497);
    }

    var trailCardModal = document.getElementById("trail-card-modal");

    function openTrailCardModal() {
        renderTrailCard();
        document.getElementById("trail-card-message").textContent = "";
        updateSocialShareLinks();
        trailCardModal.hidden = false;
    }

    function closeTrailCardModal() {
        if (trailCardModal) {
            trailCardModal.hidden = true;
        }
    }

    var trailCardOpen = document.getElementById("trail-card-open");
    if (trailCardOpen) {
        trailCardOpen.addEventListener("click", openTrailCardModal);
    }
    var trailCardClose = document.getElementById("trail-card-modal-close");
    if (trailCardClose) {
        trailCardClose.addEventListener("click", closeTrailCardModal);
    }
    var trailCardCancel = document.getElementById("trail-card-cancel");
    if (trailCardCancel) {
        trailCardCancel.addEventListener("click", closeTrailCardModal);
    }
    if (trailCardModal) {
        trailCardModal.addEventListener("click", function (event) {
            if (event.target === this) {
                closeTrailCardModal();
            }
        });
    }
    function setTrailCardMessage(message, isError) {
        var messageElement = document.getElementById("trail-card-message");
        if (!messageElement) {
            return;
        }
        messageElement.textContent = message;
        messageElement.classList.toggle("is-error", Boolean(isError));
        messageElement.classList.toggle("is-success", !isError && Boolean(message));
    }

    function copyText(value) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(value);
        }

        return new Promise(function (resolve, reject) {
            var input = document.createElement("textarea");
            input.value = value;
            input.setAttribute("readonly", "");
            input.style.position = "fixed";
            input.style.opacity = "0";
            document.body.appendChild(input);
            input.select();
            try {
                if (!document.execCommand("copy")) {
                    throw new Error("Copy was not available");
                }
                resolve();
            } catch (error) {
                reject(error);
            }
            document.body.removeChild(input);
        });
    }

    function downloadTrailCard() {
        if (!trailCardCanvas || !window.bioTrailQR) {
            return false;
        }
        try {
            var link = document.createElement("a");
            link.download = "biotrail-" + cardHandle() + "-card.png";
            link.href = trailCardCanvas.toDataURL("image/png");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast("Card downloaded.");
            return true;
        } catch (error) {
            toast("Could not download the card.");
            return false;
        }
    }

    function updateSocialShareLinks() {
        var url = profileShareUrl();
        var text = trailShareText();
        var shareUrls = {
            whatsapp: "https://wa.me/?text=" + encodeURIComponent(text + " " + url),
            facebook: "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url),
            x: "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url),
            linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(url)
        };

        document.querySelectorAll("[data-share-social]").forEach(function (link) {
            link.href = shareUrls[link.getAttribute("data-share-social")] || url;
        });
    }

    var trailLinkCopy = document.getElementById("trail-link-copy");
    if (trailLinkCopy) {
        trailLinkCopy.addEventListener("click", function () {
            copyText(profileShareUrl()).then(function () {
                setTrailCardMessage("Profile link copied.", false);
                toast("Link copied.");
            }).catch(function () {
                setTrailCardMessage("Could not copy the link. Select and copy it from your browser instead.", true);
            });
        });
    }

    var trailLinkShare = document.getElementById("trail-link-share");
    if (trailLinkShare) {
        trailLinkShare.addEventListener("click", function () {
            if (!navigator.share) {
                copyText(profileShareUrl()).then(function () {
                    setTrailCardMessage("Sharing is not available in this browser, so the link was copied instead.", false);
                }).catch(function () {
                    setTrailCardMessage("Use one of the social buttons below to share your link.", false);
                });
                return;
            }

            navigator.share({
                title: (profile.name || "My") + " BioTrail",
                text: trailShareText(),
                url: profileShareUrl()
            }).then(function () {
                setTrailCardMessage("Link shared.", false);
            }).catch(function (error) {
                if (!error || error.name !== "AbortError") {
                    setTrailCardMessage("The share menu could not be opened.", true);
                }
            });
        });
    }

    var trailCardShare = document.getElementById("trail-card-share");
    if (trailCardShare) {
        trailCardShare.addEventListener("click", function () {
            if (!trailCardCanvas || !trailCardCanvas.toBlob) {
                setTrailCardMessage("Image sharing is not available in this browser.", true);
                return;
            }

            trailCardCanvas.toBlob(function (blob) {
                if (!blob) {
                    setTrailCardMessage("The QR card image could not be prepared.", true);
                    return;
                }

                if (typeof File !== "function") {
                    if (downloadTrailCard()) {
                        setTrailCardMessage("Your browser cannot share image files directly, so the QR card was downloaded instead.", false);
                    }
                    return;
                }

                var file = new File([blob], "biotrail-" + cardHandle() + "-card.png", { type: "image/png" });
                var shareData = {
                    title: (profile.name || "My") + " BioTrail QR card",
                    text: trailShareText(),
                    files: [file]
                };

                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    navigator.share(shareData).then(function () {
                        setTrailCardMessage("QR card shared.", false);
                    }).catch(function (error) {
                        if (!error || error.name !== "AbortError") {
                            setTrailCardMessage("The QR card could not be shared.", true);
                        }
                    });
                    return;
                }

                if (downloadTrailCard()) {
                    setTrailCardMessage("Your browser cannot share image files directly, so the QR card was downloaded instead.", false);
                }
            }, "image/png");
        });
    }

    var trailCardDownload = document.getElementById("trail-card-download");
    if (trailCardDownload) {
        trailCardDownload.addEventListener("click", function () {
            downloadTrailCard();
        });
    }

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeModal();
            closeTrailCardModal();
            document.querySelectorAll(".dash-action-menu").forEach(function (menu) { menu.hidden = true; });
        }
    });
})();
