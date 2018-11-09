
exports.up = (knex, Promise) => (async() =>  {
    /*
    CREATE TABLE `settings` (
        `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
        `key` varchar(255) CHARACTER SET ascii NOT NULL DEFAULT '',
        `value` text NOT NULL,
        PRIMARY KEY (`id`),
        UNIQUE KEY `key` (`key`)
        ) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4;
    */

    await knex.schema.createTable('settings', table => {
        table.increments('id').primary().notNullable();
        table.string('key', 128).notNullable().defaultTo('');
        table.text('value').notNullable();
    })
    .raw('ALTER TABLE `settings` ADD UNIQUE KEY `key` (`key`)')
})();

exports.down = (knex, Promise) => (async() =>  {
})();
