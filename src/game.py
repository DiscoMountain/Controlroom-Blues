import json
import uuid

import gevent
from gevent.queue import Queue
from gevent.lock import BoundedSemaphore
from jsonpatch import JsonPatch

from level import Level, Room, Connection
from entity import Entity


class GameDataEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (Entity, Room, Connection, Level)):
            return obj.to_dict()
        return json.JSONEncoder.default(self, obj)


class Game(object):

    "The main game loop thingy. What drives the game."

    def __init__(self, _id=None, data=None):
        self._id = _id if _id else uuid.uuid4()
        self.level = Level.from_dict(data) if data else None

        self._lock = BoundedSemaphore()
        self._main = None    # will hold a reference to the main greenlet
        self._cache = None   # previous game state is kept for detecting changes
        self.queues = set()  # each client gets a queue where change events are put

    def start(self, period=1.0):
        "Start running the game"
        while True:
            gevent.sleep(period)
            res = self._loop()
            if not self.queues:
                self.stop()
            elif res:
                self.broadcast(res)

    def stop(self):
        "Stop running the game"
        self._main.kill()
        self._main = None
        print "stopped game", self._id

    def broadcast(self, event):
        "Send event data to all listeners"
        for queue in self.queues:
            queue.put(event)

    def listen(self):
        "Add a listener (client)"
        queue = Queue()
        self.queues.add(queue)  # add a listener queue
        queue.put({"data": self.level.to_dict()})  # client needs game data to start
        with self._lock:
            if not self.is_running:
                self._main = gevent.spawn(self.start)  # start the game
        try:
            # client listener loop
            while self.is_running:
                data = queue.get()  # wait for updates
                yield "data: %s\n\n" % json.dumps(data)
        except GeneratorExit:
            print "A listener left game %s!" % self._id
            self.queues.remove(queue)

    @property
    def is_running(self):
        return self._main

    def _loop(self):
        "Do updates and check if anything changed."
        result = self._update()
        if result:
            return dict(patch=list(result))

    def _update(self):
        "Update the level, entities, etc"
        # TODO: Should be possible to be smarter here and not generate
        # the dicts on each update if nothing actually happened.
        self.level.update_entities()
        data = self.level.to_dict()
        if self._cache:
            patch = JsonPatch.from_diff(self._cache, data)
            if patch:  # something has changed!
                self._cache = data
                return patch
        else:
            self._cache = data
