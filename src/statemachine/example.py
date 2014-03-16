import time

from state import StateMachine


sm = StateMachine("ABC")


def work_B():
    time.sleep(1)
    print "Work C is done"

sm.A.goto(sm.B)
sm.C.set_action(work_B)
sm.B.goto(sm.C)

list(sm)

# for state in sm:
#     print "Now in state %s" % state
