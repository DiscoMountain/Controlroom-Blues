var world;

(function () {

    var standard_monster_spec = {room: "d", chanceToHit: 0.25, weaponDamage: 3};

    world = new World({
        // The world is defined as a graph, where the nodes correspond to rooms
        // and edges correspond to doors/connections, connecting two rooms.
        connections: {
            "1": {door: true, locked: true, open: false},
            "2": {door: true, open: false, rooms: ["a", "b"]},
            "3": {open: true, rooms: ["a", "c"]},
            "4": {open: true, rooms: ["c", "g"]},
            "5": {door: true, open: false, rooms: ["d", "e"]},
            "6": {open: true, rooms: ["b", "e"]},
            "7": {open: true, rooms: ["g", "d"]}
        },

        rooms: {
            "a": {camera: false},
            "b": {camera: true, puzzle: true},
            "c": {},
            "d": {terminal: true, camera: true, puzzle: true},
            "e": {camera: true},
            "g": {camera: false}
        }

    });
    
    // Representation of the game world
    function World(spec) {

        // actions
        this.log =  function (s) {console.log("World console: " + s);};

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
            this.connections[c].rect = this.getRect("door", c);
        }, this);

        Object.keys(this.rooms).forEach(function (r) {
            this.rooms[r].el = 
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

        this.updateIcons();
        
        this.hero = new Entity({room: "a", isHero: true, weaponDamage: 20, healing: 1});
        this.monsters = [new Entity(standard_monster_spec)];

        // start some update loops
        setInterval(drawEntities, 200);
        setInterval(spawnMonsters, 5100, 0.5);
        setInterval(reapMonsters, 2100);
    };

    // Display icons on each room showing what's there
    World.prototype.updateIcons = function () {

        var icon_types = ["camera", "terminal", "puzzle"];
        
        function iconPosition (icon, room) {
            room = world.rooms[room];
            var position = new Vector(room.rect.left, room.rect.top);
            icon_types.some(function (ic) {
                if (ic === icon) return true;
                if (ic in room) position.x += 32;
            }, this);
            return position;
        };
                
        var s = d3.select("#layer5").selectAll("path");

        icon_types.forEach(function (icon) {
            var tmp = s.data(_.filter(_.keys(this.rooms), function (d) {return world.rooms[d][icon];}));
            tmp.enter().append("path")
                .classed({icon: true})
                .attr("d", Icons[icon])
                .attr("transform", function (d) {
                    var pos = iconPosition(icon, d);
                    return "translate(" + pos.x + "," + pos.y + ")";})
                .on("click", function (d) {console.log("clicked", icon, d);});
            tmp.exit().remove();
        }, this);
        
        // Locked doors
        var locked = s.data(_.filter(_.values(this.connections), function (d) {return d.locked;}));
        locked.enter().append("path")
            .classed({icon: true})
            .attr("d", Icons.locked)
            .attr("transform", function (d) {
                return "translate(" + (d.center.x - 8) + "," + (d.center.y - 8) + ")scale(0.5)";});
        locked.exit().remove();
    };

    World.prototype.getElement = function (type, id) {
        return d3.select("#" + type + "-" + id);
    };
    
    // find the coordinates of the center of something
    World.prototype.getCenter = function (type, id) {
        var el = this.getElement(type, id);
        if (!el.empty())
            return new Vector(parseInt(el.attr("x")) + parseInt(el.attr("width")) / 2,
                              parseInt(el.attr("y")) + parseInt(el.attr("height")) / 2);
        else
            return null;
    };

    World.prototype.getRect = function (type, id) {
        var el = this.getElement(type, id);
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


    // spawn new monsters
    function spawnMonsters (chance) {
        if (world.monsters.length < 3 && Math.random() < chance) {
            standard_monster_spec.room = _.sample(_.keys(world.rooms));
            var new_monster = new Entity(standard_monster_spec);
            world.monsters.push(new_monster);
            world.log("'" + new_monster.name +
                      "' spawned in room '" + new_monster.room + "'!");
        }
    }
    
    function reapMonsters() {
        world.monsters.forEach(function (monster) {
            if (monster.health <= 0) {
                world.monsters = _.without(world.monsters, monster);
                world.log("'" + monster.name + "' died!");
            }
        });
    }
    
    function drawEntities () {

        // draw the hero
        var h = world.view.select("g.hero").selectAll("circle.hero")
                .data([world.hero])
                .attr("id", function (d) {return d.name;})
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

        // Fade in/out depending on visibility
        m.transition().duration(400)
            .style("opacity", function (d) {return d.isVisible()? 1 : 0;});

        m.enter().append("circle")
            .classed("monster", true)
            .attr("id", function (d) {return d.name;})
            .attr("r", 10)
            .attr("cx", function (d) {return d.position.x;})
            .attr("cy", function (d) {return d.position.y;})
            .style("opacity", 0)
            .transition()
            .style("opacity", 1)
            .attr("opacity", 0);
        m.exit()
            .remove();
    };

})();
