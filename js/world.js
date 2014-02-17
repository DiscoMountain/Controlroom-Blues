var world;

(function () {

    var view = d3.select("#main-svg");

    function Vector(x, y) {
        this.x = x;
        this.y = y;
    }

    Vector.prototype.add = function (v) {
        return new Vector(this.x + v.x, this.y + v.y);
    };

    Vector.prototype.subtract = function (v) {
        return new Vector(this.x - v.x, this.y - v.y);
    };

    Vector.prototype.multiply = function (a) {
        return new Vector(this.x * a, this.y * a);
    };

    Vector.prototype.length = function () {
        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    };

    Vector.prototype.dot = function (v) {
        return this.x * v.x + this.y * v.y;
    };


    // Representation of the game world
    function World(spec) {
        console.log("spec", spec);
        // actions
        this.toggle = toggle;
        this.console =  function (s) {console.log("World console: " + s);};

        // data
        this.connections = spec.connections;

        this.rooms = spec.rooms;
        this.hero = spec.hero;

        this.preventClick = false;  // hack to avoid collisions between panning and clicking
    }

    // start the world (needs to be called after the svg is loaded)
    World.prototype.start = function (view) {
        this.view = d3.select(view);

        Object.keys(this.connections).forEach(function (c) {
            this.connections[c].center = this.getCenter("door", c);
        }, this);

        Object.keys(this.rooms).forEach(function (r) {
            this.rooms[r].center = this.getCenter("room", r);
        }, this);

        // some tests
        console.log("neigh", world.getConnectedRooms("b"));
        console.log("path", world.getShortestPath("a", "c"));
        console.log("room a is at", world.getCenter("room", "a"));

        // setup click listeners on the rooms
        Object.keys(this.rooms).forEach(function (room, i) {
            var el = this.view.select("#room-" + room)
                    .style("fill", "lightblue")
                    .on("click", function () {
                        d3.selectAll("rect")
                            .classed("waypoint", false);
                        if (!world.preventClick) {
                            var room = d3.event.target.id.split("-")[1], path;
                            this.hero.updatePath(room);
                            this.hero.path.forEach(function (r) {
                                d3.select("#room-" + r.room)
                                    .classed("waypoint", true);
                            });
                        }
                    }.bind(this), true);
        }, this);
        this.hero = new Entity({room: "a"});
        setInterval(update, 50);
    };

    // find the coordinates of the center of a room
    World.prototype.getCenter = function (type, id) {
        var el = d3.select("#" + type + "-" + id);
        if (!el.empty())
            return new Vector(parseInt(el.attr("x")) + parseInt(el.attr("width")) / 2,
                              parseInt(el.attr("y")) + parseInt(el.attr("height")) / 2);
        else
            return null;
    };

    // get a list of rooms that are adjacent (and accessible) to a given room
    World.prototype.getConnectedRooms = function (room) {
        var door, connected = {};
        for (var d in this.connections) {
            door = this.connections[d];
            if (door.open && door.rooms && door.rooms.indexOf(room) > -1) {
                door.rooms.forEach(function (r) {
                    if (r != room)
                        connected[r] = d;
                });
            }
        }
        return connected;
    };

    // return a list of rooms that form the shortest path from room1 to room2
    // TODO: take into account the actual path lengths too, not just the number of rooms...
    World.prototype.getShortestPath = function (room1, room2) {
        var step = 0, queue = {}, i = 0, pos, path = [], nearest, connected, dist, old, totdist;
        queue[room2] = 0;
        // Note: this implementation depends on objects keeping keys in the order they
        // were added. This seems to not be true for numeric strings in FF. Watch out!
        while (i < _.keys(queue).length) {
            pos = _.keys(queue)[i];
            step = _.values(queue)[i];
            if (pos == room1) {
                // done
                nearest = queue[room1];
                while (pos != room2) {
                    connected = this.getConnectedRooms(pos);
                    Object.keys(connected).forEach(function (room) {
                        dist = queue[room];
                        if (room == room2 || (dist && dist < nearest)) {
                            nearest = dist;
                            pos = room;
                        }
                    });
                    path.push({room: pos, connection: connected[pos]});
                }
                console.log("shortest path from", room1, "to", room2, "is", path);
                return path;
            }
            connected = this.getConnectedRooms(pos);
            Object.keys(connected).forEach(function (room) {
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
        this.room = spec.room;
        this.position = spec.position || world.rooms[this.room].center;
        this.speed = 50;
        this.path = [];
        this.destination = null;
    };

    Entity.prototype.updatePath = function (destination) {
        if (destination) {
            var path;
            if (this.path.length) {
                // case where the hero is already on his way somewhere.
                // then let him continue on his way until he reaches the
                // next room, then switch to the new path.
                var next_room = this.path[0].room;
                path = world.getShortestPath(next_room, destination);
                if (path)
                    this.path = [this.path[0]].concat(path);
            } else {
                path = world.getShortestPath(this.room, destination);
                if (path)
                    this.path = path;
            }
         } else {
             // the world has changed, check if the path needs updating

         }
    };

    var t = Date.now();

    function update() {
        if (world.hero.path.length) {
            var dt = (Date.now() - t) / 1000,
                hero = world.hero;

            if (!hero.destination) {
                // Need to give the hero a next destination
                if (hero.path[0].connection && world.connections[hero.path[0].connection].center) {
                    // go through the door, if there is one
                    if (world.connections[hero.path[0].connection].open)
                        hero.destination = world.connections[hero.path[0].connection].center;
                    else {
                        // Looks like a door was closed before our nose!
                        hero.path = [];
                        hero.destination = hero.position;
                        return;
                    }
                } else {
                    console.log(hero.path[0]);
                    hero.destination = world.rooms[hero.path[0].room].center;
                }
            }
            var direction = hero.destination.subtract(hero.position);
            if (direction.length() < dt * hero.speed) {
                // we've reached a destination
                hero.position = hero.destination;
                if (hero.path[0].connection)
                    delete hero.path[0].connection;
                else {
                    hero.room = hero.path.shift().room;
                    d3.select("#room-" + hero.room).classed("waypoint", false);
                }
                hero.destination = null;
            } else {
                // move towards the destination
                hero.position = hero.position.add(
                    direction.multiply(dt * hero.speed / direction.length()));
            }
            if (hero.path.length === 0) {
                // finally there!
                d3.selectAll("rect").classed("waypoint", false);
            }
        }
        t = Date.now();
        drawEntities();
    }

    function drawEntities () {
        var s = world.view.select("g").selectAll("circle")
                .data([world.hero])
                .enter().append("circle")
                .attr("id", "hero")
                .attr("r", 10)
                .attr("cx", function (d) {return d.position.x;})
                .attr("cy", function (d) {return d.position.y;});
        world.view.select("circle")
            .attr("cx", function (d) {return d.position.x;})
            .attr("cy", function (d) {return d.position.y;});
    };

    world = new World({
        // The world is defined as a graph, where the nodes correspond to "rooms"
        // and edges correspond to doors/connections, connecting two "rooms".
        connections: {
            "1": {door: true, open: false},
            "2": {door: true, open: false, rooms: ["a", "b"]},
            "3": {open: true, rooms: ["a", "c"]},
            "4": {open: true, rooms: ["c", "g"]},
            "7": {open: true, rooms: ["g", "d"]},
            "5": {door: true, open: false, rooms: ["d", "e"]},
            "6": {open: true, rooms: ["b", "e"]}
        },

        rooms: {
            "a": {},
            "b": {},
            "c": {},
            "d": {},
            "e": {},
            "g": {}
        }
    });

    // Toggle status of something, depending on its type
    function toggle (evt) {
        evt.stopPropagation();
        var target = evt.currentTarget,
            item_type = target.id.split("-")[0];
        switch (item_type) {
        case "door":
            var door = world.connections[parseInt(target.id.split("-")[1])];
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
