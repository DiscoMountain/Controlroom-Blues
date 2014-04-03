"""
A script to create a JSON representation of doors and rooms from an SVG.

 - Calculates connections by checking for overlapping rooms and doors.
 - Doors are scaled by 150% before this check.
 - Rooms that should be connected but have no door (e.g. corridor sections)
   must overlap.

Usage:
   python graph_map.py map.svg output.json

Requires https://github.com/cjlano/svg.
"""

from itertools import product
import json

import svg


def expand_bbox(bbox, factor):
    (left, top), (right, bottom) = bbox
    width = right - left
    height = bottom - top
    dx = width * (factor - 1)
    dy = height * (factor - 1)
    return (left - dx/2, top - dy/2), (right + dx/2, bottom + dy/2)


def get_bboxes(items):
    doors = [d.bbox() for d in items]
    return doors


def get_room_bboxes(s):
    rooms = [d.bbox() for d in s.items[0].items[1].items]


def get_bbox(node):
    topleft, botright = node.bbox()
    left, top = topleft.x, topleft.y
    right, bottom = botright.x, botright.y
    return (left, top), (right, bottom)


def check_overlap(bbox1, bbox2):
    (left1, top1), (right1, bottom1) = bbox1
    (left2, top2), (right2, bottom2) = bbox2
    if any((right1 <= left2, left1 >= right2, bottom1 <= top2, top1 >= bottom2)):
       return None
    overlap = (max(left1, left2), max(top1, top2)), (min(right1, right2), min(bottom1, bottom2))
    return overlap


def find_door_connections(doors, rooms):
    connections = {}
    for door in doors:
        bbox = get_bbox(door)
        expanded_door = expand_bbox(bbox, 2)
        connected_rooms = []
        for room in rooms:
            if check_overlap(expanded_door, get_bbox(room)):
                print "door", door.id, "overlap", room.id
                connected_rooms.append(room.id)
        if len(connected_rooms) == 2:
            connections[door.id] = (connected_rooms, make_rect(bbox))
    return connections


def find_room_connections(rooms):
    bboxes = [get_bbox(r) for r in rooms]
    overlaps = {}
    zipped = zip(rooms, bboxes)
    for (room1, bbox1), (room2, bbox2) in product(zipped, zipped):
        if room1 == room2:
            continue
        overlap = check_overlap(bbox1, bbox2)
        if overlap:
            low, high = sorted((room1.id, room2.id))
            key = "%s-%s" % (low, high)
            if key not in overlaps:
                overlaps[key] = ((low, high), make_rect(overlap))
    return overlaps


def make_rect(((left, top), (right, bottom))):
    return {"x": left, "y": top, "width": right - left, "height": bottom - top}


if __name__ == "__main__":

    import sys
    svg_file = sys.argv[1]
    s = svg.parse(svg_file)

    rooms = s.items[0].items[0].items[0].items
    doors = s.items[0].items[0].items[2].items

    connections = find_door_connections(doors, rooms)
    print >>sys.stderr, "Doors:", len(doors)
    print >>sys.stderr, "Connected doors:", len(connections)

    overlaps = find_room_connections(rooms)
    print >>sys.stderr, "Overlapping rooms:", len(overlaps)

    data = {}
    data["rooms"] = {r.id: {} for r in rooms}
    data["connections"] = {c: {"door": True, "locked": False,
                               "open": False, "rooms": r, "rect": b}
                           for c, (r, b) in connections.items()}
    for c, (r, b) in overlaps.items():
        data["connections"][c] = {"door": False, "locked": False,
                                  "open": False, "rooms": r, "rect": b}

    with open(sys.argv[2], "w") as f:
        f.write(json.dumps(data, indent=4))
