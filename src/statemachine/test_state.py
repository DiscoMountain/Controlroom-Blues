from collections import OrderedDict

from unittest import TestCase
from mock import Mock

from state import StateMachine, State


class StateMachineTestCase(TestCase):

    def setUp(self):
        self.states = OrderedDict((name, State(name)) for name in "ABCDEFGH")
        self.truecond = Mock()
        self.truecond.return_value = True
        self.falsecond = Mock()
        self.falsecond.return_value = False

    def test_reached_end_state(self):
        """Raises StopIteration on reaching an end state."""
        sm = StateMachine([self.states["A"]])
        self.assertRaises(StopIteration, sm.__next__)

    def test_reached_end_state_with_callback(self):
        """Reaching an end state fires the callback."""
        callback = Mock()
        sm = StateMachine([self.states["A"]], start="A",
                          on_end_state=callback)
        self.assertRaises(StopIteration, sm.__next__)
        callback.assert_called_with()

    def test_state_transition(self):
        """Next moves the SM to the appropriate state."""
        sm = StateMachine("AB")
        sm["A"].add_exit("B")
        self.assertTrue(next(sm), "B")

    def test_state_transition_performs_state_action(self):
        "Actions defined on states are performed when "
        sm = StateMachine("AB")
        action = Mock()
        sm["A"].add_exit("B")
        sm["B"].set_action(action)
        self.assertTrue(next(sm), "B")
        action.assert_called_with()

    def test_state_transition_exit_priority(self):
        """Exits are taken in order of appearance."""
        sm = StateMachine("AB")
        for st in self.states.keys()[1:]:
            sm["A"].add_exit(st)
        self.assertEqual(next(sm), "B")

    def test_state_transition_with_condition(self):
        """Conditions are evaluated to choose exit."""
        other_test = Mock()
        sm = StateMachine("ABCD")
        sm.A.add_exit("B", self.falsecond)\
            .add_exit("C", self.truecond)\
            .add_exit("D", other_test)
        self.assertEqual(next(sm), "C")
        self.assertRaises(sm.__next__)
        self.assertEquals(sm.state, "C")
        self.truecond.assert_called_with()
        self.falsecond.assert_called_with()
        self.assertEqual(other_test.call_count, 0)

    def test_proceed(self):
        "Proceed steps through all states and then returns True"
        sm = StateMachine("ABCGH")
        sm.A.add_exit(sm.C)
        sm.C.add_exit(sm.G)
        sm.G.add_exit(sm.B)
        sm.B.add_exit(sm.H)
        self.assertTrue(sm.proceed())
        self.assertEquals(sm.history.keys(), list("ACGBH"))

    def test_proceed_while_allowed(self):
        "Proceed returns False reaching a state with no allowed exits."
        sm = StateMachine("ABCGH")
        sm["A"].add_exit("C")
        sm["C"].add_exit("G", self.truecond)
        sm["G"].add_exit("B", self.falsecond)
        sm["B"].add_exit("H")
        self.assertFalse(sm.proceed())
        self.assertEquals(sm.history.keys(), list("ACG"))

    def test_callback_on_transition(self):
        "Callback is being run on state change."
        on_state_change = Mock()
        sm = StateMachine("AB", on_state_change=on_state_change)
        sm.A.add_exit("B", None)
        next(sm)
        on_state_change.assert_called_with("A", "B")

    def test_calls_action_on_transition(self):
        "Action is run on state exit."
        action = Mock()
        sm = StateMachine("AB")
        sm.A.add_exit("B", None, action)
        next(sm)
        action.assert_called_with()

    def test_chained_syntax(self):
        "States can be defined using chainable calls."
        sm = StateMachine("ABCD")
        action = Mock()
        state_action = Mock()
        sm.A.when(self.truecond).do(action).goto(sm.B)
        sm.A.when(self.falsecond).goto(sm.D)
        sm.B.set_action(state_action).when(self.truecond).goto(sm.C)

        sm.proceed()
        self.assertEquals(sm.state, "C")
        action.assert_called_with()
        state_action.assert_called_with()
