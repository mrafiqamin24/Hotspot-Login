// =========================================================
// Home.Net Main App
// Fungsi utama:
// 1. Menjaga mode dark / light tetap tersimpan.
// 2. Menampilkan loading saat pindah halaman.
// 3. Menyamakan username dan password voucher.
// 4. Mengatur smart color pada Sisa Waktu.
// 5. Mengirim notifikasi saat waktu voucher hampir habis.
// 6. Menjaga fitur kecil UI tetap aktif di semua halaman.
// =========================================================

(function () {
  "use strict";

  var THEME_KEY = "home-theme";
  var DEFAULT_THEME = "light";
  var loaderTimer = null;

  // ---------------------------------------------------------
  // Helper selector singkat.
  // ---------------------------------------------------------
  function qs(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function qsa(selector, scope) {
    return Array.prototype.slice.call(
      (scope || document).querySelectorAll(selector)
    );
  }

  // ---------------------------------------------------------
  // Helper class agar aman di browser lama.
  // ---------------------------------------------------------
  function addClass(element, className) {
    if (!element) return;

    if (element.classList) {
      element.classList.add(className);
      return;
    }

    if (element.className.indexOf(className) === -1) {
      element.className += " " + className;
    }
  }

  function removeClass(element, className) {
    if (!element) return;

    if (element.classList) {
      element.classList.remove(className);
      return;
    }

    element.className = element.className.replace(
      new RegExp("(^|\\s)" + className + "(\\s|$)", "g"),
      " "
    );
  }

  function hasClass(element, className) {
    if (!element) return false;

    if (element.classList) {
      return element.classList.contains(className);
    }

    return new RegExp("(^| )" + className + "( |$)", "gi").test(
      element.className
    );
  }

  // ---------------------------------------------------------
  // Theme dark / light.
  // ---------------------------------------------------------
  function getSavedTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
    } catch (error) {
      return DEFAULT_THEME;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      // Captive portal kadang membatasi storage, jadi cukup diamankan.
    }
  }

  function applyTheme(theme) {
    var icon = qs("#themeIcon");

    document.documentElement.setAttribute("data-theme", theme);

    if (icon) {
      icon.className =
        theme === "dark"
          ? "bi bi-sun"
          : "bi bi-moon-stars";
    }
  }

  function initTheme() {
    applyTheme(getSavedTheme());
  }

  window.toggleTheme = function () {
    var currentTheme =
      document.documentElement.getAttribute("data-theme") || DEFAULT_THEME;

    var nextTheme = currentTheme === "dark" ? "light" : "dark";

    applyTheme(nextTheme);
    saveTheme(nextTheme);
  };

  // Terapkan theme secepat mungkin agar halaman tidak kedip warna.
  initTheme();

  // ---------------------------------------------------------
  // Loading saat pindah halaman / submit form.
  // ---------------------------------------------------------
  window.showLoader = function () {
    var loader = qs("#loader");
    var percent = qs("#loaderPercent");
    var number = 0;

    if (!loader) return;

    addClass(loader, "show");

    if (loaderTimer) {
      clearInterval(loaderTimer);
    }

    if (percent) {
      percent.textContent = "0%";
    }

    loaderTimer = setInterval(function () {
      number += Math.floor(Math.random() * 9) + 5;

      if (number >= 99) {
        number = 99;
        clearInterval(loaderTimer);
      }

      if (percent) {
        percent.textContent = number + "%";
      }
    }, 90);
  };


  window.startLoginLoaderDelayed = function () {
    window.clearTimeout(window.loginLoaderTimer);
    window.loginLoaderTimer = window.setTimeout(function () {
      window.showLoader();
    }, 900);
  };

  window.showLoginNotice = window.showLoginNotice || function (message) {
    var notice = qs("#loginNotice");
    if (!notice) return;

    var text = qs("span", notice);
    if (text) text.textContent = message;

    notice.removeAttribute("hidden");

    window.clearTimeout(window.loginNoticeTimer);
    window.loginNoticeTimer = window.setTimeout(function () {
      notice.setAttribute("hidden", "hidden");
    }, 5000);
  };

  function shouldIgnoreLoader(element) {
    if (!element) return true;

    if (hasClass(document.body, "error-body")) return true;

    if (element.getAttribute("data-no-loader") !== null) return true;

    if (element.getAttribute("target") === "_blank") return true;

    var href = element.getAttribute("href") || "";

    if (
      href === "#" ||
      href.indexOf("javascript:") === 0 ||
      href.indexOf("tel:") === 0 ||
      href.indexOf("mailto:") === 0 ||
      href.indexOf("wa.me") !== -1 ||
      href.indexOf("api.whatsapp.com") !== -1
    ) {
      return true;
    }

    return false;
  }

  function initLoader() {
    qsa("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (!shouldIgnoreLoader(link)) {
          window.showLoader();
        }
      });
    });

    qsa("form").forEach(function (form) {
      form.addEventListener("submit", function () {
        if (form.getAttribute("data-no-loader") !== null) return;

        if (form.getAttribute("data-login-form") !== null) {
          window.startLoginLoaderDelayed();
          return;
        }

        window.showLoader();
      });
    });
  }

  // ---------------------------------------------------------
  // Login voucher: username = password.
  // Berguna untuk login non-CHAP MikroTik.
  // Login CHAP tetap memakai doLogin() bawaan halaman.
  // ---------------------------------------------------------
  function initVoucherPasswordMirror() {
    var form = document.forms.login;

    if (!form || !form.username || !form.password) return;

    form.addEventListener("submit", function (event) {
      var username = String(form.username.value || "").trim();

      if (!username) {
        if (event && event.preventDefault) event.preventDefault();
        window.clearTimeout(window.loginLoaderTimer);
        window.showLoginNotice("Kode voucher wajib diisi dulu, bro.");
        return false;
      }

      form.username.value = username;
      form.password.value = username;
      return true;
    });
  }

  // ---------------------------------------------------------
  // Konversi waktu MikroTik ke menit.
  // Support contoh: 1w2d3h4m, 02:10:00, 10m, 5m30s.
  // ---------------------------------------------------------
  function toMinutes(text) {
    var value = String(text || "").toLowerCase();
    var total = 0;
    var match = null;

    if (!value) return 9999;

    match = value.match(/(\d+)\s*w/);
    if (match) total += parseInt(match[1], 10) * 10080;

    match = value.match(/(\d+)\s*d/);
    if (match) total += parseInt(match[1], 10) * 1440;

    match = value.match(/(\d+)\s*h/);
    if (match) total += parseInt(match[1], 10) * 60;

    match = value.match(/(\d+)\s*m/);
    if (match) total += parseInt(match[1], 10);

    if (!total) {
      match = value.match(/^(\d+):(\d+):(\d+)/);

      if (match) {
        total =
          parseInt(match[1], 10) * 60 +
          parseInt(match[2], 10) +
          Math.ceil(parseInt(match[3], 10) / 60);
      }
    }

    if (!total) {
      match = value.match(/^(\d+):(\d+)/);

      if (match) {
        total =
          parseInt(match[1], 10) * 60 +
          parseInt(match[2], 10);
      }
    }

    return total || 9999;
  }

  // ---------------------------------------------------------
  // Smart color Sisa Waktu.
  // > 15 menit hijau, < 10 menit kuning, < 5 menit merah.
  // ---------------------------------------------------------
  function initSmartTime() {
    qsa("[data-time-left]").forEach(function (element) {
      var minutes = toMinutes(element.getAttribute("data-time-left"));

      removeClass(element, "smart-green");
      removeClass(element, "smart-yellow");
      removeClass(element, "smart-red");

      if (minutes < 5) {
        addClass(element, "smart-red");
      } else if (minutes < 10) {
        addClass(element, "smart-yellow");
      } else {
        addClass(element, "smart-green");
      }
    });
  }

  // ---------------------------------------------------------
  // Notifikasi saat voucher hampir habis.
  // ---------------------------------------------------------
  function initTimeNotification() {
    var element = qs("[data-time-left]");
    var minutes = element
      ? toMinutes(element.getAttribute("data-time-left"))
      : 9999;

    if (!element || minutes >= 5 || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      new Notification("Home.Net", {
        body: "Waktu voucher kurang dari 5 menit, bro.",
      });

      return;
    }

    if (Notification.permission !== "denied") {
      Notification.requestPermission(function (permission) {
        if (permission === "granted") {
          new Notification("Home.Net", {
            body: "Waktu voucher kurang dari 5 menit, bro.",
          });
        }
      });
    }
  }

  // ---------------------------------------------------------
  // Audio feedback logout / error.
  // Tidak memaksa autoplay bila browser memblokir suara.
  // ---------------------------------------------------------
  function playPageSound(selector) {
    var audio = qs(selector);

    if (!audio || typeof audio.play !== "function") return;

    audio.play().catch(function () {
      // Browser biasanya butuh interaksi user dulu, jadi aman diabaikan.
    });
  }

  function initPageSounds() {
    playPageSound("#logoutSound");
    playPageSound("#errorSound");
  }

  // ---------------------------------------------------------
  // Init semua fitur setelah DOM siap.
  // ---------------------------------------------------------
  function initHomeNetApp() {
    initTheme();
    initLoader();
    initVoucherPasswordMirror();
    initSmartTime();
    initTimeNotification();
    initPageSounds();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHomeNetApp);
  } else {
    initHomeNetApp();
  }

  // ---------------------------------------------------------
  // Expose kecil untuk debug kalau dibutuhkan.
  // ---------------------------------------------------------
  window.HomeNetApp = {
    init: initHomeNetApp,
    showLoader: window.showLoader,
    toMinutes: toMinutes,
  };
})();
