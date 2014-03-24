// This file concerns the view of the map; drawing the SVG, zooming, panning, so on

var view = {};

(function () {

    function process_map (xml) {

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
                                 "scale(" + d3.event.scale + ")");  // + (0.67 * d3.event.scale) + ")" +
            //"rotate(30, " + (svg_width / 2) + ", " + (svg_height / 2) + ")");

            // ...and update the position and size of the view rectangle in the overview.
            var scale = 1 / d3.event.scale;
            d3.select("#view-rect")
                .attr("x", -d3.event.translate[0] * scale)
                .attr("y", -d3.event.translate[1] * scale)
                .attr("width", view_width * scale)
                .attr("height", view_height * scale);
        }

        // A D3 zoom "behavior" to attach to the SVG, allowing panning and zooming
        // using the mouse
        var zoom = d3.behavior.zoom();
        zoom.on("zoom", zoomed)
            .scaleExtent([1, 5])
            .scale(view_scale)
            .size([container.offsetWidth, container.offsetHeight]);

        var dragging = false;
        function mousedown() {
            dragging = true;
        }

        function mousemove() {
            if (dragging) world.preventClick = true;
        }

        function mouseup() {
            dragging = false;
        }

        function click() {
            if (world.preventClick) {
                d3.event.stopPropagation();
                world.preventClick = false;
            }
        }

        // insert the main view SVG into the page
        var svg = d3.select(importedNode)
                .attr("id", "main-svg")
                .call(zoom)
        // The following listeners a hack to prevent collisions between panning and clicking
                .on("mousedown", mousedown)
                .on("mouseup", mouseup)
                .on("mousemove", mousemove)
                .on("click", click);
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
                .attr("preserveAspectRatio", "true")

                .append("rect")  // view indicator
                .attr("id", "view-rect");

        thumbnail_container.insertBefore(svg_tmp, thumbnail_container.firstChild);
        thumbnail_container.style.height = thumbnail_height;

        zoom.event(svg);

        world.connect_map(importedNode);

    };


    view.load = function (map_url) {
        d3.xml(map_url, "image/svg+xml", process_map);
    };


    view.toggle = function (node_id, open) {
        var item_type = node_id.split("-")[0],
            target = document.getElementById(node_id);
        console.log("toggle door", node_id, open);
        switch (item_type) {
        case "door":
            if (open) {
                setStatus(target, "OPEN");
            } else {
                setStatus(target, "CLOSED");
            }
            break;
        }
        return false;
    };

    // Change the status (class) of an element
    function setStatus (element, status) {
        console.log("id: " + element.getAttribute("id"));
        // TODO: the time it takes to trigger a change should be variable
        setTimeout(function () {element.setAttribute("class", "status-" + status);}, 1000);
        runAnim(element, status);
    };

    // Find any animations of a given type and run them
    function runAnim (element, animName) {
        var anim = Array.prototype.slice.call(element.querySelectorAll(
            "animateMotion." + animName));
        anim.forEach(function (a) {console.log(a); a.beginElement();});
    };


}());
