/* ============================================================
   SchoolTable — xlsx.js
   อ่านไฟล์ .xlsx และ .csv ด้วยตัวเอง โดยไม่ต้องต่ออินเทอร์เน็ต
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- คลายการบีบอัดแบบ deflate (ใช้กับไฟล์ .xlsx) ---------- */
  function inflateRaw(data) {
    var pos = 0, bitBuf = 0, bitCnt = 0;
    var out = new Uint8Array(Math.max(4096, data.length * 8));
    var outLen = 0;

    function ensure(n) {
      if (outLen + n <= out.length) return;
      var size = out.length;
      while (size < outLen + n) size *= 2;
      var next = new Uint8Array(size);
      next.set(out.subarray(0, outLen));
      out = next;
    }
    function bits(n) {
      while (bitCnt < n) {
        if (pos >= data.length) throw new Error('ข้อมูลบีบอัดไม่สมบูรณ์');
        bitBuf |= data[pos++] << bitCnt;
        bitCnt += 8;
      }
      var v = bitBuf & ((1 << n) - 1);
      bitBuf >>>= n;
      bitCnt -= n;
      return v;
    }
    function makeDecoder(lengths) {
      var maxBits = 0, i;
      for (i = 0; i < lengths.length; i++) if (lengths[i] > maxBits) maxBits = lengths[i];
      var blCount = new Int32Array(maxBits + 2);
      for (i = 0; i < lengths.length; i++) if (lengths[i]) blCount[lengths[i]]++;
      var nextCode = new Int32Array(maxBits + 2);
      var code = 0;
      for (var b = 1; b <= maxBits; b++) { code = (code + blCount[b - 1]) << 1; nextCode[b] = code; }
      var table = {};
      for (i = 0; i < lengths.length; i++) {
        var len = lengths[i];
        if (!len) continue;
        table[len + ':' + nextCode[len]] = i;
        nextCode[len]++;
      }
      return { table: table, maxBits: maxBits };
    }
    function decode(dec) {
      var code = 0;
      for (var len = 1; len <= dec.maxBits; len++) {
        code = (code << 1) | bits(1);
        var sym = dec.table[len + ':' + code];
        if (sym !== undefined) return sym;
      }
      throw new Error('รหัสในไฟล์บีบอัดไม่ถูกต้อง');
    }

    var LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
    var LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
    var DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
    var DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
    var ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

    var fixedLit = null, fixedDist = null;
    function fixedTrees() {
      if (fixedLit) return;
      var l = new Array(288), i;
      for (i = 0; i < 144; i++) l[i] = 8;
      for (; i < 256; i++) l[i] = 9;
      for (; i < 280; i++) l[i] = 7;
      for (; i < 288; i++) l[i] = 8;
      fixedLit = makeDecoder(l);
      var d = new Array(30);
      for (i = 0; i < 30; i++) d[i] = 5;
      fixedDist = makeDecoder(d);
    }

    var last = 0;
    while (!last) {
      last = bits(1);
      var type = bits(2);
      if (type === 0) {
        bitBuf = 0; bitCnt = 0;
        var len = data[pos] | (data[pos + 1] << 8);
        pos += 4;
        ensure(len);
        out.set(data.subarray(pos, pos + len), outLen);
        outLen += len;
        pos += len;
        continue;
      }
      var litDec, distDec;
      if (type === 1) {
        fixedTrees();
        litDec = fixedLit; distDec = fixedDist;
      } else if (type === 2) {
        var hlit = bits(5) + 257;
        var hdist = bits(5) + 1;
        var hclen = bits(4) + 4;
        var clLengths = new Array(19).fill(0);
        for (var c = 0; c < hclen; c++) clLengths[ORDER[c]] = bits(3);
        var clDec = makeDecoder(clLengths);
        var lengths = [];
        while (lengths.length < hlit + hdist) {
          var sym = decode(clDec);
          if (sym < 16) lengths.push(sym);
          else if (sym === 16) {
            var prev = lengths[lengths.length - 1];
            var rep = bits(2) + 3;
            while (rep--) lengths.push(prev);
          } else if (sym === 17) {
            var rep2 = bits(3) + 3;
            while (rep2--) lengths.push(0);
          } else {
            var rep3 = bits(7) + 11;
            while (rep3--) lengths.push(0);
          }
        }
        litDec = makeDecoder(lengths.slice(0, hlit));
        distDec = makeDecoder(lengths.slice(hlit, hlit + hdist));
      } else {
        throw new Error('รูปแบบการบีบอัดในไฟล์นี้ไม่รองรับ');
      }

      for (;;) {
        var s = decode(litDec);
        if (s === 256) break;
        if (s < 256) {
          ensure(1);
          out[outLen++] = s;
        } else {
          var li = s - 257;
          var length = LEN_BASE[li] + bits(LEN_EXTRA[li]);
          var ds = decode(distDec);
          var dist = DIST_BASE[ds] + bits(DIST_EXTRA[ds]);
          ensure(length);
          var from = outLen - dist;
          for (var k = 0; k < length; k++) out[outLen++] = out[from + k];
        }
      }
    }
    return out.subarray(0, outLen);
  }

  /* ---------- แกะไฟล์ zip ---------- */
  function unzip(arrayBuffer) {
    var data = new Uint8Array(arrayBuffer);
    var view = new DataView(arrayBuffer);
    /* หา End of Central Directory */
    var eocd = -1;
    for (var i = data.length - 22; i >= 0 && i > data.length - 66000; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์ Excel ที่ถูกต้อง');
    var count = view.getUint16(eocd + 10, true);
    var cdOffset = view.getUint32(eocd + 16, true);

    var files = {};
    var p = cdOffset;
    for (var n = 0; n < count; n++) {
      if (view.getUint32(p, true) !== 0x02014b50) break;
      var method = view.getUint16(p + 10, true);
      var compSize = view.getUint32(p + 20, true);
      var nameLen = view.getUint16(p + 28, true);
      var extraLen = view.getUint16(p + 30, true);
      var commentLen = view.getUint16(p + 32, true);
      var localOffset = view.getUint32(p + 42, true);
      var name = utf8Decode(data.subarray(p + 46, p + 46 + nameLen));

      var lnLen = view.getUint16(localOffset + 26, true);
      var leLen = view.getUint16(localOffset + 28, true);
      var dataStart = localOffset + 30 + lnLen + leLen;
      var raw = data.subarray(dataStart, dataStart + compSize);
      files[name] = method === 0 ? raw : inflateRaw(raw);
      p += 46 + nameLen + extraLen + commentLen;
    }
    return files;
  }

  function utf8Decode(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
  }

  /* ---------- อ่านเนื้อหาแผ่นงานแรกของไฟล์ .xlsx ---------- */
  function parseXlsx(arrayBuffer) {
    var files = unzip(arrayBuffer);
    var sheetName = null;
    Object.keys(files).forEach(function (name) {
      if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
        if (!sheetName || name < sheetName) sheetName = name;
      }
    });
    if (!sheetName) throw new Error('ไม่พบแผ่นงานในไฟล์นี้');

    var shared = [];
    if (files['xl/sharedStrings.xml']) {
      var sx = utf8Decode(files['xl/sharedStrings.xml']);
      var siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g, m;
      while ((m = siRe.exec(sx))) {
        var text = '';
        var tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g, tm;
        while ((tm = tRe.exec(m[1]))) text += decodeXml(tm[1]);
        shared.push(text);
      }
    }

    var sheet = utf8Decode(files[sheetName]);
    var rows = [];
    var rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g, rm;
    while ((rm = rowRe.exec(sheet))) {
      var cells = [];
      var cRe = /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g, cm;
      while ((cm = cRe.exec(rm[1]))) {
        var attrs = cm[1] || cm[2] || '';
        var inner = cm[3] || '';
        var refMatch = /r="([A-Z]+)\d+"/.exec(attrs);
        var col = refMatch ? colIndex(refMatch[1]) : cells.length;
        var type = (/t="([^"]+)"/.exec(attrs) || [])[1];
        var value = '';
        if (type === 'inlineStr') {
          var isRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g, im;
          while ((im = isRe.exec(inner))) value += decodeXml(im[1]);
        } else {
          var vm = /<v>([\s\S]*?)<\/v>/.exec(inner);
          if (vm) {
            value = decodeXml(vm[1]);
            if (type === 's') value = shared[Number(value)] || '';
          }
        }
        while (cells.length < col) cells.push('');
        cells[col] = value;
      }
      rows.push(cells);
    }
    return rows;
  }

  function colIndex(letters) {
    var n = 0;
    for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
    return n - 1;
  }

  function decodeXml(s) {
    return String(s)
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); })
      .replace(/&amp;/g, '&');
  }

  /* ---------- CSV ---------- */
  function parseCsv(text) {
    var clean = String(text).replace(/^﻿/, '');
    var rows = [], row = [], field = '', inQuotes = false;
    for (var i = 0; i < clean.length; i++) {
      var ch = clean[i];
      if (inQuotes) {
        if (ch === '"') {
          if (clean[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
        continue;
      }
      if (ch === '"') { inQuotes = true; continue; }
      if (ch === ',') { row.push(field); field = ''; continue; }
      if (ch === '\r') continue;
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
      field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }

  function toCsv(rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        var s = c === null || c === undefined ? '' : String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  }

  global.ST.xlsx = {
    inflateRaw: inflateRaw,
    unzip: unzip,
    parseXlsx: parseXlsx,
    parseCsv: parseCsv,
    toCsv: toCsv
  };
})(typeof window !== 'undefined' ? window : globalThis);
