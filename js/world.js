var world;

(function () {

    // Representation of the game world
    function World(spec) {
        console.log("spec", spec);
        // actions
        this.toggle = toggle;
        this.console =  function (s) {console.log("World console: " + s);};

        // data
        this.doors = spec.doors;
        this.rooms = spec.rooms;
    }

    World.prototype.getConnectedRooms = function (room_number) {
        var door, connected = {};
        for (var d in this.doors) {
            door = this.doors[d];
            if (door.open && door.rooms && door.rooms.indexOf(room_number) > -1) {
                door.rooms.forEach(function (r) {
                    if (r != room_number)
                        connected[r] = true;
                });
            }
        }
        return Object.keys(connected);
    };

    World.prototype.getShortestPath = function (room1, room2) {
        var step = 0, queue = {}, i = 0, pos, path, nearest, connected, dist, old, totdist;
        queue[room2] = 0;
        // Note: this implementation depends on objects keeping keys in the order they
        // were added. This seems to not be true for numeric strings in FF. Watch out!
        while (i < _.keys(queue).length) {
            pos = _.keys(queue)[i];
            step = _.values(queue)[i];
            if (pos == room1) {
                path = [];
                nearest = queue[room1];
                while (pos != room2) {
                    connected = this.getConnectedRooms(pos);
                    connected.forEach(function (room) {
                        dist = queue[room];
                        if (room == room2 || (dist && dist < nearest)) {
                            nearest = dist;
                            pos = room;
                        }
                    });
                    path.push(pos);
                }
                return path;
            }
            connected = this.getConnectedRooms(pos);
            connected.forEach(function (room) {
                old = queue[room];
                totdist = step + 1;
                if (!old || old > totdist)
                    queue[room] = totdist;
            });
            i++;
        }
        return false;
    };

    world = new World({
        doors: {
            "1": {open: false},
            "2": {open: true, rooms: ["a", "b"]},
            "3": {open: true, rooms: ["a", "c"]}
        },
        rooms: {
            "a": {},
            "b": {},
            "c": {}
        }
    });

    console.log("neigh", world.getConnectedRooms("b"));
    console.log("path", world.getShortestPath("b", "c"));

    // Toggle status of something, depending on its type
    function toggle (evt) {
        evt.stopPropagation();
        var target = evt.currentTarget,
            item_type = target.id.split("-")[0];
        switch (item_type) {
        case "door":
            var door = world.doors[parseInt(target.id.split("-")[1])];
            if (door.open) {
                setStatus(target, "CLOSED");
            } else {
                setStatus(target, "OPEN");
            }
            door.open = !door.open;
            break;
        }
        return false;
    }

    // Change the status (class) of an element
    function setStatus (element, status) {
        console.log("id: " + element.getAttribute("id"));
        // TODO: the time it takes to trigger a change should be variable
        setTimeout(function () {element.setAttribute("class", "status-" + status);}, 1000);
        runAnim(element, status);
    }

    // Find any animations of a given type and run them
    function runAnim (element, animName) {
        var anim = Array.prototype.slice.call(element.querySelectorAll(
            "animateMotion." + animName));
        anim.forEach(function (a) {console.log(a); a.beginElement();});
    }

})();
