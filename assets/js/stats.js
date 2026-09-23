/* Real, local-first page analytics.
   Views and link clicks are recorded per page and per calendar day in
   localStorage (biotrail_stats), so the dashboard charts real numbers
   instead of the old fabricated demo values. Nothing is sent anywhere.
   Avoids ES6 module syntax for file:// compatibility. */
(function () {
    "use strict";

    var KEY = "biotrail_stats";

    // --- Storage ----------------------------------------------------------
    function read() {
        try {
            var raw = localStorage.getItem(KEY);
            if (raw) {
                return JSON.parse(raw) || {};
            }
        } catch (error) {
            return {};
        }
        return {};
    }

    function write(store) {
        try {
            localStorage.setItem(KEY, JSON.stringify(store));
        } catch (error) {
            // Storage full or unavailable - analytics should never crash the page.
        }
    }

    function todayKey() {
        var now = new Date();
        return now.getFullYear() + "-" +
            ("0" + (now.getMonth() + 1)).slice(-2) + "-" +
            ("0" + now.getDate()).slice(-2);
    }

    function dayKey(offsetDays) {
        var now = new Date();
        now.setDate(now.getDate() + offsetDays);
        return now.getFullYear() + "-" +
            ("0" + (now.getMonth() + 1)).slice(-2) + "-" +
            ("0" + now.getDate()).slice(-2);
    }

    function linkKey(title, url) {
        return String(title || "") + "\u0001" + String(url || "");
    }

    function ensurePage(store, pageId) {
        if (!store[pageId]) {
            store[pageId] = { views: {}, clicks: {} };
        }
        if (!store[pageId].views) {
            store[pageId].views = {};
        }
        if (!store[pageId].clicks) {
            store[pageId].clicks = {};
        }
        return store[pageId];
    }

    // --- Recording (views and clicks per calendar day) ---------------------
    function recordView(pageId) {
        if (!pageId) {
            return;
        }
        var store = read();
        var page = ensurePage(store, pageId);
        var day = todayKey();
        page.views[day] = (page.views[day] || 0) + 1;
        write(store);
    }

    function recordClick(pageId, title, url) {
        if (!pageId) {
            return;
        }
        var store = read();
        var page = ensurePage(store, pageId);
        var key = linkKey(title, url);
        var day = todayKey();
        if (!page.clicks[key]) {
            page.clicks[key] = {};
        }
        page.clicks[key][day] = (page.clicks[key][day] || 0) + 1;
        write(store);
    }

    // Sum a day-key -> count map over the last 7 calendar days.
    function sumLast(map, days) {
        var total = 0;
        for (var d = 0; d < days; d += 1) {
            total += map[dayKey(-d)] || 0;
        }
        return total;
    }

    function trendRatio(current, previous) {
        if (previous <= 0) {
            return current > 0 ? 100 : 0;
        }
        return Math.round(((current - previous) / previous) * 1000) / 10;
    }

    // Build the dashboard summary for one page.
    function summary(pageId, links) {
        var store = read();
        var page = store[pageId] || { views: {}, clicks: {} };
        var series = [];
        for (var d = 6; d >= 0; d -= 1) {
            var key = dayKey(-d);
            series.push({ day: key, views: page.views[key] || 0 });
        }
        var totalViews = 0;
        var totalClicks = 0;
        for (var s = 0; s < series.length; s += 1) {
            totalViews += series[s].views;
        }

        var topLinks = (links || []).map(function (link) {
            var key = linkKey(link.title, link.url);
            var clicks = sumLast(page.clicks[key] || {}, 7);
            return { title: link.title, url: link.url, icon: link.icon, clicks: clicks };
        }).sort(function (a, b) { return b.clicks - a.clicks; });

        for (var t = 0; t < topLinks.length; t += 1) {
            totalClicks += topLinks[t].clicks;
        }

        var viewsTrend = trendRatio(totalViews, sumLast(page.views, 14) - totalViews);
        var previousClicks = sumPageClicks(page, 14) - totalClicks;
        var clicksTrend = trendRatio(totalClicks, previousClicks);
        var ctr = totalViews > 0 ? Math.round((totalClicks / totalViews) * 1000) / 10 : 0;

        return {
            series: series,
            views: totalViews,
            clicks: totalClicks,
            previousClicks: previousClicks,
            ctr: ctr,
            viewsTrend: viewsTrend,
            clicksTrend: clicksTrend,
            topLinks: topLinks
        };
    }

    function sumPageClicks(page, days) {
        var total = 0;
        var keys = Object.keys(page.clicks || {});
        for (var i = 0; i < keys.length; i += 1) {
            total += sumLast(page.clicks[keys[i]], days);
        }
        return total;
    }

    // Raw per-link totals across all time (used when a link was renamed).
    function allTimeClicks(pageId, title, url) {
        var store = read();
        var page = (store[pageId] || {}).clicks || {};
        return sumLast(page[linkKey(title, url)] || {}, 9999);
    }

    // --- Public API ---------------------------------------------------------
    window.bioTrailStats = {
        recordView: recordView,
        recordClick: recordClick,
        summary: summary,
        allTimeClicks: allTimeClicks,
        lastDays: 7,
        dayKey: dayKey
    };
})();