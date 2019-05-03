
exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.createTable('settings', table => {
        table.increments('id').primary().notNullable();
        table.string('key', 128).notNullable().defaultTo('');
        table.text('value', 'longtext').notNullable();
    })
    .raw('ALTER TABLE `settings` ADD UNIQUE KEY `key` (`key`)')
})();

exports.down = (knex, Promise) => (async() =>  {
})();
