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

    util.bboxOverlap = function (bb1, bb2) {
        var left1 = bb1.x, right1 = bb1.x + bb1.width,
            bottom1 = bb1.y + bb1.height, top1 = bb1.y,
            left2 = bb2.x, right2 = bb2.x + bb2.width,
            bottom2 = bb2.y + bb2.height, top2 = bb2.y;
        if (right1 <= left2 || left1 >= right2 || bottom1 <= top2 || top1 >= bottom2)
            return null;
        var bbox = {
            x: Math.max(left1, left2),
            y: Math.max(top1, top2)
        };
        bbox.width = Math.min(right1, right2) - bbox.x;
        bbox.height = Math.min(bottom1, bottom2) - bbox.y;
        return bbox;
    };

    // find the coordinates of the center of a bounding box
    util.getCenter = function (bbox) {
        return new Vector(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
    };

    // Find the bounding box of an element
    util.getRect = function (type, id) {
        // Note: does not care a bout the type for now
        var el = document.getElementById(id);
        if (el) {
            var bbox = util.transformedBoundingBox(el);
            return{x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height};
        } else return null;
    };

})();
