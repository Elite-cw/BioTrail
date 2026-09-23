(function () {
    "use strict";

    function hasActiveSession() {
        try {
            var session = localStorage.getItem("biotrail_session");
            if (session === null && localStorage.getItem("biotrail_profile")) {
                localStorage.setItem("biotrail_session", "active");
                return true;
            }
            return session === "active";
        } catch (error) {
            return false;
        }
    }

    if (hasActiveSession()) {
        return;
    }

    var fileName = window.location.pathname.split("/").pop() || "pages.html";
    var next = "../app/" + fileName + window.location.search;
    window.location.replace("../view/login.html?next=" + encodeURIComponent(next));
})();
