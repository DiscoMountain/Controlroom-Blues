#!/usr/bin/env python

import logging

import gevent
import gevent.monkey
from gevent.pywsgi import WSGIServer
gevent.monkey.patch_all()

import werkzeug.serving
from flask import Flask, request, Response, render_template

from game import Game

app = Flask(__name__)

game_data = {

    "_id": "kpejfhai",

    "connections": {
        "1": {"door": True, "locked": True, "open": False},
        "2": {"door": True, "open": False, "rooms": ["a", "b"]},
        "3": {"open": True, "rooms": ["a", "c"]},
        "4": {"open": True, "rooms": ["c", "g"]},
        "5": {"door": True, "open": True, "rooms": ["d", "e"]},
        "6": {"open": True, "rooms": ["b", "e"]},
        "7": {"open": True, "rooms": ["g", "d"]}
    },

    "rooms": {
        "a": {},
        "b": {},
        "c": {},
        "d": {},
        "e": {},
        "g": {}
    },

    "entities": [
        {"_id": "hero", "is_hero": True, "level": "0", "room": "a"},
        {"_id": "monster1", "is_hero": False, "level": "0", "room": "d"},
    ]
}


@app.route('/listen_game')
def listen_game():
    game = Game(data=game_data)
    gevent.spawn(game.start)
    return Response(game.listen(),
                    mimetype='text/event-stream')


@app.route('/')
def get_client():
    return render_template('test_client.html')


@werkzeug.serving.run_with_reloader
def main():
    handler = logging.FileHandler('server.log')
    handler.setLevel(logging.DEBUG)
    app.logger.setLevel(logging.DEBUG)
    app.logger.addHandler(handler)
    http_server = WSGIServer(('127.0.0.1', 8001), app)
    http_server.serve_forever()


if __name__ == '__main__':
    main()
