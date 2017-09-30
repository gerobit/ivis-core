const shareableEntityTypes = ['namespace', 'template', 'workspace', 'panel', 'signal', 'signal_group'];

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
        id: 1, /* Global namespace id */
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
        table.json('settings');
        table.integer('state'); /* enum TemplateState*/
        table.json('output');
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
        table.json('params');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.integer('namespace').unsigned().notNullable().references('namespaces.id');
    });

    await knex.schema.createTable('panel_tokens', table => {
        table.increments('id').primary();
        table.string('token', 40).index();
        table.integer('panel').unsigned().references('panels.id').onDelete('CASCADE');
        table.integer('user').unsigned().references('users.id').onDelete('CASCADE');
        table.timestamp('created').defaultTo(knex.fn.now()).index();
    });


    // Signals
    await knex.schema.createTable('signals', table => {
        table.increments('id').primary();
        table.string('cid').unique().collate('utf8_general_ci');
        table.string('name');
        table.text('description');
        table.boolean('has_agg').notNullable();
        table.boolean('has_val').notNullable();
        table.timestamp('created').defaultTo(knex.fn.now());
        table.integer('namespace').unsigned().notNullable().references('namespaces.id');
    });

    await knex.schema.createTable('signal_groups', table => {
        table.increments('id').primary();
        table.string('name');
        table.text('description');
        table.timestamp('created').defaultTo(knex.fn.now());
        table.integer('namespace').unsigned().notNullable().references('namespaces.id');
    });

    await knex.schema.createTable('signal_group_mapping', table => {
        table.integer('signal').unsigned().notNullable().references('signals.id').onDelete('CASCADE');
        table.integer('group').unsigned().notNullable().references('signal_groups.id').onDelete('CASCADE');
        table.primary(['signal', 'group']);
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
    /* The generate_role_names table is repopulated in regenerateRoleNamesTable, which is called upon every start */

    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();

exports.down = (knex, Promise) => (async() => {
    await knex.raw('SET FOREIGN_KEY_CHECKS=0');

    for (const entityType of shareableEntityTypes) {
        await knex.schema
            .dropTable(`shares_${entityType}`)
            .dropTable(`permissions_${entityType}`);
    }

    await knex.schema.dropTable('signal_group_mapping');
    await knex.schema.dropTable('signal_groups');
    await knex.schema.dropTable('signals');

    await knex.schema.dropTable('panel_tokens');
    await knex.schema.dropTable('panels');
    await knex.schema.dropTable('workspaces');

    await knex.schema.dropTable('templates');

    await knex.schema.dropTable('users');

    await knex.schema.dropTable('namespaces');

    await knex.raw('SET FOREIGN_KEY_CHECKS=1');
})();