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
                 speed=50, chance_to_hit=0.5, weapon_damage=5, healing=0, max_health=100,
                 health=100, ammo=0, morale=100):
        self._id = _id if _id else str(uuid.uuid4)
        self.level = level
        self.room = room

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
        StateMachine.__init__(self, ["IDLE", "MOVING", "FIGHTING", "DEAD"],
                              on_state_change=log_state_change)

    def log(self, msg):
        print " > %s:%s %s" % (self.__class__.__name__, self._id, msg)

    def update(self):
        self.proceed()
        self.act()

    def act(self):
        """Act according to state."""
        if self.state == "FIGHTING":
            self.fight()

    def enter_room(self):
        old_room, self.room = self.room, self._path.popleft()
        self.log("went from %s to %s" % (old_room, self.room))
        self.update_vision()

    def set_timeout(self, dt):
        self._timeout = time.time() + dt

    def timeout_passed(self):
        return time.time() >= self._timeout

    def set_destination(self, level, destination):
        start = self._path[0] if self._path else self.room
        path = level.get_shortest_path(start, destination)
        if path:
            self._path = path

    def update_vision(self):
        connected = self.level.get_connected_rooms(self.room)
        self.vision = connected + [self.room]

    def fight(self):
        enemies = self.get_enemies()
        if enemies and time.time() >= self._fight_timeout:  # cooldown over
            enemy = random.choice(enemies)  # pick one randomly
            self.attack(enemy)
            self._fight_timeout = time.time() + self.fight_cooldown
        return enemies

    def attack(self, enemy):
        hit = random.random() < self.chance_to_hit
        if hit:
            enemy.damage(self.weapon_damage)

    def damage(self, amount):
        self.health = max(0, self.health - amount)
        self.log("lost %d HP -> %d!" % (amount, self.health))

    @abstractmethod
    def to_dict(self):
        pass

    @classmethod
    def from_dict(cls, level, data):
        print data
        is_hero = data.pop("is_hero")
        data["room"] = level.rooms[data["room"]]
        data["level"] = level
        return Hero(**data) if is_hero else Monster(**data)


class Hero(Entity):

    def __init__(self, *args, **kwargs):

        Entity.__init__(self, *args, **kwargs)

        # === Defining the state machine ===

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
        # TODO: fight monsters in adjacent rooms too?
        self.FIGHTING.when(lambda: self.health <= 0).goto(self.DEAD)
        self.FIGHTING.when(lambda: self._path)\
                     .goto(self.MOVING)
        self.FIGHTING.when(lambda: not self.get_enemies())\
                     .goto(self.IDLE)

    def get_enemies(self):
        monsters = [e for e in self.level.get_entities(self.room)
                    if isinstance(e, Monster)]
        return monsters

    def to_dict(self):
        "Representation of the Entity, for sending to the client"
        return dict(
            _id=self._id, level=self.level._id, room=self.room._id,
            health=self.health, ammo=self.ammo, morale=self.morale,
            state=self.state, is_hero=True)


class Monster(Entity):

    def __init__(self, restlessness=0.5, *args, **kwargs):

        Entity.__init__(self, *args, **kwargs)

        self.restlessness = restlessness  # likelihood of wandering randomly

        # === Defining the state machine ===

        # IDLE - not doing anything particular
        self.IDLE.when(lambda: self._path)\
                 .goto(self.MOVING)
        self.IDLE.when(self.get_enemies)\
                 .goto(self.FIGHTING)
        self.IDLE.when(lambda: random.random() < self.restlessness and
                       self._set_random_destination())\
                 .goto(self.MOVING)

        # MOVING - going from room to room
        def leave_room():
            self.set_timeout(100.0 / self.speed)
        self.MOVING.set_action(leave_room)
        #self.MOVING.when(lambda: not self._path).goto(self.IDLE)
        self.MOVING.when(self.timeout_passed)\
            .do(self.enter_room).goto(self.IDLE)

        # FIGHTING - when there are enemies present
        self.FIGHTING.when(lambda: self.health <= 0).goto(self.DEAD)
        self.FIGHTING.when(lambda: self._path)\
                     .goto(self.MOVING)
        self.FIGHTING.when(lambda: not self.fight())\
                     .goto(self.IDLE)

    def _set_random_destination(self):
        connected = self.level.get_connected_rooms(self.room)
        if connected:
            self._path.append(random.choice(connected)[0])
        return connected

    def get_enemies(self):
        heroes = [e for e in self.level.get_entities(self.room)
                  if isinstance(e, Hero)]
        return heroes

    def to_dict(self):
        "Representation of the Entity, for sending to the client"
        return dict(
            _id=self._id, level=self.level._id, room=self.room._id,
            state=self.state, is_hero=False)
