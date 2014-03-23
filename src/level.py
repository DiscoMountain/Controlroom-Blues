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
        self.entities = {}

    def add_entities(self, data):
        for d in data:
            self.entities[d["_id"]] = Entity.from_dict(self, d)

    def get_connected_rooms(self, room):
        """
        Find out which rooms are accessible from a room, and how.
        Returns a set of tuples on the form (room, connection)
        """
        if isinstance(room, str):
            room = self.rooms[room]
        connected = set()
        for conn in self.connections.values():
            if conn and room._id in conn.rooms:
                conn_room = (conn.rooms - set([room._id])).pop()
                connected.add((self.rooms[conn_room], conn))
        return connected

    def get_shortest_path(self, room1, room2):
        """
        Find the/a shortest path from room1 to room2.
        Returns a list of tuples on the form (room, connection, distance)
        """
        queue = OrderedDict({room2._id: 0})
        i = 0
        while i < len(queue):
            pos, step = queue.items()[i]
            if pos == room1._id:  # we're there
                print "there"
                path = []
                nearest = queue[pos]
                while pos != room2._id:
                    connected = self.get_connected_rooms(pos)
                    for room, conn in connected:
                        dist = queue.get(room._id)
                        if room == room2 or (dist and dist < nearest):
                            nearest = dist
                            pos = room._id
                            the_conn = conn
                            dist_delta = 1  # should use actual distance on map
                    path.append((self.rooms[pos], the_conn, dist_delta))
                return path
            for room, conn in self.get_connected_rooms(pos):
                old = queue.get(room._id)
                totdist = step + 1
                if old is None or old > totdist:
                    queue[room._id] = totdist
            i += 1
        return None

    def update_entities(self):
        "Go through all entities and check if they change state, etc."
        changed = [e for e in self.entities.values() if e.update()]
        self.reap_entities()
        return True

    def reap_entities(self):
        "Remove dead entities."
        for _id, entity in self.entities.items():
            if entity.state == "DEAD":
                del self.entities[_id]

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
        return [e for e in self.entities.values() if e.room == room]

    def to_dict(self):
        d = {}
        d["rooms"] = dict((_id, room.to_dict())
                          for _id, room in self.rooms.items())
        d["connections"] = dict((_id, conn.to_dict())
                                for _id, conn in self.connections.items())
        d["entities"] = dict((_id, ent.to_dict())
                             for _id, ent in self.entities.items())
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
