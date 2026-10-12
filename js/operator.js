/* 運営用：QR 読み取り・集計・CSV（データは この端末の LocalStorage のみ） */
(function () {
  const BCT = window.BCT;
  const $ = (id) => document.getElementById(id);
  const KEY = "bct-operator-v1";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let rows = load();

  function load() {
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || "{}");
      return r && typeof r === "object" ? r : {};
    } catch (e) {
      return {};
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) { alert("保存できませんでした: " + e.message); }
  }

  // ---------- 読み取ったデータの確認（信用しない前提で 整える） ----------
  const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  const str = (v, max) => String(v == null ? "" : v).slice(0, max);
  function normalize(text) {
    let d;
    try { d = JSON.parse(text); } catch (e) { return { err: "ビーチクリーン探検隊のQRではありません" }; }
    if (!d || d.app !== "bct") return { err: "ビーチクリーン探検隊のQRではありません" };
    if (d.v !== 2) return { err: "アプリの版が違います（v=" + esc(d.v) + "）。参加者のアプリを開き直してもらってください" };
    if (!d.id) return { err: "端末IDがありません" };
    const tr = {};
    BCT.TRASH.forEach((t) => { tr[t.key] = int(d.tr && d.tr[t.key], 9999); });
    const bd = Array.isArray(d.bd) ? d.bd.filter((b) => BCT.badgeOf(b)).slice(0, 50) : [];
    return {
      row: {
        id: str(d.id, 40),
        tm: str(d.tm, 30) || "（名前なし）",
        n: int(d.n, 99),
        pet: BCT.pets.TYPES[d.pet] ? d.pet : "",
        pn: str(d.pn, 30),
        lv: int(d.lv, 99),
        xp: int(d.xp, 999999),
        rc: int(d.rc, 99999),
        qz: int(d.qz, 999),
        cm: int(d.cm, 99),
        ev: str(d.ev, 60),
        tr,
        bd,
        t: int(d.t, 4102444800),
        at: Date.now(),
      },
    };
  }

  function add(text) {
    const r = normalize(text);
    const last = $("last");
    if (r.err) {
      last.className = "last ng";
      last.textContent = "⚠ " + r.err;
      return false;
    }
    const existed = !!rows[r.row.id];
    rows[r.row.id] = r.row;
    save();
    render();
    last.className = "last ok";
    last.textContent = `✅ ${r.row.tm}（Lv${r.row.lv}・ゴミ${r.row.rc}こ）を${existed ? "上書き" : "追加"}しました`;
    $("cam").classList.remove("flashok");
    void $("cam").offsetWidth;
    $("cam").classList.add("flashok");
    beep();
    return true;
  }

  function beep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = beep.ac || (beep.ac = new AC());
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 1320;
      g.gain.value = 0.08;
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.12);
    } catch (e) { /* 音が出なくても よい */ }
  }

  // ---------- 表示 ----------
  // 清掃量・成績で 順位を つけない（読み取った順 か 隊の名前順 のみ）
  function sorted() {
    const k = $("sort").value;
    const list = Object.values(rows);
    return list.sort((a, b) => (k === "name" ? a.tm.localeCompare(b.tm, "ja") : a.at - b.at));
  }

  function render() {
    const list = sorted();
    const total = (f) => list.reduce((s, r) => s + f(r), 0);
    const people = total((r) => r.n);
    $("sum").innerHTML = [
      ["読み取った隊", list.length + " 隊"],
      ["参加人数（入力あり）", people + " 人"],
      ["ゴミの合計", total((r) => r.rc) + " こ"],
      ["クイズ クリア 合計", total((r) => r.qz) + " 問"],
      ["そうじミッション 合計", total((r) => r.cm) + " こ"],
      ["称号 合計", total((r) => r.bd.length) + " こ"],
    ].map(([l, v]) => `<div class="stat"><div class="num" style="font-size:18px">${v}</div><div class="lbl">${l}</div></div>`).join("");

    const head = `<tr><th>No.</th><th>隊の名前</th><th>人数</th><th>ようせい</th><th>Lv</th><th>ゴミ</th>
      ${BCT.TRASH.map((t) => `<th title="${t.name}">${t.ico}</th>`).join("")}
      <th>クイズ</th><th>そうじ</th><th>称号</th><th>読取</th><th></th></tr>`;
    const body = list.map((r, i) => {
      const petName = r.pet ? `${BCT.pets.TYPES[r.pet].motif}` : "";
      const at = new Date(r.at);
      return `<tr><td class="num">${i + 1}</td><td>${esc(r.tm)}</td><td class="num">${r.n || "-"}</td>
        <td>${esc(petName)}${r.pn ? `<br><span class="note">${esc(r.pn)}</span>` : ""}</td>
        <td class="num">${r.lv}</td><td class="num">${r.rc}</td>
        ${BCT.TRASH.map((t) => `<td class="num">${r.tr[t.key] || ""}</td>`).join("")}
        <td class="num">${r.qz}</td><td class="num">${r.cm}</td>
        <td>${r.bd.map((b) => `<span class="operator-badge-art" role="img" aria-label="${esc(BCT.badgeOf(b).name)}" title="${esc(BCT.badgeOf(b).name)}">${BCT.collectionArt.badge(b)}</span>`).join("")}</td>
        <td>${at.getHours()}:${String(at.getMinutes()).padStart(2, "0")}</td>
        <td><button class="del" data-del="${esc(r.id)}">削除</button></td></tr>`;
    }).join("");
    $("tbl").innerHTML = head + (body || `<tr><td colspan="99" class="note">まだ読み取っていません</td></tr>`);

    const byType = {};
    BCT.TRASH.forEach((t) => { byType[t.key] = total((r) => r.tr[t.key] || 0); });
    const max = Math.max(1, ...Object.values(byType));
    $("bars").innerHTML = BCT.TRASH.map((t) => `<div class="row"><span class="name">${t.ico} ${t.name}</span>
      <span class="bar"><div style="width:${(byType[t.key] / max) * 100}%;background:${t.color}"></div></span>
      <span class="n">${byType[t.key]}</span></div>`).join("");

    const byBadge = {};
    BCT.BADGES.forEach((b) => { byBadge[b.id] = list.filter((r) => r.bd.includes(b.id)).length; });
    const bmax = Math.max(1, list.length);
    $("bdBars").innerHTML = BCT.BADGES.map((b) => `<div class="row"><span class="name" style="width:190px"><span class="operator-badge-art">${BCT.collectionArt.badge(b.id)}</span> ${b.name}</span>
      <span class="bar"><div style="width:${(byBadge[b.id] / bmax) * 100}%;background:#ffd85e"></div></span>
      <span class="n">${byBadge[b.id]}</span></div>`).join("");
  }

  // ---------- CSV（Excel で 文字化けしないよう BOM 付き UTF-8） ----------
  function buildCsv() {
    const list = sorted();
    const cell = (v) => {
      let s = String(v == null ? "" : v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // Excel の数式として 動かないように
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ["No.", "隊の名前", "人数", "ようせい", "ようせいの名前", "Lv", "けいけんち", "ゴミの数",
      ...BCT.TRASH.map((t) => t.name), "クイズクリア", "そうじミッション", ...BCT.BADGES.map((b) => b.name), "イベントID", "端末ID", "QR作成時刻", "読取時刻"];
    const fmt = (ms) => {
      const d = new Date(ms);
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    const lines = [head.map(cell).join(",")];
    list.forEach((r, i) => {
      lines.push([
        i + 1, r.tm, r.n || "", r.pet ? BCT.pets.TYPES[r.pet].motif : "", r.pn, r.lv, r.xp, r.rc,
        ...BCT.TRASH.map((t) => r.tr[t.key] || 0), r.qz, r.cm,
        ...BCT.BADGES.map((b) => (r.bd.includes(b.id) ? "○" : "")),
        r.ev, r.id, r.t ? fmt(r.t * 1000) : "", fmt(r.at),
      ].map(cell).join(","));
    });
    return String.fromCharCode(0xfeff) + lines.join("\r\n");
  }
  function csv() {
    const blob = new Blob([buildCsv()], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    const d = new Date();
    a.download = `beach-clean-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.csv`;
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- カメラ ----------
  let stream = null, timer = null, detector = null, lastText = "", lastAt = 0;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  async function pickEngine() {
    try {
      if ("BarcodeDetector" in window) {
        const fmts = await BarcodeDetector.getSupportedFormats();
        if (fmts.includes("qr_code")) {
          detector = new BarcodeDetector({ formats: ["qr_code"] });
          $("engine").textContent = "ブラウザ内蔵（BarcodeDetector）";
          return;
        }
      }
    } catch (e) { /* jsQR へ */ }
    detector = null;
    $("engine").textContent = "jsQR";
  }

  async function startCam() {
    if (stream) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      $("camMsg").textContent = "このブラウザではカメラが使えません。https で開いているか確認してください。";
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    } catch (e) {
      $("camMsg").textContent = "カメラを起動できませんでした（" + e.name + "）。カメラの許可を確認してください。";
      return;
    }
    await pickEngine();
    const v = $("video");
    v.srcObject = stream;
    await v.play().catch(() => {});
    $("camMsg").style.display = "none";
    scan();
  }
  function stopCam() {
    clearTimeout(timer);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    $("camMsg").style.display = "flex";
    $("camMsg").textContent = "停止中";
  }

  async function scan() {
    if (!stream) return;
    const v = $("video");
    let text = null;
    try {
      if (v.readyState >= 2 && v.videoWidth) {
        if (detector) {
          const codes = await detector.detect(v);
          if (codes.length) text = codes[0].rawValue;
        } else if (window.jsQR) {
          const w = 640, h = Math.round((v.videoHeight / v.videoWidth) * 640);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
          if (code) text = code.data;
        }
      }
    } catch (e) {
      console.warn(e);
    }
    // 同じ QR を 続けて 何度も 読まない
    if (text && (text !== lastText || Date.now() - lastAt > 4000)) {
      lastText = text;
      lastAt = Date.now();
      add(text);
    }
    timer = setTimeout(scan, 250);
  }

  // ---------- イベント ----------
  $("camStart").onclick = startCam;
  $("camStop").onclick = stopCam;
  $("sort").onchange = render;
  $("csv").onclick = csv;
  $("clear").onclick = () => {
    if (!confirm("読み取ったデータを全部消します。先に CSV を書き出しましたか？")) return;
    if (!confirm("本当に全部消しますか？ 元に戻せません。")) return;
    rows = {};
    save();
    render();
  };
  $("tbl").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    const r = rows[b.dataset.del];
    if (r && confirm(`「${r.tm}」を一覧から消しますか？`)) {
      delete rows[b.dataset.del];
      save();
      render();
    }
  });
  $("manualAdd").onclick = () => {
    if (add($("manual").value.trim())) $("manual").value = "";
  };

  render();
  BCT.operator = { add, rows: () => rows, buildCsv, normalize };
})();
