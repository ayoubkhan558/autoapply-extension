// Settings/profile/import status presentation.
// Classic-script module; dependency order is declared in config/modules.json.
function setStatus(t, kind) {
  const s = document.getElementById("status");
  if (s) {
    s.textContent = t;
    s.className = "aa-status " + (kind ? "aa-" + kind : "");
  }
  let toast = document.getElementById("saveToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "saveToast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = t || "";
  toast.className = "aa-save-toast " + (kind ? "aa-" + kind : "");
  if (t) {
    toast.classList.add("aa-is-visible");
    clearTimeout(window.__aaSaveStatusTimer);
    window.__aaSaveStatusTimer = setTimeout(function () {
      if (s) s.textContent = "";
      toast.classList.remove("aa-is-visible");
    }, 3500);
  }
}

function setElStatus(id, baseClass, t, kind) {
  const s = document.getElementById(id);
  if (!s) return;
  s.textContent = t;
  s.className = baseClass + " " + (kind ? "aa-" + kind : "");
}
function setRawStatus(t, kind) { setElStatus("rawStatus", "aa-raw-status", t, kind); }
function setAiStatus(t, kind) { setElStatus("aiStatus", "aa-status", t, kind); }
function setAiImportStatus(t, kind) {
  setElStatus("aiImportStatus", "aa-status", t, kind);
  const wrap = document.querySelector(".aa-profile-import-note");
  if (wrap) wrap.classList.toggle("aa-hidden", !t);
}
