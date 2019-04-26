exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.createTable('set_owners', table => {
        table.integer('set').unsigned().notNullable().references('signal_sets.id').onDelete('CASCADE');
        table.integer('job').unsigned().notNullable().references('jobs.id');
        table.unique(['set','job']);
    });

})();

exports.down = (knex, Promise) => (async() =>  {
    await knex.schema.dropTable('set_owners');
})();
