
exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.createTable('template_files', table => {
        table.increments('id').primary();
        table.integer('template').unsigned().notNullable().references('templates.id').onDelete('CASCADE');
        table.string('filename');
        table.string('originalname');
        table.string('mimetype');
        table.string('encoding');
        table.integer('size');
        table.timestamp('created').defaultTo(knex.fn.now());
    })
    .raw('ALTER TABLE `template_files` ADD KEY `originalname` (`template`,`originalname`)');
})();

exports.down = (knex, Promise) => (async() =>  {
})();
