/* BioTrail checkout — Paystack (card + bank transfer) */
(function () {
    "use strict";

    /* ------------------------------------------------------------------
     * Paystack is a free-to-start payment API (paystack.com).
     * Drop your test/live PUBLIC key in below to enable live checkout.
     * Public keys are safe to expose in the browser; secret keys are not.
     * ------------------------------------------------------------------ */
    var PAYSTACK_PUBLIC_KEY = "pk_test_REPLACE_WITH_YOUR_PAYSTACK_PUBLIC_KEY";

    var PLANS = {
        starter: { name: "Starter", monthly: 5, annual: 3.5 },
        pro: { name: "Pro", monthly: 9, annual: 6 }
    };

    var params = new URLSearchParams(window.location.search);
    var planKey = (params.get("plan") || "").toLowerCase();
    var billing = params.get("billing") === "monthly" ? "monthly" : "annual";
    var plan = PLANS[planKey];

    var planEl = document.getElementById("checkout-plan");
    var billingEl = document.getElementById("checkout-billing");
    var amountEl = document.getElementById("checkout-amount");
    var hintEl = document.getElementById("pay-hint");
    var button = document.getElementById("pay-button");
    var message = document.getElementById("pay-message");
    var methods = Array.prototype.slice.call(document.querySelectorAll(".pay-method"));

    var method = "card";

    /* Not signed in? Send them to the account-choice page first. */
    function signedIn() {
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

    if (!signedIn()) {
        window.location.replace("../view/start.html?plan=" + encodeURIComponent(planKey) +
            "&billing=" + encodeURIComponent(billing));
        return;
    }

    if (!plan) {
        window.location.replace("pages.html");
        return;
    }

    function money(value) {
        return "$" + value.toFixed(2);
    }

    var monthly = plan.monthly;
    var annualMonthly = plan.annual;
    var total = billing === "annual" ? annualMonthly * 12 : monthly;
    var amountSubunit = Math.round(total * 100);

    planEl.textContent = plan.name;
    billingEl.textContent = billing === "annual"
        ? "Annual (12 x " + money(annualMonthly) + "/mo)"
        : "Monthly (" + money(monthly) + "/mo)";
    amountEl.textContent = money(total);

    function updateButton() {
        button.textContent = "Pay " + money(total) + " with Paystack";
    }

    function selectMethod(next) {
        method = next;
        methods.forEach(function (item) {
            var active = item.getAttribute("data-method") === next;
            item.classList.toggle("is-active", active);
            item.setAttribute("aria-selected", active ? "true" : "false");
        });
        hintEl.textContent = next === "card"
            ? "Pay instantly with your debit or credit card."
            : "Pay directly from your bank account with a one-time bank transfer.";
    }

    methods.forEach(function (item) {
        item.addEventListener("click", function () {
            selectMethod(item.getAttribute("data-method"));
        });
    });

    function accountEmail() {
        try {
            var profile = JSON.parse(localStorage.getItem("biotrail_profile") || "{}") || {};
            if (profile.email) {
                return profile.email;
            }
            if (profile.username) {
                return profile.username + "@biotrail.app";
            }
        } catch (error) {
            /* ignore */
        }
        return "creator@biotrail.app";
    }

    function reference() {
        return "BT-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
    }

    function completePayment(ref, provider) {
        var record = {
            plan: planKey,
            billing: billing,
            status: "active",
            amount: total,
            currency: "USD",
            method: method,
            provider: provider,
            reference: ref,
            startedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem("biotrail_plan", JSON.stringify(record));
        } catch (error) {
            /* ignore */
        }

        message.className = "auth-message is-success";
        message.textContent = "Payment received. Taking you to your dashboard…";
        window.setTimeout(function () {
            window.location.href = "pages.html?upgraded=1";
        }, 700);
    }

    function demoMode() {
        return !window.PaystackPop ||
            !PAYSTACK_PUBLIC_KEY ||
            PAYSTACK_PUBLIC_KEY.indexOf("REPLACE_WITH") !== -1;
    }

    button.addEventListener("click", function () {
        var ref = reference();

        if (demoMode()) {
            message.className = "auth-message";
            message.textContent = "Demo mode: no live Paystack key is configured, so this payment is simulated.";
            button.disabled = true;
            button.textContent = "Processing…";
            window.setTimeout(function () {
                completePayment(ref, "Paystack (demo)");
            }, 1200);
            return;
        }

        var handler = window.PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email: accountEmail(),
            amount: amountSubunit,
            currency: "USD",
            channels: [method],
            ref: ref,
            metadata: {
                plan: planKey,
                billing: billing,
                custom_fields: [
                    { display_name: "Plan", variable_name: "plan", value: plan.name },
                    { display_name: "Billing", variable_name: "billing", value: billing }
                ]
            },
            callback: function (response) {
                completePayment(response && response.reference ? response.reference : ref, "Paystack");
            },
            onClose: function () {
                message.className = "auth-message";
                message.textContent = "Checkout closed before payment was completed.";
            }
        });

        handler.openIframe();
    });

    selectMethod(method);
    updateButton();
})();
