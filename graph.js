// Set paths and options
const guides = {
  General: {
    'Info-Microservices': {
      data: 'https://raw.githubusercontent.com/luckyfun/test/main/legend_rhony.csv',
      url: 'https://taptap.com.vn',
      strength: -8500,
      distance: 800,
      radius: 0.6
    }
  }
};

const commanders = 'https://raw.githubusercontent.com/luckyfun/test/main/commanders.json';

// Set initial options
const options_type = Object.keys(guides);
const select_type = document.getElementById('dropdown_type');
const select_guide = document.getElementById('dropdown_guide');

for (let i = 0; i < options_type.length; i++) {
  opt = document.createElement('option');
  opt.textContent = options_type[i];
  select_type.appendChild(opt);
}

changeType();

// Functions for guide selection
function changeType() {
  select_guide.length = 0;

  guide_list = Object.keys(guides[select_type.value]);

  for (let i = 0; i < guide_list.length; i++) {
    opt = document.createElement('option');
    opt.textContent = guide_list[i];
    select_guide.appendChild(opt);
  }

  changeGuide();
}

function changeGuide() {
  guide_type = select_type.value;
  guide = select_guide.value;

  a = document.getElementById('link');
  a.href = guides[guide_type][guide].url;

  loadGraph(
    guides[guide_type][guide].data,
    guides[guide_type][guide].strength,
    guides[guide_type][guide].distance,
    guides[guide_type][guide].radius
  );
}

// Functions for graph generation
function loadGraph(data, strength, distance, radius) {
  const svg = d3.select('svg'),
    width = +svg.attr('width'),
    height = +svg.attr('height');


  svg.selectAll('*').remove();

  const zoom = d3
    .zoom()
    .scaleExtent([-8 / 2, 4])
    .on('zoom', zoomed);

  svg.call(zoom);

  const g = svg.append('g');

  const color = d3
    .scaleOrdinal()
    .domain(['Legendary', 'Epic', 'Elite', 'Advanced'])
    .range(['#ff9b00', '#ac41c2', '#058cc3', '#2d9830']);

  const tooltip = d3.select('#info').attr('class', 'tooltip');

  const simulation = d3
    .forceSimulation()
    .force('link', d3.forceLink().id(d => d.id))
    .force(
      'charge',
      d3
        .forceManyBody()
        .strength(strength)
        .distanceMax([distance])
    )
    .force('center', d3.forceCenter(width / 2, height / 2));

  // Read data from files
  d3.queue()
    .defer(d3.json, commanders)
    .defer(d3.csv, data)
    .await(function(error, commanders, links) {
      if (error) {
        console.error(error);
      } else {
        links = links.map(d => ({
          source: d.MainServices,
          target: d.RelatedServices,
          rank: d.APIServices,
          top: d.Priority
        }));

        // calculate node weights (number of links)
        commanders.nodes.forEach(n => {
          n.weight = (function() {
            let weight = 0;
            links.forEach(l => {
              if ((n.id === l.source) | (n.id === l.target)) {
                weight++;
              }
            });
            return weight;
          })();
        });

        // links
        const link = g
          .attr('class', 'links')
          .selectAll('line')
          .data(links)
          .enter()
          .append('line')
          .attr('stroke-width', d => (1 / d.rank) * 2.3);

        // nodes
        const node = g
          .selectAll('.node')
          .data(commanders.nodes)
          .enter()
          .append('g')
          .attr('class', 'nodes')
          .filter(d => {
            if (d.weight != 0) {
              return this;
            }
          })
          .call(
            d3
              .drag()
              .on('start', dragstarted)
              .on('drag', dragged)
              .on('end', dragended)
          );

        node
          .append('circle')
          .attr('r', d => d.weight * radius / 2.5 )
          .attr('fill', d => color(d.group))
          .on('mouseover.tooltip', function(d) {
            // Generate tooltip text
            info = `<strong>${d.id}</strong><br/><span class=${d.group}>${
              d.group
            }</span><br>Versatility (# of pairs): ${d.weight}`;

            table_primary = `<p><table id='tooltipTablePrimary' border=1>`;
            table_secondary = `<p><table id='tooltipTableSecondary' border=1>`;

            header = `<tr style="font-weight:bold">
            <td class='MainServices' width='auto'>Main-Services</td>
            <td class='RelatedServices' width='auto'>Related-Services</td>
            <td class='APIServices' width='auto'>APIServices</td></tr>
            <td class='Priority' width='auto'>Priority</td>`;

            rank_sum = 0;
            rows_primary = '';
            rows_secondary = '';

            links.forEach(pair => {
              if (d.id === pair.source.id) {
                rank_sum += Number(pair.rank);
                rows_primary += `<tr><td style='font-weight:bold'>${
                  pair.source.id
                }</td><td>${pair.target.id}</td><td>${pair.rank}</td></tr>`;
              } else if (d.id === pair.target.id) {
                rank_sum += Number(pair.rank);
                rows_secondary += `<tr><td>${
                  pair.source.id
                }</td><td style='font-weight:bold'>${pair.target.id}</td><td>${
                  pair.rank
                }</td></tr>`;
              }
            });

            table_primary += header + rows_primary + '</table>';
            table_secondary += header + rows_secondary + '</table>';

            tables_combined = '';
            if (rows_primary !== '') {
              tables_combined += table_primary;
            }

            if (rows_secondary !== '') {
              tables_combined += table_secondary;
            }

            tooltip
              .transition()
              .duration(300)
              .style('opacity', 1);
            tooltip.html(info + tables_combined);

            sortTable('tooltipTablePrimary');
            sortTable('tooltipTableSecondary');
          })
          .on('mouseout.tooltip', function() {
            tooltip
              .transition()
              .duration(100)
              .style('opacity', 0);
          })
          .on('mouseover.fade', fade(0.05))
          .on('mouseout.fade', fade(1));

        // node labels
        node
          .append('text')
          .text(d => d.id)
          .attr('class', 'labels')
          .attr('x', 0)
          .attr('y', 0);

        simulation.nodes(commanders.nodes).on('tick', ticked);
        simulation.force('link').links(links);

        function ticked() {
          // zoom to bounding box of nodes
          if (this.alpha() > 0.04) {
            // set up zoom transform
            var xExtent = d3.extent(node.data(), function(d) {
              return d.x + 100;
            });
            var yExtent = d3.extent(node.data(), function(d) {
              return d.y;
            });

            // get scales
            var xScale = (width / (xExtent[1] - xExtent[0])) * 0.75;
            var yScale = (height / (yExtent[1] - yExtent[0])) * 3;

            // get most restrictive scale
            var minScale = Math.min(xScale, yScale);

            if (minScale < 1) {
              var transform = d3.zoomIdentity
                .translate(width / 1, height /1)
                .scale(minScale)
                .translate(
                  -(xExtent[0] + xExtent[1]) / 2,
                  -(yExtent[0] + yExtent[1]) / 2
                );
              svg.call(zoom.transform, transform);
            }
          } else {
            svg.attr('cursor', 'pointer');
            var check = false;
          }

          link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

          node.attr('transform', d => `translate(${d.x},${d.y})`);
        }

        const linkedByIndex = {};
        links.forEach(d => {
          linkedByIndex[`${d.source.index},${d.target.index}`] = 1;
        });

        function isConnected(a, b) {
          return (
            linkedByIndex[`${a.index},${b.index}`] ||
            linkedByIndex[`${b.index},${a.index}`] ||
            a.index === b.index
          );
        }

        function fade(opacity) {
          return d => {
            node.style('stroke-opacity', function(o) {
              const thisOpacity = isConnected(d, o) ? 1 : opacity;
              this.setAttribute('fill-opacity', thisOpacity);
              return thisOpacity;
            });

            link.style('stroke-opacity', o =>
              o.source === d || o.target === d ? 1 : opacity
            );
          };
        }

        function sortTable(id) {
          var table, rows, switching, i, x, y, shouldSwitch;
          table = document.getElementById(id);
          switching = true;

          while (switching) {
            try {
              rows = table.rows;
            } catch (err) {
              return;
            }

            switching = false;

            for (i = 1; i < rows.length - 1; i++) {
              shouldSwitch = false;

              x = rows[i].getElementsByTagName('TD')[2];
              y = rows[i + 1].getElementsByTagName('TD')[2];

              if (Number(x.innerHTML) > Number(y.innerHTML)) {
                shouldSwitch = true;
                break;
              }
            }
            if (shouldSwitch) {
              rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
              switching = true;
            }
          }
        }
      }
    });

  function dragstarted(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragended(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  function zoomed() {
    g.attr('transform', d3.event.transform);
  }
}
