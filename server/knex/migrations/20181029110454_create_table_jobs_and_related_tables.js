const JOBS_TABLE = 'jobs';
const TASKS_TABLE = 'tasks';
const TASKS_FILES_TABLE = 'files_task_file';
const JOB_ENTITY = 'job';
const TASK_ENTITY = 'task';
const JOB_RUNS = 'job_runs';
const JOB_TRIGGERS = 'job_triggers';

const shareableEntityTypes = [JOB_ENTITY, TASK_ENTITY];

exports.up = (knex, Promise) => (async () => {
    await knex.raw('SET FOREIGN_KEY_CHECKS=0');


    await knex.schema.createTable(TASKS_TABLE, table => {
        table.increments('id').primary();
        table.string('name');
        table.text('description');
        table.string('type').index();
        table.text('settings', 'longtext');
        table.integer('build_state'); /*enum BuildState for tasks*/
        table.text('build_output', 'longtext');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.integer('namespace').unsigned().notNullable().references('namespaces.id');
    });

    await knex.schema.createTable(JOBS_TABLE, table => {
        table.increments('id').primary();
        table.string('name');
        table.text('description');
        table.text('params', 'longtext');
        table.integer('task').unsigned().notNullable().index();
        table.integer('state'); /* enum JobState*/

        // in seconds
        table.integer('trigger');
        // Minimum time gap between runs
        table.integer('min_gap');
        // How long to wait after receiving trigger
        table.integer('delay');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.integer('namespace').unsigned().notNullable().references('namespaces.id');

    });

    await knex.schema.createTable(JOB_TRIGGERS, table => {
        table.integer('job').unsigned().notNullable().references('jobs.id').onDelete('CASCADE').index();
        table.integer('signal_set').unsigned().notNullable().references('signal_sets.id').onDelete('CASCADE').index();
        table.primary(['job', 'signal_set']);
    });

    // Job runs
    await knex.schema.createTable(JOB_RUNS, table => {
        table.increments('id').primary();
        table.integer('job').unsigned().notNullable().references('jobs.id').onDelete('CASCADE').index();
        table.timestamp('started_at').defaultTo(null);
        table.timestamp('finished_at').defaultTo(null);
        table.integer('status'); /* enum RunStatus*/
        table.text('output', 'longtext');
    });

    // Permissions
    for (const entityType of shareableEntityTypes) {
        await knex.schema
            .createTable(`shares_${entityType}`, table => {
                table.integer('entity').unsigned().notNullable().references(`${entityType}s.id`).onDelete('CASCADE');
                table.integer('user').unsigned().notNullable().references('users.id').onDelete('CASCADE');
                table.string('role', 128).notNullable();
                table.boolean('auto').defaultTo(false);
                table.primary(['entity', 'user']);
            })
            .createTable(`permissions_${entityType}`, table => {
                table.integer('entity').unsigned().notNullable().references(`${entityType}s.id`).onDelete('CASCADE');
                table.integer('user').unsigned().notNullable().references('users.id').onDelete('CASCADE');
                table.string('operation', 128).notNullable();
                table.primary(['entity', 'user', 'operation']);
            });
    }

    await knex.schema.createTable(TASKS_FILES_TABLE, table => {
        table.increments('id').primary();
        table.integer('entity').unsigned().notNullable().references('tasks.id').onDelete('CASCADE');
        table.string('filename');
        table.string('originalname');
        table.string('mimetype');
        table.integer('size');
        table.timestamp('created').defaultTo(knex.fn.now());
    })
        .raw('ALTER TABLE `files_task_file` ADD KEY `originalname` (`entity`,`originalname`)');

    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();

exports.down = (knex, Promise) => (async () => {
    await knex.schema.dropTable(JOB_RUNS);
    await knex.schema.dropTable(JOB_TRIGGERS);
    await knex.schema.dropTable(TASKS_FILES_TABLE);
    for (const entityType of shareableEntityTypes) {
        await knex.schema.dropTable(`shares_${entityType}`);
        await knex.schema.dropTable(`permissions_${entityType}`);
    }
    await knex.schema.dropTable(JOBS_TABLE);
})();
