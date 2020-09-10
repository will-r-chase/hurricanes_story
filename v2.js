//set up constants
//width+height of svg
const svgWidth = 1650;
const svgHeight = 1650;
//for the circle, text, and rectangles radii
const r_inner = 350;
const r_outer = 600;
const r_text = 630;
const r_rect = 740;
const r_year = 800;
const r_date = 150;
//width and hypotenuse of the diamond visualizations
const rect_width = 17;
const date_width = 13;
const background = '#fdfbf1';
const yellow = '#FBC60C';
const grey = '#BEBEBE';
const darkGrey = '#989898';
const brightRed = '#CD172D';
const lightBrightRed = '#CD6B77';
const black = '#282727';
const blue = '#54BCCE';
const hyp = rect_width * Math.sqrt(2);
const date_hyp = date_width * Math.sqrt(2);
let zoomed = false;
let wheelAng = 0;
let resizeTimer;
let mobile;
window.innerWidth < 600 ? (mobile = true) : (mobile = false);

//set up svg
const svg = d3
  .select('#svg')
  .attr('preserveAspectRatio', 'xMinYMin meet')
  .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

const diamond_color_scale = d3
  .scaleOrdinal()
  .domain(['0', 'TD', 'TS', '1', '2', '3', '4', '5'])
  .range([
    '#fdfbf1',
    '#C6EAFA',
    '#CBE19C',
    '#FCF0BC',
    '#FBDF7D',
    '#FBBF28',
    '#F8A021',
    '#F37328'
  ]);
// .range(
//   d3.quantize(d3.interpolateRgbBasis([background, yellow, '#FF901C']), 8)
// );

String.prototype.replaceAll = function(search, replace) {
  if (replace === undefined) {
    return this.toString();
  }
  return this.split(search).join(replace);
};

//load data
d3.csv('data/retired_hurricanes.csv', d3.autoType)
  //transform data for plotting
  .then(data => circularize(data, r_inner, r_outer, r_text, r_rect, r_date))
  //main draw function
  .then(data => {
    resize();
    //scale for bubble sizes and colors
    const size = d3
      .scaleSqrt()
      .domain(d3.extent(data.map(d => d.deaths)))
      .range([10, 40]);

    const bubble_color_scale = d3
      .scaleLinear()
      .domain(d3.extent(data.map(d => d.deaths)))
      .range([lightBrightRed, brightRed]);

    //scale for damage caused
    const length = d3
      .scaleLinear()
      .domain([0, d3.max(data.map(d => d.damage_inflation_adjusted))])
      .range([r_inner, r_outer]);

    //formatting functions
    const damFormat = d3.format('($.2s');
    const tooltipDamFormat = d3.format('$,');
    const tooltipDeathsFormat = d3.format(',');

    function nth(d) {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) {
        case 1:
          return 'st';
        case 2:
          return 'nd';
        case 3:
          return 'rd';
        default:
          return 'th';
      }
    }

    //generate data for axes
    let gridCircles = [];
    for (let i = 0; i <= 150000000000; i += 30000000000) {
      gridCircles.push(i);
    }
    const date_text = [1950, 1975, 2000];

    //main group, transform to center of screen
    const g = svg
      .append('g')
      .attr('transform', `translate(${svgWidth / 2}, ${svgHeight / 2})`)
      .attr('id', 'main_group');
    //group for axis text
    const axis_text_g = svg
      .append('g')
      .attr('transform', `translate(${svgWidth / 2}, ${svgHeight / 2})`)
      .attr('id', 'axis_text_group');

    //grid lines
    g.selectAll('.guide_lines')
      .data(data)
      .join('line')
      .attr('x1', d => d.x1)
      .attr('y1', d => d.y1)
      .attr('x2', d => d.text_x)
      .attr('y2', d => d.text_y)
      .attr('stroke', grey)
      .attr('stroke-width', 0.5)
      .attr('stroke-opacity', 0.5);

    //grid circles
    g.selectAll('.circle_grid')
      .data(gridCircles)
      .join('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', d => lengthScale(d))
      .attr('fill', 'none')
      .attr('stroke-width', 0.5)
      .attr('stroke', grey)
      .attr('stroke-opacity', 0.5);

    //grid axis text
    axis_text_g
      .selectAll('.grid_text')
      .data(gridCircles)
      .join('text')
      .attr('x', 0)
      .attr('y', d => -lengthScale(d))
      .attr('class', 'grid_text')
      .text(d =>
        damFormat(d)
          .replace('G', 'B')
          .replace('.0', '')
      )
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '16px')
      .attr('stroke', background)
      .attr('stroke-width', 10)
      .clone(true)
      .attr('fill', black)
      .attr('font-size', '16px')
      .attr('stroke', 'none');

    axis_text_g
      .selectAll('.date_text')
      .data(date_text)
      .join('text')
      .attr('class', 'date_text')
      .attr('x', 0)
      .attr('y', d => -dateScale(d))
      .text(d => d.toString())
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('font-size', '16px')
      .attr('stroke', background)
      .attr('stroke-width', 4)
      .clone(true)
      .attr('fill', darkGrey)
      .attr('font-size', '16px')
      .attr('stroke', 'none');

    //bubbles
    g.selectAll('.circle')
      .data(data)
      .join('circle')
      .attr('id', (d, i) => `bubble${i}`)
      .attr('class', 'bubble')
      .attr('cx', d => d.x2)
      .attr('cy', d => d.y2)
      .attr('r', d => size(d.deaths))
      .attr('fill', d => bubble_color_scale(d.deaths))
      .attr('fill-opacity', 0.6);

    //lines to bubbles
    g.selectAll('.damage_lines')
      .data(data)
      .join('line')
      .attr('id', (d, i) => `bubble_line${i}`)
      .attr('class', 'bubble_line')
      .attr('x1', d => d.x1)
      .attr('y1', d => d.y1)
      .attr('x2', d => d.x2)
      .attr('y2', d => d.y2)
      .attr('stroke', black)
      .attr('stroke-width', 2);

    //dots inside bubbles
    g.selectAll('.circle_inner')
      .data(data)
      .join('circle')
      .attr('cx', d => d.x2)
      .attr('cy', d => d.y2)
      .attr('r', 2)
      .attr('fill', black)
      .attr('fill-opacity', 0.9);

    //hurricane names
    g.selectAll('.label')
      .data(data)
      .join('text')
      .attr('id', (d, i) => `name${i}`)
      .attr('class', 'names')
      .attr('x', d => d.text_x)
      .attr('y', d => d.text_y)
      .attr('text-anchor', d => (d.angle > Math.PI / 2 ? 'end' : 'start'))
      .attr('alignment-baseline', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 21)
      .attr('fill', black)
      .text(d => d.name.toLowerCase())
      .attr('transform', function(d) {
        let a =
          d.angle > Math.PI / 2
            ? d.angle * (180 / Math.PI) + 180
            : d.angle * (180 / Math.PI);
        return `rotate(${a}, ${d.text_x}, ${d.text_y})`;
      });

    //hurricane year outer ring
    g.selectAll('.year')
      .data(data)
      .join('text')
      .attr('class', 'hurricane-year')
      .attr('x', d => d.year_x)
      .attr('y', d => d.year_y)
      .text(d => d.year)
      .attr('alignment-baseline', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('text-anchor', 'middle')
      .attr('fill', darkGrey)
      .attr('font-size', 20)
      .attr(
        'transform',
        d => `rotate(${d.angle_deg + 90}, ${d.year_x}, ${d.year_y})`
      );

    //previous storms
    //dotted lines
    g.selectAll('.date_lines')
      .data(data)
      .join('line')
      .attr('class', 'date_line')
      .attr('id', (d, i) => `date_line${i}`)
      .attr('x1', d => d.date_x1)
      .attr('y1', d => d.date_y1)
      .attr('x2', d => d.x1)
      .attr('y2', d => d.y1)
      .attr('stroke', black)
      .attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '1.5, 4');

    //prev storm marks
    g.selectAll('.date_groups')
      .data(data)
      .join('g')
      .attr('id', (d, i) => `date_group${i}`)
      .attr('class', 'date_group')
      .selectAll('.date_points')
      .data(d => d.past_storms)
      .join('rect')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('width', date_width)
      .attr('height', date_width)
      .attr('transform', d => `rotate(${d.angle_deg - 45}, ${d.x}, ${d.y})`)
      .attr('fill', d => (d.landfall === 'yes' ? black : background))
      .attr('stroke', black)
      .attr('stroke-width', 0.5);

    //diamonds
    g.selectAll('.rect_groups')
      .data(data)
      .join('g')
      .attr('id', (d, i) => `rect_group${i}`)
      .attr('class', 'rect_group')
      .attr(
        'transform',
        d => `translate(${d.x_rect}, ${d.y_rect}), rotate(${d.angle_deg - 45})`
      )
      .selectAll('.rects')
      .data(d => d.areas)
      .join('rect')
      .attr('x', (d, i) => ([1, 3].includes(i) ? rect_width : 0))
      .attr('y', (d, i) => ([2, 3].includes(i) ? rect_width : 0))
      .attr('width', rect_width)
      .attr('height', rect_width)
      .attr('fill', d => diamond_color_scale(d.score))
      .attr('stroke', black)
      .attr('stroke-width', 2);

    g.selectAll('.text_groups')
      .data(data)
      .join('g')
      .attr('id', (d, i) => `text_group${i}`)
      .attr('class', 'text_group')
      .attr(
        'transform',
        d => `translate(${d.x_score}, ${d.y_score}) rotate(${d.angle_deg + 90})`
      )
      .selectAll('.scores')
      .data(d => d.areas)
      .join('text')
      .text(d => (d.score === '0' ? '' : d.score))
      .attr('font-size', d => (['TD', 'TS'].includes(d.score) ? 10 : 14))
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', black)
      .attr('x', (d, i) => {
        switch (i) {
          case 0:
            return 0;
          case 1:
            return -hyp / 2;
          case 2:
            return hyp / 2;
          case 3:
            return 0;
          default:
            console.error('missing value in SCORE variable');
        }
      })
      .attr('y', (d, i) => {
        switch (i) {
          case 0:
            return hyp / 2;
          case 1:
            return 0;
          case 2:
            return 0;
          case 3:
            return -hyp / 2;
          default:
            console.error('missing value in SCORE variable');
        }
      });

    //arcs for tooltip hover area
    let arc = d3
      .arc()
      .innerRadius(r_date)
      .outerRadius(r_rect + hyp * 2)
      .startAngle(d => d.arc_start)
      .endAngle(d => d.arc_end);

    //set up tooltip div
    let tooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute');

    //add tooltip interactions on hover
    g.selectAll('.arcs')
      .data(data)
      .join('path')
      .attr('id', (d, i) => `arc${i}`)
      .attr('d', arc)
      .attr('fill', black)
      .attr('fill-opacity', 0)
      .on('mouseover', tooltipIn)
      .on('mouseout', tooltipOut);

    //legend overflow hidden toggle
    const legendOpen = document.querySelector('#legend-link');
    const legendClose = document.querySelector('.modal-close');
    const body = document.querySelector('body');
    legendOpen.addEventListener(
      'click',
      () => body.classList.add('no-scroll'),
      false
    );
    legendClose.addEventListener(
      'click',
      () => body.classList.remove('no-scroll'),
      false
    );

    //add resize, zoom, key, and wheel event listeners
    d3.select(window).on('resize', _.debounce(resize, 10, { leading: true }));
    d3.select('.zoom-button').on('click', zoomClick);
    d3.select('#svg').on('wheel', function() {
      if (zoomed) {
        d3.event.preventDefault();
        scrollThrottled(event);
        event.currentTarget.style = `transform: rotate(${wheelAng}deg)`;
      }
    });
    d3.select('body').on('keydown', function() {
      if (zoomed) {
        if (event.key === 'ArrowRight') {
          wheelAng -= 10;
        } else if (event.key === 'ArrowLeft') {
          wheelAng += 10;
        }

        d3.event.preventDefault();
        d3.select('#svg').style('transform', `rotate(${wheelAng}deg)`);
      }
    });

    //event handlers for mobile buttons
    d3.select('.right-button').on('click', function() {
      if (zoomed) {
        wheelAng -= 10;
      }
      d3.event.preventDefault();
      d3.select('#svg').style('transform', `rotate(${wheelAng}deg)`);
    });
    d3.select('.left-button').on('click', function() {
      if (zoomed) {
        wheelAng += 10;
      }
      d3.event.preventDefault();
      d3.select('#svg').style('transform', `rotate(${wheelAng}deg)`);
    });

    //handlers for all the interactions and events
    function handleScroll2(e) {
      e.deltaY > 0 ? (wheelAng -= 10) : (wheelAng += 10);
    }
    let scrollThrottled = _.throttle(handleScroll2, 100, { leading: true });

    function resize() {
      //front matter
      //update window width and height
      let width = window.innerWidth;
      let height = window.innerHeight;

      //set up selections
      //do it inside the function so it only tries to access them once initialized
      const wrapperInner = d3.select('#wrapper-inner');
      const wrapperOuter = d3.select('#wrapper-outer');
      const legendLink = d3.select('#legend-link');
      const zoomButton = d3.select('.zoom-button');

      //animation bug fix
      document.body.classList.add('resize-animation-stopper');
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        document.body.classList.remove('resize-animation-stopper');
      }, 400);

      //determine if mobile or not
      window.innerWidth < 600 ? (mobile = true) : (mobile = false);

      if (mobile) {
        //MOBILE STYLES
        if (zoomed) {
          //when mobile is zoomed
          //can't resize mobile zoom, nothing needed here
        } else {
          //when mobile is not zoomed
          //can't resize on mobile, but this just sets up the initial layout
          wrapperInner.style('width', '100%').style('padding-bottom', '100%');

          legendLink
            .style('left', `${width / 2}px`)
            .style('margin-left', function() {
              return `${-this.offsetWidth / 2 - 3}px`;
            })
            .style('transform', `translateY(-20px)`)
            .style('font-size', '0.4rem');
          zoomButton
            .style('left', `${width / 2}px`)
            .style('margin-left', function() {
              return `${-this.offsetWidth / 2 - 2}px`;
            });
        }
      } else {
        //DESKTOP STYLES
        if (zoomed) {
          if (width > height) {
            //desktop is zoomed and window width is greater than window height
            wrapperOuter
              .style('width', `${height * 2}px`)
              .style('margin-left', `${(width - height * 2) / 2}px`);
            zoomButton
              .style('top', null)
              .style('bottom', '40px')
              .style('left', `${width / 2}px`)
              .style('margin-left', function() {
                return `${-(width - height * 2) / 2 - this.offsetWidth / 2}px`;
              });
            legendLink
              .style('top', null)
              .style('bottom', '60px')
              .style('left', `${width / 2}px`)
              .style('margin-left', function() {
                return `${-(width - height * 2) / 2 - this.offsetWidth / 2}px`;
              });
          } else {
            //desktop is zoomed and window height is greater than window width
            wrapperOuter
              .style('width', `${width * 2}px`)
              .style('margin-left', `${-width / 2}px`)
              .style('margin-top', `${(height - width) / 2}px`);
            zoomButton
              .style('top', `${width - 50}px`)
              .style('left', `${width}px`)
              .style('margin-left', null)
              .style('bottom', null);
            legendLink
              .style('top', `${width - 50}px`)
              .style('left', `${width}px`)
              .style('margin-left', null)
              .style('bottom', null);
          }
        } else {
          //desktop is not zoomed, window width and height are irrelevant for zoom button and link pos
          legendLink
            .style('left', `${width / 2}px`)
            .style('margin-left', function() {
              return `${-this.offsetWidth / 2 - 4}px`;
            })
            .style('transform', `translateY(-40px)`)
            .style('font-size', '0.7rem');
          zoomButton
            .style('left', `${width / 2}px`)
            .style('margin-left', function() {
              return `${-this.offsetWidth / 2 - 4}px`;
            });
          if (width > height) {
            //desktop is not zoomed and window width is greater than height
            wrapperInner
              .style('width', `${height}px`)
              .style('padding-bottom', `${height}px`);
          } else {
            //desktop is not zoomed and window height is greater than width
            wrapperInner.style('width', '100%').style('padding-bottom', '100%');
          }
        }
      }
    }

    function zoomClick() {
      //front matter
      //update window width and height
      let width = window.innerWidth;
      let height = window.innerHeight;

      //set up selections
      //do it inside the function so it only tries to access them once initialized
      const wrapperInner = d3.select('#wrapper-inner');
      const wrapperOuter = d3.select('#wrapper-outer');
      const legendLink = d3.select('#legend-link');
      const zoomButton = d3.select('.zoom-button');

      if (zoomed) {
        //FIRES WHEN ZOOMING OUT

        //re-enable scrolling on body
        bodyScrollLock.clearAllBodyScrollLocks();

        //reset viz rotation
        wheelAng = 0;
        svg.style('transform', `rotate(${wheelAng}deg)`);

        //reset outer wrapper styles and hide scroll indicator
        document.querySelector('#wrapper-outer').removeAttribute('style');
        d3.select('#scrollIndicator').attr('visibility', 'hidden');

        if (mobile) {
          //mobile when zoomed
          wrapperInner.style('width', '100%').style('padding-bottom', '100%');

          zoomButton
            .style('top', null)
            .style('left', `${width / 2}px`)
            .style('margin-left', function() {
              return `${-this.offsetWidth / 2 - 2}px`;
            });
          legendLink
            .style('top', null)
            .style('left', `${width / 2}px`)
            .style('margin-left', function() {
              return `${-this.offsetWidth / 2 - 3}px`;
            })
            .style('transform', `translateY(-20px)`)
            .style('font-size', '0.4rem');

          //have to do this or else multiple zoom in and outs screws up position
          //I guess it's just necessary to reset the position of these every time
          d3.select('.left-button')
            .style('top', null)
            .style('left', null);
          d3.select('.right-button')
            .style('top', null)
            .style('left', null);
          d3.selectAll('.mobile-buttons').style('visibility', 'hidden');
        } else {
          if (width > height) {
            //desktop while zoomed and width > height
            wrapperInner
              .style('width', `${height}px`)
              .style('padding-bottom', `${height}px`);
            zoomButton
              .style('bottom', null)
              .style('left', `${width / 2}px`)
              .style('margin-left', function() {
                return `${-this.offsetWidth / 2 - 4}px`;
              });
            legendLink
              .style('bottom', null)
              .style('left', `${width / 2}px`)
              .style('margin-left', function() {
                return `${-this.offsetWidth / 2 - 4}px`;
              })
              .style('transform', `translateY(-40px)`);
          } else {
            //desktop while zoomed and height > width
            zoomButton
              .style('top', null)
              .style('left', `${width / 2}px`)
              .style('margin-left', function() {
                return `${-this.offsetWidth / 2 - 4}px`;
              });
            legendLink
              .style('top', null)
              .style('left', `${width / 2}px`)
              .style('margin-left', function() {
                return `${-this.offsetWidth / 2 - 4}px`;
              });
          }
        }
      } else {
        //FIRES WHEN ZOOMING IN
        //scroll so viz fits window full height before zooming
        const vizY = document
          .querySelector('#wrapper-outer')
          .getBoundingClientRect().y;
        window.scrollBy(0, vizY);

        wrapperInner.style('width', '100%').style('padding-bottom', '100%');
        //d3.select('body').style('overflow', 'hidden');
        d3.select('#scrollIndicator').attr('visibility', 'visible');

        //disable scrolling on body
        bodyScrollLock.disableBodyScroll(legendLink);

        if (mobile) {
          //mobile when not zoomed
          wrapperOuter
            .style('width', `${width * 2}px`)
            .style('margin-left', `${-width / 2}px`)
            .style('margin-top', `${(height - width) / 1.3}px`);
          zoomButton
            .style('top', `${width - 25}px`)
            .style('left', `${width}px`);

          legendLink
            .style('top', `${width - 35}px`)
            .style('left', `${width}px`);

          d3.select('.left-button')
            .style('top', `-50px`)
            .style('left', `${width / 2}px`);

          d3.select('.right-button')
            .style('top', `-50px`)
            .style('left', `${width * 1.5 - this.offsetWidth}px`);
          d3.selectAll('.mobile-buttons').style('visibility', 'visible');
        } else {
          if (width > height) {
            //desktop while not zoomed and width > height
            wrapperOuter
              .style('width', `${height * 2}px`)
              .style('margin-left', `${(width - height * 2) / 2}px`);
            zoomButton
              .style('bottom', '40px')
              .style('left', `${width / 2}px`)
              .style('margin-left', function() {
                return `${-(width - height * 2) / 2 - this.offsetWidth / 2}px`;
              });
            legendLink
              .style('bottom', '60px')
              .style('left', `${width / 2}px`)
              .style('margin-left', function() {
                return `${-(width - height * 2) / 2 - this.offsetWidth / 2}px`;
              });
          } else {
            //desktop while not zoomed and height > width
            wrapperOuter
              .style('width', `${width * 2}px`)
              .style('margin-left', `${-width / 2}px`)
              .style('margin-top', `${(height - width) / 2}px`);
            zoomButton
              .style('top', `${width - 50}px`)
              .style('left', `${width}px`);
            legendLink
              .style('top', `${width - 50}px`)
              .style('left', `${width}px`);
          }
        }
      }

      //toggle zoom state
      zoomed ? (zoomed = false) : (zoomed = true);
    }

    function tooltipIn(d, i) {
      let bubbles = d3.selectAll('.bubble');
      let selectedBubble = d3.select(`#bubble${i}`);
      let bubble_lines = d3.selectAll('.bubble_line');
      let selectedBubbleLine = d3.select(`#bubble_line${i}`);
      let selectedName = d3.select(`#name${i}`);
      let rects = d3.selectAll('.rect_group');
      let selectedRect = d3.select(`#rect_group${i}`);
      let texts = d3.selectAll('.text_group');
      let selectedText = d3.select(`#text_group${i}`);
      let date_lines = d3.selectAll('.date_line');
      let selectedDateLine = d3.select(`#date_line${i}`);
      let date_groups = d3.selectAll('.date_group');
      let selectedDateGroup = d3.select(`#date_group${i}`);

      bubbles
        .transition()
        .duration(50)
        .attr('fill-opacity', 0.3);
      selectedBubble
        .transition()
        .duration(50)
        .attr('fill-opacity', 0.9);
      bubble_lines
        .transition()
        .duration(50)
        .attr('stroke-opacity', 0.3);
      selectedBubbleLine
        .transition()
        .duration(50)
        .attr('stroke-opacity', 1);
      selectedName
        .transition()
        .duration(150)
        .attr('font-size', 25);
      rects
        .transition()
        .duration(50)
        .style('opacity', 0.3);
      selectedRect
        .transition()
        .duration(50)
        .style('opacity', 1);
      texts
        .transition()
        .duration(50)
        .style('opacity', 0.3);
      selectedText
        .transition()
        .duration(50)
        .style('opacity', 1);
      date_lines
        .transition()
        .duration(50)
        .style('opacity', 0.3);
      selectedDateLine
        .transition()
        .duration(50)
        .style('opacity', 1);
      date_groups
        .transition()
        .duration(50)
        .style('opacity', 0.3);
      selectedDateGroup
        .transition()
        .duration(50)
        .style('opacity', 1);

      tooltip
        .transition()
        .duration(150)
        .style('opacity', 1);
      tooltip
        .html(() => {
          let string;
          if (d.prev_storms_tooltip != 'None') {
            string = `
                        <div class='tooltip-title'>Hurricane ${d.name} - ${
              d.year
            }</div>
                        <span class='tooltip-date'>${d.start_month} ${
              d.start_day
            }<sup>${nth(d.start_day)}</sup> – ${d.end_month} ${
              d.end_day
            }<sup>${nth(d.end_day)}</sup></span><br></br>
                        <div class='tooltip-detail'><strong>${tooltipDeathsFormat(
                          d.deaths
                        )}</strong> deaths</div>
                        <div class='tooltip-detail'><strong>${tooltipDamFormat(
                          d.damage
                        )}</strong> of damage</div>
                        <div class='tooltip-detail'>Before retirement, hurricane ${
                          d.name
                        } also occurred in <strong>${
              d.prev_storms_tooltip
            }</strong></div>
                        
                        `;
          } else {
            string = `
                        <div class='tooltip-title'>Hurricane ${d.name} - ${
              d.year
            }</div>
                        <span class='tooltip-date'>${d.start_month} ${
              d.start_day
            }<sup>${nth(d.start_day)}</sup> – ${d.end_month} ${
              d.end_day
            }<sup>${nth(d.end_day)}</sup></span><br></br>
                        <div class='tooltip-detail'><strong>${tooltipDeathsFormat(
                          d.deaths
                        )}</strong> deaths</div>
                        <div class='tooltip-detail'><strong>${tooltipDamFormat(
                          d.damage
                        )}</strong> of damage</div>
                       
                        `;
          }
          return string;
        })
        .style('left', d3.event.pageX + 28 + 'px')
        .style('top', d3.event.pageY - 28 + 'px');
    }
    function tooltipOut(d, i) {
      let bubbles = d3.selectAll('.bubble');
      let bubble_lines = d3.selectAll('.bubble_line');
      let selectedName = d3.select(`#name${i}`);
      let rects = d3.selectAll('.rect_group');
      let texts = d3.selectAll('.text_group');
      let date_lines = d3.selectAll('.date_line');
      let date_groups = d3.selectAll('.date_group');

      bubbles
        .transition()
        .duration(50)
        .attr('fill-opacity', 0.6);
      bubble_lines
        .transition()
        .duration(50)
        .attr('stroke-opacity', 1);
      selectedName
        .transition()
        .duration(75)
        .attr('font-size', 21);
      rects
        .transition()
        .duration(50)
        .style('opacity', 1);
      texts
        .transition()
        .duration(50)
        .style('opacity', 1);
      date_lines
        .transition()
        .duration(50)
        .style('opacity', 1);
      date_groups
        .transition()
        .duration(50)
        .style('opacity', 1);

      tooltip
        .transition()
        .duration(75)
        .style('opacity', 0);
    }
    resize();
  });

let indicator = mobile
  ? 'static/button_indicator_concourse.svg'
  : 'static/scroll_indicator_concourse.svg';
//scroll indicator
d3.xml(indicator).then(d => {
  let test = document.importNode(d.documentElement, true);
  const scroll_indicator = test.children[0];

  d3.select('#svg')
    .node()
    .append(scroll_indicator);
  d3.select('#scrollIndicator')
    .attr('transform', `translate(${svgWidth / 2 - 56}, 15)`)
    .attr('visibility', zoomed ? 'visible' : 'hidden');
});

//set up data for plotting
function circularize(pts, r_inner, r_outer, r_text, r_rect, r_date) {
  //add 2 to denominator to account for missing space for grid axis
  let angle = (2 * Math.PI) / (pts.length + 2);
  let angle2 = (2 * Math.PI) / pts.length;
  let points = [];
  let i = -1;

  lengthScale = d3
    .scaleLinear()
    .domain([0, d3.max(pts.map(d => d.damage_inflation_adjusted))])
    .range([r_inner, r_outer]);

  dateScale = d3
    .scaleLinear()
    .domain([1950, 2015])
    .range([r_date, r_inner]);

  for (
    let a = -(Math.PI / 2) + 0.1;
    a < 2 * Math.PI - Math.PI / 2 - 0.1;
    a += angle
  ) {
    i++;
    points.push({
      //starting point radial transform
      x1: r_inner * Math.cos(a),
      y1: r_inner * Math.sin(a),
      //end point radial transform
      x2:
        pts.map(d => lengthScale(d.damage_inflation_adjusted))[i] * Math.cos(a),
      y2:
        pts.map(d => lengthScale(d.damage_inflation_adjusted))[i] * Math.sin(a),
      //date line
      date_x1: r_date * Math.cos(a),
      date_y1: r_date * Math.sin(a),
      //storm year
      year_x: r_year * Math.cos(a),
      year_y: r_year * Math.sin(a),
      //starting point for diamonds
      x_rect: r_rect * Math.cos(a),
      y_rect: r_rect * Math.sin(a),
      x_score: (r_rect + hyp - 1) * Math.cos(a),
      y_score: (r_rect + hyp - 1) * Math.sin(a),
      //for grid lines
      deaths_x: r_outer * Math.cos(a),
      deaths_y: r_outer * Math.sin(a),
      //text positions
      text_x: a > Math.PI / 2 ? r_text * Math.cos(a) : r_text * Math.cos(a),
      text_y: a > Math.PI / 2 ? r_text * Math.sin(a) : r_text * Math.sin(a),
      // dam_path: `M ${r * Math.cos(a)},${r * Math.sin(a)} Q ${(r + 50) * Math.cos(a - angle)},${(r + 50) * Math.sin(a - angle)},${(r + (pts.map(d => length(d.damage_scaled))[i])) * Math.cos(a + angle)},${(r + (pts.map(d => length(d.damage_scaled))[i])) * Math.sin(a + angle)}`,
      label: 'point' + i,
      name: pts.map(d => d.name)[i],
      deaths: pts.map(d => d.deaths)[i],
      start_month: pts.map(d => d.start_month)[i],
      end_month: pts.map(d => d.end_month)[i],
      start_day: pts.map(d => d.start_day)[i],
      end_day: pts.map(d => d.end_day)[i],
      damage: pts.map(d => d.damage_inflation_adjusted)[i],
      prev_storms_tooltip: String(pts.map(d => d.previous_storms)[i])
        .replaceAll(';', ', ')
        .replace('null', 'None'),
      year: pts.map(d => d.year)[i],
      angle: a,
      arc_start: a - angle / 2 + Math.PI / 2,
      arc_end: a + angle / 2 + Math.PI / 2,
      angle_deg: a * (180 / Math.PI),
      storm_x: pts
        .map(d =>
          String(d.previous_storms)
            .split(';')
            .map(s => Number(s))
            .map(v => dateScale(v))
        )
        [i].map(x => (x - date_hyp / 2) * Math.cos(a)),
      storm_y: pts
        .map(d =>
          String(d.previous_storms)
            .split(';')
            .map(s => Number(s))
            .map(v => dateScale(v))
        )
        [i].map(x => (x - date_hyp / 2) * Math.sin(a)),
      landfall: pts.map(d => String(d.landfall).split(';'))[i],
      //for the diamonds
      areas: [
        {
          location: 'caribbean',
          score: pts.map(d => d.caribbean.toString())[i]
        },
        {
          location: 'central',
          score: pts.map(d => d.central_america.toString())[i]
        },
        {
          location: 'east',
          score: pts.map(d => d.eastern_seaboard.toString())[i]
        },
        { location: 'gulf', score: pts.map(d => d.gulf_coast.toString())[i] }
      ]
    });
  }

  //set up data for the past storms
  points.map(function(d) {
    let past_storms = [];
    for (let j = 0; j < d.storm_x.length; j++) {
      if (d.storm_x[0]) {
        past_storms.push({
          x: d.storm_x[j],
          y: d.storm_y[j],
          landfall: d.landfall[j],
          angle_deg: d.angle_deg
        });
      }
    }
    d.past_storms = past_storms;
  });
  return points;
}
