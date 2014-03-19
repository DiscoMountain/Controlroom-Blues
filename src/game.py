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

        self._queue = Queue()

    def start(self, period=1.0):
        while self._running:
            gevent.sleep(period)
            res = self._loop()
            if res:
                self._queue.put(res)

    def listen(self):
        try:
            while self._running:
                data = self._queue.get()
                yield "data: %s\n\n" % json.dumps(data)
        except GeneratorExit:
            print "A listener exite"
            pass

    def stop(self):
        self._running = False

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
                return data
