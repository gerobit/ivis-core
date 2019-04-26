import numpy as np

def mean(arr):
    a = np.asarray(arr)
    return a.mean()

def run(es, array = None,   **kwargs):
    query = {
        'size': 10000,
        '_source': ["val_temperature_157"],
        'query': {
            'match_all': {}
        }
    }
    a = []
    res = es.search(index="signal_set_0e7e3464333100b6", doc_type="doc", body=query, scroll="1m")
    for doc in res['hits']['hits']:
        temp = doc["_source"]["val_temperature_157"]
        if temp is not None:
            a.append(temp)
    par = {}
    test_arr = np.ndarray(shape=(2, 2), dtype=float, order='F')
    par['array'] = test_arr
    par['mean'] = mean(test_arr)

    print(par['array'])
    print(par['mean'])
    return par
