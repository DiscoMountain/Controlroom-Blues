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
                            view.toggle("door-" + id, p.value);
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
        view.load("static/graphics/map.svg");  // get the map
    };

    // "activate" the map (needs to be called after the svg is loaded)
    World.prototype.connect_map = function (mapNode) {

        this.view = d3.select(mapNode);

        Object.keys(this.connections).forEach(function (c) {
            this.connections[c].center = this.getCenter("door", c);
            this.connections[c].rect = this.getRect("door", c);
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
                            var room = d3.event.target.id.split("-")[1];
                            //this.hero.updatePath(room);
                            var success = function (data) {
                                console.log(data);
                            };
                            d3.json(this.game_id + "/hero/room/" + room, success);
                        }
                    }.bind(this), true);
        }, this);

        Object.keys(this.connections).forEach(function (conn, i) {
            if (this.connections[conn].door) {
                // Initialize door position
                if (this.connections[conn].opened)
                    view.toggle("door-" + conn, true);

                // setup click listener
                var el = this.view.select("#door-" + conn)
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
