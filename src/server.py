#!/usr/bin/env python

from copy import deepcopy
import json
import logging
from random import choice

import gevent
import gevent.monkey
from gevent.pywsgi import WSGIServer
gevent.monkey.patch_all()

import werkzeug.serving
from flask import (Flask, request, Response, render_template, jsonify,
                   send_from_directory)

from game import Game, GameDataEncoder


app = Flask(__name__)
app.json_encoder = GameDataEncoder


with open("src/data/map2.json") as f:
    game_data = json.load(f)

game_data["_id"] = "dksaoko2"

game_data["entities"] = [
    {"_id": "hero", "is_hero": True, "level": "0",
     "room": game_data["start_room"]},
    {"_id": "monster1", "is_hero": False, "level": "0",
     "room": choice(game_data["rooms"].keys())},
]

games = {}


@app.route('/listen_game/<int:game_id>', methods=['GET'])
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


@app.route('/<int:game_id>/map')
def get_map(game_id):
    print game_id
    map_file = games[game_id].data["map_file"]
    return send_from_directory(app.static_folder + "/graphics", map_file)


@app.route('/<int:game_id>/door/<door_id>/toggle')
def toggle_door(game_id, door_id):
    if game_id in games:
        result = games[game_id].level.toggle_door(door_id)
        return jsonify(result=result)
    return False


@app.route('/<int:game_id>/entity/<entity_id>/move/<room_id>')
def move_hero(game_id, entity_id, room_id):
    if game_id in games:
        level = games[game_id].level
        entity = level.entities[entity_id]
        room = level.rooms[room_id]
        success = entity.set_destination(level, room)
        return jsonify(result=success)
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
