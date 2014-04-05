var world;

window.addEventListener("load", function () {

    world = new World();
    console.log("Wworld defined");

    // Representation of the game world
    function World() {

        // actions
        this.log =  function (s) {console.log("World console: " + s);};

        this.preventClick = false;  // hack to avoid collisions between panning and clicking

        // Handle data updates from the server
        function update (event) {
            if (!event.data)
                return;
            var data = JSON.parse(event.data);  // decode JSON
            console.log(data);
            if ("data" in data) {
                // We got a full level data object, let's initialize
                this.connections = data.data.connections;
                this.rooms = data.data.rooms;
                this.entities = data.data.entities;
                this.observer = jsonpatch.observe(this);
                if (!this.started)
                    this.start();  // get things rolling
            } else {
                // We got a patch of changes, let's apply it
                jsonpatch.apply(this, data.patch);
                data.patch.forEach(function(p) {
                    // Trying to be a bit intelligent and only update stuff
                    // that has changed.
                    var path = /(\w+)\/(\w+)\/(\w+)/.exec(p.path);  // regex matching
                    if (path) {
                        var main = path[1], id = path[2], sub = path[3];
                        if (main == "connections")  // a door has been changed
                            view.toggle(id, "door", p.value);
                        if (main == "entities" && (sub == "health" || sub == "ammo") &&
                            this.entities[id].is_hero)  // our hero's stats changed
                            updateHud();
                    }
                }, this);
            }
        };

        // Figure out the game-id to use
        this.game_id = parseInt(document.getElementById("game-id").textContent);

        // Subscribe to server events (SSE) for the game
        this.sse_stream = new EventSource("/listen_game/" + this.game_id);
        this.sse_stream.addEventListener("message", update.bind(this));
    }

    // start the world
    World.prototype.start = function () {
        console.log("start");
        this.started = true;
        view.load("static/graphics/map2.svg");  // get the map
    };

    // "activate" the map (needs to be called after the svg is loaded)
    World.prototype.connect_map = function (mapNode) {

        this.view = d3.select(mapNode);

        // compute centers and rects
        Object.keys(this.connections).forEach(function (c) {
            var conn = this.connections[c];
            if (conn.door) {
                conn.rect = util.getRect("door", c);
                conn.center = util.getCenter(conn.rect);
            } else {
                var room1 = util.getRect("room", conn.rooms[0]),
                    room2 = util.getRect("room", conn.rooms[1]);
                console.log(room1, room2);
                conn.rect = util.bboxOverlap(room1, room2);
                conn.center = util.getCenter(conn.rect);
            }
            console.log("connection rect", c, conn.rect);
        }, this);

        Object.keys(this.rooms).forEach(function (r) {
            var rect = this.rooms[r].rect = util.getRect("room", r);
            this.rooms[r].center = util.getCenter(rect);

            // write room names (for debugging)
            var s = d3.select("#layer5").append("text");
            s.attr("x", this.rooms[r].center.x)
                .attr("y", this.rooms[r].center.y)
                .style("fill", "black")
                .style("text-anchor", "middle")
                .style("font-size", "5px")
                .text(r);
        }, this);

        // setup click listeners on the rooms
        Object.keys(this.rooms).forEach(function (room, i) {
            var el = this.view.select("#" + room)
                    .style("fill", "lightblue")
                    .on("click", function () {
                        if (!world.preventClick) {
                            var room = d3.event.target.id;
                            console.log("click", room);
                            //this.getHero().updatePath(room);
                            var success = function (data) {
                                console.log(data);
                            };
                            d3.json(this.game_id + "/entity/hero/move/" + room, success);
                        }
                    }.bind(this), true);
        }, this);

        Object.keys(this.connections).forEach(function (conn, i) {
            if (this.connections[conn].door) {
                // Initialize door position
                if (this.connections[conn].opened)
                    view.toggle(conn, "door", true);

                // setup click listener
                var el = this.view.select("#" + conn)
                        .on("click", function () {
                            if (!world.preventClick) {
                                console.log("clicked door", conn);
                                var success = function (data) {
                                    console.log(data);
                                };
                                d3.json(this.game_id + "/door/" + conn + "/toggle", success);
                            }
                        }.bind(this), true);
            }
        }, this);

        this.updateIcons();
        setInterval(drawEntities, 1000);
        updateHud();
    };

    // Display icons on each room showing what's there
    World.prototype.updateIcons = function () {

        console.log("updateIcons", this);

        var room_icons = ["camera", "terminal", "puzzle", "firstaid", "ammo"];

        function iconPosition (icon, room) {
            room = world.rooms[room];
            var position = new Vector(room.rect.left, room.rect.top);
            room_icons.some(function (ic) {
                if (ic === icon) return true;
                if (ic in room) position.x += 32;
            }, world);
            return position;
        };

        var s = d3.select("#layer5").selectAll("path.icon");

        // Draw the correct icons on each room
        room_icons.forEach(function (icon) {
            var tmp = s.filter("."+icon).data(_.filter(_.keys(world.rooms),
                                                       function (d) {return world.rooms[d][icon];}));
            tmp.exit().remove();
            tmp.enter().append("path")
                .classed("icon", true)
                .classed(icon, true)
                .attr("d", Icons[icon])
                .attr("transform", function (d) {
                    var pos = iconPosition(icon, d);
                    return "translate(" + pos.x + "," + pos.y + ")";})
                // here's where to put callbacks for mouseclick
                .on("click", function (d) {console.log("clicked", icon, d);});
        }, world);

        // Locked door icons
        var locked = s.filter(".locked").data(_.filter(_.values(world.connections),
                                                       function (d) {return d.locked;}));
        locked.exit().remove();
        locked.enter().append("path")
            .classed("icon", true)
            .classed("locked", true)
            .attr("d", Icons.locked)
            .attr("transform", function (d) {
                return "translate(" + (d.center.x - 8) + "," + (d.center.y - 8) + ")scale(0.5)";});
    };

    World.prototype.getHero = function () {
        return _.filter(_.values(this.entities), function (e) {return e.is_hero})[0];
    };

    function updateHud() {
        var hud = document.getElementById("hud"),
            hero = world.getHero();
        if (hero) {
            hud.innerHTML = [
                ("HEALTH: " + Math.round(hero.health) + "% <br>" +
                 "AMMO: " + Math.round(hero.ammo) + "%")
            ].join();
            if (hero.health < 20) {
                hud.className = "critical";
            } else {
                if (hero.health < 80)
                    hud.className = "hurt";
                else
                    hud.className = null;
            }
            d3.select("#hud")
                .style("background-color", "white", "important")
                .transition()
                .style("background-color", "rgba(0,0,0,0.5)");
        }
    };

    function drawEntities () {
        // draw all entities

        var m = world.view.select("g.monsters").selectAll("circle.monster")
                .data(_.values(world.entities), function (e) {return e._id;});

        m.transition().duration(1000)
            .attr("cx", function (d) {return world.rooms[d.room].center.x;})
            .attr("cy", function (d) {return world.rooms[d.room].center.y;});

        m.enter().append("circle")
            .classed("monster", true)
            .classed("hero", function (d) {return d.is_hero;})
            .attr("id", function (d) {return d.name;})
            .attr("r", 10)
            .attr("cx", function (d) {return world.rooms[d.room].center.x;})
            .attr("cy", function (d) {return world.rooms[d.room].center.y;})
            .style("opacity", 0)
            .transition()
            .style("opacity", 1);

        m.exit()
            .transition()
            .style("opacity", 0)
            .remove();

    };

});
