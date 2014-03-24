"""Simple implementation of a state machine.

A StateMachine has at least one possible State, of which it occupies
exactly one at any given time.

A State is characterized by a name, and zero or more exits. If it has
no exits, it is an "end state". After reaching an end state the
StateMachine can do nothing more.

An Exit represents a possible transition from one State to another
State. It can have a conditional (a function evaluating to something
truthy or falsey) which is used to determine if it can be taken.

> A = State("A")
> A.add_exit("B", lambda: x > 1)
> A.add_exit("C", action=do_something)
> B = State("B")
> C = State("C")
> sm = StateMachine([A, B, C])

The StateMachine can also be described using fancy, "chained" syntax:

> sm = StateMachine("ABC")
> sm.A.when(lambda: x > 1).goto(sm.B)
> sm.A.goto(sm.C).action(do_something)

The StateMachine works as an iterator, so looping over it (or calling
"next" on it) will attempt to advance it to a new state if
possible. This is done by going through the list of exits in the order
they were defined, and evaluating their conditionals if any. It takes
the first exit where the conditional evaluates to True or is None.

> for state in sm:
>     print "I am now in state %s" % state
> next(sm)
--> Raises StopIteration exception

The "proceed" method can be used to run the StateMachine as far as
possible at the moment. It will return True if it reaches an end
state.

> if proceed(sm):
>     print "I am done!"

> while not sm.finished:
>     time.sleep(1)
>     sm.proceed()

The StateMachine can be given functions to run on each state
transition and upon reaching an end state. States and Exits can
also have actions attached.

"""

from collections import OrderedDict
import time


def maybe(fun, *args, **kwargs):
    return fun and fun(*args, **kwargs)


def state_name(state):
    return state.name if isinstance(state, State) else state


class Exit(object):

    def __init__(self, dest=None, cond=None, action=None, *args, **kwargs):
        self.cond = cond
        self.dest = state_name(dest)
        self.action = action and (lambda: action(*args, **kwargs))

    def when(self, cond):
        self.cond = cond
        return self

    def goto(self, dest):
        self.dest = state_name(dest)
        return self

    def do(self, action):
        self.action = action
        return self


class State(object):

    def __init__(self, name, exits=None, action=None, *args, **kwargs):
        self.name = name
        self.exits = exits or []
        self.action = action and (lambda: action(*args, **kwargs))

    def when(self, cond):
        ex = Exit(cond=cond)
        self.exits.append(ex)
        return ex

    def goto(self, dest):
        ex = Exit(dest=state_name(dest))
        self.exits.append(ex)
        return ex

    def add_exit(self, dest, cond=None, action=None):
        ex = Exit(state_name(dest), cond, action)
        self.exits.append(ex)
        return self

    def set_action(self, action, *args, **kwargs):
        self.action = action and (lambda: action(*args, **kwargs))
        return self


class StateMachine(object):

    def __init__(self, states=None, start=None,
                 on_state_change=None, on_end_state=None):
        if not states:
            raise ValueError("A StateMachine needs at least one State")
        states = [s if isinstance(s, State) else State(s)
                  for s in states]
        self._states = OrderedDict((state.name, state)
                                   for state in states)
        self.start = start or states[0].name
        self._state = self._states[self.start]

        self.on_state_change = on_state_change
        self.on_end_state = on_end_state

        self.history = OrderedDict([(self.start, time.time())])

    def __getitem__(self, state):
        if state in self._states:
            return self._states[state]
        else:
            raise AttributeError(state)

    def __getattr__(self, state):
        return self[state]

    def __iter__(self):
        return self

    def __next__(self):
        return self.next()

    @property
    def state(self):
        return self._state.name

    @state.setter
    def state(self, new_state):
        if new_state != self.state:
            maybe(self.on_state_change, self.state, new_state)
            self._state = self[new_state]
            maybe(self._state.action)
            self.history[self.state] = time.time()
        else:
            maybe(self._state.recurring_action)

    @property
    def finished(self):
        return not self._state.exits

    def next(self):
        "Proceed to the first allowed exit state, if any."
        if not self._state.exits:  # end state
            maybe(self.on_end_state)
        for ex in self._state.exits:
            if not ex.cond or ex.cond():
                maybe(ex.action)
                self.state = ex.dest
                return self.state
        raise StopIteration

    def proceed(self):
        "Try to proceed until there are no currently allowed exits."
        changed = False
        for _ in self:
            changed = True
        return changed
