(function () {
    "use strict";

    function isLoggedIn() {
        try {
            var session = localStorage.getItem("biotrail_session");
            if (session === null && localStorage.getItem("biotrail_profile")) {
                localStorage.setItem("biotrail_session", "active");
                session = "active";
            }
            return session === "active";
        } catch (error) {
            return false;
        }
    }

    if (!isLoggedIn()) {
        return;
    }

    document.querySelectorAll("a.brand, a.live-brand, a.dash-brand").forEach(function (link) {
        var href = link.getAttribute("href") || "";
        if (href.indexOf("index.html") !== -1) {
            link.setAttribute("href", href.indexOf("../") === 0 ? "../app/pages.html" : "app/pages.html");
        }
    });

    document.querySelectorAll("[data-signout]").forEach(function (button) {
        button.addEventListener("click", function () {
            localStorage.setItem("biotrail_session", "signed_out");
            window.location.href = button.getAttribute("data-signout-url") || "index.html";
        });
    });

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
        });
    }

    function profileInitials(value) {
        return value.trim().split(/\s+/).map(function (word) { return word.charAt(0); }).join("").slice(0, 2).toUpperCase();
    }

    var authProfile = {};
    try {
        authProfile = JSON.parse(localStorage.getItem("biotrail_profile") || "{}") || {};
    } catch (error) {
        authProfile = {};
    }
    var accountName = authProfile.name || "My account";
    var pageIsInView = window.location.pathname.indexOf("/view/") !== -1;
    var dashHref = pageIsInView ? "../app/pages.html" : "app/pages.html";
    var avatarHtml = authProfile.avatar
        ? '<img src="' + authProfile.avatar + '" alt="">'
        : "<span>" + profileInitials(accountName) + "</span>";

    document.querySelectorAll(".nav-actions").forEach(function (actions) {
        var loginLink = actions.querySelector('a[href$="login.html"]');
        if (!loginLink) {
            return;
        }
        actions.innerHTML =
            '<a class="button button-dark" href="' + dashHref + '">My dashboard</a>' +
            '<a class="nav-account" href="' + dashHref + '" aria-label="' + escapeHtml(accountName) + ' - open your dashboard">' +
            '<span class="nav-account-avatar">' + avatarHtml + "</span>" +
            '<span class="nav-account-name">' + escapeHtml(accountName) + "</span></a>";
    });

    document.querySelectorAll('.page-actions a[href$="signup.html"]').forEach(function (link) {
        link.setAttribute("href", dashHref);
        link.textContent = "Go to your dashboard";
    });

    var activePlan = null;
    try {
        activePlan = JSON.parse(localStorage.getItem("biotrail_plan") || "null");
    } catch (error) {
        activePlan = null;
    }

    if (activePlan && activePlan.plan && activePlan.plan !== "free") {
        var planNames = { starter: "Starter", pro: "Pro" };
        var planName = planNames[activePlan.plan] ||
            activePlan.plan.charAt(0).toUpperCase() + activePlan.plan.slice(1);

        document.querySelectorAll(".dash-plan").forEach(function (link) {
            var label = link.querySelector("span");
            var note = link.querySelector("small");
            if (label) {
                label.textContent = planName + " plan";
            }
            if (note) {
                note.textContent = "Manage";
            }
        });
    }
})();
