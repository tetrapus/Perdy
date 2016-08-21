tableDragEvent = null;
linkDragEvent = null;

const modelData = document.getElementById("model-data");

function load(tables, links) {
  model = document.getElementById("model");
  model.innerHTML = '';
  tables.forEach(def => {
    const columns = def.columns.map(
      column => `
        <div class="table-column" data-column="${column.name}">
          <div class="column-name">${column.name}</div>
          <div class="column-type ${column.type}"></div>
        </div>`
    );
    const table = `
      <div id="${def.id}" class="table ${def.class}">
        <div class="table-name">${def.name}</div>
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
    //ctx.setLineDash([5, 1]);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    //ctx.setLineDash([]);
  }

  function redrawLinks() {
    const canvas = document.getElementById("connectors");
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    links.forEach(link => {
      const fromEl = document.querySelector(link.from);
      const toEl = document.querySelector(link.to);
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
            from: `#${linkDragEvent.target.parentNode.id} [data-column=${linkDragEvent.target.getAttribute('data-column')}]`,
            to: `#${target.parentNode.id} [data-column=${target.getAttribute('data-column')}]`,
            color: "#888888",
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
    while (document.getElementById(`membership-new-table-${counter}-table`) !== null) {
      counter++;
    }
    tables.push({
      id: `membership-new-table-${counter}-table`,
      name: `New Table ${counter}`,
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
