from abc import ABCMeta, abstractmethod
from collections import deque
import random
import time
import uuid

from statemachine import StateMachine


class Entity(StateMachine):

    """
    Abstract representation of an entity.
    Cannot be instantiated, for inheritance only!
    """

    __metaclass__ = ABCMeta

    def __init__(self, _id=None, level=None, room=None,
                 speed=50, chance_to_hit=0.5, weapon_damage=5,
                 healing=0, max_health=100,
                 health=100, ammo=0, morale=100):
        self._id = _id if _id else str(uuid.uuid4())
        self.level = level
        self.room = room  # the currently occupied Room object

        self.speed = speed
        self.chance_to_hit = chance_to_hit
        self.weapon_damage = weapon_damage  # Note: should depend on equipment
        self.fight_cooldown = 1.0
        self.healing = healing

        self.health = health
        self.ammo = ammo
        self.morale = morale

        self._path = deque()  # the current path the entity is on
        self._vision = set()  # the rooms currently visible to the entity

        self._timeout = 0

        self._fight_timeout = 0

        def log_state_change(a, b):
            self.log("%s -> %s" % (a, b))
        StateMachine.__init__(
            self, ["IDLE", "MOVING", "FIGHTING", "DEAD", "PATROLLING"],
            on_state_change=log_state_change)

    def log(self, msg):
        "Print a nice log message"
        print " > %s:%s %s" % (self.__class__.__name__, self._id, msg)

    def update(self):
        """
        Check if state should change, and behave.
        This method should be run periodically, otherwise the entity
        will be inert.
        """
        self.proceed()
        self._behave()

    def _behave(self):
        """Act according to state."""
        if self.state == "FIGHTING":
            self.fight()
        # More behavior here!

    def enter_room(self):
        "Enter the next room in the path"
        print self._path
        if self._path:
            old_room, (self.room, conn, _) = self.room, self._path.popleft()
            self.log("went from %s to %s via %s" % (old_room, self.room, conn))
            self.update_vision()

    def set_timeout(self, dt):
        "Set a timeout that the entity will wait for."
        self._timeout = time.time() + dt

    def timeout_passed(self):
        "Check if the timeout has passed."
        return time.time() >= self._timeout

    def set_destination(self, destination):
        "Chart a path to another room."
        start = self.level.rooms[self._path[0][0]] if self._path else self.room
        path = self.level.get_shortest_path(start, destination)
        if path:
            if self._path:
                first_dest = self.path.popleft()
                self._path.clear()
            self._path.extend(path)
        return path

    def add_destination(self, destination):
        start = (self.level.rooms[self._path[-1][0]._id]
                 if self._path else self.room)
        path = self.level.get_shortest_path(start, destination)
        print start, destination, path
        if path:
            self._path.extend(path)
        return path

    def update_vision(self):
        "Update the entity's field of vision (rooms that can be seen)"
        connected = dict(self.level.get_connected_rooms(self.room)).keys()
        self.vision = connected + [self.room]

    def fight(self):
        "Fight any enemies present"
        # A very simple fighting system, just attacking as often as we can
        enemies = self.get_enemies()
        if enemies and time.time() >= self._fight_timeout:  # cooldown over
            enemy = random.choice(enemies)  # pick a random enemy
            self.attack(enemy)
            self._fight_timeout = time.time() + self.fight_cooldown
        return enemies

    def attack(self, enemy):
        "Try to attack an enemy"
        # Simplest possible mechanic right now...
        hit = random.random() < self.chance_to_hit
        if hit:
            enemy.damage(self.weapon_damage)
        return hit

    def damage(self, amount):
        "Take damage"
        # We could do lots more here, e.g. reduce damage if we have armor
        self.health = max(0, self.health - amount)
        self.log("lost %d HP -> %d!" % (amount, self.health))

    @abstractmethod
    def to_dict(self):
        pass

    @classmethod
    def from_dict(cls, level, data):
        is_hero = data.pop("is_hero")
        data["room"] = level.rooms[data["room"]]
        data["level"] = level
        return Hero(**data) if is_hero else Monster(**data)


class Hero(Entity):

    "The protagonist"

    def __init__(self, *args, **kwargs):

        Entity.__init__(self, *args, **kwargs)

        # === Defining the state machine ===
        # The *state* defines the current 'behavior' of an entity.
        # The *state machine* dictates how the entity *changes* state.

        # IDLE - not doing anything particular
        self.IDLE.when(lambda: self._path)\
                 .goto(self.MOVING)
        self.IDLE.when(self.get_enemies)\
                 .goto(self.FIGHTING)

        # MOVING - going from room to room
        def leave_room():
            self.set_timeout(100.0 / self.speed)
        self.MOVING.set_action(leave_room)
        self.MOVING.when(self.timeout_passed)\
            .do(self.enter_room).goto(self.IDLE)

        # FIGHTING - when there are enemies present
        self.FIGHTING.when(lambda: self.health <= 0).goto(self.DEAD)
        # Note: it should be possible to die also when not fighting...
        self.FIGHTING.when(lambda: self._path)\
                     .goto(self.MOVING)
        self.FIGHTING.when(lambda: not self.get_enemies())\
                     .goto(self.IDLE)

    def get_enemies(self):
        "Return a list of monsters in the vicinity."
        # TODO: fight monsters in adjacent rooms too?
        monsters = [e for e in self.level.get_entities(self.room)
                    if isinstance(e, Monster)]
        return monsters

    def to_dict(self):
        "Representation of the Entity, for sending to the client"
        return dict(
            _id=self._id, level=self.level._id, room=self.room._id,
            health=self.health, ammo=self.ammo, morale=self.morale,
            path=[(room._id, conn._id, dist) for room, conn, dist in self._path],
            state=self.state, is_hero=True)


class Monster(Entity):

    "The antagonists"

    def __init__(self, restlessness=0.1, route=None, *args, **kwargs):

        Entity.__init__(self, *args, **kwargs)

        # === Behavior parameters ===
        self.restlessness = restlessness  # likelihood of wandering randomly
        self.route = route  # route to follow if in PATROLLING

        # === Defining the state machine ===

        # IDLE - not doing anything particular
        # self.IDLE.when(lambda: self.route)\
        #          .goto(self.PATROLLING)
        self.IDLE.when(lambda: self._path)\
                 .goto(self.MOVING)
        self.IDLE.when(self.get_enemies)\
                 .goto(self.FIGHTING)
        self.IDLE.when(lambda: self.route and self._set_new_destination())\
                 .goto(self.MOVING)
        # Monsters are antsy and don't stay in one room for long
        self.IDLE.when(lambda: random.random() < self.restlessness and
                       self._set_random_destination())\
                 .goto(self.MOVING)

        # MOVING - going from room to room
        def leave_room():
            self.set_timeout(100.0 / self.speed)
        self.MOVING.set_action(leave_room)
        self.MOVING.when(self.timeout_passed)\
            .do(self.enter_room).goto(self.IDLE)

        # FIGHTING - when there are enemies present
        self.FIGHTING.when(lambda: self.health <= 0).goto(self.DEAD)
        self.FIGHTING.when(lambda: self._path)\
                     .goto(self.MOVING)
        self.FIGHTING.when(lambda: not self.fight())\
                     .goto(self.IDLE)

    def _set_random_destination(self):
        "Select an adjacent room at random."
        connected = self.level.get_connected_rooms(self.room)
        if connected:
            room, conn = random.choice(list(connected))
            self._path.append((room, conn, 1))
        return connected

    def _set_new_destination(self):
        if self.route:
            for r in self.route:
                self.add_destination(self.level.rooms[r])
        return self._path

    def get_enemies(self):
        "Check if any heroes are around."
        heroes = [e for e in self.level.get_entities(self.room)
                  if isinstance(e, Hero)]
        return heroes

    def to_dict(self):
        "Representation of the Entity, for sending to the client"
        return dict(
            _id=self._id, level=self.level._id, room=self.room._id,
            path=[(room._id, conn._id, dist) for room, conn, dist in self._path],
            state=self.state, is_hero=False)
