from mock import Mock, patch
import unittest

from entity import Hero, Monster


class HeroTestCase(unittest.TestCase):

    def setUp(self):
        self.level = Mock()
        self.level.get_entities.return_value = []
        self.room = Mock()
        self.enemy = Mock()

        self.hero = Hero("test", self.level, self.room,
                         speed=5.0, chance_to_hit=0.5, weapon_damage=3, healing=1,
                         max_health=100, health=100, ammo=10, morale=7)

    def test_hero_idle_if_nothing_to_do(self):
        self.hero.proceed()
        self.assertEqual(self.hero.state, "IDLE")

    def test_hero_leaves_room_if_has_path(self):
        with patch("time.time") as mock_time:
            mock_time.return_value = 0.  # set the time seen by the hero
            destination = Mock()
            self.hero._path.append(destination)
            self.hero.proceed()
            self.assertEqual(self.hero.state, "LEAVING_ROOM")
            self.assertEqual(self.hero._timeout, 100.0 / self.hero.speed)

    def test_hero_enters_next_room_if_has_path(self):
        with patch("time.time") as mock_time:
            mock_time.return_value = 0.  # set the time seen by the hero
            destination = Mock()
            self.hero._path.append(destination)
            self.hero.state = "LEAVING_ROOM"
            mock_time.return_value = t1 = 100 / self.hero.speed + 5.  # past the timeout
            self.hero.proceed()
            self.assertEqual(self.hero.state, "ENTERING_ROOM")
            self.assertEqual(self.hero.room, destination)
            self.assertFalse(self.hero._path)

    def test_hero_idle_after_entering_room(self):
        with patch("time.time") as mock_time:
            mock_time.return_value = 0.  # set the time seen by the hero
            destination = Mock()
            self.hero._path.append(destination)
            self.hero.state = "ENTERING_ROOM"
            mock_time.return_value = t1 = 100 / self.hero.speed + 5.  # past the timeout
            self.hero.proceed()
            self.assertEqual(self.hero.state, "IDLE")
            self.assertEqual(self.hero.room, destination)
