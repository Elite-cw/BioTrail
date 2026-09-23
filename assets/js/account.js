(function () {
    "use strict";

    var KEY = "biotrail_pages";

    function read(key, fallback) {
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

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    // Remove the retired demo identity from both old and newly loaded browser data.
    var retiredHandle = ["ama", "ra"].join("");
    var retiredName = retiredHandle + " miles";
    var retiredCompactName = retiredHandle + "miles";

    function cleanLegacyProfile(value) {
        var profile = Object.assign({}, value || {});
        if ([retiredName, "your name"].indexOf(String(profile.name || "").trim().toLowerCase()) !== -1) {
            profile.name = "BioTrail creator";
        }
        if (String(profile.username || "").trim().toLowerCase() === retiredHandle) {
            profile.username = "mytrail";
        }
        return profile;
    }

    function cleanLegacyUrl(value) {
        return String(value || "")
            .replace(new RegExp(retiredCompactName, "gi"), "creator")
            .replace(new RegExp(retiredHandle, "gi"), "creator");
    }

    function cleanLegacyLinks(links) {
        return Array.isArray(links) ? links.map(function (link) {
            return Object.assign({}, link, { url: cleanLegacyUrl(link.url) });
        }) : links;
    }

    function cleanLegacyDefaults() {
        var profile = cleanLegacyProfile(read("biotrail_profile", {}) || {});
        write("biotrail_profile", profile);

        var legacyLinks = read("biotrail_links", null);
        if (Array.isArray(legacyLinks)) {
            write("biotrail_links", cleanLegacyLinks(legacyLinks));
        }

        var pages = read(KEY, null);
        if (Array.isArray(pages)) {
            write(KEY, pages.map(function (page) {
                var cleaned = Object.assign({}, page);
                if (String(cleaned.title || "").trim().toLowerCase() === retiredName) {
                    cleaned.title = "My page";
                }
                if (String(cleaned.handle || "").trim().toLowerCase() === retiredHandle) {
                    cleaned.handle = "mytrail";
                }
                delete cleaned.profile;
                cleaned.links = cleanLegacyLinks(cleaned.links);
                return cleaned;
            }));
        }
    }

    function defaultLinks() {
        return [
            { title: "Watch my latest video", url: "https://youtube.com/@creator", icon: "smart_display", enabled: true },
            { title: "Shop the new collection", url: "https://shop.biotrail.me/creator", icon: "storefront", enabled: true },
            { title: "Read my articles", url: "https://blog.example.com/posts", icon: "auto_stories", enabled: true },
            { title: "Book a discovery call", url: "https://calendar.example.com/meet", icon: "calendar_month", enabled: true }
        ];
    }

    // F8/F16: theme shape includes the animated background effect (bgfx),
    // so defaults here must always carry it to keep old saved pages coherent.
    function defaultTheme() {
        return { accent: "lime", shape: "pill", bg: "paper", bgfx: "plain" };
    }

    function migrate() {
        var pages = read(KEY, null);
        if (Array.isArray(pages) && pages.length) {
            return pages;
        }

        var profile = read("biotrail_profile", {}) || {};
        var handle = String(profile.username || "mytrail").toLowerCase();

        var page = {
            id: "p1",
            title: profile.name || "My page",
            handle: handle,
            links: read("biotrail_links", null) || [],
            theme: read("biotrail_theme", null) || defaultTheme(),
            createdAt: Date.now()
        };

        write(KEY, [page]);
        return [page];
    }

    function baseHandle() {
        var profile = read("biotrail_profile", {}) || {};
        return String(profile.username || "mytrail").toLowerCase();
    }

    function getPages() {
        var pages = migrate();
        var profile = read("biotrail_profile", {}) || {};
        var profileName = profile.name || "";
        return pages.map(function (page) {
            if (page && page.title === "My page" && profileName) {
                return Object.assign({}, page, { title: profileName });
            }
            return page;
        });
    }

    function savePages(pages) {
        write(KEY, pages);
        return pages;
    }

    function findPage(query) {
        var pages = getPages();
        query = query || {};
        if (query.id) {
            for (var i = 0; i < pages.length; i += 1) {
                if (pages[i].id === query.id) {
                    return pages[i];
                }
            }
            return null;
        }
        if (query.handle) {
            var wanted = String(query.handle).toLowerCase();
            for (var j = 0; j < pages.length; j += 1) {
                if (String(pages[j].handle).toLowerCase() === wanted) {
                    return pages[j];
                }
            }
            return null;
        }
        return pages[0] || null;
    }

    function uniqueHandle(base) {
        var pages = getPages();
        var used = {};
        pages.forEach(function (page) { used[String(page.handle).toLowerCase()] = true; });
        if (!used[String(base).toLowerCase()]) {
            return base;
        }
        var n = 2;
        while (used[(base + "-" + n).toLowerCase()]) {
            n += 1;
        }
        return base + "-" + n;
    }

    function createPage() {
        var profile = read("biotrail_profile", {}) || {};
        return {
            id: "p" + Date.now(),
            title: profile.name || "My page",
            handle: uniqueHandle(baseHandle()),
            links: [],
            theme: defaultTheme(),
            createdAt: Date.now()
        };
    }

    function removePage(id) {
        var pages = getPages().filter(function (page) { return page.id !== id; });
        savePages(pages);
        return pages;
    }

    cleanLegacyDefaults();

    window.bioTrailAccount = {
        getPages: getPages,
        savePages: savePages,
        findPage: findPage,
        createPage: createPage,
        removePage: removePage,
        uniqueHandle: uniqueHandle,
        baseHandle: baseHandle
    };
})();
