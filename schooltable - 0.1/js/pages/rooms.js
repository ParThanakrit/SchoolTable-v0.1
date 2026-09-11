/* หน้า P3 — อาคารและห้อง (กล่องเดียว สลับดูห้อง/อาคารได้) */
(function (global) {
  'use strict';
  var U = global.ST.util, M = global.ST.model, UI = global.ST.ui;
  global.ST.pages = global.ST.pages || {};

  var buildingFilter = '';   /* '' = ทุกอาคาร */
  var view = 'rooms';        /* 'rooms' | 'buildings' */

  global.ST.pages.rooms = {
    render: function (root) {
      var app = global.ST.app;
      var st = app.state();
      if (buildingFilter && !U.byId(st.buildings, buildingFilter)) buildingFilter = '';

      UI.pageHeader(root, {
        title: 'อาคารและห้อง',
        desc: 'เก็บอาคารและห้องสถานที่ไว้ในกล่องเดียว สลับดูเป็นรายห้องหรือรายอาคารได้ พร้อมกรองตามอาคารและค้นหาชื่อ',
        actions: [
          { label: '❓ ช่วยเหลือ', onClick: function () { global.ST.help.show('rooms'); } },
          { label: '+ เพิ่มอาคาร', onClick: function () { buildingForm(); } },
          { label: '+ เพิ่มห้อง', className: 'btn--primary', onClick: function () { roomForm(); } },
          { label: '📥 นำเข้าจากไฟล์', onClick: function () { app.go('import', { kind: 'rooms' }); } }
        ]
      });

      /* ---------- กล่องเดียว + ตัวเลือกมุมมอง ---------- */
      var card = U.elFromHTML('<div class="card">' +
        '<div class="rooms-head">' +
        '<div><div class="card__title">อาคารและห้อง</div>' +
        '<div class="card__desc mb-0">เลือกดูได้ว่าจะดูรายห้องหรือรายอาคาร</div></div>' +
        '<div class="view-switch" id="rmView">' +
        '<button type="button" data-view="rooms"' + (view === 'rooms' ? ' class="is-active"' : '') +
        '>ห้อง ' + U.fmtNum(st.rooms.length) + '</button>' +
        '<button type="button" data-view="buildings"' + (view === 'buildings' ? ' class="is-active"' : '') +
        '>อาคาร ' + U.fmtNum(st.buildings.length) + '</button>' +
        '</div></div>' +
        '<div id="rmHost"></div></div>');
      var host = card.querySelector('#rmHost');
      U.on(card.querySelector('#rmView'), 'click', 'button', function (ev, btn) {
        view = btn.dataset.view;
        app.refresh();
      });
      root.appendChild(card);

      if (view === 'buildings') renderBuildings(host);
      else renderRooms(host);

      /* ---------- มุมมอง: อาคาร ---------- */
      function renderBuildings(hostEl) {
        if (!st.buildings.length) {
          hostEl.appendChild(UI.emptyState({
            icon: '🏢', title: 'ยังไม่มีอาคารในระบบ',
            desc: 'เพิ่มอาคารก่อน แล้วจึงเพิ่มห้องเข้าไปในอาคาร',
            actions: [{ label: 'เพิ่มอาคาร', onClick: function () { buildingForm(); } }]
          }));
          return;
        }
        var wrap = U.elFromHTML('<div class="table-wrap"><table class="data"><thead><tr>' +
          '<th>ชื่ออาคาร</th><th class="num">จำนวนห้อง</th><th class="col-actions"></th>' +
          '</tr></thead><tbody></tbody></table></div>');
        wrap.querySelector('tbody').innerHTML = st.buildings.map(function (b) {
          var count = st.rooms.filter(function (r) { return r.buildingId === b.id; }).length;
          return '<tr><td><b>' + U.esc(b.name) + '</b></td>' +
            '<td class="num">' + U.fmtNum(count) + ' ห้อง</td>' +
            '<td class="col-actions"><div class="row-actions">' +
            '<button type="button" class="btn btn--sm" data-act="bshow" data-b="' + b.id + '">ดูห้อง</button>' +
            '<button type="button" class="btn btn--sm" data-act="bedit" data-b="' + b.id + '">แก้ไข</button>' +
            '<button type="button" class="btn btn--sm btn--danger-ghost" data-act="bdel" data-b="' + b.id + '">ลบ</button>' +
            '</div></td></tr>';
        }).join('');
        U.on(wrap, 'click', 'button[data-act="bshow"]', function (ev, btn) {
          buildingFilter = btn.dataset.b; view = 'rooms'; app.refresh();
        });
        U.on(wrap, 'click', 'button[data-act="bedit"]', function (ev, btn) {
          buildingForm(U.byId(st.buildings, btn.dataset.b));
        });
        U.on(wrap, 'click', 'button[data-act="bdel"]', function (ev, btn) {
          var b = U.byId(st.buildings, btn.dataset.b);
          UI.deleteWithGuard({
            what: 'อาคาร', name: b.name,
            references: M.referencesOfBuilding(st, b.id),
            fix: 'ให้ย้ายห้องทั้งหมดไปอาคารอื่น หรือลบห้องเหล่านั้นก่อน แล้วจึงลบอาคารนี้'
          }).then(function (ok) {
            if (!ok) return;
            st.buildings = st.buildings.filter(function (x) { return x.id !== b.id; });
            if (buildingFilter === b.id) buildingFilter = '';
            app.saveAndRefresh('ลบอาคารแล้ว');
          });
        });
        hostEl.appendChild(wrap);
      }

      /* ---------- มุมมอง: ห้องทั้งหมด ---------- */
      function renderRooms(hostEl) {
        if (!st.buildings.length) {
          hostEl.appendChild(UI.emptyState({
            icon: '🚪', title: 'ยังไม่มีห้อง',
            desc: 'เพิ่มอาคารก่อน แล้วจึงเพิ่มห้องเข้าไป',
            actions: [{ label: 'เพิ่มอาคาร', onClick: function () { buildingForm(); } }]
          }));
          return;
        }
        var buildingFilterSel = U.elFromHTML('<select class="select" aria-label="กรองตามอาคาร">' +
          '<option value="">ทุกอาคาร</option>' +
          st.buildings.map(function (b) {
            return '<option value="' + b.id + '"' + (buildingFilter === b.id ? ' selected' : '') + '>' + U.esc(b.name) + '</option>';
          }).join('') + '</select>');
        buildingFilterSel.addEventListener('change', function () {
          buildingFilter = buildingFilterSel.value; app.refresh();
        });

        var table = UI.dataTable({
          rows: U.sortThai(st.rooms, function (r) { return r.name; }),
          tools: [buildingFilterSel],
          searchPlaceholder: 'ค้นหาชื่อห้อง…',
          filter: function (r, term) { return r.name.toLowerCase().indexOf(term) !== -1; },
          extraFilter: function (r) { return !buildingFilter || r.buildingId === buildingFilter; },
          empty: {
            icon: '🚪',
            title: st.rooms.length ? 'ไม่พบห้องที่ตรงกับเงื่อนไข' : 'ยังไม่มีห้องในระบบ',
            desc: st.rooms.length ? 'ลองเปลี่ยนอาคาร หรือแก้คำค้น' : 'เพิ่มห้องเข้าไปในอาคาร หรือใช้การนำเข้าจากไฟล์',
            actions: [{ label: 'เพิ่มห้อง', onClick: function () { roomForm(); } }]
          },
          columns: [
            { label: 'ชื่อห้อง', render: function (r) { return '<b>' + U.esc(r.name) + '</b>'; } },
            {
              label: 'อาคาร', render: function (r) {
                var b = U.byId(st.buildings, r.buildingId);
                return U.esc(b ? b.name : '-');
              }
            },
            { label: 'ชั้น', className: 'num', render: function (r) { return 'ชั้น ' + U.num(r.floor); } },
            { label: 'ความจุ', className: 'num', render: function (r) { return U.fmtNum(r.capacity) + ' คน'; } },
            {
              label: 'ใช้เป็นห้องประจำของ', render: function (r) {
                var secs = st.classSections.filter(function (s) { return s.homeRoomId === r.id; });
                return secs.length ? U.esc(secs.map(function (s) { return s.name; }).join(', ')) : '<span class="muted">-</span>';
              }
            },
            {
              label: '', className: 'col-actions', render: function (r) {
                return '<div class="row-actions">' +
                  '<button type="button" class="btn btn--sm" data-act="edit" data-id="' + r.id + '">แก้ไข</button>' +
                  '<button type="button" class="btn btn--sm btn--danger-ghost" data-act="del" data-id="' + r.id + '">ลบ</button></div>';
              }
            }
          ],
          onRendered: function (body) {
            U.on(body, 'click', 'button[data-act="edit"]', function (ev, btn) {
              roomForm(U.byId(st.rooms, btn.dataset.id));
            });
            U.on(body, 'click', 'button[data-act="del"]', function (ev, btn) {
              var room = U.byId(st.rooms, btn.dataset.id);
              UI.deleteWithGuard({
                what: 'ห้อง', name: room.name,
                references: M.referencesOfRoom(st, room.id),
                fix: 'ให้เปลี่ยนห้องในการจัดครูผู้สอนและห้องประจำของชั้นเรียนก่อน หรือลบตารางที่ใช้ห้องนี้'
              }).then(function (ok) {
                if (!ok) return;
                st.rooms = st.rooms.filter(function (x) { return x.id !== room.id; });
                app.saveAndRefresh('ลบห้องแล้ว');
              });
            });
          }
        });
        hostEl.appendChild(table);
      }

      /* ---------- ฟอร์ม ---------- */
      function buildingForm(building) {
        UI.formModal({
          title: building ? 'แก้ไขอาคาร' : 'เพิ่มอาคาร',
          values: building ? { name: building.name } : { name: '' },
          fields: [{ name: 'name', label: 'ชื่ออาคาร', required: true, hint: 'เช่น อาคาร 1, อาคารวิทยาศาสตร์' }],
          onSubmit: function (v) {
            var name = String(v.name || '').trim();
            if (!name) return { ok: false, errors: { name: 'ต้องกรอกชื่ออาคาร' } };
            var dup = st.buildings.some(function (b) {
              return b.name === name && (!building || b.id !== building.id);
            });
            if (dup) return { ok: false, errors: { name: 'มีอาคารชื่อนี้อยู่แล้ว ให้ใช้ชื่ออื่น' } };
            if (building) building.name = name;
            else {
              var rec = { id: U.uid('bd'), name: name, order: st.buildings.length + 1 };
              st.buildings.push(rec);
              buildingFilter = rec.id;
            }
            app.saveAndRefresh('บันทึกอาคารแล้ว');
          }
        });
      }

      function roomForm(room) {
        if (!st.buildings.length) {
          U.explainDialog({
            title: 'เพิ่มห้องไม่ได้',
            cause: 'ยังไม่มีอาคารในระบบ ห้องต้องระบุอาคารเสมอ',
            fix: 'ให้กดปุ่มเพิ่มอาคารก่อน แล้วจึงเพิ่มห้อง'
          });
          return;
        }
        UI.formModal({
          title: room ? 'แก้ไขห้อง' : 'เพิ่มห้อง',
          values: room ? U.deepClone(room) : {
            name: '', buildingId: buildingFilter || st.buildings[0].id, floor: 1, capacity: 40
          },
          fields: [
            { name: 'name', label: 'ชื่อห้อง', required: true, hint: 'เช่น 141 หรือ ปฏิบัติการวิทย์ 1' },
            {
              name: 'buildingId', label: 'อาคาร', type: 'select',
              options: st.buildings.map(function (b) { return { value: b.id, label: b.name }; })
            },
            {
              name: 'floor', label: 'ชั้นที่ห้องนี้อยู่', type: 'number', min: 1, max: 20,
              hint: 'ใช้คำนวณระยะเดินระหว่างคาบ ห้องที่อยู่อาคารเดียวกันชั้นเดียวกันถือว่าเดินใกล้ที่สุด'
            },
            { name: 'capacity', label: 'ความจุ (คน)', type: 'number', min: 0, hint: 'ใช้เตือนเมื่อชั้นเรียนใหญ่กว่าห้อง' }
          ],
          onSubmit: function (v) {
            var name = String(v.name || '').trim();
            if (!name) return { ok: false, errors: { name: 'ต้องกรอกชื่อห้อง' } };
            var dup = st.rooms.some(function (r) {
              return r.name === name && r.buildingId === v.buildingId && (!room || r.id !== room.id);
            });
            if (dup) return { ok: false, errors: { name: 'มีห้องชื่อนี้ในอาคารเดียวกันอยู่แล้ว ให้ใช้ชื่ออื่น' } };
            if (room) {
              room.name = name; room.buildingId = v.buildingId;
              room.capacity = U.num(v.capacity);
              room.floor = Math.max(1, U.num(v.floor) || 1);
            } else {
              st.rooms.push({
                id: U.uid('rm'), name: name, buildingId: v.buildingId,
                floor: Math.max(1, U.num(v.floor) || 1), capacity: U.num(v.capacity)
              });
              buildingFilter = v.buildingId;
            }
            app.saveAndRefresh('บันทึกห้องแล้ว');
          }
        });
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
