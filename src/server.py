#!/usr/bin/env python

import logging
from copy import deepcopy

import gevent
import gevent.monkey
from gevent.pywsgi import WSGIServer
gevent.monkey.patch_all()

import werkzeug.serving
from flask import Flask, request, Response, render_template, jsonify

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

games = {}


@app.route('/listen_game/<int:game_id>', methods = ['GET'])
def listen_game(game_id):
    if game_id in games:
        return Response(games[game_id].listen(),
                        mimetype='text/event-stream')


@app.route('/<int:game_id>')
def get_client(game_id):
    if game_id not in games:
        game = Game(data=deepcopy(game_data))
        games[game_id] = game
    #return render_template('test_client.html')
    return render_template('client.html', game_id=game_id)


@app.route('/<int:game_id>/door/<int:door_id>/toggle')
def toggle_door(game_id, door_id):
    if game_id in games:
        result = games[game_id].level.toggle_door(str(door_id))
        return jsonify(result=result)
    return False


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
