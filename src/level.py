from collections import OrderedDict
import uuid


class Room(object):
    def __init__(self, _id=None, items=set()):
        self._id = _id or uuid.uuid4()
        self.items = items

    def __repr__(self):
        return "Room: %s" % self._id

    def __contains__(self, item):
        return item in self.items


class Connection(object):
    def __init__(self, _id=None, rooms=set()):
        self._id = _id or uuid.uuid4()
        self.rooms = set(rooms)

    def __repr__(self):
        return "Connection: %s" % self._id

    def __nonzero__(self):
        return True


class Door(Connection):
    def __init__(self, _id=None, opened=False, locked=False, *args, **kwargs):
        Connection.__init__(self, *args, **kwargs)
        self.opened = opened
        self.locked = locked

    def __repr__(self):
        return "Door: %s" % self._id

    def __nonzero__(self):
        return self.opened


class Level(object):

    def __init__(self, _id=None, rooms=None, connections=None, entities=None):
        self._id = _id or uuid.uuid4()
        self.rooms = {room._id: room for room in (rooms if rooms else [])}
        self.connections = {conn._id: conn for conn in (connections if connections else [])}
        self.entities = entities if entities else set()

    def get_connected_rooms(self, room):
        if isinstance(room, str):
            room = self.rooms[room]
        connected = set()
        for conn in self.connections.values():
            if conn and room in conn.rooms:
                conn_room = (conn.rooms - set([room])).pop()
                connected.add((conn_room, conn))
        return connected

    def get_shortest_path(self, room1, room2):
        """Find the/a shortest path from room1 to room2."""
        step = 0
        queue = OrderedDict({room2._id: step})
        i = 0
        while i < len(queue):
            pos, step = queue.items()[i]
            if pos == room1._id:  # we're there
                path = []
                pos = room1
                nearest = queue[room1._id]
                while pos != room2._id:
                    for room, conn in self.get_connected_rooms(pos):
                        dist = queue.get(room._id)
                        if room == room2 or (dist and dist < nearest):
                            nearest = dist
                            pos = room._id
                            dist_delta = 1  # should use actual distance on map
                    path.append((pos, dist_delta))
                return path
            for room, conn in self.get_connected_rooms(pos):
                old = queue.get(room._id)
                totdist = step + 1
                if old is None or old > totdist:
                    queue[room._id] = totdist
            i += 1
        return None
