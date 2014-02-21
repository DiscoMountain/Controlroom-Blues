var Entity = {};

(function () {
    // Representation of someone (hero, monster, ...) or something
    Entity = function (spec) {
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
        } else
            updateVision(this);
    };

    Entity.prototype.setRoom = function (room) {
        this.room = room;
    };

    Entity.prototype.isVisible = function () {
        return this.room in world.hero.vision || world.rooms[this.room].camera;
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
            entity.path = path;
            followPath(entity, function () {setTimeout(randomWalkLoop, 1000 + Math.random() * 10000, entity);});
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

    function updateVision (entity) {
        entity.vision = world.getConnectedRooms(entity.room);
        entity.vision[entity.room] = {};
        _.keys(world.rooms).forEach(function (r) {
            d3.select("#room-" + r).classed("visible", function () {
                return r in entity.vision;});
        });
    }
    
    // follow the path
    function followPath (entity, callback) {
        if (!entity.waypoint && entity.path.length) {
            var target = entity.path[0];
            moveTo(entity, target, function () {followPath(entity, callback);}, 0.1);
        } else {
            console.log(entity.name + " reached destination " + entity.room + "!");
            if (callback) callback(entity);
        }
        d3.select("#room-" + entity.room).classed("waypoint", false);
    };

    // move an entity between two adjacent rooms
    function moveTo(entity, target, callback, dt, subpath, delta) {
        if (!subpath) {
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
    
})();
