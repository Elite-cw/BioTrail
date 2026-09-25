(function () {
    "use strict";

    function setupBackToTop() {
        if (!document.body || document.querySelector(".back-to-top")) {
            return;
        }

        var button = document.createElement("button");
        button.className = "back-to-top";
        button.type = "button";
        button.hidden = true;
        button.setAttribute("aria-label", "Back to top");
        button.setAttribute("title", "Back to top");
        button.innerHTML =
            '<svg class="back-to-top-icon" viewBox="0 -960 960 960" aria-hidden="true" focusable="false">' +
            '<path d="m240-400 240-240 240 240-56 56-144-144v368h-80v-368L296-344l-56-56Z"/></svg>' +
            '<span>Back to top</span>';
        document.body.appendChild(button);

        var ticking = false;

        function updateButton() {
            var pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
            var isScrollable = pageHeight > window.innerHeight + 120;
            var shouldShow = isScrollable && window.scrollY > Math.max(320, window.innerHeight * 0.45);

            button.hidden = !isScrollable;
            button.classList.toggle("is-visible", shouldShow);
            ticking = false;
        }

        function requestUpdate() {
            if (!ticking) {
                ticking = true;
                window.requestAnimationFrame(updateButton);
            }
        }

        button.addEventListener("click", function () {
            var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
        });

        window.addEventListener("scroll", requestUpdate, { passive: true });
        window.addEventListener("resize", requestUpdate);
        window.addEventListener("load", requestUpdate);

        if (typeof ResizeObserver !== "undefined") {
            new ResizeObserver(requestUpdate).observe(document.body);
        }

        updateButton();
    }

    setupBackToTop();

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
    var accountHandle = authProfile.username || "mytrail";
    var pageIsInView = window.location.pathname.indexOf("/view/") !== -1;
    var dashHref = pageIsInView ? "../app/pages.html" : "app/pages.html";
    var settingsHref = pageIsInView ? "../app/dashboard.html?panel=settings" : "app/dashboard.html?panel=settings";
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

    document.querySelectorAll(".footer-links > div").forEach(function (group) {
        var loginLink = group.querySelector('a[href$="login.html"]');
        var signupLink = group.querySelector('a[href$="signup.html"]');
        if (!loginLink || !signupLink) {
            return;
        }

        loginLink.setAttribute("href", dashHref);
        loginLink.textContent = "My dashboard";
        signupLink.setAttribute("href", settingsHref);
        signupLink.textContent = "Account settings";
    });

    var activePlan = null;
    try {
        activePlan = JSON.parse(localStorage.getItem("biotrail_plan") || "null");
    } catch (error) {
        activePlan = null;
    }

    var activePlanKey = activePlan && activePlan.plan ? String(activePlan.plan).toLowerCase() : "free";
    var accountPlanNames = { free: "Free", starter: "Starter", pro: "Pro" };
    var activePlanName = accountPlanNames[activePlanKey] ||
        activePlanKey.charAt(0).toUpperCase() + activePlanKey.slice(1);

    document.body.classList.add("has-active-session");

    var pricingAccount = document.querySelector("[data-account-pricing]");
    if (pricingAccount) {
        pricingAccount.hidden = false;

        var pricingAvatar = pricingAccount.querySelector("[data-pricing-avatar]");
        var pricingName = pricingAccount.querySelector("[data-pricing-name]");
        var pricingHandle = pricingAccount.querySelector("[data-pricing-handle]");
        var pricingPlan = pricingAccount.querySelector("[data-pricing-plan]");

        if (pricingAvatar) {
            pricingAvatar.textContent = "";
            if (authProfile.avatar) {
                var pricingAvatarImage = document.createElement("img");
                pricingAvatarImage.src = authProfile.avatar;
                pricingAvatarImage.alt = "";
                pricingAvatar.appendChild(pricingAvatarImage);
            } else {
                pricingAvatar.textContent = profileInitials(accountName);
            }
        }
        if (pricingName) {
            pricingName.textContent = accountName;
        }
        if (pricingHandle) {
            pricingHandle.textContent = "@" + accountHandle;
        }
        if (pricingPlan) {
            pricingPlan.textContent = activePlanName + " plan";
        }

        var pricingHeading = document.querySelector("[data-pricing-heading]");
        var pricingCopy = document.querySelector("[data-pricing-copy]");
        if (pricingHeading) {
            pricingHeading.textContent = "Choose the next plan for your trail.";
        }
        if (pricingCopy) {
            pricingCopy.textContent = "You are still signed in. Compare the plans below and choose the upgrade that fits your account.";
        }

        document.querySelectorAll("[data-plan-card]").forEach(function (card) {
            var cardPlan = card.getAttribute("data-plan-card");
            var planButton = card.querySelector("[data-plan]");
            var isCurrent = cardPlan === activePlanKey;

            card.classList.toggle("is-current-plan", isCurrent);
            if (!planButton) {
                return;
            }

            planButton.setAttribute("data-current-plan", isCurrent ? "true" : "false");
            if (isCurrent) {
                planButton.textContent = "Current plan";
                planButton.setAttribute("aria-label", activePlanName + " is your current plan; return to dashboard");
            } else if (cardPlan === "free") {
                planButton.textContent = "Back to dashboard";
            } else {
                planButton.textContent = "Upgrade to " + (accountPlanNames[cardPlan] || cardPlan);
            }
        });
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
