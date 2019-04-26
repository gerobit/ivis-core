from elasticsearch import Elasticsearch
from elasticsearch import exceptions
import sys
import importlib
import importlib.util
import datetime
from timeit import default_timer as timer
import logging.config
import yaml
import os
import shutil
import argparse
import json
import pathlib

# Mapping types will be completely removed in Elasticsearch 7.0.0.
# Used with a query this parameter forces ES to ignore types.
# It seems that there is no direct support for this parameter in ES python api.
#TYPE_DEL = 'include_type_name=false'

INDEX_JOBS = 'jobs'
TYPE_JOBS = 'doc'
JOBS_DIR = 'jobs'
logger = None

ES_HOST = 'localhost'
ES_PORT = 9200

CONFIG_FIELD = 'config'


def setup_logging(default_path='logging.yaml', default_level=logging.INFO, env_key='LOG_CFG'):
    """Setup logging configuration"""
    path = default_path
    value = os.getenv(env_key, None)
    if value:
        path = value
    if os.path.exists(path):
        with open(path, 'rt') as f:
            config = yaml.safe_load(f.read())
        logging.config.dictConfig(config)
    else:
        logging.basicConfig(level=default_level)


def load_job(id):
    """Load job module with specified name from job folder."""
    pckg = JOBS_DIR + '.' + id
    try:
        return importlib.import_module('.job', package=pckg)
    except ImportError:
        logger.error('Code for job "%s" not found or couldn\'t be parsed.', id)
        return None


def load_job_config(elasticsearch, job_id):
    """Try to load previous state from ES; if fails return empty dictionary"""
    job_config = {}
    # Load previous state from database
    try:
        job_config = elasticsearch.get(index=INDEX_JOBS, doc_type=TYPE_JOBS, id=job_id, filter_path=['_source'])
        job_config = job_config['_source'][CONFIG_FIELD]
    except exceptions.NotFoundError:
        # Doesn't differentiate between missing job and missing index
        logger.info('Config for job with name %s not found.', job_id)
    except KeyError:
        logger.info('Config for job with name %s not found.', job_id)
    return job_config


def init_indices(es):
    """Create job index if it doesn't exists and set correct mapping for job config"""
    if not es.indices.exists(INDEX_JOBS):
        settings = {
            "mappings": {
                TYPE_JOBS: {
                    "properties": {
                        CONFIG_FIELD: {
                            "type": "object",
                            "enabled": False
                        }
                    }
                }
            }
        }
        # create index
        es.indices.create(index=INDEX_JOBS, ignore=400,  body=settings)


def run(job_id):
    """Run job with specified id"""
    logger.info('Processing request for job "%s"', job_id)

    es = Elasticsearch([{'host': ES_HOST, 'port': ES_PORT}])
    init_indices(es)

    # Get chosen job and run
    job_module = load_job(job_id)
    if job_module is None:
        exit()
    job_config = load_job_config(es, job_id)

    # Get start time before running
    last_run = datetime.datetime.utcnow()
    logger.info('Running job with name %s .', job_id)

    start = timer()
    new_config = job_module.run(es, job_config)
    end = timer()
    elapsed = end - start
    logger.info('Job with name %s finished in %s s.', job_id, elapsed)

    job_body = {}
    job_body['last_run'] = last_run

    # Store config if required
    if new_config is not None:
        job_body[CONFIG_FIELD] = new_config

    try:
        es.index(index=INDEX_JOBS, doc_type=TYPE_JOBS, id=job_id, body=job_body)
    except exceptions.SerializationError:
        logger.warn('Input from module not in valid format, couldn\'t be stored')


def clear_dir(dir):
    """Remove content of the specified dir"""
    # Remove all files from dir
    for the_file in os.listdir(dir):
        file_path = os.path.join(dir, the_file)
        try:
            if os.path.isfile(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        # TODO find proper exceptions
        except Exception as e:
            logger.info('Directory cleaning failed %s', id)


def create(id, spec):
    """Create job with specified id"""
    job_dir = os.path.join(JOBS_DIR, id)
    pathlib.Path(job_dir).mkdir(parents=True, exist_ok=True)

    clear_dir(job_dir)

    with open(os.path.join(job_dir, 'job.py'), 'w') as f:
        f.write(spec['code'])

    with open(os.path.join(job_dir, '__init__.py'), 'w') as f:
        pass

    logger.info('Create file for job %s', id)
    logger.info('Create file for job %s', spec['code'])

def delete(id):
    """Delete job with specified id"""
    job_dir = os.path.join(JOBS_DIR, id)
    shutil.rmtree(job_dir)

    es = Elasticsearch([{'host': ES_HOST, 'port': ES_PORT}])
    es.delete(index=INDEX_JOBS, doc_type=TYPE_JOBS, id=id)


def main():
    setup_logging()
    global logger
    logger = logging.getLogger(__name__)

    parser = argparse.ArgumentParser(description='Job handling script')
    parser.add_argument("-c", "--create", action='store_true',
                        help="create job with chosen id, expects json from stdin")
    parser.add_argument("-d", "--delete", action='store_true',
                        help="delete job with chosen id")
    parser.add_argument('id',
                        help='id of the job')
    args = parser.parse_args()

    if args.create:
        spec = json.load(sys.stdin)
        create(args.id, spec)

    elif args.delete:
        delete(args.id)
    else:
        run(args.id)

    # if len(args) < 2:
    #    logger.error('Job id missing: use %s job_id', args.id)
    #    exit()


if __name__ == '__main__':
    main()
