/**
 * Election 2015
 * Hackathon project April, 2015 for
 * Dean Breaker & Roy Viggo Larsen
 *
 * (c) ABC Startsiden AS
 */

(function() {

  // Mixin for lodash to filter on property values inside a collection
  _.mixin({
    'findByValues': function(collection, property, values) {
      return _.filter(collection, function(item) {
        return _.contains(values, item[property]);
      });
    }
  });

  // We'll make the whole thing square
  var square = 800;

  // …but keep variables for height and width, if we want to keep it separate
  var width = square;
  var height = square;

  // Empty active on init
  var active = d3.select(null);

  // Global variables
  var lookup_table = {};
  var overlays = {};
  var paths = {};
  var results = {};
  var national_results = [];

  var parties = [{
    name: 'Høyre',
    color: '#0056c4',
    abbreviation: 'H'
  }, {
    name: 'Arbeiderpartiet',
    color: '#D71921',
    abbreviation: 'A'
  }, {
    name: 'Venste',
    color: '#A0CF67',
    abbreviation: 'V'
  }, {
    name: 'Fremskrittspartiet',
    color: '#024c93',
    abbreviation: 'FRP'
  }, {
    name: 'Sosialistisk Venstreparti',
    color: '#DB0127',
    abbreviation: 'SV'
  }, {
    name: 'Kristelig Folkeparti',
    color: '#FECD0F',
    abbreviation: 'KRF'
  }, {
    name: 'Senterpartiet',
    color: '#008542',
    abbreviation: 'SP'
  }, {
    name: 'Rødt',
    color: '#C22526',
    abbreviation: 'RØDT'
  }];

  // Defaut stroke width (zoomed out)
  var strokeWidth = '0.5px';

  // Create the svg inside body, inside a div
  // Set width and height from variables above
  var svg = d3.select('body')
    .append('div')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'svg');

  // Create a unordered list to store links
  var featureList = d3.select('body')
    .append('div')
    .append('ul')

  // Append a rectangle that fills the svg, and attach reset click to it
  // (clicking outside the actual map will then zoom out if zoomed in)
  svg.append('rect')
    .attr('class', 'background')
    .attr('width', width)
    .attr('height', height)
    .on('click', reset);

  // Create a geometric shape within the svg and set stroke width
  var g = svg.append('g')
    .attr('class', 'paths')
    .style('stroke-width', strokeWidth);

  // Create a geometric shape to store fylke overlays
  var overlay = svg.append('g')
    .attr('class', 'overlay')
    .style('stroke-width', strokeWidth);

  // Initialize the projection path
  // Using mercator cylindrical projection
  // 
  // Set the center of the projection to coordinated within Sweden, to center
  // the map relativ to the size of Norway when using mercator projection
  // 
  // Offset the path ot center the center of the projection to the viewport
  // 
  // Scale the map by a factor of 1.66667 of the square size to always keep
  // the map within the viewport
  var path = d3.geo.path().projection(d3.geo.mercator()
    .center([18, 65])
    .translate([width / 2, height / 2])
    .scale(square * 1.666667)
  );

  // Filter out the kommuner that is in the active fylke
  var features = function(d) {
    // Pluck only returns on property 'kommune'
    // Filter gets all kommuner from the lookup table with a fylke
    // matching the current FylkeNr
    var current_municipalities = _.pluck(
      _.filter(lookup_table, 'fylke', d.id),
      'kommune'
    );
    // Return features from the kommuner features that has ID matched
    // with the filtered lookup table
    return _.findByValues(paths.features, 'id', current_municipalities);
  }

  // Load the lookup table for kommuner and set the variable
  d3.json('/municipalities.json', function(error, map) {
    if (error) return console.error(error);

    lookup_table = map;
  });

  _.forEach(parties, function(party, index) {
    party.color = d3.rgb(party.color);
  });

  var partylist = d3.select('body')
    .append('div')
    .attr('class', 'party-list')
    .selectAll('div')
    .data(parties)
    .enter()
    .append('div')
    .style('background-color', function(d, i) {
      return d.color;
    })
    .html(function(d, i) {
      return d.abbreviation;
    })

  d3.json('/election.json', function(error, election) {
    if (error) return console.error(error);

    results = election;

    var municipalities_with_boroughs = [{
      id: '0301',
      name: 'Oslo'
    }, {
      id: '1103',
      name: 'Stavanger'
    }, {
      id: '1201',
      name: 'Bergen'
    }, {
      id: '1601',
      name: 'Trondheim'
    }];

    _.forEach(municipalities_with_boroughs, function(municipality, index) {
      var boroughs = _.filter(results, 'mid', municipality.id);

      var results_without_boroughs = [];

      results = results.filter(function(object) {
        return object.mid !== municipality.id;
      });

      _.forEach(boroughs, function(borough, index) {
        var matched = _.find(results_without_boroughs, function(match) {
          return match.party == borough.party;
        });
        if (!matched) {
          results_without_boroughs.push({
            cid: '0000',
            cname: '',
            mid: municipality.id,
            mname: municipality.name,
            party: borough.party,
            votes: parseInt(borough.votes),
            prevotes: parseInt(borough.prevotes),
            sum: parseInt(borough.sum)
          });
        } else {
          matched.votes += parseInt(borough.votes);
          matched.prevotes += parseInt(borough.prevotes);
          matched.sum += parseInt(borough.sum);
        }
      });

      results = results.concat(results_without_boroughs);

    });

    _.forEach(results, function(result, index) {
      var matched = _.find(national_results, function(match) {
        return match.party == result.party;
      });
      if (!matched) {
        national_results.push({
          party: result.party,
          votes: parseInt(result.votes),
          prevotes: parseInt(result.prevotes),
          sum: parseInt(result.sum)
        });
      } else {
        matched.votes += parseInt(result.votes);
        matched.prevotes += parseInt(result.prevotes);
        matched.sum += parseInt(result.sum);
      }
    });


    // Load the TopoJSON object containing geo paths for Norway
    d3.json('/norway.topojson', function(error, norway) {
      if (error) return console.error(error);

      // Created features for fylker using objects from the TopoJSON
      overlays = topojson.feature(
        norway,
        norway.objects.NO_Fylker_pol_latlng
      );

      overlays.features.reverse();

      // Creathe the same kind of features for all kommuner
      paths = topojson.feature(
        norway,
        norway.objects.NO_Kommuner_pol_latlng
      );

      // Loop through all kommuner to set and indicate that they are child 
      // objects for easy lookup later
      _.forEach(paths.features, function(d, i) {
        var parent = _.pluck(
          _.filter(lookup_table, 'kommune', d.id),
          'fylke'
        );
        d.parent = parent.toString();
      });

      // Select all paths within the main geometric shape (fylker)
      // Set the dataset to be that of fylker and append them to the geometric
      // shape.
      // 
      // Set the data (.attr('d')), as well as ids and classes
      // 
      // Enable mouseover/out and click event for the path
      g.selectAll('path')
        .data(paths.features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('id', function(feature) {
          return 'feature' + feature.id;
        })
        .attr('class', 'feature')
        .style('fill', setColor)
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide)
        .on('click', tip.click);

      overlay.selectAll('path')
        .data(overlays.features)
        .enter()
        .append('path')
        .attr('d', path)
        .attr('id', function(feature) {
          return 'feature' + feature.id;
        })
        .attr('class', 'feature')
        .style('fill', 'transparent')
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide)
        .on('click', clicked);

      // Populate the list with all the fylker and use the same click event as
      // for the paths
      list.create(overlays.features, clicked);

    });

  });

  // Click event for fylker, to zoom inn to kommuner
  function clicked(d) {
    // Zoom out if active path is clicked (is currently overlayed by kommuner)
    // and will therefore not be used
    if (active.node() === this) return reset();
    active.classed('active', false);

    // Remove any clicked tooltip (fresh start)
    tip.removeClicked();

    // Set the currently clicked path to be the active one
    active = d3.select(this)
      .classed('active', true);

    // Get the bounding box size for the current path
    // Bounds are relative to top left of viewport
    // bounds[0,0] top left
    // bounds[0,1] bottom left
    // bounds[1,0] top right
    // bounds[1,1] bottom right
    var bounds = path.bounds(d);

    // Path width
    var dx = bounds[1][0] - bounds[0][0];

    // Path height
    var dy = bounds[1][1] - bounds[0][1];

    // x coordinate of viewport left to path center
    var x = (bounds[0][0] + bounds[1][0]) / 2;

    // y coorcidate of viewport top to path center
    var y = (bounds[0][1] + bounds[1][1]) / 2;

    // Scale the path to fit within the viewport when zoomed in
    // .9 is used so that the zoom scale is not too much (max size
    // will populate 90% of the viewport)
    // Math.max(dx / square, dy / square) will determine if height or width
    // is largest, and use the largest to zoom
    var scale = .9 / Math.max(dx / square, dy / square);

    // Offset the path within the viewport to keep the path in the center of
    // the viewport
    var translate = [square / 2 - scale * x, square / 2 - scale * y];

    // Set a stroke size for the current zoom scale
    var zoomedStrokeWidth = 0.8 / scale;

    // Make CSS transform property with transform and scale variables (we only
    // zoom with CSS and will not modify the scale or offset of the fylker
    // path within the viewport)
    var transformProperty =
      'translate(' + translate + ')scale(' + scale + ')';

    // Removed any kommuned currently displayed
    overlay.remove();

    // Set color after the transition has ended
    g.selectAll('path')
      .style('opacity', function(current, i) {
        if (_.map(features(d), 'id').indexOf(current.id) == -1) {
          return '0.3';
        }
        return '1';
      });

    // Make the fylker geometric shape transition to the transform property
    // 750 ms.
    g.transition()
      .duration(750)
      .style('stroke-width', zoomedStrokeWidth + 'px')
      .attr('transform', transformProperty)
      .each('end', function() {

        // Create a list of the current filtered kommuner, with back button
        // and "show all fylker"-button enabled
        list.create(features(d), tip.click, true, true, d);
      });
  }

  // Zooms out
  function reset() {
    // Remove any active path
    active.classed('active', false);
    active = d3.select(null);

    // Remove any clicked kommune tooltip
    tip.removeClicked();

    tip.tool
      .html('')
      .style('opacity', '0');

    // Create the list with fylker instead of kommuner again
    list.create(overlays.features, clicked);

    // Set all path to have the zoomed out color
    g.selectAll('path')
      .style('opacity', '1');

    // Transition the zoom out animation
    g.transition()
      .duration(750)
      .style('stroke-width', strokeWidth)
      .attr('transform', '')
      .each('end', function() {
        overlay = svg.append('g')
          .style('stroke-width', strokeWidth);

        overlay.selectAll('path')
          .data(overlays.features)
          .enter()
          .append('path')
          .attr('d', path)
          .attr('id', function(feature) {
            return 'feature' + feature.id;
          })
          .attr('class', 'feature')
          .style('fill', 'transparent')
          .on('mouseover', tip.show)
          .on('mouseout', tip.hide)
          .on('click', clicked);
      });
  }

  // Several function for setting color easy
  function setColor(feature, index) {
    var municipality_result = _.filter(results, 'mid', feature.id);

    var minicipality_winner = _.max(municipality_result, function(party) {
      return parseInt(party.sum);
    });

    var winner = _.filter(parties, 'abbreviation', minicipality_winner.party);

    if (winner[0] && winner[0].color) {
      return winner[0].color;
    }
    return d3.rgb(215, 215, 215);
  }

  function setGrayColor(feature, index) {
    return d3.rgb(215, 215, 215);
  }

  function setHoverColor(feature, index) {
    return d3.rgb(125, 125, 125);
  }

  function setClickedColor(feature, index) {
    return d3.rgb(0, 0, 125);
  }

  // List object, to display fylker or kommuner
  var list = {
    create: function(features, click, back, showall, parent) {
      // Always remove the current list
      this.remove()
      if (!click) {
        click = function() {
          return true;
        }
      }

      // Dataset the ul til have li's of the same objects as the path,
      // using feature.porperties.name as content and either sort if from 
      // top to bottom (for fylker) or alphabetic for kommuner

      featureList.selectAll('li')
        .data(function() {
          if (parent) {
            parent.properties.label = 'Vis hele ' + parent.properties.name;
            features = [parent].concat(features);
          }
          return features;
        })
        .enter()
        .append('li')
        .append('a')
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide)
        .attr('href', '#')
        .html(function(feature) {
          if (feature.properties.label) {
            var label = feature.properties.label;
            delete feature.properties.label;
            return label;
          }
          return feature.properties.name;
        })
        .on('click', click);

      // Create a button for "show all fylker"
      if (showall) {
        featureList.append('li')
          .append('a')
          .attr('href', '#')
          .html('Vis et annet fylke')
          .on('click', function() {
            tip.removeClicked();
            return list.create(overlays.features, clicked, true, false, false);
          });
      }

      // Create a back button for zooming out
      if (back) {
        featureList.append('li')
          .append('a')
          .attr('href', '#')
          .html('Vis hele landet')
          .on('click', reset);
      }
    },
    remove: function() {
      // Select all li's and remove them
      featureList.selectAll('li')
        .remove();
    }
  }

  // Tooltip, using own soltion to support clicking and letting it stick
  var tip = {
    tool: d3.select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', '0'),
    clicked: d3.select(null),
    show: function(selected) {
      // Hover color when mouseover or clicked
      if (!active.node() ||
        _.map(features(active.data()[0]), 'id').indexOf(selected.id) > -1
      ) {
        g.selectAll('path')
          .style('opacity', function(d, i) {
            if (active.node()) {
              if (selected.parent) {
                if (selected.id === d.id) {
                  return '1';
                }
                return '0.3';
              }
              if (
                _.map(features(active.data()[0]), 'id').indexOf(d.id) == -1
              ) {
                return '0.3';
              }
              return '1';
            }
            if (d.parent != selected.id) {
              return '0.3';
            }
            return '1';
          });

        // Set toolip to feature name and show it
        tip.tool
          .html(selected.properties.name)
          .style('opacity', '1');
      }
    },
    hide: function(selected) {

      g.selectAll('path')
        .style('opacity', function(d, i) {
          if (tip.clicked.node()) {
            if (tip.clicked.data()[0].id === d.id) {
              return '1';
            }
            return '0.3';
          }
          if (active.node()) {
            if (_.map(features(active.data()[0]), 'id').indexOf(d.id) == -1) {
              return '0.3';
            }
          }
          return '1';
        });

      // Check ot see if a tip node has been clicked
      if (tip.clicked.node()) {
        // Set the tooltip to the name of the currenty clicked node
        tip.tool
          .html(tip.clicked.data()[0].properties.name);
      } else {
        // If no kommune has been clicked, check if we are zoomed in
        if (active.node()) {
          // Set the tooltip name to the currently zoomed in fylke
          tip.tool
            .html(active.data()[0].properties.name);
        } else {
          // … and remove the tooltip
          tip.tool
            .html('')
            .style('opacity', '0');
        }
      }
    },
    colorize: function(d, color) {
      // Select a feature ID and set a color function to fill it
      d3.select('#feature' + d.id)
        .style('fill', color);
    },
    click: function(d) {

      if (active.node()) {
        if (!d.parent) {
          tip.removeClicked();
        } else if (
          _.map(features(active.data()[0]), 'id').indexOf(d.id) == -1
        ) {
          reset();
        } else {
          tip.clicked = g.select('#feature' + d.id);
        }
      }

    },
    removeClicked: function() {
      // Empty old node
      var old = d3.select(null);

      // Store the old node for later use if present
      if (tip.clicked.node()) {
        old = tip.clicked;
      }

      // Set the clicked node to a empty one
      tip.clicked = d3.select(null);

      // Hide the tooltip of a old node was clicked
      if (old.node()) {
        tip.hide(old.data()[0]);
      }
    }
  }

  // AUTORUN
})();