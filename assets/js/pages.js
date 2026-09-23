// Shared interactions for subpages (Products, Templates, Marketplace, Learn, Pricing, Auth)
(function () {
    function byId(id) {
        return document.getElementById(id);
    }

    function all(selector, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
    }

    function accountExists(username) {
        var wanted = String(username || "").toLowerCase();
        try {
            var profile = JSON.parse(localStorage.getItem("biotrail_profile") || "{}") || {};
            if (String(profile.username || "").toLowerCase() === wanted) {
                return true;
            }
            var pages = JSON.parse(localStorage.getItem("biotrail_pages") || "[]");
            if (Array.isArray(pages)) {
                return pages.some(function (page) {
                    return String(page.handle || "").toLowerCase() === wanted;
                });
            }
        } catch (error) {
            return false;
        }
        return false;
    }

    function isLoggedIn() {
        try {
            var session = localStorage.getItem("biotrail_session");
            if (session === null && localStorage.getItem("biotrail_profile")) {
                return true;
            }
            return session === "active";
        } catch (error) {
            return false;
        }
    }

    // Mobile navigation
    var menuToggle = byId("menu-toggle");
    var navMenu = byId("nav-menu");
    var dropdownButtons = all(".dropdown-toggle");

    function closeDropdowns(buttonToKeepOpen) {
        dropdownButtons.forEach(function (button) {
            if (button !== buttonToKeepOpen) {
                button.setAttribute("aria-expanded", "false");

                var menu = byId(button.getAttribute("aria-controls"));
                if (menu) {
                    menu.classList.remove("is-open");
                }
            }
        });
    }

    dropdownButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            var menu = byId(button.getAttribute("aria-controls"));
            var isOpen = button.getAttribute("aria-expanded") === "true";

            closeDropdowns(button);
            button.setAttribute("aria-expanded", String(!isOpen));

            if (menu) {
                menu.classList.toggle("is-open", !isOpen);
            }
        });
    });

    document.addEventListener("click", function (event) {
        if (!event.target.closest(".nav-dropdown")) {
            closeDropdowns();
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeDropdowns();
            if (navMenu) {
                navMenu.classList.remove("is-open");
            }
            if (menuToggle) {
                menuToggle.setAttribute("aria-expanded", "false");
            }
        }
    });

    if (menuToggle && navMenu) {
        menuToggle.addEventListener("click", function () {
            var menuIsOpen = menuToggle.getAttribute("aria-expanded") === "true";
            menuToggle.setAttribute("aria-expanded", String(!menuIsOpen));
            navMenu.classList.toggle("is-open", !menuIsOpen);
        });

        document.addEventListener("click", function (event) {
            if (event.target.closest(".nav-menu a")) {
                navMenu.classList.remove("is-open");
                menuToggle.setAttribute("aria-expanded", "false");
                return;
            }

            if (navMenu.classList.contains("is-open")
                && window.matchMedia("(max-width: 900px)").matches
                && !event.target.closest(".nav-menu")
                && !event.target.closest(".menu-toggle")) {
                navMenu.classList.remove("is-open");
                menuToggle.setAttribute("aria-expanded", "false");
            }
        });
    }

    // Generic filter tab groups (templates + marketplace)
    all("[data-target]").forEach(function (tabGroup) {
        var tabs = all("[data-filter]", tabGroup);
        var target = tabGroup.getAttribute("data-target");
        var cards = target ? all(target + " [data-category]") : [];

        tabs.forEach(function (tab) {
            tab.addEventListener("click", function () {
                tabs.forEach(function (otherTab) {
                    otherTab.classList.remove("is-active");
                    otherTab.setAttribute("aria-pressed", "false");
                });

                tab.classList.add("is-active");
                tab.setAttribute("aria-pressed", "true");

                var filter = tab.getAttribute("data-filter");
                cards.forEach(function (card) {
                    card.hidden = filter !== "all" && card.getAttribute("data-category") !== filter;
                });
            });
        });
    });

    // Learn panel tabs
    all("[data-panel-tabs]").forEach(function (tabBar) {
        var tabs = all("[data-panel]", tabBar);
        var panels = all(tabBar.getAttribute("data-panel-tabs") + " > .learn-panel");
        var activateTab = function (tab) {
            tabs.forEach(function (otherTab) {
                otherTab.classList.remove("is-active");
                otherTab.setAttribute("aria-pressed", "false");
            });

            tab.classList.add("is-active");
            tab.setAttribute("aria-pressed", "true");

            panels.forEach(function (panel) {
                panel.hidden = panel.getAttribute("data-panel") !== tab.getAttribute("data-panel");
            });
        };

        tabs.forEach(function (tab) {
            tab.addEventListener("click", function () {
                activateTab(tab);
            });
        });

        if (window.location.hash) {
            var requestedPanel = document.getElementById(window.location.hash.slice(1));
            if (requestedPanel && requestedPanel.classList.contains("learn-panel")) {
                var matchingTab = tabs.filter(function (tab) {
                    return tab.getAttribute("data-panel") === requestedPanel.getAttribute("data-panel");
                })[0];
                if (matchingTab) {
                    activateTab(matchingTab);
                }
            }
        }
    });

    // Pricing billing toggle
    all("[data-billing-group]").forEach(function (group) {
        var options = all(".billing-option", group);
        var prices = all("[data-price]");
        var billingNote = document.querySelector("[data-billing-note]");

        options.forEach(function (option) {
            option.addEventListener("click", function () {
                options.forEach(function (other) {
                    other.classList.remove("is-active");
                    other.setAttribute("aria-pressed", "false");
                });

                option.classList.add("is-active");
                option.setAttribute("aria-pressed", "true");

                var mode = option.getAttribute("data-billing");
                prices.forEach(function (price) {
                    price.textContent = price.getAttribute("data-" + mode);
                });

                if (billingNote && option.getAttribute("data-note")) {
                    billingNote.textContent = option.getAttribute("data-note");
                }
            });
        });
    });

    // Marketplace search + cart
    var searchInput = byId("market-search");
    var cartCount = byId("cart-count");
    var cartMessage = byId("cart-message");
    var marketGrid = byId("market-grid");
    var activeFilter = "all";
    var cartTotal = parseInt(localStorage.getItem("biotrail_cart") || "0", 10);

    if (cartCount) {
        cartCount.textContent = String(cartTotal);
    }

    if (cartMessage) {
        cartMessage.textContent = cartTotal > 0
            ? "Your trail cart has " + cartTotal + " item" + (cartTotal === 1 ? "" : "s") + " saved."
            : "Browse the marketplace and build your trail cart.";
    }

    if (marketGrid && searchInput) {
        all(".market-add", marketGrid).forEach(function (button) {
            button.addEventListener("click", function () {
                cartTotal += 1;
                localStorage.setItem("biotrail_cart", String(cartTotal));
                if (cartCount) {
                    cartCount.textContent = String(cartTotal);
                }
                if (cartMessage) {
                    cartMessage.textContent = button.getAttribute("data-name") +
                        " added. Your trail cart now holds " + cartTotal + " item" + (cartTotal === 1 ? "" : "s") + ".";
                }
            });
        });

        searchInput.addEventListener("input", function () {
            var query = searchInput.value.trim().toLowerCase();
            var activeTab = marketGrid.parentElement.querySelector(".filter-tab.is-active");

            if (activeTab) {
                activeFilter = activeTab.getAttribute("data-filter");
            }

            all("[data-category]", marketGrid).forEach(function (card) {
                var matchesFilter = activeFilter === "all" || card.getAttribute("data-category") === activeFilter;
                var matchesQuery = !query || (card.getAttribute("data-search") || "").toLowerCase().indexOf(query) !== -1;
                card.hidden = !(matchesFilter && matchesQuery);
            });
        });
    }

    // Market category filtered for marketplace (kept for clarity)
    all("[data-target='#market-grid'] [data-filter]").forEach(function (tab) {
        tab.addEventListener("click", function () {
            activeFilter = tab.getAttribute("data-filter");

            if (searchInput) {
                var query = searchInput.value.trim().toLowerCase();
                all("[data-category]", marketGrid).forEach(function (card) {
                    var matchesFilter = activeFilter === "all" || card.getAttribute("data-category") === activeFilter;
                    var matchesQuery = !query || (card.getAttribute("data-search") || "").toLowerCase().indexOf(query) !== -1;
                    card.hidden = !(matchesFilter && matchesQuery);
                });
            }
        });
    });

    // Page builder demonstration (products page)
    var builderAddButton = byId("builder-add-button");
    var builderNewCard = byId("builder-new-card");

    if (builderAddButton && builderNewCard) {
        builderAddButton.addEventListener("click", function () {
            builderNewCard.hidden = false;
            bioTrailSwapIcon(builderAddButton.querySelector(".material-icon"), "check");
            builderAddButton.setAttribute("aria-expanded", "true");
            builderAddButton.setAttribute("aria-label", "Example link added");
            builderAddButton.disabled = true;
        });
    }

    // Closing username form (hero-adjacent claim on subpages)
    var closingClaimForm = byId("closing-claim-form");

    if (closingClaimForm) {
        var closingUsernameInput = byId("closing-username");
        var closingClaimMessage = byId("closing-claim-message");

        closingClaimForm.addEventListener("submit", function (event) {
            event.preventDefault();

            var username = closingUsernameInput.value.trim().toLowerCase();
            var usernameIsValid = /^[a-z0-9_-]{3,20}$/.test(username);

            closingClaimMessage.classList.remove("is-error");

            if (!usernameIsValid) {
                closingClaimMessage.textContent = "Use 3–20 letters, numbers, underscores or hyphens.";
                closingClaimMessage.classList.add("is-error");
                closingUsernameInput.focus();
                return;
            }

            if (accountExists(username)) {
                closingClaimMessage.textContent = "biotrail.me/" + username + " already has an account — log in to keep editing it.";
                window.location.href = "login.html?username=" + encodeURIComponent(username);
                return;
            }

            closingClaimMessage.textContent = "Great choice — biotrail.me/" + username + " is ready.";
            window.location.href = "signup.html?username=" + encodeURIComponent(username);
        });
    }

    // Plan selection routing (pricing page)
    var planButtons = all("[data-plan]");

    if (planButtons.length) {
        planButtons.forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.preventDefault();

                var plan = button.getAttribute("data-plan");
                var activeBilling = document.querySelector(".billing-option.is-active");
                var billing = activeBilling ? activeBilling.getAttribute("data-billing") : "annual";
                var query = "?plan=" + encodeURIComponent(plan) + "&billing=" + encodeURIComponent(billing);

                if (plan === "free") {
                    window.location.href = isLoggedIn() ? "../app/pages.html" : "start.html" + query;
                    return;
                }

                window.location.href = isLoggedIn() ? "../app/payment.html" + query : "start.html" + query;
            });
        });
    }

    // Login form
    var loginForm = byId("login-form");

    if (loginForm) {
        var loginParams = new URLSearchParams(window.location.search);
        var loginUsername = loginParams.get("username");
        var loginPlan = loginParams.get("plan");
        var loginBilling = loginParams.get("billing") || "annual";
        var loginMessage = byId("auth-message");

        if (loginUsername && loginMessage) {
            loginMessage.textContent = "biotrail.me/" + loginUsername.toLowerCase() +
                " already has an account — log in with that account's email to keep editing it.";
            loginMessage.classList.add("is-success");
        }

        loginForm.addEventListener("submit", function (event) {
            event.preventDefault();

            var email = byId("login-email");
            var password = byId("login-password");
            var message = byId("auth-message");
            var emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());

            message.classList.remove("is-success");
            message.classList.remove("is-error");

            if (!emailIsValid || password.value.length < 8) {
                message.textContent = "Enter a valid email and a password of at least 8 characters.";
                message.classList.add("is-error");
                email.focus();
                return;
            }

            message.textContent = "Welcome back — your trail is ready.";
            message.classList.add("is-success");
            localStorage.setItem("biotrail_session", "active");
            loginForm.querySelector(".button").disabled = true;
            loginForm.querySelector(".button").textContent = "Signing you in…";
            if (loginPlan && loginPlan !== "free") {
                window.location.href = "../app/payment.html?plan=" + encodeURIComponent(loginPlan) +
                    "&billing=" + encodeURIComponent(loginBilling);
                return;
            }
            window.location.href = "../app/dashboard.html" + (loginUsername ? "?username=" + encodeURIComponent(loginUsername) : "");
        });
    }

    // Signup form
    // --- F1: template themes pre-seeded on signup -----------------------
    var signupForm = byId("signup-form");

    if (signupForm) {
        var signupParams = new URLSearchParams(window.location.search);
        var requestedUsername = signupParams.get("username");
        var requestedTemplate = signupParams.get("template");
        var signupPlan = signupParams.get("plan");
        var signupBilling = signupParams.get("billing") || "annual";
        var nameField = byId("signup-name");
        var usernameField = byId("signup-username");
        var templateNotice = byId("template-notice");
        // F1: maps the seven marketplace templates to a starting theme (accent/shape/bg/bgfx).
        var templateThemes = {
            "minimal-muse": { accent: "lime", shape: "pill", bg: "paper", bgfx: "plain" },
            "sketch-line": { accent: "ink", shape: "rounded", bg: "paper", bgfx: "plain" },
            "bold-statement": { accent: "lime", shape: "square", bg: "ink", bgfx: "plain" },
            "studio-punch": { accent: "coral", shape: "square", bg: "paper", bgfx: "gradient" },
            "pastel-stack": { accent: "purple", shape: "rounded", bg: "paper", bgfx: "aurora" },
            "sky-route": { accent: "purple", shape: "pill", bg: "paper", bgfx: "waves" },
            "full-bloom": { accent: "coral", shape: "pill", bg: "lime", bgfx: "dots" }
        };
        var chosenTemplateTheme = templateThemes[requestedTemplate] || null;

        if (requestedUsername && usernameField) {
            usernameField.value = requestedUsername;
            if (nameField) {
                nameField.value = requestedUsername;
            }
        }

        if (requestedTemplate && templateNotice) {
            templateNotice.textContent = chosenTemplateTheme
                ? "You chose the '" + requestedTemplate.replace(/-/g, " ") + "' template - its colours, shape and background will be pre-applied to your page."
                : "You chose the " + requestedTemplate.replace(/-/g, " ") + " template.";
        }

        signupForm.addEventListener("submit", function (event) {
            event.preventDefault();

            var name = nameField.value.trim();
            var email = byId("signup-email").value.trim();
            var username = usernameField.value.trim().toLowerCase();
            var password = byId("signup-password").value;
            var confirm = byId("signup-confirm").value;
            var message = byId("auth-message");

            message.classList.remove("is-success");
            message.classList.remove("is-error");

            var error = null;

            if (!name) {
                error = "Please enter your name.";
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                error = error || "Enter a valid email address.";
            }

            if (!/^[a-z0-9_-]{3,20}$/.test(username)) {
                error = error || "Username must be 3–20 letters, numbers, underscores or hyphens.";
            }

            if (password.length < 8) {
                error = error || "Password must be at least 8 characters.";
            }

            if (confirm !== password) {
                error = error || "Passwords do not match.";
            }

            if (error) {
                message.textContent = error;
                message.classList.add("is-error");
                return;
            }

            if (accountExists(username)) {
                message.textContent = "biotrail.me/" + username +
                    " already has an account — redirecting you to log in instead.";
                message.classList.add("is-error");
                window.location.href = "login.html?username=" + encodeURIComponent(username);
                return;
            }

            localStorage.setItem("biotrail_session", "active");
            localStorage.setItem("biotrail_profile", JSON.stringify({
                username: username,
                name: name,
                email: email,
                role: "Your trail is live"
            }));

            if (chosenTemplateTheme) {
                var seededPage = {
                    id: "p" + Date.now(),
                    title: name,
                    handle: username.toLowerCase(),
                    links: [
                        { title: "Watch my latest video", url: "https://youtube.com/@" + username, icon: "smart_display", enabled: true },
                        { title: "Shop the new collection", url: "https://shop.biotrail.me/" + username, icon: "storefront", enabled: true },
                        { title: "Book a discovery call", url: "https://calendar.example.com/meet", icon: "calendar_month", enabled: true },
                        { title: "Read my articles", url: "https://blog.example.com/posts", icon: "auto_stories", enabled: true }
                    ],
                    theme: chosenTemplateTheme,
                    createdAt: Date.now()
                };
                localStorage.setItem("biotrail_pages", JSON.stringify([seededPage]));
            }

            message.textContent = "Welcome to BioTrail, " + name + "! Taking you to your page…";
            message.classList.add("is-success");
            signupForm.querySelector(".button").disabled = true;
            signupForm.querySelector(".button").textContent = "Creating your page…";

            if (signupPlan && signupPlan !== "free") {
                window.location.href = "../app/payment.html?plan=" + encodeURIComponent(signupPlan) +
                    "&billing=" + encodeURIComponent(signupBilling);
                return;
            }

            window.location.href = "../app/dashboard.html?username=" + encodeURIComponent(username) + "&name=" + encodeURIComponent(name);
        });
    }
})();
