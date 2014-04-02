var util = {};


(function () {
        // Calculate the bounding box of an element with respect to its parent element
    util.transformedBoundingBox = function (el){
        var bb  = el.getBBox(),
            svg = el.ownerSVGElement,
            m   = el.getTransformToElement(el.parentNode);

        // Create an array of all four points for the original bounding box
        var pts = [
            svg.createSVGPoint(), svg.createSVGPoint(),
            svg.createSVGPoint(), svg.createSVGPoint()
        ];
        pts[0].x=bb.x;          pts[0].y=bb.y;
        pts[1].x=bb.x+bb.width; pts[1].y=bb.y;
        pts[2].x=bb.x+bb.width; pts[2].y=bb.y+bb.height;
        pts[3].x=bb.x;          pts[3].y=bb.y+bb.height;

        // Transform each into the space of the parent,
        // and calculate the min/max points from that.
        var xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
        pts.forEach(function(pt){
            pt = pt.matrixTransform(m);
            xMin = Math.min(xMin,pt.x);
            xMax = Math.max(xMax,pt.x);
            yMin = Math.min(yMin,pt.y);
            yMax = Math.max(yMax,pt.y);
        });

        // Update the bounding box with the new values
        bb.x = xMin; bb.width  = xMax-xMin;
        bb.y = yMin; bb.height = yMax-yMin;
        return bb;
    };

})();
