var world;

(function () {

    var view = d3.select("#main-svg"), hud = document.getElementById("hud"), t;

    // Representation of the game world
    function World(spec) {
        console.log("spec", spec);
        // actions
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
            this.rooms[r].rect = this.getRect("room", r);
        }, this);

        // setup click listeners on the rooms
        Object.keys(this.rooms).forEach(function (room, i) {
            var el = this.view.select("#room-" + room)
                    .style("fill", "lightblue")
                    .on("click", function () {
                        if (!world.preventClick) {
                            var room = d3.event.target.id.split("-")[1], path;
                            this.hero.updatePath(room);
                        }
                    }.bind(this), true);
        }, this);

        this.hero = new Entity({room: "a", isHero: true});
        this.monsters = [new Entity({room: "d"})];
        updateHud();

        t = Date.now() / 1000;
        update();  // start the "main loop"
    };

    // find the coordinates of the center of something
    World.prototype.getCenter = function (type, id) {
        var el = d3.select("#" + type + "-" + id);
        if (!el.empty())
            return new Vector(parseInt(el.attr("x")) + parseInt(el.attr("width")) / 2,
                              parseInt(el.attr("y")) + parseInt(el.attr("height")) / 2);
        else
            return null;
    };

    World.prototype.getRect = function (type, id) {
        var el = d3.select("#" + type + "-" + id);
        if (!el.empty())
            return{left: parseInt(el.attr("x")), top: parseInt(el.attr("y")),
                   width: parseInt(el.attr("width")), height: parseInt(el.attr("height"))};
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
        this.position = spec.position || world.rooms[this.room].center.copy();
        this.isHero = spec.isHero;  // hmm 
        this.speed = 50;
        this.path = [];
        this.waypoint = null;
        this.name = Math.random().toString(36).replace(/[^a-z]+/g, '');

        this.sleepUntil = 0;

        this.health = 100;
        this.ammo = 100;
        this.morale = 100;
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
        if (this.isHero) {
            d3.selectAll("rect")
                .classed("waypoint", false);
            this.path.forEach(function (r) {
                d3.select("#room-" + r.room)
                    .classed("waypoint", true);
            });
        }
    };

    function updateHud() {
        hud.innerHTML = [
            "HEALTH: " + Math.round(world.hero.health) + "%"
        ].join();
        if (world.hero.health < 20) {
            hud.className = "critical";
        } else {
            if (world.hero.health < 80)
                hud.className = "hurt";
            else
                hud.className = null;
        }
    };

    function updateEntity(entity) {
        if (entity.path.length) {
            var dt = (Date.now() / 1000 - t),
                conn = entity.path[0].connection;

            if (!entity.waypoint) { // Need to give the entity a next destination
                if (conn && world.connections[conn].center) {
                    // go through the door, if there is one
                    if (world.connections[conn].open) {
                        entity.waypoint = world.connections[conn].center.copy();
                    } else {  // Looks like a door was closed before our nose!
                        entity.path = [];
                        entity.waypoint = entity.position;
                        return;
                    }
                } else {  // no door; rooms are not separated
                    entity.room = entity.path[0].room;
                    delete entity.path[0].connection;
                    if (entity.path.length === 1) {
                        entity.waypoint = randomOffsetInRoom(world.rooms[entity.room].center,
                                                             entity.room, 0.2);
                    } else {
                        entity.waypoint = world.rooms[entity.room].center.copy();
                    }
                    if (entity.isHero) {
                        d3.select("#room-" + entity.room).classed("waypoint", false);
                        console.log("hero entered room '" + entity.room + "'!");
                    } else
                        console.log("'" + entity.name + "' entered room '" + entity.room + "'!");
                }
            } else {  // already have a destination, let's move towards it
                var direction = entity.waypoint.subtract(entity.position);
                if (direction.length() < dt * entity.speed) { // we've reached a waypoint
                    entity.position = entity.waypoint;
                    if (conn)
                        delete entity.path[0].connection;
                    else {
                        entity.room = entity.path.shift().room;
                        
                    }
                    entity.waypoint = null;
                } else { // move towards the destination
                    entity.position = entity.position.add(
                        direction.multiply(dt * entity.speed / direction.length()));
                }
            }
        }
        // if we're stationary, do some random walking to make things look more alive
        if (!entity.path.length && !entity.waypoint &&
            turn % 10 === 0 && Math.random() < 0.2) {
            entity.position = randomOffsetInRoom(entity.position, entity.room, Math.random() * 0.1);
        }
    }

    function randomOffsetInRoom(position, room, scale) {
        var offset_dir = Math.PI * 2 * Math.random();  // a random angle
        var rect = world.rooms[room].rect;
        return new Vector(
            Math.min(rect.left + rect.width - 15, 
                     Math.max(rect.left + 15, position.x + rect.width*scale * Math.cos(offset_dir))),
            Math.min(rect.top + rect.height - 15, 
                     Math.max(rect.top + 15, position.y + rect.height*scale * Math.sin(offset_dir))));
    }

    // This is the main loop that is run several times per second. It updates
    // the hero's position... and not much else so far :)
    var turn = 0;
    function update() {
        // update hero
        updateEntity(world.hero);
        if (world.hero.health < 100 && turn % 10 == 0) {
            world.hero.health = Math.min(100, world.hero.health + 0.2);
            updateHud();
        }
        // update each monster
        world.monsters.forEach(function (monster) {
            updateEntity(monster);
            if (turn % 20 == 0) {
                // randomly walk from room to room
                if (!monster.path.length && monster.sleepUntil < t) {
                    var conn = world.getConnectedRooms(monster.room),
                        room = (_.sample(Object.keys(conn)));
                    monster.path = [{room: room, connection: conn[room]}];
                    monster.sleepUntil = t + 5 + 10 * Math.random();
                }
                // fight the hero
                if (monster.room == world.hero.room) {
                    monster.health -= 20;
                    world.hero.health -= 5;
                    console.log("Fight between hero and '" + monster.name + "'!");
                }
                // remove if dead
                if (monster.health <= 0) {
                    world.monsters = _.without(world.monsters, monster);
                    console.log("'" + monster.name + "' died!");
                }
            }
        });
        // spawn new monsters
        if (world.monsters.length < 3 && turn % 20 == 0 && Math.random() < 0.1) {
            var new_monster = new Entity({room: _.sample(_.keys(world.rooms))});
            world.monsters.push(new_monster);
            console.log("'" + new_monster.name +
                        "' spawned in room '" + new_monster.room + "'!");
        }
        
        drawEntities();
        t = Date.now() / 1000;
        turn++;
        setTimeout(update, 100);
    }

    function drawEntities () {

        // draw the hero
        var h = world.view.select("g.hero").selectAll("circle.hero")
                .data([world.hero])
                .attr("cx", function (d) {return d.position.x;})
                .attr("cy", function (d) {return d.position.y;});
        h.enter().append("circle")
            .classed("hero", true)
            .attr("r", 10)
            .attr("cx", function (d) {return d.position.x;})
            .attr("cy", function (d) {return d.position.y;});

        // draw all monsters
        var m = world.view.select("g.monsters").selectAll("circle.monster")
                .data(world.monsters)
                //.attr("r", function (d) {return d.health / 10;})
                .attr("cx", function (d) {return d.position.x;})
                .attr("cy", function (d) {return d.position.y;});
        m.enter().append("circle")
            .classed("monster", true)
            .attr("r", 10)
            .attr("cx", function (d) {return d.position.x;})
            .attr("cy", function (d) {return d.position.y;})
            .style("opacity", 0)
            .transition()
            .style("opacity", 1);
        m.exit()
            .transition()
            .style("opacity", 0)
            .each("end", function () {d3.select(this).remove();});
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

})();
