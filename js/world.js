var world;

(function () {

    var view = d3.select("#main-svg");

    // Representation of the game world
    function World(spec) {
        console.log("spec", spec);
        // actions
        this.toggle = toggle;
        this.console =  function (s) {console.log("World console: " + s);};

        // data
        this.doors = spec.doors;
        this.rooms = spec.rooms;
        this.hero = spec.hero;
    }

    // start the world (needs to be called after the svg is loaded)
    World.prototype.start = function (view) {
        this.view = d3.select(view);

        // some tests
        console.log("neigh", world.getConnectedRooms("b"));
        console.log("path", world.getShortestPath("b", "d"));
        console.log("room a is at", world.getRoomCenter("a"));

        // setup click listeners on the rooms
        Object.keys(this.rooms).forEach(function (room, i) {
            var center = world.getRoomCenter(room);
            var el = this.view.select("#room-" + room)
                    .on("click", function () {
                        var room = d3.event.target.id.split("-")[1],
                            path = this.getShortestPath(this.hero.position, room);
                        this.hero.path = path;
                        drawEntities();
                    }.bind(this));
        }, this);
        drawEntities();
    };

    // find the coordinates of the center of a room
    World.prototype.getRoomCenter = function (room) {
        console.log("getRoomCoordinates", "#room-" + room, d3.select("#room-" + room));
        var el = this.view.select("#room-" + room);
        return [parseInt(el.attr("x")) + parseInt(el.attr("width")) / 2,
                parseInt(el.attr("y")) + parseInt(el.attr("height")) / 2];
    };

    // get a list of rooms that are adjacent (and accessible) to a given room
    World.prototype.getConnectedRooms = function (room) {
        var door, connected = {};
        for (var d in this.doors) {
            door = this.doors[d];
            if (door.open && door.rooms && door.rooms.indexOf(room) > -1) {
                door.rooms.forEach(function (r) {
                    if (r != room)
                        connected[r] = true;
                });
            }
        }
        return Object.keys(connected);
    };

    // return a list of rooms that form the shortest path from room1 to room2
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

    // Representation of someone (hero, monster, ...) or something
    function Entity(spec) {
        this.position = spec.position;
        this.path = [];
    };

    Entity.prototype.walk = function (map, dest) {
        var path = map.getShortestPath(this.position, dest);
    };

    function drawEntities () {
        var s = world.view.select("g").selectAll("#hero")
                .data([world.hero])
                .enter().append("circle")
                .attr("id", "hero")
                .attr("fill", "green").attr("r", 10)
                .attr("cx", function (d) {return world.getRoomCenter(d.position)[0];})
                .attr("cy", function (d) {return world.getRoomCenter(d.position)[1];});

        if (world.hero.path.length > 0) {
            world.view.select("circle")
                .transition().duration(1000).ease("linear")
                .attr("cx", function (d) {return world.getRoomCenter(d.path[0])[0];})
                .attr("cy", function (d) {return world.getRoomCenter(d.path[0])[1];})
                .each("end", function (d) {
                    world.hero.position = d.path.shift();
                    if (d.path) drawEntities();
                });
        }
    };


    world = new World({
        hero: new Entity({position: "a"}),
        doors: {
            "1": {open: false},
            "2": {open: false, rooms: ["a", "b"]},
            "3": {open: true, rooms: ["a", "c"]},
            "4": {open: true, rooms: ["d", "c"]},
            "5": {open: false, rooms: ["d", "e"]},
            "6": {open: true, rooms: ["b", "e"]}
        },
        // these don't really do anything so far...
        rooms: {
            "a": {},
            "b": {},
            "c": {},
            "d": {},
            "e": {}
        }
    });

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
