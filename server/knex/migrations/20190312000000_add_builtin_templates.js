exports.up = (knex, Promise) => (async() =>  {
    await knex.schema.table('panels', table => {
        table.string('builtin_template');
        table.integer('template').unsigned().alter();
    });
})();

exports.down = (knex, Promise) => (async() =>  {
})();
