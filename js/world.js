var world;

(function () {

    var view = d3.select("#main-svg"), hud = document.getElementById("hud"), t;

    var standard_monster_spec = {room: "d", chanceToHit: 0.25, weaponDamage: 3};

    world = new World({
        // The world is defined as a graph, where the nodes correspond to "rooms"
        // and edges correspond to doors/connections, connecting two "rooms".
        connections: {
            "1": {door: true, open: false},
            "2": {door: true, open: false, rooms: ["a", "b"]},
            "3": {open: true, rooms: ["a", "c"]},
            "4": {open: true, rooms: ["c", "g"]},
            "5": {door: true, open: false, rooms: ["d", "e"]},
            "6": {open: true, rooms: ["b", "e"]},
            "7": {open: true, rooms: ["g", "d"]}
        },

        rooms: {
            "a": {camera: false},
            "b": {camera: true},
            "c": {},
            "d": {camera: true},
            "e": {camera: true},
            "g": {camera: false}
        }

    });
    
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

        this.updateIcons();
        
        this.hero = new Entity({room: "a", isHero: true, weaponDamage: 20, healing: 1});
        this.monsters = [new Entity(standard_monster_spec)];

        // start some update loops
        setInterval(drawEntities, 100);
        setInterval(updateHud, 1005);
        setInterval(spawnMonsters, 5100, 0.5);
        setInterval(reapMonsters, 2100);
    };

    World.prototype.updateIcons = function () {
        _.values(this.connections).forEach(function (conn) {
            if (!conn.open && conn.center) {
                d3.select("#layer5")
                    .append("path")
                    .attr("d", Icons.lock)
                    .attr("transform", "translate(" + conn.center.x + "," + conn.center.y + ")scale(0.5)");
            }
        });
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
        this.vision = {};
        this.waypoint = null;
        this.changeToHit = spec.changeToHit || 0.5;
        this.weaponDamage = spec.weaponDamage || 10;
        this.name = this.isHero? "Hero" : Math.random().toString(36).replace(/[^a-z]+/g, '');

        this.healing = spec.healing || 0;
        
        this.sleepUntil = 0;

        this.health = 100;
        this.ammo = 100;
        this.morale = 100;

        loopUntilDead(brownianWalk, this, 1.5);
        loopUntilDead(fight, this, 1.01);
        loopUntilDead(heal, this, 5.1);
        if (!this.isHero) {
            randomWalkLoop(this, 2.03);
            loopUntilDead(updateVisibility, this, 1.1);
        }
    };

    Entity.prototype.setRoom = function (room) {
        this.room = room;
    };

    Entity.prototype.updatePath = function (destination) {
        if (destination) {
            var path;
            if (this.path.length) {
                // case where the hero is already on his way somewhere.
                // then let him continue on his way until he reaches the
                // next room, then switch to the new path.
                var next = this.path[0];
                path = world.getShortestPath(next.room, destination);
                if (path)
                    this.path = [next].concat(path);
            } else {
                path = world.getShortestPath(this.room, destination);
                if (path)
                    this.path = path;
            }
        } else {
            // the world has changed, check if the path needs updating
        }
        if (this.isHero) {
            d3.selectAll(".waypoint")
                .classed("waypoint", false);
            this.path.forEach(function (r) {
                d3.select("#room-" + r.room)
                    .classed("waypoint", true);
            });
        }
        followPath(this, updateVision);
    };

    function loopUntilDead(f, entity, period) {
        if (entity.health > 0) {
            f(entity);
            setTimeout(loopUntilDead, period * 1000, f, entity, period);
        }
    }

    function updateVision (entity) {
        entity.vision = world.getConnectedRooms(entity.room);
    }
        
    // do some in-place movement to seem more alive
    function brownianWalk(entity) {
        if (!entity.waypoint) { // unless we're going somewhere
            entity.position = randomOffsetInRoom(entity.position, entity.room, Math.random() * 0.1);
        }
    }

    // walk from room to room
    function randomWalkLoop(entity) {
        if (entity.health > 0) { 
            var conn = world.getConnectedRooms(entity.room),
                room = (_.sample(Object.keys(conn))),
                path = [{room: room, connection: conn[room]}];
            console.log(entity.name, "randomly walking to", room, "from", entity.room);
            entity.path = path;
            followPath(entity, function () {setTimeout(randomWalkLoop, 1000 + Math.random() * 3000, entity);});
        }
    }
    
    function fight(entity) {
        var opponents;
        if (entity.isHero)
            opponents = _.filter(world.monsters, function (m) {return m.room == entity.room;});
        else
            opponents = (entity.room == world.hero.room) ? [world.hero] : [];
        opponents.forEach(function (o) {
            console.log("'" + entity.name +"' attacking '" + o.name + "'!");
            var hit = Math.random() < entity.changeToHit;
            if (hit) {
                    o.health -= entity.weaponDamage;
                console.log("'" + entity.name +"' hits!");
            }
        });
    };

    function heal(entity) {
        entity.health = Math.min(100, entity.health + entity.healing);
    }

    function updateVisibility(entity) {
        if (entity.room == world.hero.room ||
            entity.room in world.hero.vision ||
            world.rooms[entity.room].camera) {
            d3.selectAll("#" + entity.name)
                .style("opacity", entity.room == world.hero.room || world.rooms[entity.room].camera? 1 : 0);
        }
    }

    // follow the path
    function followPath (entity, callback) {
        if (!entity.waypoint && entity.path.length) {
            var target = entity.path[0];
            moveTo(entity, target, function () {followPath(entity, callback);}, 0.2);
        } else {
            console.log(entity.name + " reached destination " + entity.room + "!");
            if (callback) callback(entity);
        }
        d3.select("#room-" + entity.room).classed("waypoint", false);
    };

    // move an entity between two adjacent rooms
    function moveTo(entity, target, callback, dt, subpath, delta) {
        if (!subpath) {
            console.log(target);
            var conn = world.connections[target.connection];
            subpath = conn && conn.center ?
                [world.connections[target.connection].center,
                 randomOffsetInRoom(world.rooms[target.room].center, target.room, 0.1)] :
                [randomOffsetInRoom(world.rooms[target.room].center, target.room, 0.1)];
        }
        var direction = subpath[0].subtract(entity.position);            
        if (!delta) {
            delta = delta || direction.multiply(dt * entity.speed / direction.length());
        }
        if (direction.length() > dt * entity.speed) {
            entity.position = entity.position.add(delta);
            entity.waypoint = setTimeout(function () {moveTo(entity, target, callback, dt, subpath, delta);},
                                         dt * 1000);
        } else {
            entity.position = subpath.shift();
            if (subpath.length) {
                console.log(entity.name, " reached connection", target.connection);
                entity.room = target.room;
                entity.waypoint = setTimeout(function () {moveTo(entity, target, callback, dt, subpath);},
                                             dt * 1000);
            } else {
                console.log(entity.name + " reached room", target.room);
                entity.room = target.room;
                entity.waypoint = null;
                entity.path.shift();
                callback();
            }
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

    // spawn new monsters
    function spawnMonsters (chance) {
        if (world.monsters.length < 3 && Math.random() < chance) {
            standard_monster_spec.room = _.sample(_.keys(world.rooms));
            var new_monster = new Entity(standard_monster_spec);
            world.monsters.push(new_monster);
            console.log("'" + new_monster.name +
                        "' spawned in room '" + new_monster.room + "'!");
        }
    }
    
    function reapMonsters() {
        world.monsters.forEach(function (monster) {
            if (monster.health <= 0) {
                world.monsters = _.without(world.monsters, monster);
                console.log("'" + monster.name + "' died!");
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
        m.enter().append("circle")
            .classed("monster", true)
            .attr("id", function (d) {return d.name;})
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

})();
