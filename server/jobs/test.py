from abc import ABCA
import numpy

class A(ABC):

    def __init__(self, **kwargs):
        print("A")
        pass

    def hi(self):
        print("hi")


class B(A):

    def __init__(self, test = "test", **kwargs):
        print("B")

dic = {"tst": "t"}

t = B(**dic)
t.hi()
