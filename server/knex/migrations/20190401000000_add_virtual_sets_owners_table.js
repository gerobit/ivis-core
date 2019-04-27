exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.createTable('signal_sets_owners', table => {
        table.integer('set').unsigned().notNullable().references('signal_sets.id').onDelete('CASCADE');
        table.integer('job').unsigned().notNullable().references('jobs.id');
        table.unique(['set','job']);
    });

})();

exports.down = (knex, Promise) => (async() =>  {
    await knex.schema.dropTable('signal_sets_owners');
})();
