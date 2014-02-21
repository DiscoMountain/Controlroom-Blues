(function () {
    // Toggle status of something, depending on its type
    world.toggle = function (evt) {
        evt.stopPropagation();
        var target = evt.currentTarget,
            item_type = target.id.split("-")[0];
        switch (item_type) {
        case "door":
            var door = world.connections[target.id.split("-")[1]];
            if (door.open) {
                setStatus(target, "CLOSED");
                door.open = false;
            } else if (!door.locked) {
                setStatus(target, "OPEN");
                door.open = true;
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

})();
