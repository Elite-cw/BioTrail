(function () {
    "use strict";

    var icons = window.bioTrailDashIcons || {};
    var account = window.bioTrailAccount;

    function iconSvg(name) {
        return '<svg class="material-icon" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="' + (icons[name] || "") + '"/></svg>';
    }

    function fillStaticIcons() {
        document.querySelectorAll("[data-icon]").forEach(function (svg) {
            var name = svg.getAttribute("data-icon");
            if (icons[name]) {
                svg.innerHTML = '<path d="' + icons[name] + '"/>';
            }
        });
    }

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>"]/g, function (char) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char];
        });
    }

    function initials(value) {
        return value.trim().split(/\s+/).map(function (word) { return word.charAt(0); }).join("").slice(0, 2).toUpperCase();
    }

    // Custom confirmation flow for deleting a page.
    var pendingDeleteId = null;

    function openDeleteModal(page) {
        pendingDeleteId = page.id;
        document.getElementById("delete-page-name").textContent = page.title || "Untitled";
        document.getElementById("delete-page-modal").hidden = false;
        document.getElementById("confirm-page-delete").focus();
    }

    function closeDeleteModal() {
        pendingDeleteId = null;
        document.getElementById("delete-page-modal").hidden = true;
    }

    function render() {
        var pages = account.getPages();
        var profile = {};
        try {
            profile = JSON.parse(localStorage.getItem("biotrail_profile") || "{}") || {};
        } catch (error) {
            profile = {};
        }

        var list = document.getElementById("pages-grid");
        var count = document.getElementById("pages-count-label");
        count.textContent = pages.length + (pages.length === 1 ? " page" : " pages");

        var pagesAvatar = document.getElementById("pages-avatar");
        if (profile.avatar) {
            pagesAvatar.innerHTML = '<img src="' + profile.avatar + '" alt="">';
        } else {
            pagesAvatar.textContent = initials(profile.name || "BioTrail");
        }
        document.getElementById("pages-display-name").textContent = profile.name || "BioTrail creator";
        document.getElementById("pages-handle-name").textContent = profile.username || "mytrail";

        list.innerHTML = pages.map(function (page) {
            var enabled = page.links.filter(function (link) { return link.enabled; }).length;
            var total = page.links.length;
            return (
                '<article class="dash-page-card" data-id="' + page.id + '">' +
                '<div class="dash-page-card-head">' +
                '<span class="dash-page-thumb">' + iconSvg("link") + "</span>" +
                '<div class="dash-page-meta">' +
                "<strong>" + escapeHtml(page.title || "Untitled") + "</strong>" +
                '<small>biotrail.me/' + escapeHtml(page.handle) + "</small>" +
                '</div><span class="dash-accent-dot accent-' + escapeHtml(page.theme.accent || "lime") + '" aria-hidden="true"></span>' +
                "</div>" +
                '<p class="dash-page-stats">' + enabled + " of " + total + " links enabled</p>" +
                '<div class="dash-page-actions">' +
                '<a class="dash-page-btn" href="dashboard.html?page=' + encodeURIComponent(page.id) + '">' + iconSvg("edit") + " Edit</a>" +
                '<a class="dash-page-btn" href="profile.html?page=' + encodeURIComponent(page.id) + '">' + iconSvg("visibility") + " View</a>" +
                '<button class="dash-page-btn is-danger" type="button" data-delete="' + page.id + '" aria-label="Delete ' + escapeHtml(page.title) + '">' + iconSvg("delete") + "</button>" +
                "</div></article>"
            );
        }).join("") +
            '<button class="dash-new-page" type="button" id="new-page-card">' +
            iconSvg("add") + "Create a new page</button>";
    }

    document.getElementById("new-page-button").addEventListener("click", function () {
        window.location.href = "dashboard.html?new=1";
    });

    document.getElementById("pages-grid").addEventListener("click", function (event) {
        var cardButton = event.target.closest("#new-page-card");
        if (cardButton) {
            window.location.href = "dashboard.html?new=1";
            return;
        }
        var deleteButton = event.target.closest("[data-delete]");
        if (deleteButton) {
            var id = deleteButton.getAttribute("data-delete");
            var page = account.findPage({ id: id });
            if (page) {
                openDeleteModal(page);
            }
        }
    });

    document.getElementById("cancel-page-delete").addEventListener("click", closeDeleteModal);
    document.getElementById("delete-page-modal-close").addEventListener("click", closeDeleteModal);
    document.getElementById("confirm-page-delete").addEventListener("click", function () {
        if (pendingDeleteId) {
            account.removePage(pendingDeleteId);
            render();
        }
        closeDeleteModal();
    });
    document.getElementById("delete-page-modal").addEventListener("click", function (event) {
        if (event.target === this) {
            closeDeleteModal();
        }
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeDeleteModal();
        }
    });

    fillStaticIcons();
    render();
})();
