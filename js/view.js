d3.xml("graphics/map.svg", "image/svg+xml", function(xml) {

    var importedNode = document.importNode(xml.documentElement, true),
        container = document.getElementById("view"),
        svg_width = importedNode.getAttribute("width"),
        svg_height = importedNode.getAttribute("height"),
        view_width = container.offsetWidth, view_height = container.offsetHeight,
        view_scale = Math.min(view_width / svg_width, view_height / svg_height),
        thumbnail_container = document.getElementById("thumbnail-container"),
        thumbnail_rect = document.getElementById("view-rect");

    // callback for when the user zooms or pans the view.
    function zoomed () {
        // update the zoom level and offset on the main view
        svg.select("g").attr("transform", 
                 "translate(" + d3.event.translate + ")" +
                 "scale(" + d3.event.scale + ")");
        
        // ...and update the position and size of the view rectangle in the overview.
        var scale = svg_small_scale / d3.event.scale;
        d3.select(thumbnail_rect)
            .style("left", Math.round(-d3.event.translate[0] * scale)) 
            .style("top", Math.round(-d3.event.translate[1] * scale))
            .style("width", Math.round(container.offsetWidth * scale))
            .style("height", Math.round(container.offsetHeight * scale));
    }

    // A D3 zoom "behavior" to attach to the SVG, allowing panning and zooming
    // using the mouse
    var zoom = d3.behavior.zoom();
    zoom.on("zoom", zoomed)
        .scaleExtent([1, 5])
        .scale(view_scale)
        .size([container.offsetWidth, container.offsetHeight]);

    // insert the main view SVG into the page
    var svg = d3.select(importedNode)
            .attr("id", "main-svg")
            .call(zoom);
    d3.select("#view").node()
        .appendChild(importedNode);

    // create the small thumbnail thumbnail
    var svg_tmp = importedNode.cloneNode(true), 
        svg_small_scale = thumbnail_container.offsetWidth / importedNode.getAttribute("width"),
        thumbnail_height = thumbnail_container.offsetWidth * 
            importedNode.getAttribute("height") / importedNode.getAttribute("width"),
        svg_small = d3.select(svg_tmp)
            .attr("id", "svg-small")
            .attr("viewBox", "0 0 " + importedNode.getAttribute("width") + " " + importedNode.getAttribute("height"))
            .attr("width", thumbnail_container.offsetWidth)
            .attr("height", thumbnail_height)
            .attr("preserveAspectRatio", "true");
    thumbnail_container.insertBefore(svg_tmp, thumbnail_container.firstChild);
    thumbnail_container.style.height = thumbnail_height;

    // svg.selectAll("rect")
    //     .style("fill", "red")
    //     .style("stroke", "blue");

    zoom.event(svg);
    
});
