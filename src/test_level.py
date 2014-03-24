import unittest

from level import Level, Room, Connection


ROOM_A = Room("A", [])
ROOM_B = Room("B", [])
ROOM_C = Room("C", [])
ROOM_D = Room("D", [])
ROOM_E = Room("E", [])

DOOR_1 = Connection("1", opened=True, rooms=["A", "B"])
DOOR_2 = Connection("2", opened=True, rooms=["B", "C"])
DOOR_3 = Connection("3", opened=True, rooms=["A", "C"])
DOOR_4 = Connection("4", opened=True, rooms=["A", "D"])
DOOR_5 = Connection("5", opened=False, rooms=["B", "D"])


class LevelTestCase(unittest.TestCase):

    def setUp(self):

        self.level = Level(
            rooms=[ROOM_A, ROOM_B, ROOM_C, ROOM_D, ROOM_E],
            connections=[DOOR_1, DOOR_2, DOOR_3, DOOR_4]
        )

    def test_get_connected_rooms(self):
        expected = set([(ROOM_A, DOOR_3), (ROOM_B, DOOR_2)])
        conn = self.level.get_connected_rooms(ROOM_C)
        self.assertItemsEqual(conn, expected)

    def test_get_connected_rooms_after_closing_door(self):
        expected = set([(ROOM_A, DOOR_3), (ROOM_B, DOOR_2)])
        conn = self.level.get_connected_rooms(ROOM_C)
        self.assertItemsEqual(conn, expected)

    #@unittest.skip("")
    def test_get_shortest_path(self):
        expected = [(ROOM_A, DOOR_1, 1), (ROOM_D, DOOR_4, 1)]
        path = self.level.get_shortest_path(ROOM_B, ROOM_D)
        self.assertListEqual(path, expected)
