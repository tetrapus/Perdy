tableDragEvent = null;
linkDragEvent = null;

const modelData = document.getElementById("model-data");

var cumulativeOffset = function(element) {
    var top = 0, left = 0;
    do {
        top += element.offsetTop  || 0;
        left += element.offsetLeft || 0;
        element = element.parentNode;
    } while(element);

    return {x: left, y: top};
};

function connect(from, to, color) {
  if (from.x > to.x) {
    var temp = from;
    from = to;
    to = temp;
  }
  const c = document.getElementById("connectors");
  const ctx = c.getContext("2d");
  const radius = 6;
  const tangentY= (from.y > to.y)? -radius : radius;
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  if (Math.abs(from.y - to.y) > 8) {
    ctx.lineTo((from.x + to.x) / 2 - radius, from.y);
    ctx.arcTo((from.x + to.x) / 2, from.y, (from.x + to.x) / 2, from.y + tangentY, radius);
    ctx.lineTo((from.x + to.x) / 2, to.y - tangentY);
    ctx.arcTo((from.x + to.x) / 2, to.y, (from.x + to.x) / 2 + radius, to.y, radius);
    ctx.stroke();
  }
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function load(tables, links) {
  model = document.getElementById("model");
  model.innerHTML = '';
  tables.forEach((def, tblidx) => {
    const columns = def.columns.map(
      (column, colidx) => `
        <div class="table-column" data-column="${colidx}">
          <div class="column-name"
            data-target="column-text"
            contenteditable=true>${column.name}</div>
          <div class="column-type ${column.type}"></div>
        </div>`
    ); // todo: innertext
    const table = `
      <div id="${def.id}" class="table ${def.class}" data-table=${tblidx}>
        <div class="table-name"
          data-target="table-name-text"
          contenteditable=true>${def.name}</div>
        ${columns.join("\n")}
      </div>
    `;
    model.innerHTML = `
      ${model.innerHTML}
      ${table}
    `;
    const elem = document.getElementById(def.id);
    elem.style.left = `${def.position[0]}px`;
    elem.style.top = `${def.position[1]}px`;
  });

  model.innerHTML = `
    <canvas id="connectors" width="${window.innerWidth}px" height="${window.innerHeight}px"></canvas>
    ${model.innerHTML}
  `;

  function bindEditEvents(elem) {
    elem.addEventListener("keydown", event => {
      if (event.keyCode === 13) {
        event.preventDefault();
        event.stopPropagation();
      }
    });

    elem.addEventListener("keyup", event => {
      console.log(event);
      if (event.keyCode === 13) {
        const column = document.createElement("div");
        let table;
        let idx = elem.parentNode.getAttribute('data-column');
        if (idx === null) {
          idx = 0;
          table = elem.parentNode.getAttribute('data-table');
        } else {
          idx = parseInt(idx) + 1;
          table = elem.parentNode.parentNode.getAttribute('data-table');
        }
        column.innerHTML = `
          <div class="column-name"
            data-target="column-text"
            contenteditable=true></div>
          <div class="column-type natural"></div>
        `;
        column.classList.add("table-column");
        column.setAttribute('data-column', idx);
        Array.from(column.querySelectorAll('[contenteditable=true]')).forEach(bindEditEvents);
        tables[table].columns.splice(idx, 0, {
          'name': '',
          'type': 'natural'
        });
        const parent = document.querySelector(`.table[data-table="${table}"]`);
        // Increment column index for all elems >= idx
        Array.from(parent.querySelectorAll('[data-column]')).forEach(elem => {
          const oldIdx = parseInt(elem.getAttribute('data-column'));
          if (oldIdx >= idx) {
            elem.setAttribute('data-column', oldIdx + 1);
          }
        });
        links.forEach(link => {
          if (link.from.table === table && link.from.column >= idx) {
            link.from.column++;
          } else if (link.to.table === table && link.to.column >= idx) {
            link.to.column++;
          }
        });
        parent.insertBefore(column, parent.querySelector(`[data-column="${idx+1}"]`));
        column.querySelector('[contenteditable=true]').focus();
      } else {
        const column = elem.parentNode.getAttribute('data-column');
        let model;
        if (column !== null) {
          model = tables[elem.parentNode.parentNode.getAttribute('data-table')].columns[column];
        } else {
          model = tables[elem.parentNode.getAttribute('data-table')];
        }
        model.name = elem.innerHTML;
      }
      modelData.value = JSON.stringify({tables: tables, links: links}, null, '  ');
      localStorage.setItem("erd-model", modelData.value);
      redrawLinks();
    });
  }

  Array.from(document.querySelectorAll('[contenteditable=true]')).forEach(bindEditEvents);

  function redrawLinks() {
    const canvas = document.getElementById("connectors");
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    links.forEach(link => {
      const fromEl = document.querySelector(`[data-table="${link.from.table}"] [data-column="${link.from.column}"]`);
      const toEl = document.querySelector(`[data-table="${link.to.table}"] [data-column="${link.to.column}"]`);
      let fromPos = cumulativeOffset(fromEl);
      // For the from pos, we want the left side
      fromPos.x += fromEl.offsetWidth;
      fromPos.y += (fromEl.offsetHeight / 2);
      let toPos = cumulativeOffset(toEl);
      toPos.y += (toEl.offsetHeight / 2);
      connect(fromPos, toPos, link.color);
    });
  }

  Array.from(document.querySelectorAll('.table-name')).forEach(header => {
    function saveDragEvent(evt) {
      const pos = cumulativeOffset(evt.target);
      const offset = {
        x: pos.x - evt.clientX,
        y: pos.y - evt.clientY,
      };

      tableDragEvent = {
        event: evt,
        target: evt.target,
        position: pos,
        offset: offset
      };
    }
    header.addEventListener('mousedown', saveDragEvent);
  });

  Array.from(document.querySelectorAll('.table-column')).forEach(column => {
    function saveDragEvent(evt) {
      let position = cumulativeOffset(column);
      position.x += column.offsetWidth;
      position.y += (column.offsetHeight / 2);
      var target = evt.target;
      if (target.classList.contains('column-name') || target.classList.contains('column-type')) {
        target = target.parentNode;
      }
      linkDragEvent = {
        target: target,
        event: evt,
        position: position
      };
    }
    column.addEventListener('mousedown', saveDragEvent);
  });

  function drag(evt) {
    if (tableDragEvent !== null) {
      const newPosition = [tableDragEvent.offset.x + evt.clientX, tableDragEvent.offset.y + evt.clientY];
      const table = tables.filter(table => table.id === tableDragEvent.target.parentNode.id)[0];
      table.position = newPosition;
      tableDragEvent.target.parentNode.style.left = newPosition[0] + 'px';
      tableDragEvent.target.parentNode.style.top = newPosition[1] + 'px';
      redrawLinks();
    }
    if (linkDragEvent !== null) {
      redrawLinks();
      var newPosition = {x: evt.clientX, y: evt.clientY};
      var target = evt.target;
      if (target.classList.contains('column-name') || target.classList.contains('column-type')) {
        target = target.parentNode;
      }
      if (target.classList.contains('table-column')) {
        newPosition = cumulativeOffset(target);
        newPosition.y += (target.offsetHeight / 2);
      }
      connect(linkDragEvent.position, newPosition);
    }
  }
  function clearDragEvent(evt) {
    if ((tableDragEvent !== null) || (linkDragEvent !== null)) {
      if (linkDragEvent !== null) {
        var target = evt.target;
        if (target.classList.contains('column-name') || target.classList.contains('column-type')) {
          target = target.parentNode;
        }
        if (target.classList.contains('table-column') && (target.parentNode.id !== linkDragEvent.target.parentNode.id)) {
          links.push({
            from: {
              table:linkDragEvent.target.parentNode.getAttribute('data-table'),
              column: linkDragEvent.target.getAttribute('data-column')
            },
            to: {
              table: target.parentNode.getAttribute('data-table'),
              column: target.getAttribute('data-column')
            },
            color: "#888888"
          });
        }
        redrawLinks();
      }
      modelData.value = JSON.stringify({tables: tables, links: links}, null, '  ');
      localStorage.setItem("erd-model", modelData.value);
      tableDragEvent = null;
      linkDragEvent = null;
    }
  }
  document.body.addEventListener('mousemove', drag);
  document.body.addEventListener('mouseup', clearDragEvent);
  document.getElementById("connectors").addEventListener('dblclick', event => {
    let counter = 1;
    while (document.getElementById(`table-${counter}`) !== null) {
      counter++;
    }
    tables.push({
      id: `table-${counter}`,
      name: `New Table`,
      class: "subscription",
      position: [event.clientX, event.clientY],
      columns: [
        {
          name: 'id',
          type: 'natural'
        }
      ]
    });
    modelData.value = JSON.stringify({tables: tables, links: links}, null, '  ');
    localStorage.setItem("erd-model", modelData.value);
    load(tables, links);
  });
  redrawLinks();
}

var data = JSON.parse(localStorage.getItem("erd-model"));
if (data === null) {
  data = {tables: [], links: []};
}
load(data.tables, data.links);

modelData.value = JSON.stringify(data, null, '  ');
modelData.addEventListener("keyup", event => {
  var newData = JSON.parse(modelData.value);
  load(newData.tables, newData.links);
  localStorage.setItem("erd-model", modelData.value);
});

document.getElementById("save").addEventListener('click', event => {
  // find bounds of image
  var min_x, max_x, min_y, max_y;
  Array.from(document.querySelectorAll('.table')).forEach(table => {
    if (min_x === undefined || min_x > table.offsetLeft) {
      min_x = table.offsetLeft;
    }
    if (min_y === undefined || min_y > table.offsetTop) {
      min_y = table.offsetTop;
    }
    if (max_x === undefined || max_x < table.offsetLeft + table.offsetWidth) {
      max_x = table.offsetLeft + table.offsetWidth;
    }
    if (max_y === undefined || max_y < table.offsetTop + table.offsetHeight) {
      max_y = table.offsetTop + table.offsetHeight;
    }
  });
  const padding = 20;
  html2canvas(document.getElementById("model"), {
    onrendered: canvas => {
      clipped = document.createElement('canvas');
      clipped.width = max_x - min_x + 2 * padding;
      clipped.height = max_y - min_y + 2 * padding;
      var ctx = clipped.getContext("2d");
      ctx.drawImage(canvas, -min_x + 20, -min_y + 20);
      document.getElementById("save-contents").innerHTML = "";
      document.getElementById("save-contents").appendChild(clipped);
      document.getElementById("save-contents").classList.remove("hidden");
    },
    width: max_x + padding,
    height: max_y + padding
  });
});
