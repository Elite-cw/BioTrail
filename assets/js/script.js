// Page elements
const announcement = document.querySelector("#announcement");
const announcementClose = document.querySelector("#announcement-close");
const menuToggle = document.querySelector("#menu-toggle");
const navMenu = document.querySelector("#nav-menu");
const dropdownButtons = document.querySelectorAll(".dropdown-toggle");
const claimForm = document.querySelector("#claim-form");
const usernameInput = document.querySelector("#username");
const claimMessage = document.querySelector("#claim-message");
const builderAddButton = document.querySelector("#builder-add-button");
const builderNewCard = document.querySelector("#builder-new-card");
const trailButtons = document.querySelectorAll(".trail-button");
const trailHeading = document.querySelector("#trail-heading");
const trailDescription = document.querySelector("#trail-description");
const trailLinkOne = document.querySelector("#trail-link-one");
const trailLinkTwo = document.querySelector("#trail-link-two");
const trailLinkThree = document.querySelector("#trail-link-three");
const freshnessButton = document.querySelector("#freshness-button");
const freshnessButtonLabel = document.querySelector("#freshness-button-label");
const healthScore = document.querySelector("#health-score");
const healthWarningRow = document.querySelector("#health-warning-row");
const healthDetail = document.querySelector("#health-detail");
const healthStatus = document.querySelector("#health-status");
const freshnessMessage = document.querySelector("#freshness-message");
const storySlides = document.querySelectorAll("[data-story-slide]");
const storyPrevious = document.querySelector("#story-previous");
const storyNext = document.querySelector("#story-next");
const storyPosition = document.querySelector("#story-position");
const closingClaimForm = document.querySelector("#closing-claim-form");
const closingUsernameInput = document.querySelector("#closing-username");
const closingClaimMessage = document.querySelector("#closing-claim-message");

function accountExists(username) {
    const wanted = String(username || "").toLowerCase();
    try {
        const profile = JSON.parse(localStorage.getItem("biotrail_profile") || "{}") || {};
        if (String(profile.username || "").toLowerCase() === wanted) {
            return true;
        }
        const pages = JSON.parse(localStorage.getItem("biotrail_pages") || "[]");
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

// Shared page state and Guided Trails content
let currentStoryIndex = 0;

const trailOptions = {
    hire: {
        heading: "Work with Jordan",
        description: "The best links for clients and collaborators are now at the top.",
        links: ["View selected projects", "Book a discovery call", "Download my résumé"]
    },
    shop: {
        heading: "Shop with Jordan",
        description: "Products, recommendations and current offers now lead the page.",
        links: ["Shop the latest collection", "Browse digital downloads", "See customer favourites"]
    },
    learn: {
        heading: "Learn with Jordan",
        description: "Lessons, resources and helpful guides are now easiest to reach.",
        links: ["Start the design course", "Read the latest guide", "Join the next workshop"]
    }
};

// Navigation dropdowns
function closeDropdowns(buttonToKeepOpen) {
    dropdownButtons.forEach(function (button) {
        if (button !== buttonToKeepOpen) {
            button.setAttribute("aria-expanded", "false");

            const menuId = button.getAttribute("aria-controls");
            const menu = document.querySelector("#" + menuId);
            menu.classList.remove("is-open");
        }
    });
}

dropdownButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const menuId = button.getAttribute("aria-controls");
        const menu = document.querySelector("#" + menuId);
        const isOpen = button.getAttribute("aria-expanded") === "true";

        closeDropdowns(button);
        button.setAttribute("aria-expanded", String(!isOpen));
        menu.classList.toggle("is-open", !isOpen);
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
        navMenu.classList.remove("is-open");
        menuToggle.setAttribute("aria-expanded", "false");
    }
});

// Mobile navigation
menuToggle.addEventListener("click", function () {
    const menuIsOpen = menuToggle.getAttribute("aria-expanded") === "true";

    menuToggle.setAttribute("aria-expanded", String(!menuIsOpen));
    navMenu.classList.toggle("is-open", !menuIsOpen);
});

function closeMobileMenu() {
    navMenu.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
}

function isMobileMenuOpen() {
    return window.matchMedia("(max-width: 900px)").matches && navMenu.classList.contains("is-open");
}

document.addEventListener("click", function (event) {
    if (event.target.closest(".nav-menu a")) {
        closeMobileMenu();
        return;
    }

    if (isMobileMenuOpen() && !event.target.closest(".nav-menu") && !event.target.closest(".menu-toggle")) {
        closeMobileMenu();
    }
});

// Announcement bar
announcementClose.addEventListener("click", function () {
    announcement.hidden = true;
});

// Hero username form
claimForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const username = usernameInput.value.trim().toLowerCase();
    const usernameIsValid = /^[a-z0-9_-]{3,20}$/.test(username);

    claimMessage.classList.remove("is-error");

    if (!usernameIsValid) {
        claimMessage.textContent = "Use 3–20 letters, numbers, underscores or hyphens.";
        claimMessage.classList.add("is-error");
        usernameInput.focus();
        return;
    }

    if (accountExists(username)) {
        claimMessage.textContent = "biotrail.me/" + username + " already has an account — redirecting you to log in…";
        window.location.href = "view/login.html?username=" + encodeURIComponent(username);
        return;
    }

    claimMessage.textContent = "Great choice — biotrail.me/" + username + " is ready. Setting up your sign-up…";
    window.location.href = "view/signup.html?username=" + encodeURIComponent(username);
});

// Page builder demonstration
builderAddButton.addEventListener("click", function () {
    builderNewCard.hidden = false;
    bioTrailSwapIcon(builderAddButton.querySelector(".material-icon"), "check");
    builderAddButton.setAttribute("aria-expanded", "true");
    builderAddButton.setAttribute("aria-label", "Example link added");
    builderAddButton.disabled = true;
});

// Guided Trails demonstration
trailButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        const selectedTrail = button.getAttribute("data-trail");
        const trail = trailOptions[selectedTrail];

        trailButtons.forEach(function (trailButton) {
            trailButton.classList.remove("is-active");
            trailButton.setAttribute("aria-pressed", "false");
        });

        button.classList.add("is-active");
        button.setAttribute("aria-pressed", "true");
        trailHeading.textContent = trail.heading;
        trailDescription.textContent = trail.description;
        trailLinkOne.firstChild.textContent = trail.links[0] + " ";
        trailLinkTwo.firstChild.textContent = trail.links[1] + " ";
        trailLinkThree.firstChild.textContent = trail.links[2] + " ";
    });
});

// Freshness Check demonstration
freshnessButton.addEventListener("click", function () {
    const healthIcon = healthWarningRow.querySelector(".health-icon");

    healthIcon.classList.add("is-good");
    bioTrailSwapIcon(healthIcon.querySelector(".material-icon"), "check_circle");
    healthStatus.classList.add("is-good");
    healthStatus.textContent = "Fresh";
    healthDetail.textContent = "Checked just now";
    healthScore.classList.add("is-complete");
    healthScore.textContent = "3 of 3 fresh";
    bioTrailSwapIcon(freshnessButton.querySelector(".material-icon"), "check_circle");
    freshnessButtonLabel.textContent = "Links checked";
    freshnessButton.disabled = true;
    freshnessMessage.textContent = "Everything is current and ready to share.";
});

// Creator story slider
function showStory(storyIndex) {
    storySlides.forEach(function (story, index) {
        story.hidden = index !== storyIndex;
        story.classList.toggle("is-active", index === storyIndex);
    });

    storyPosition.textContent = storyIndex + 1 + " / " + storySlides.length;
}

storyPrevious.addEventListener("click", function () {
    currentStoryIndex = currentStoryIndex - 1;

    if (currentStoryIndex < 0) {
        currentStoryIndex = storySlides.length - 1;
    }

    showStory(currentStoryIndex);
});

storyNext.addEventListener("click", function () {
    currentStoryIndex = currentStoryIndex + 1;

    if (currentStoryIndex >= storySlides.length) {
        currentStoryIndex = 0;
    }

    showStory(currentStoryIndex);
});

// Closing username form
closingClaimForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const username = closingUsernameInput.value.trim().toLowerCase();
    const usernameIsValid = /^[a-z0-9_-]{3,20}$/.test(username);

    closingClaimMessage.classList.remove("is-error");

    if (!usernameIsValid) {
        closingClaimMessage.textContent = "Use 3–20 letters, numbers, underscores or hyphens.";
        closingClaimMessage.classList.add("is-error");
        closingUsernameInput.focus();
        return;
    }

    if (accountExists(username)) {
        closingClaimMessage.textContent = "biotrail.me/" + username + " already has an account — redirecting you to log in…";
        window.location.href = "view/login.html?username=" + encodeURIComponent(username);
        return;
    }

    closingClaimMessage.textContent = "Great choice — biotrail.me/" + username + " is ready.";
    window.location.href = "view/signup.html?username=" + encodeURIComponent(username);
});
