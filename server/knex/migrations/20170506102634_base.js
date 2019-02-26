const {getGlobalNamespaceId} = require("../../../shared/namespaces");

const shareableEntityTypes = ['namespace', 'template', 'workspace', 'panel', 'signal', 'signal_set'];

exports.up = (knex, Promise) => (async() => {
    await knex.raw('SET FOREIGN_KEY_CHECKS=0');

    // Namespaces
    await knex.schema.createTable('namespaces', table => {
        table.increments('id').primary();
        table.string('name');
        table.text('description');
        table.integer('namespace').unsigned().references('namespaces.id');
    });

    await knex('namespaces').insert({
        id: getGlobalNamespaceId(),
        name: 'Root',
        description: 'Root namespace'
    });


    // Users
    await knex.schema.createTable('users', table => {
        table.increments('id').primary();
        table.string('username').notNullable();
        table.string('name');
        table.string('password');
        table.string('email').notNullable();
        table.string('access_token', 40).index();
        table.string('reset_token').index();
        table.dateTime('reset_expire');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.string('role');
        table.integer('namespace').unsigned().notNullable().references('namespaces.id');
    })

    // INNODB tables have the limit of 767 bytes for an index.
    // Combined with the charset used, this poses limits on the size of keys. Knex does not offer API
    // for such settings, thus we resort to raw queries.
    .raw('ALTER TABLE `users` MODIFY `email` VARCHAR(255) CHARACTER SET utf8 NOT NULL')
    .raw('ALTER TABLE `users` ADD UNIQUE KEY `email` (`email`)')
    .raw('ALTER TABLE `users` ADD KEY `username` (`username`(191))')
    .raw('ALTER TABLE `users` ADD KEY `check_reset` (`username`(191),`reset_token`,`reset_expire`)');

    await knex('users').insert({
        id: 1,
        username: 'admin',
        password: '$2a$10$mzKU71G62evnGB2PvQA4k..Wf9jASk.c7a8zRMHh6qQVjYJ2r/g/K',
        email: 'admin@example.org',
        name: 'Administrator',
        namespace: 1
    });


    // Templates
    await knex.schema.createTable('templates', table => {
        table.increments('id').primary();
        table.string('name');
        table.text('description');
        table.string('type').index();
        table.text('settings', 'longtext');
        table.integer('state'); /* enum TemplateState*/
        table.text('output', 'longtext');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.integer('namespace').unsigned().notNullable().references('namespaces.id');
    });

    // Workspaces & panels
    await knex.schema.createTable('workspaces', table => {
        table.increments('id').primary();
        table.string('name');
        table.text('description');
        table.integer('order');
        table.integer('default_panel').unsigned().references('panels.id').onDelete('SET NULL');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.integer('namespace').unsigned().notNullable().references('namespaces.id');
    });

    await knex.schema.createTable('panels', table => {
        table.increments('id').primary();
        table.integer('workspace').unsigned().notNullable().index();
        table.string('name');
        table.text('description');
        table.integer('order');
        table.integer('template').unsigned().notNullable().index();
        table.text('params', 'longtext');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.integer('namespace').unsigned().notNullable().references('namespaces.id');
    });

    // Signals
    await knex.schema.createTable('signal_sets', table => {
        table.increments('id').primary();
        table.string('cid').unique().collate('utf8_general_ci');
        table.string('name');
        table.text('description');
        table.boolean('aggs').notNullable();
        table.text('indexing', 'longtext').notNullable();
        table.timestamp('created').defaultTo(knex.fn.now());
        table.integer('namespace').unsigned().notNullable().references('namespaces.id');
    });

    await knex.schema.createTable('signals', table => {
        table.increments('id').primary();
        table.string('cid').collate('utf8_general_ci'); // Unique in signal_set
        table.string('name');
        table.text('description');
        table.string('type').notNullable();
        table.text('settings', 'longtext');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.integer('set').unsigned().notNullable().references('signal_sets.id');
        table.integer('namespace').unsigned().notNullable().references('namespaces.id');
        table.unique(['cid', 'set']);
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
    /* The global share for admin is set automatically in rebuildPermissions, which is called upon every start */

    await knex.schema
        .createTable('generated_role_names', table => {
            table.string('entity_type', 32).notNullable();
            table.string('role', 128).notNullable();
            table.string('name');
            table.string('description');
            table.primary(['entity_type', 'role']);
        });
    /* The generated_role_names table is repopulated in regenerateRoleNamesTable, which is called upon every start */

    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();

exports.down = (knex, Promise) => (async() => {
})();