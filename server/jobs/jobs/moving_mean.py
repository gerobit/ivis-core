#from job import Job
import json

class Calculator:
    """Specifies API for stateful analytic job."""

    def push_next(self):
        pass

    def get_result(self):
        return []


class MovingMeanCalc:
    """Stateful moving mean calculator."""

    def __init__(self, array=[], pos_array=0, window_size=3):
        # Array with values currently used to calculate mean
        self.array = array
        # Position of oldest element in array
        self.pos_array = pos_array

        # All calculated mean values
        self.values = []
        self.mmean = 0
        self.val_counter = 0
        self.window_size = window_size

    def push_next(self, value):
        """Push next value in order and calculate new moving mean."""
        if value is None:
            return

        try:
            mean_bit = float(value)/self.window_size
        except ValueError:
            return

        # Init array with none values
        if self.val_counter == 0:
            self.array = ['?' for i in range(self.window_size)]

        # Until array is full of valid values, just keep adding
        if self.val_counter < self.window_size:
            self.array[self.val_counter] = mean_bit
            self.val_counter += 1
            self.mmean += mean_bit
        else:
            # New values to the newest position
            self.array[(self.pos_array + self.window_size - 1) % self.window_size] = mean_bit

            self.mmean -= self.array[self.pos_array]
            self.pos_array += 1

            self.mmean += mean_bit
            self.values.append(self.mmean)

        self.pos_array = self.pos_array % self.window_size

    def get_result(self):
        """Get all calculated moving means."""
        return self.values


class MovingMeanJob():
    """Job calculating moving mean of specified signal set"""

    def __init__(self, array=[], pos_array=0, window_size=3):
        self.calc = MovingMeanCalc(array, pos_array, window_size)
        pass

    def get_state(self):
        dic_to_save = {}
        dic_to_save["array"] = self.calc.array
        dic_to_save["pos_array"] = self.calc.pos_array
        dic_to_save["window_size"] = self.calc.window_size
        return dic_to_save

    def run(self, elasticsearch):
        query = {
            'size': 10000,
            '_source': ["val_temperature_157"],
            'query': {
                'match_all': {}
            }
        }
        res = elasticsearch.search(index="signal_set_0e7e3464333100b6", doc_type="doc", body=query, scroll="1m")
        for doc in res['hits']['hits']:
            self.calc.push_next(doc["_source"]["val_temperature_157"])

#        scrollId = res['_scroll_id']
#        elasticsearch.scroll(scroll_id=scrollId, scroll='1m')


def run(es, config):
    try:
        job = MovingMeanJob(**config)
    except KeyError:
        job = MovingMeanJob()
    job.run(es)
    return job.get_state()
