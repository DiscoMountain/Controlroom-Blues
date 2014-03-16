from abc import ABCMeta, abstractmethod
from collections import deque
from random import choice, random
import time
import uuid

from statemachine import StateMachine


class Entity(StateMachine):

    """
    Abstract representation of an entity.
    Cannot be instantiated, for inheritance only!
    """

    __metaclass__ = ABCMeta

    def __init__(self, _id, level, room,
                 speed, chance_to_hit, weapon_damage, healing, max_health,
                 health, ammo, morale):
        self._id = _id if _id else str(uuid.uuid4)
        self.level = level
        self.room = room

        self.speed = speed
        self.chance_to_hit = chance_to_hit
        self.weapon_damage = weapon_damage  # Note: should depend on equipment
        self.healing = healing

        self.health = health
        self.ammo = ammo
        self.morale = morale

        self._path = deque()  # the current path the entity is on
        self._vision = set()  # the rooms currently visible to the entity

        self._timeout = 0

        StateMachine.__init__(self, ["IDLE",
                                     "LEAVING_ROOM", "ENTERING_ROOM",
                                     "FIGHTING"])

    def enter_room(self):
        self.room = self._path.popleft()
        self.set_timeout(100.0 / self.speed)

    def set_timeout(self, dt):
        self._timeout = time.time() + dt

    def timeout_passed(self):
        return time.time() >= self._timeout

    def set_destination(self, destination):
        start = self._path[0] if self._path else self.room
        path = self.level.get_shortest_path(start, destination)
        if path:
            self._path = path

    def update_vision(self):
        connected = self.level.get_connected_rooms(self.room)
        self.vision = connected + set((self.room,))

    @abstractmethod
    def get_enemies(self):
        pass

    def fight(self):
        enemies = self.get_enemies()
        enemy = choice(enemies)  # pick one randomly
        self.attack(enemy)

    def attack(self, enemy):
        hit = random() < self.chance_to_hit
        if hit:
            enemy.health -= self.weapon_damage

    @abstractmethod
    def dict(self):
        pass


class Hero(Entity):

    def __init__(self, *args, **kwargs):

        Entity.__init__(self, *args, **kwargs)

        # === Defining the state machine ===

        # IDLE - not doing anything particular
        self.IDLE.when(lambda: self._path).goto(self.LEAVING_ROOM)
        self.IDLE.when(self.get_enemies)\
                 .goto(self.FIGHTING)

        # Movement, when there is a path defined
        # LEAVING_ROOM - going to the door
        self.LEAVING_ROOM.set_action(self.set_timeout, 100.0 / self.speed)
        self.LEAVING_ROOM.when(self.timeout_passed)\
                           .goto(self.ENTERING_ROOM)
        self.LEAVING_ROOM.when(self.get_enemies)\
                           .goto(self.FIGHTING)

        # Entering room, going from the door to the center
        self.ENTERING_ROOM.set_action(self.enter_room)
        self.ENTERING_ROOM.when(self.timeout_passed)\
                          .goto(self.IDLE)
        self.ENTERING_ROOM.when(self.get_enemies)\
                          .goto(self.FIGHTING)

        # FIGHTING - when there are enemies present
        # TODO: fight monsters in adjacent rooms too?
        self.FIGHTING.set_action(self.fight)
        self.FIGHTING.when(lambda: self._path)\
            .goto(self.LEAVING_ROOM)
        self.FIGHTING.when(lambda: not self.get_enemies())\
            .goto(self.IDLE)

    def get_enemies(self):
        monsters = [e for e in self.level.get_entities(self.room)
                    if isinstance(e, Monster)]
        return monsters

    def dict(self):
        "Representation of the Entity, for sending to the client"
        return dict(
            _id=self._id, level=self.level._id, room=self.room._id,
            health=self.health, ammo=self.ammo, morale=self.morale,
            state=self.state)


class Monster(Entity):

    def __init__(self, restlessness=0.1, *args, **kwargs):

        Entity.__init__(self, *args, **kwargs)

        self.restlessness = restlessness  # likelihood of wandering randomly

        # === Defining the state machine ===
        # IDLE - not doing anything particular
        self.IDLE.when(lambda: self._path).goto(self.LEAVING_ROOM)
        self.IDLE.when(lambda: random() < self.restlessness)\
                 .do(self.set_random_destination)\
                 .goto(self.LEAVING_ROOM)
        self.IDLE.when(self.get_enemies)\
                 .goto(self.FIGHTING)

        # Movement, when there is a path defined
        # LEAVING_ROOM - going to the door
        self.LEAVING_ROOM.set_action(self.set_timeout, 100.0 / self.speed)
        self.LEAVING_ROOM.when(self.timeout_passed)\
                           .do(self.enter_room)\
                           .goto(self.ENTERING_ROOM)
        self.LEAVING_ROOM.when(self.get_enemies)\
                           .goto(self.FIGHTING)

        # Entering room, going from the door to the center
        self.ENTERING_ROOM.set_action(self.set_timeout, 100.0 / self.speed)
        self.ENTERING_ROOM.when(self.timeout_passed)\
                          .goto(self.IDLE)
        self.ENTERING_ROOM.when(self.get_enemies)\
                          .goto(self.FIGHTING)

        # FIGHTING - when there are enemies present
        # TODO: fight monsters in adjacent rooms too?
        self.FIGHTING.set_action(self.fight)
        self.FIGHTING.when(lambda: self._path)\
            .goto(self.LEAVING_ROOM)
        self.FIGHTING.when(lambda: not self.get_enemies())\
            .goto(self.IDLE)

    def set_random_destination(self):
        connected = self.level.get_connected_rooms(self.room)
        self._path.append(connected[0])

    def get_enemies(self):
        entities = self.level.get_entities(self.room)
        for e in entities:
            if isinstance(e, Hero):
                return [Hero]

    def dict(self):
        "Representation of the Entity, for sending to the client"
        return dict(
            _id=self._id, level=self.level._id, room=self.room._id,
            state=self.state)
