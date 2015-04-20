(function() {

  _.mixin({
    'findByValues': function(collection, property, values) {
      return _.filter(collection, function(item) {
        return _.contains(values, item[property]);
      });
    }
  });

  var square = 800,
    width = square,
    height = square,
    active = d3.select(null),
    lookup_table = {},
    fylker = {},
    kommuner = {};

  var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height);

  svg.append("rect")
    .attr("class", "background")
    .attr("width", width)
    .attr("height", height)
    .on("click", reset);

  var g = svg.append("g")
    .style("stroke-width", "1.5px");

  var kommune = svg.append("g")
    .attr('class', 'kommune')
    .style("stroke-width", "1.5px");

  var tip = d3.tip()
    .style('border', '1px solid black')
    .style("background-color", "white")
    .offset([-10, 0])
    .html(function(fylke) {
      return fylke.properties.name;
    });

  var path = d3.geo.path().projection(d3.geo.mercator()
    .center([18, 65])
    .translate([width / 2, height / 2])
    .scale(square * 1.666667)
  );

  var color = d3.scale.category20();

  d3.json('/kommune_lookup.json', function(error, map) {
    if (error) return console.error(error);

    lookup_table = map;
  });

  d3.json('/norge.topojson', function(error, norway) {
    if (error) return console.error(error);

    fylker = topojson.feature(
      norway,
      norway.objects.NO_Fylker_pol_latlng
    );

    kommuner = topojson.feature(
      norway,
      norway.objects.NO_Kommuner_pol_latlng
    );

    g.call(tip);

    g.selectAll('path')
      .data(fylker.features)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('id', function(fylke) {
        return fylke.id;
      })
      .attr('class', 'fylke')
      .style('fill', function(fylke, index) {
        return color(index);
      })
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide)
      .on("click", clicked);
  });

  function clicked(d) {
    if (active.node() === this) return reset();
    active.classed("active", false);
    active = d3.select(this).classed("active", true);

    var bounds = path.bounds(d),
      dx = bounds[1][0] - bounds[0][0],
      dy = bounds[1][1] - bounds[0][1],
      x = (bounds[0][0] + bounds[1][0]) / 2,
      y = (bounds[0][1] + bounds[1][1]) / 2,
      scale = .9 / Math.max(dx / square, dy / square),
      translate = [square / 2 - scale * x, square / 2 - scale * y];

    kommune.remove();

    g.selectAll('path')
      .style('fill', function(fylke, index) {
        console.log(color(index));
        return d3.rgb(color(index)).brighter(0.6);
      });

    g.transition()
      .duration(750)
      .style('fill', function(fylke, index) {
        console.log(color(index));
        return d3.rgb().brighter(color(index));
      })
      .style("stroke-width", 1.5 / scale + "px")
      .attr("transform", "translate(" + translate + ")scale(" + scale + ")")
      .each("end", function() {
        kommune = svg.append("g")
          .attr('class', 'kommune')
          .style("stroke-width", "1.5px")

        kommune.selectAll('path')
          .data(function() {
            var current_kommunes = _.pluck(_.filter(lookup_table, 'fylke', d.id), 'kommune');
            return _.findByValues(kommuner.features, 'id', current_kommunes);
          })
          .enter()
          .append('path')
          .attr('d', path)
          .style('fill', function(fylke, index) {
            return color(index);
          })
          .style("stroke-width", 1.5 / scale + "px")
          .attr("transform", "translate(" + translate + ")scale(" + scale + ")");
          
      });
  }

  function reset() {
    active.classed("active", false);
    active = d3.select(null);

    kommune.remove();

    g.selectAll('path')
      .style('fill', function(fylke, index) {
        return color(index);
      });

    g.transition()
      .duration(750)
      .style("stroke-width", "1.5px")
      .attr("transform", "");
  }

})();