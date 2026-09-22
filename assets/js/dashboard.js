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

    stashSet("biotrail_profile", profile);

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

    function activeLinks() {
        return links.filter(function (link) { return link.enabled; }).length;
    }

    function clickCountFor(index) {
        var bases = [187, 129, 96, 74, 61, 53, 48, 40, 34];
        return bases[index % bases.length];
    }

    // Interactive seven-day line chart inspired by the NJC Global chart treatment.
    function renderLineChart(totalViews) {
        var chart = document.getElementById("analytics-line-chart");
        var days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        var weights = [0.10, 0.13, 0.12, 0.145, 0.127, 0.175, 0.203];
        var values = weights.map(function (weight) { return Math.round(totalViews * weight); });
        var difference = totalViews - values.reduce(function (sum, value) { return sum + value; }, 0);
        values[values.length - 1] += difference;

        var width = 620;
        var baseline = 198;
        var top = 38;
        var startX = 48;
        var step = 88;
        var maxValue = Math.ceil(Math.max.apply(null, values) / 50) * 50;
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
        var views = 1284 + activeLinks() * 40;
        var clicks = 508 + activeLinks() * 18;
        document.getElementById("stat-views").textContent = views.toLocaleString();
        document.getElementById("stat-clicks").textContent = clicks.toLocaleString();
        document.getElementById("stat-ctr").textContent = Math.round((clicks / views) * 1000) / 10 + "%";
        renderLineChart(views);

        var topList = document.getElementById("top-links");
        topList.innerHTML = links.slice(0, 4).map(function (link, index) {
            return '<div class="dash-top-link"><span class="dash-link-thumb">' + iconSvg(link.icon) +
                "</span><div><strong>" + escapeHtml(link.title) +
                '</strong><small>' + clickCountFor(index) + " clicks</small></div></div>";
        }).join("");
    }

    function renderLinks(filterValue) {
        var list = document.getElementById("link-card-list");
        var filter = (filterValue || "").toLowerCase().trim();
        var count = 0;

        list.innerHTML = links.map(function (link, index) {
            if (filter && link.title.toLowerCase().indexOf(filter) === -1 && link.url.toLowerCase().indexOf(filter) === -1) {
                return "";
            }
            count += 1;
            return (
                '<div class="dash-link-card' + (link.enabled ? "" : " is-off") + '" data-index="' + index + '">' +
                '<svg class="material-icon dash-drag" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="' + icons.drag_indicator + '"/></svg>' +
                '<span class="dash-link-thumb">' + iconSvg(link.icon) +
                " </span><div class=\"dash-link-meta\"><strong>" + escapeHtml(link.title) +
                "</strong><small>" + escapeHtml(link.url) + "</small></div>" +
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

    function openModal(isEdit) {
        var title = document.getElementById("link-title");
        var url = document.getElementById("link-url");
        var icon = document.getElementById("link-icon");
        var enabled = document.getElementById("link-enabled");
        var message = document.getElementById("link-message");
        var heading = document.getElementById("link-modal-title");

        message.textContent = "";
        editingIndex = isEdit ? parseInt(editingIndex, 10) : -1;

        document.getElementById("link-modal").hidden = false;

        if (isEdit) {
            var link = links[editingIndex];
            heading.textContent = "Edit link";
            title.value = link.title;
            url.value = link.url;
            icon.value = link.icon;
            enabled.classList.toggle("is-on", link.enabled);
            enabled.setAttribute("aria-checked", String(link.enabled));
        } else {
            heading.textContent = "Add new link";
            title.value = "";
            url.value = "";
            icon.value = "link";
            enabled.classList.add("is-on");
            enabled.setAttribute("aria-checked", "true");
        }

        title.focus();
    }

    function closeModal() {
        document.getElementById("link-modal").hidden = true;
    }

    function saveLinkFromModal(event) {
        event.preventDefault();
        var title = document.getElementById("link-title").value.trim();
        var url = document.getElementById("link-url").value.trim();
        var icon = document.getElementById("link-icon").value;
        var enabled = document.getElementById("link-enabled").classList.contains("is-on");
        var validUrl = /^https?:\/\/.+\..+/.test(url);
        var message = document.getElementById("link-message");

        if (!title || !validUrl) {
            message.textContent = "Add a title and a full URL starting with http:// or https://";
            message.classList.add("is-error");
            return;
        }

        message.classList.remove("is-error");

        if (editingIndex >= 0) {
            links[editingIndex] = { title: title, url: url, icon: icon, enabled: enabled };
        } else {
            links.push({ title: title, url: url, icon: icon, enabled: enabled });
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
                var copy = Object.assign({}, links[index], { enabled: true, title: links[index].title + " (copy)" });
                links.push(copy);
                saveLinks("Link duplicated.");
                renderLinks(document.getElementById("links-search").value);
            } else if (kind === "delete") {
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

    ["accent-swatches", "shape-options", "background-options"].forEach(function (groupId) {
        var group = document.getElementById(groupId);
        group.querySelectorAll("button").forEach(function (button) {
            button.addEventListener("click", function () {
                group.querySelectorAll("button").forEach(function (item) { item.classList.remove("is-selected"); });
                button.classList.add("is-selected");
                if (groupId === "accent-swatches") {
                    theme.accent = button.getAttribute("data-accent");
                } else if (groupId === "shape-options") {
                    theme.shape = button.getAttribute("data-shape");
                } else {
                    theme.bg = button.getAttribute("data-bg");
                }
                persistPage();
                syncPreview();
                toast("Theme updated.");
            });
        });
    });

    function applyThemeSelections() {
        document.querySelectorAll("#accent-swatches [data-accent='" + theme.accent + "']").forEach(function (button) { button.classList.add("is-selected"); });
        document.querySelectorAll("#shape-options [data-shape='" + theme.shape + "']").forEach(function (button) { button.classList.add("is-selected"); });
        document.querySelectorAll("#background-options [data-bg='" + theme.bg + "']").forEach(function (button) { button.classList.add("is-selected"); });
    }
    applyThemeSelections();

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

    ["settings-name", "settings-username", "settings-role", "settings-bio"].forEach(function (id) {
        document.getElementById(id).addEventListener("input", function () {
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

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeModal();
            document.querySelectorAll(".dash-action-menu").forEach(function (menu) { menu.hidden = true; });
        }
    });
})();
