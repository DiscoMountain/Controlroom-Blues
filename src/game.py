import json
import uuid

import gevent
from gevent.queue import Queue
from jsonpatch import JsonPatch

from level import Level


def sse_json(data):
    json_str = json.dumps(data)




class Game(object):

    def __init__(self, _id=None, data=None):
        self._id = _id if _id else uuid.uuid4()
        self.level = Level.from_dict(data) if data else None

        self._cache = None
        self._running = True

        self.queues = set()

    def start(self, period=1.0):
        "Start running the game"
        while self._running:
            gevent.sleep(period)
            res = self._loop()
            if not self.queues:
                self.stop()
            elif res:
                self.broadcast(res)

    def stop(self):
        "Stop running the game"
        self._running = False

    def broadcast(self, event):
        "Send event data to all listeners"
        for queue in self.queues:
            queue.put(event)

    def listen(self):
        "Add a listener"
        if not self.queues:  # we're the first listener; start the game
            gevent.spawn(self.start)
        queue = Queue()
        self.queues.add(queue)  # add a listener queue
        queue.put({"data": self.level.to_dict()})
        try:
            while self._running:
                data = queue.get()
                yield "data: %s\n\n" % json.dumps(data)
        except GeneratorExit:
            print "A listener exited!"
            self.queues.remove(queue)

    def _loop(self):
        result = self._update()
        if result:
            if isinstance(result, JsonPatch):
                return dict(patch=list(result))
            elif isinstance(result, dict):
                return dict(data=result)

    def _update(self):
        changes = self.level.update_entities()
        if changes:
            data = self.level.to_dict()
            if self._cache:
                patch = JsonPatch.from_diff(self._cache, data)
                if patch:
                    self._cache = data
                    return patch
            else:
                self._cache = data
                #return data
