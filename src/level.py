from collections import OrderedDict
from copy import deepcopy
import uuid

from entity import Entity


class Room(object):

    "A room in a level."

    def __init__(self, _id=None, items=None):
        self._id = _id if _id else uuid.uuid4()
        self.items = items if items else []

    def __repr__(self):
        "Return a string representation, for printing etc"
        return "Room: %s" % self._id

    def __contains__(self, item):
        "Used to check if a room contains something, using 'in'"
        return item in self.items

    def to_dict(self):
        "A dict representation, for sending to the client."
        return dict(items=self.items)


class Connection(object):

    "A connection (e.g. a door) between two rooms."

    def __init__(self, _id=None, door=False, opened=True, locked=False, rooms=None):
        self._id = _id if _id else uuid.uuid4()
        self.door = door
        self.opened = opened
        self.locked = locked
        self.rooms = set(rooms) if rooms else []

    def __repr__(self):
        return "Door: %s" % self._id

    def __nonzero__(self):
        "The truth value of a connection can be checked to see if it's passable."
        return self.opened

    def to_dict(self):
        return dict(rooms=list(self.rooms), door=self.door, opened=self.opened, locked=self.locked)


class Level(object):

    "A floor level."

    def __init__(self, _id=None, rooms=None, connections=None):
        self._id = _id or uuid.uuid4()
        self.rooms = {room._id: room for room in (rooms if rooms else [])}
        self.connections = {conn._id: conn for conn in (connections if connections else [])}
        self.entities = set()

    def add_entities(self, data):
        for d in data:
            self.entities.add(Entity.from_dict(self, d))

    def get_connected_rooms(self, room):
        "Find out which rooms are accessible from a room, and how."
        if isinstance(room, str):
            room = self.rooms[room]
        connected = []
        for conn in self.connections.values():
            if conn and room._id in conn.rooms:
                conn_room = (conn.rooms - set([room._id])).pop()
                connected.append((self.rooms[conn_room], conn))
        return connected

    def get_shortest_path(self, room1, room2):
        "Find the/a shortest path from room1 to room2."
        step = 0
        queue = OrderedDict({room2._id: step})
        i = 0
        while i < len(queue):
            pos, step = queue.items()[i]
            if pos == room1._id:  # we're there
                path = []
                pos = room1
                _, nearest = queue[room1._id]
                while pos != room2._id:
                    for room, conn in self.get_connected_rooms(pos):
                        conn, dist = queue.get(room._id)
                        if room == room2 or (dist and dist < nearest):
                            nearest = dist
                            pos = room._id
                            dist_delta = 1  # should use actual distance on map
                    path.append((pos, conn, dist_delta))
                return path
            for room, conn in self.get_connected_rooms(pos):
                old = queue.get(room._id)
                totdist = step + 1
                if old is None or old > totdist:
                    queue[room._id] = (conn, totdist)
            i += 1
        return None

    def update_entities(self):
        "Go through all entities and check if they change state, etc."
        changed = [e for e in self.entities if e.update()]
        self.reap_entities()
        return True

    def reap_entities(self):
        "Remove dead entities."
        for entity in list(self.entities):
            if entity.state == "DEAD":
                self.entities.remove(entity)

    def toggle_door(self, door_id):
        "Open a door if closed (and unlocked), and vice versa."
        conn = self.connections[door_id]
        if conn.door:
            if conn.locked:
                return False
            else:
                conn.opened = not conn.opened
                return True

    def get_entities(self, room):
        "Return the list of entities occupying a room."
        return [e for e in self.entities if e.room == room]

    def to_dict(self):
        d = {}
        d["rooms"] = dict((_id, room.to_dict())
                          for _id, room in self.rooms.items())
        d["connections"] = dict((_id, conn.to_dict())
                                for _id, conn in self.connections.items())
        d["entities"] = [ent.to_dict() for ent in self.entities]
        return d

    @classmethod
    def from_dict(cls, data):
        "Create an instance of this class from a dict of properties."
        _id = data["_id"]
        rooms = [Room(_id, room.get("items", []))
                 for _id, room in data["rooms"].items()]
        connections = [Connection(_id, door=conn.get("door"), rooms=conn.get("rooms", []))
                       for _id, conn in data["connections"].items()]
        level = cls(_id, rooms, connections)
        level.add_entities(deepcopy(data["entities"]))
        return level
